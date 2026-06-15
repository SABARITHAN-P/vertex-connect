const Chat = require("../../models/Chat");
const User = require("../../models/User");
const Message = require("../../models/Message");
const cloudinary = require("../../config/cloudinary");
const streamifier = require("streamifier");
const { getIO } = require("../../sockets/socket");
const crypto = require("crypto");
const Block = require("../../models/Block");
const Follow = require("../../models/Follow");
const PrivacySettings = require("../../models/PrivacySettings");
const { invalidateChatsCache: invalidateChatsCacheUser, invalidateChatsCacheForChat } = require("../../utils/cacheHelper");

/* =========================================================
   CLOUDINARY AVATAR UPLOAD UTILITY
========================================================= */
const uploadGroupAvatarToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "vertex-connect/group-avatars",
        resource_type: "image",
        width: 500,
        height: 500,
        crop: "fill",
        quality: "auto",
        fetch_format: "auto",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(file.buffer).pipe(stream);
  });
};

/* =========================================================
   CHECK GROUP ADDITION PERMISSION
========================================================= */
const checkGroupAdditionPermission = async (adminId, targetUserId) => {
  try {
    // 1. Block check
    const blockExists = await Block.findOne({
      $or: [
        { blocker: adminId, blocked: targetUserId },
        { blocker: targetUserId, blocked: adminId },
      ],
    });
    if (blockExists) {
      return { allowed: false, message: "Cannot add user due to blocking." };
    }

    // 2. Fetch target user's group addition privacy settings
    let settings = await PrivacySettings.findOne({ user: targetUserId });
    if (!settings) {
      settings = await PrivacySettings.create({ user: targetUserId });
    }

    // If Everyone: Allowed
    if (settings.groupsPermission === "everyone") {
      return { allowed: true };
    }

    // Follow states (must be accepted!)
    const targetFollowsAdmin = await Follow.findOne({ follower: targetUserId, following: adminId, status: "accepted" });
    const adminFollowsTarget = await Follow.findOne({ follower: adminId, following: targetUserId, status: "accepted" });
    const isMutual = !!(targetFollowsAdmin && adminFollowsTarget);

    // If Followers only: Target must follow Admin
    if (settings.groupsPermission === "followers") {
      if (!targetFollowsAdmin) {
        return { allowed: false, message: "User's privacy settings only allow their followers to add them to groups." };
      }
    }

    // If Mutual followers only: Must follow each other mutually
    if (settings.groupsPermission === "mutual") {
      if (!isMutual) {
        return { allowed: false, message: "User's privacy settings only allow their mutual followers to add them to groups." };
      }
    }

    return { allowed: true };
  } catch (err) {
    console.error("Group permission check error:", err);
    return { allowed: false, message: "Server permission check failed." };
  }
};

/* =========================================================
   CREATE SYSTEM MESSAGE UTILITY HELPER
========================================================= */
const createSystemMessage = async (chatId, senderId, content) => {
  try {
    const newMessage = await Message.create({
      chat: chatId,
      sender: senderId,
      messageType: "text",
      content: content,
      isSystem: true,
      reactions: [],
      messageStatus: [],
    });

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "username email avatar")
      .populate("chat")
      .lean();

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: populatedMessage._id,
    });

    const io = getIO();
    const chat = await Chat.findById(chatId).select("participants roles isGroupChat").lean();
    if (chat && chat.participants) {
      chat.participants.forEach((participant) => {
        if (chat.isGroupChat && chat.roles) {
          const partRole = chat.roles.find(r => r.user.toString() === participant.toString());
          if (partRole && partRole.role === "left") {
            return;
          }
        }
        io.to(participant.toString()).emit("newMessage", populatedMessage);
      });
    }
    return populatedMessage;
  } catch (error) {
    console.error("Error creating system message:", error);
  }
};

/* =========================================================
   1-ON-1 CHAT ACCESS OR ACCESS CREATION
========================================================= */
const accessChat = async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUserId = req.user.id;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    /* EXISTING CHAT */
    let chat = await Chat.findOne({
      isGroupChat: false,
      participants: { $all: [currentUserId, userId] },
    })
      .populate("participants", "-password")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "username email avatar" },
      })
      .populate({
        path: "pinnedMessages",
        populate: { path: "sender", select: "username avatar" }
      });

    const { redactUserPrivacy } = require("../../utils/privacyHelper");

    if (chat) {
      const chatObj = chat.toObject ? chat.toObject() : chat;
      if (chatObj.participants) {
        chatObj.participants = await Promise.all(
          chatObj.participants.map(p => redactUserPrivacy(req.user._id, p))
        );
      }
      // Nullify lastMessage if it was created before the user cleared the chat
      if (chatObj.lastMessage && chatObj.clearedBy) {
        const userIdStr = req.user._id.toString();
        const clearedEntry = chatObj.clearedBy.find((c) => c.user.toString() === userIdStr);
        if (clearedEntry) {
          const lastMsgDate = new Date(chatObj.lastMessage.createdAt);
          const clearedDate = new Date(clearedEntry.clearedAt);
          if (lastMsgDate <= clearedDate) {
            chatObj.lastMessage = null;
          }
        }
      }
      return res.status(200).json(chatObj);
    }

    /* CREATE NEW 1-ON-1 CHAT */
    chat = await Chat.create({
      participants: [currentUserId, userId],
    });

    // Invalidate chats cache for both participants
    await invalidateChatsCacheUser(currentUserId);
    await invalidateChatsCacheUser(userId);

    chat = await Chat.findById(chat._id).populate("participants", "-password");
    const chatObj = chat.toObject ? chat.toObject() : chat;
    if (chatObj.participants) {
      chatObj.participants = await Promise.all(
        chatObj.participants.map(p => redactUserPrivacy(req.user._id, p))
      );
    }
    res.status(201).json(chatObj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

const redisClient = require("../../config/redis");

/* =========================================================
   INVALIDATE CHATS CACHE HELPER FOR ALL PARTICIPANTS
   ========================================================= */
const invalidateChatsCache = invalidateChatsCacheForChat;

/* =========================================================
   GET ALL USER CHATS
========================================================= */
const getChats = async (req, res) => {
  try {
    const cacheKey = `user:chats_populated:${req.user._id}`;
    let chats = [];
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      chats = JSON.parse(cachedData);
    } else {
      chats = await Chat.find({
        participants: { $elemMatch: { $eq: req.user._id } },
      })
        .populate("participants", "-password")
        .populate("creator", "username avatar")
        .populate("roles.user", "username email avatar")
        .populate({
          path: "lastMessage",
          populate: { path: "sender", select: "username email avatar" },
        })
        .populate({
          path: "pinnedMessages",
          populate: { path: "sender", select: "username avatar" }
        })
        .sort({ updatedAt: -1 });

      await redisClient.set(cacheKey, JSON.stringify(chats), {
        EX: 3600, // 1 hour expiration
      });
    }

    const chatIds = chats.map((c) => c._id);
    const io = getIO();

    // 1. Automatically mark all undelivered messages in these chats as delivered
    const undeliveredMessages = await Message.find({
      chat: { $in: chatIds },
      sender: { $ne: req.user._id },
      deletedFor: { $ne: req.user._id },
      $or: [
        { "messageStatus.user": { $ne: req.user._id } },
        {
          messageStatus: {
            $elemMatch: {
              user: req.user._id,
              delivered: { $ne: true }
            }
          }
        }
      ]
    });

    if (undeliveredMessages.length > 0) {
      for (const msg of undeliveredMessages) {
        // Atomic update to mark as delivered only if not already present
        const updatedMsg = await Message.findOneAndUpdate(
          {
            _id: msg._id,
            "messageStatus.user": { $ne: req.user._id }
          },
          {
            $push: {
              messageStatus: {
                user: req.user._id,
                delivered: true,
                deliveredAt: new Date()
              }
            }
          },
          { new: true }
        );

        if (updatedMsg) {
          // Emit update in real-time to the sender of the message
          io.to(updatedMsg.sender.toString()).emit("messageStatusUpdated", {
            _id: updatedMsg._id,
            messageStatus: updatedMsg.messageStatus,
          });
        }
      }
    }

    // 2. Count unread messages for each chat using indexed Unread collection
    const Unread = require("../../models/Unread");
    const unreads = await Unread.find({ userId: req.user._id });
    const unreadMap = new Map(unreads.map((u) => [u.chatId.toString(), u.unreadCount]));

    // Filter chats based on WhatsApp-style per-user deletion, archive, and lock states
    const visibleChats = chats.filter((c) => {
      const userIdStr = req.user._id.toString();

      // 1. Deletion isolation
      const deletedEntry = c.deletedBy?.find((d) => d.user.toString() === userIdStr);
      if (deletedEntry) {
        if (!c.lastMessage) return false;
        const lastMsgObj = typeof c.lastMessage === "object" ? c.lastMessage : null;
        const lastMessageTime = lastMsgObj ? new Date(lastMsgObj.createdAt) : new Date(c.updatedAt);
        if (lastMessageTime <= new Date(deletedEntry.deletedAt)) {
          return false; // Hidden due to deletion
        }
      }

      // 2. Archive isolation
      const isArchived = c.archivedBy?.some((a) => a.user.toString() === userIdStr);
      // 3. Lock isolation
      const isLocked = c.lockedBy?.some((l) => l.user.toString() === userIdStr);

      if (req.query.archived === "true") {
        return isArchived;
      }
      if (req.query.locked === "true") {
        return isLocked;
      }

      // Default sidebar list: hide archived and locked chats
      return !isArchived && !isLocked;
    });

    const chatsWithUnread = visibleChats.map((chatObj) => {
      const chat = typeof chatObj.toObject === "function" ? chatObj.toObject() : chatObj;
      chat.unreadCount = unreadMap.get(chat._id.toString()) || 0;

      // Nullify lastMessage if it was created before the user cleared the chat
      if (chat.lastMessage && chat.clearedBy) {
        const userIdStr = req.user._id.toString();
        const clearedEntry = chat.clearedBy.find((c) => c.user.toString() === userIdStr);
        if (clearedEntry) {
          const lastMsgDate = new Date(chat.lastMessage.createdAt);
          const clearedDate = new Date(clearedEntry.clearedAt);
          if (lastMsgDate <= clearedDate) {
            chat.lastMessage = null;
          }
        }
      }

      return chat;
    });

    const { redactUserPrivacy } = require("../../utils/privacyHelper");
    const sanitizedChats = await Promise.all(
      chatsWithUnread.map(async (chat) => {
        if (chat.participants) {
          chat.participants = await Promise.all(
            chat.participants.map((p) => redactUserPrivacy(req.user._id, p))
          );
        }
        return chat;
      })
    );

    res.status(200).json(sanitizedChats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch chats" });
  }
};

/* =========================================================
   CREATE GROUP CHAT
========================================================= */
const createGroupChat = async (req, res) => {
  try {
    const { chatName, groupDescription, participants, groupAvatar } = req.body;

    if (!chatName || !chatName.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ message: "At least one participant is required" });
    }

    // Include the creator in the participants list
    const allParticipants = [...new Set([...participants, req.user.id])];

    // Validate that creator has permission to add other participants
    for (const pId of participants) {
      if (pId.toString() === req.user._id.toString()) continue;
      const permCheck = await checkGroupAdditionPermission(req.user._id, pId);
      if (!permCheck.allowed) {
        const failedUser = await User.findById(pId).select("username").lean();
        return res.status(403).json({
          message: `Cannot add ${failedUser?.username || "user"} due to their group privacy settings.`
        });
      }
    }

    // Build the roles array (Creator is owner, others are members)
    const roles = allParticipants.map((userId) => ({
      user: userId,
      role: userId.toString() === req.user.id.toString() ? "owner" : "member",
      joinedAt: new Date(),
    }));

    const inviteCode = crypto.randomBytes(6).toString("hex");

    // Upload base64 avatar to Cloudinary if provided
    let finalAvatarUrl = "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=150&h=150&q=80";
    if (groupAvatar) {
      if (groupAvatar.startsWith("data:image/")) {
        const uploadResult = await cloudinary.uploader.upload(groupAvatar, {
          folder: "vertex-connect/group-avatars",
          resource_type: "image",
          width: 500,
          height: 500,
          crop: "fill",
          gravity: "center",
          quality: "auto",
          fetch_format: "auto",
        });
        finalAvatarUrl = uploadResult.secure_url;
      } else {
        finalAvatarUrl = groupAvatar;
      }
    }

    const groupChat = await Chat.create({
      chatName: chatName.trim(),
      groupDescription: groupDescription || "",
      isGroupChat: true,
      participants: allParticipants,
      groupAdmin: req.user._id,
      creator: req.user._id,
      inviteCode,
      roles,
      groupAvatar: finalAvatarUrl,
    });

    // Invalidate chats cache for all group participants
    for (const participantId of allParticipants) {
      await invalidateChatsCacheUser(participantId);
    }

    const populatedGroup = await Chat.findById(groupChat._id)
      .populate("participants", "-password")
      .populate("creator", "username avatar")
      .populate("roles.user", "username email avatar");

    const io = getIO();
    allParticipants.forEach((userId) => {
      io.to(userId.toString()).emit("groupCreated", populatedGroup);
    });

    res.status(201).json(populatedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create group chat" });
  }
};

/* =========================================================
   UPDATE GROUP DETAILS
========================================================= */
const updateGroupInfo = async (req, res) => {
  try {
    const { chatId, chatName, groupDescription } = req.body;

    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Validate permission based on rules
    const userRoleObj = chat.roles.find((r) => r.user.toString() === req.user.id.toString());
    const userRole = userRoleObj ? userRoleObj.role : "member";

    const ruleVal = chat.rules?.editGroupInfo || "everyone";
    let isAllowed = false;
    if (userRole === "owner") {
      isAllowed = true;
    } else if (ruleVal === "everyone") {
      isAllowed = true;
    } else if (ruleVal === "admins" && userRole === "admin") {
      isAllowed = true;
    }

    if (!isAllowed) {
      return res.status(403).json({ message: "You do not have permission to update group details based on active rules" });
    }

    const userObj = await User.findById(req.user.id);
    const username = userObj.username;

    if (chatName && chatName.trim() && chatName.trim() !== chat.chatName) {
      const oldName = chat.chatName;
      chat.chatName = chatName.trim();
      await createSystemMessage(chat._id, req.user.id, `${username} changed the group name from "${oldName}" to "${chatName.trim()}"`);
    }

    if (groupDescription !== undefined && groupDescription.trim() !== chat.groupDescription) {
      chat.groupDescription = groupDescription.trim();
      await createSystemMessage(chat._id, req.user.id, `${username} changed the group description to "${groupDescription.trim()}"`);
    }

    await chat.save();

    const updatedChat = await Chat.findById(chat._id)
      .populate("participants", "-password")
      .populate("creator", "username avatar")
      .populate("roles.user", "username email avatar");

    const io = getIO();
    chat.participants.forEach((userId) => {
      io.to(userId.toString()).emit("groupUpdated", updatedChat);
    });

    res.status(200).json(updatedChat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update group information" });
  }
};

const updateGroupAvatar = async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No avatar image provided" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Validate permission based on rules
    const userRoleObj = chat.roles.find((r) => r.user.toString() === req.user.id.toString());
    const userRole = userRoleObj ? userRoleObj.role : "member";

    const ruleVal = chat.rules?.editProfilePhoto || "everyone";
    let isAllowed = false;
    if (userRole === "owner") {
      isAllowed = true;
    } else if (ruleVal === "everyone") {
      isAllowed = true;
    } else if (ruleVal === "admins" && userRole === "admin") {
      isAllowed = true;
    }

    if (!isAllowed) {
      return res.status(403).json({ message: "You do not have permission to change group photo based on active rules" });
    }

    const avatarUrl = await uploadGroupAvatarToCloudinary(req.file);
    chat.groupAvatar = avatarUrl;
    await chat.save();

    const updatedChat = await Chat.findById(chat._id)
      .populate("participants", "-password")
      .populate("creator", "username avatar")
      .populate("roles.user", "username email avatar");

    // System Message
    const userObj = await User.findById(req.user.id);
    await createSystemMessage(chat._id, req.user.id, `${userObj.username} changed the group profile photo`);

    const io = getIO();
    io.emit("group:profile-updated", {
      chatId: chat._id,
      groupAvatar: avatarUrl,
      chatName: chat.chatName,
    });

    chat.participants.forEach((userId) => {
      io.to(userId.toString()).emit("groupUpdated", updatedChat);
    });

    res.status(200).json(updatedChat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to upload group avatar" });
  }
};

const removeGroupAvatar = async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Validate permission based on rules
    const userRoleObj = chat.roles.find((r) => r.user.toString() === req.user.id.toString());
    const userRole = userRoleObj ? userRoleObj.role : "member";

    const ruleVal = chat.rules?.editProfilePhoto || "everyone";
    let isAllowed = false;
    if (userRole === "owner") {
      isAllowed = true;
    } else if (ruleVal === "everyone") {
      isAllowed = true;
    } else if (ruleVal === "admins" && userRole === "admin") {
      isAllowed = true;
    }

    if (!isAllowed) {
      return res.status(403).json({ message: "You do not have permission to change group photo based on active rules" });
    }

    chat.groupAvatar = "";
    await chat.save();

    const updatedChat = await Chat.findById(chat._id)
      .populate("participants", "-password")
      .populate("creator", "username avatar")
      .populate("roles.user", "username email avatar");

    // System Message
    const userObj = await User.findById(req.user.id);
    await createSystemMessage(chat._id, req.user.id, `${userObj.username} removed the group profile photo`);

    const io = getIO();
    io.emit("group:profile-updated", {
      chatId: chat._id,
      groupAvatar: "",
      chatName: chat.chatName,
    });

    chat.participants.forEach((userId) => {
      io.to(userId.toString()).emit("groupUpdated", updatedChat);
    });

    res.status(200).json(updatedChat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to remove group avatar" });
  }
};

/* =========================================================
   ADD PARTICIPANTS TO GROUP
========================================================= */
const addToGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({ message: "Chat ID and User ID are required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Validate permission based on rules
    const requesterRole = chat.roles.find((r) => r.user.toString() === req.user.id.toString());
    const userRole = requesterRole ? requesterRole.role : "member";

    const ruleVal = chat.rules?.addMembers || "everyone";
    let isAllowed = false;
    if (userRole === "owner") {
      isAllowed = true;
    } else if (ruleVal === "everyone") {
      isAllowed = true;
    } else if (ruleVal === "admins" && userRole === "admin") {
      isAllowed = true;
    }

    if (!isAllowed) {
      return res.status(403).json({ message: "You do not have permission to add members based on active rules" });
    }

    // Validate follow addition permission
    const permCheck = await checkGroupAdditionPermission(req.user.id, userId);
    if (!permCheck.allowed) {
      return res.status(403).json({ message: permCheck.message });
    }

    // Prevent duplicate entries or handle previously left users
    const existingRoleIndex = chat.roles.findIndex((r) => r.user.toString() === userId.toString());

    if (existingRoleIndex !== -1) {
      const existingRole = chat.roles[existingRoleIndex];
      if (existingRole.role !== "left") {
        return res.status(400).json({ message: "User is already in the group" });
      }
      existingRole.role = "member";
      existingRole.joinedAt = new Date();
      existingRole.leftAt = undefined;

      if (!chat.participants.some((p) => p.toString() === userId.toString())) {
        chat.participants.push(userId);
      }
    } else {
      chat.participants.push(userId);
      chat.roles.push({ user: userId, role: "member", joinedAt: new Date() });
    }

    await chat.save();

    const updatedChat = await Chat.findById(chat._id)
      .populate("participants", "-password")
      .populate("creator", "username avatar")
      .populate("roles.user", "username email avatar");

    // Create System Message
    const addedUser = await User.findById(userId);
    const adderUser = await User.findById(req.user.id);
    const systemMessageContent = `${addedUser.username} was added by ${adderUser.username}`;
    await createSystemMessage(chat._id, req.user.id, systemMessageContent);

    const io = getIO();
    updatedChat.participants.forEach((p) => {
      io.to(p._id.toString()).emit("groupUpdated", updatedChat);
    });

    res.status(200).json(updatedChat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add member" });
  }
};

/* =========================================================
   REMOVE PARTICIPANT (KICK)
========================================================= */
const removeFromGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({ message: "Chat ID and User ID are required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Group not found" });
    }

    const requesterRole = chat.roles.find((r) => r.user.toString() === req.user.id.toString());
    if (!requesterRole || (requesterRole.role !== "admin" && requesterRole.role !== "owner")) {
      return res.status(403).json({ message: "Only administrators can kick members" });
    }

    // Prevent kicking the owner
    const targetRole = chat.roles.find((r) => r.user.toString() === userId.toString());
    if (targetRole && targetRole.role === "owner") {
      return res.status(400).json({ message: "Group owner cannot be kicked" });
    }

    if (targetRole) {
      targetRole.role = "left";
      targetRole.leftAt = new Date();
    }
    await chat.save();

    // Delete persistent unread tracking for the kicked participant
    const Unread = require("../../models/Unread");
    await Unread.deleteOne({ userId, chatId });

    const updatedChat = await Chat.findById(chat._id)
      .populate("participants", "-password")
      .populate("creator", "username avatar")
      .populate("roles.user", "username email avatar");

    // Create System Message
    const kickedUser = await User.findById(userId);
    const kickerUser = await User.findById(req.user.id);
    const systemMessageContent = `${kickedUser.username} was removed by ${kickerUser.username}`;
    await createSystemMessage(chat._id, req.user.id, systemMessageContent);

    const io = getIO();
    // Notify the kicked user they were kicked
    io.to(userId.toString()).emit("groupKicked", { chatId });

    updatedChat.participants.forEach((p) => {
      io.to(p._id.toString()).emit("groupUpdated", updatedChat);
    });

    res.status(200).json(updatedChat);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to kick member" });
  }
};

/* =========================================================
   LEAVE GROUP (SELF-LEAVE)
========================================================= */
const leaveGroup = async (req, res) => {
  try {
    const { chatId, deleteChat } = req.body;

    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Group not found" });
    }

    const userRoleObj = chat.roles.find((r) => r.user.toString() === req.user.id.toString());

    // If the user has ALREADY left/been kicked (their role is "left") OR they requested deleteChat,
    // this acts as a "Delete Chat" request, removing them from participants completely!
    if (deleteChat || (userRoleObj && userRoleObj.role === "left")) {
      const isOwner = userRoleObj && userRoleObj.role === "owner";
      let promotedUser = null;

      // Handle leader promotion if they were the owner and we are deleting
      if (isOwner) {
        const activeMembers = chat.roles.filter((r) => r.role !== "left" && r.user.toString() !== req.user.id.toString());
        if (activeMembers.length > 0) {
          const oldestMember = activeMembers[0];
          oldestMember.role = "owner";
          chat.groupAdmin = oldestMember.user;
          promotedUser = await User.findById(oldestMember.user);
        } else {
          chat.groupAdmin = undefined;
        }
      }

      // Create a leaving system message before they are removed
      const leavingUser = await User.findById(req.user.id);
      if (userRoleObj && userRoleObj.role !== "left") {
        await createSystemMessage(chat._id, req.user.id, `${leavingUser.username} left the group`);
        if (promotedUser) {
          await createSystemMessage(chat._id, req.user.id, `${promotedUser.username} is now the Group Leader`);
        }
      }

      // Remove from participants and roles!
      chat.participants = chat.participants.filter((p) => p.toString() !== req.user.id.toString());
      chat.roles = chat.roles.filter((r) => r.user.toString() !== req.user.id.toString());

      await chat.save();

      // Delete persistent unread tracking for the leaving participant
      const Unread = require("../../models/Unread");
      await Unread.deleteOne({ userId: req.user.id, chatId });

      const io = getIO();
      io.to(req.user.id.toString()).emit("groupLeft", { chatId });

      const updatedChat = await Chat.findById(chat._id)
        .populate("participants", "-password")
        .populate("creator", "username avatar")
        .populate("roles.user", "username email avatar");

      if (updatedChat) {
        updatedChat.participants.forEach((p) => {
          io.to(p._id.toString()).emit("groupUpdated", updatedChat);
        });
      }

      return res.status(200).json({ message: "Successfully exited and deleted group chat" });
    }

    const isOwner = userRoleObj && userRoleObj.role === "owner";

    // Mark as left instead of removing from participants to preserve sidebar history
    if (userRoleObj) {
      userRoleObj.role = "left";
      userRoleObj.leftAt = new Date();
    }

    let promotedUser = null;
    if (isOwner) {
      // Find the oldest active participant (whose role is not "left" and is not current user)
      const activeMembers = chat.roles.filter((r) => r.role !== "left" && r.user.toString() !== req.user.id.toString());
      if (activeMembers.length > 0) {
        const oldestMember = activeMembers[0];
        oldestMember.role = "owner";
        chat.groupAdmin = oldestMember.user;
        promotedUser = await User.findById(oldestMember.user);
      } else {
        chat.groupAdmin = undefined;
      }
    }

    await chat.save();

    // Delete persistent unread tracking for the leaving participant
    const Unread = require("../../models/Unread");
    await Unread.deleteOne({ userId: req.user.id, chatId });


    const updatedChat = await Chat.findById(chat._id)
      .populate("participants", "-password")
      .populate("creator", "username avatar")
      .populate("roles.user", "username email avatar");

    // Post leaving system message
    const leavingUser = await User.findById(req.user.id);
    await createSystemMessage(chat._id, req.user.id, `${leavingUser.username} left the group`);

    // If owner leaves and someone is promoted, post promotion system message
    if (promotedUser) {
      await createSystemMessage(chat._id, req.user.id, `${promotedUser.username} is now the Group Leader`);
    }

    const io = getIO();
    io.to(req.user.id.toString()).emit("groupLeft", { chatId });

    if (updatedChat) {
      updatedChat.participants.forEach((p) => {
        io.to(p._id.toString()).emit("groupUpdated", updatedChat);
      });
    }

    res.status(200).json({ message: "Successfully left the group" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to leave group" });
  }
};

/* =========================================================
   UPDATE MEMBER ROLE
========================================================= */
const updateMemberRole = async (req, res) => {
  try {
    const { chatId, userId, role } = req.body;

    if (!chatId || !userId || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!["admin", "member"].includes(role)) {
      return res.status(400).json({ message: "Invalid role value" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Only owner or admin can update roles
    const requesterRole = chat.roles.find((r) => r.user.toString() === req.user.id.toString());
    if (!requesterRole || (requesterRole.role !== "owner" && requesterRole.role !== "admin")) {
      return res.status(403).json({ message: "Only group administrators can promote or demote members" });
    }

    const memberRole = chat.roles.find((r) => r.user.toString() === userId.toString());
    if (!memberRole) {
      return res.status(404).json({ message: "User is not a participant of this group" });
    }

    // Prevent anyone from demoting or modifying the owner's role
    if (memberRole.role === "owner") {
      return res.status(400).json({ message: "Group owner's role cannot be updated" });
    }

    memberRole.role = role;
    await chat.save();

    const updatedChat = await Chat.findById(chat._id)
      .populate("participants", "-password")
      .populate("creator", "username avatar")
      .populate("roles.user", "username email avatar");

    const io = getIO();
    updatedChat.participants.forEach((p) => {
      io.to(p._id.toString()).emit("groupUpdated", updatedChat);
    });

    res.status(200).json(updatedChat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update member role" });
  }
};

/* =========================================================
   TRANSFER OWNERSHIP
========================================================= */
const transferOwnership = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({ message: "Chat ID and target User ID are required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Only current owner can transfer ownership
    const requesterRole = chat.roles.find((r) => r.user.toString() === req.user.id.toString());
    if (!requesterRole || requesterRole.role !== "owner") {
      return res.status(403).json({ message: "Only the owner can transfer ownership" });
    }

    const targetRole = chat.roles.find((r) => r.user.toString() === userId.toString());
    if (!targetRole) {
      return res.status(404).json({ message: "Target user is not in the group" });
    }

    // Perform transfer
    requesterRole.role = "admin";
    targetRole.role = "owner";
    chat.groupAdmin = userId; // update groupAdmin pointer
    await chat.save();

    const updatedChat = await Chat.findById(chat._id)
      .populate("participants", "-password")
      .populate("creator", "username avatar")
      .populate("roles.user", "username email avatar");

    const io = getIO();
    updatedChat.participants.forEach((p) => {
      io.to(p._id.toString()).emit("groupUpdated", updatedChat);
    });

    res.status(200).json(updatedChat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to transfer ownership" });
  }
};

/* =========================================================
   JOIN GROUP BY INVITE CODE
========================================================= */
const joinGroupByCode = async (req, res) => {
  try {
    const { inviteCode } = req.params;

    if (!inviteCode) {
      return res.status(400).json({ message: "Invite code is required" });
    }

    const chat = await Chat.findOne({ inviteCode, isGroupChat: true });
    if (!chat) {
      return res.status(404).json({ message: "Invalid or expired invite link" });
    }

    // Check if already in the group or if previously left
    const existingRoleIndex = chat.roles.findIndex((r) => r.user.toString() === req.user.id.toString());

    if (existingRoleIndex !== -1) {
      const existingRole = chat.roles[existingRoleIndex];
      if (existingRole.role !== "left") {
        return res.status(400).json({ message: "You are already a member of this group" });
      }
      existingRole.role = "member";
      existingRole.joinedAt = new Date();
      existingRole.leftAt = undefined;

      if (!chat.participants.some((p) => p.toString() === req.user.id.toString())) {
        chat.participants.push(req.user.id);
      }
    } else {
      chat.participants.push(req.user.id);
      chat.roles.push({ user: req.user.id, role: "member", joinedAt: new Date() });
    }

    await chat.save();

    const updatedChat = await Chat.findById(chat._id)
      .populate("participants", "-password")
      .populate("creator", "username avatar")
      .populate("roles.user", "username email avatar");

    const io = getIO();
    updatedChat.participants.forEach((p) => {
      io.to(p._id.toString()).emit("groupUpdated", updatedChat);
    });

    res.status(200).json(updatedChat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to join group by code" });
  }
};

/* =========================================================
   DELETE GROUP CHAT
========================================================= */
const deleteGroupChat = async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Verify requesting user is admin/owner
    const requesterRole = chat.roles.find((r) => r.user.toString() === req.user.id.toString());
    if (!requesterRole || (requesterRole.role !== "admin" && requesterRole.role !== "owner")) {
      return res.status(403).json({ message: "Only group administrators can delete this group" });
    }

    const io = getIO();
    chat.participants.forEach((p) => {
      io.to(p.toString()).emit("groupDeleted", { chatId });
    });

    // Delete all messages in the chat
    await Message.deleteMany({ chat: chatId });

    // Delete the chat itself
    await Chat.findByIdAndDelete(chatId);

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("Delete Group Error:", error);
    res.status(500).json({ message: "Failed to delete group" });
  }
};

/* =========================================================
   UPDATE GROUP RULES
========================================================= */
const updateGroupRules = async (req, res) => {
  try {
    const { chatId, editGroupInfo, editProfilePhoto, addMembers } = req.body;
    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if requester is Owner/Leader (rules can strictly only be modified by owner/leader)
    const requesterRole = chat.roles.find((r) => r.user.toString() === req.user.id.toString());
    if (!requesterRole || requesterRole.role !== "owner") {
      return res.status(403).json({ message: "Only the group leader can update group rules" });
    }

    // Update rules
    chat.rules = {
      editGroupInfo: editGroupInfo || chat.rules?.editGroupInfo || "everyone",
      editProfilePhoto: editProfilePhoto || chat.rules?.editProfilePhoto || "everyone",
      addMembers: addMembers || chat.rules?.addMembers || "everyone",
    };

    await chat.save();

    const updatedChat = await Chat.findById(chat._id)
      .populate("participants", "-password")
      .populate("creator", "username avatar")
      .populate("roles.user", "username email avatar");

    // Post rules update system message
    const leaderUser = await User.findById(req.user.id);
    const systemMessageContent = `${leaderUser.username} updated the group settings & rules`;
    await createSystemMessage(chat._id, req.user.id, systemMessageContent);

    const io = getIO();
    updatedChat.participants.forEach((p) => {
      io.to(p._id.toString()).emit("groupUpdated", updatedChat);
    });

    res.status(200).json(updatedChat);
  } catch (error) {
    console.error("Update Rules Error:", error);
    res.status(500).json({ message: "Failed to update group rules" });
  }
};

/* =========================================================
   DELETE CHAT FOR CURRENT USER (WhatsApp Style)
========================================================= */
const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === userId.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not a participant in this chat" });
    }

    // Update deletedBy array (push or update)
    const existingIndex = chat.deletedBy.findIndex(
      (d) => d.user.toString() === userId.toString()
    );

    if (existingIndex !== -1) {
      chat.deletedBy[existingIndex].deletedAt = new Date();
    } else {
      chat.deletedBy.push({
        user: userId,
        deletedAt: new Date(),
      });
    }

    await chat.save();

    // Clear unread counts for this user
    const Unread = require("../../models/Unread");
    await Unread.findOneAndUpdate(
      { userId, chatId },
      { unreadCount: 0 },
      { upsert: true, new: true }
    );

    // Invalidate Redis caches
    await invalidateChatsCache(chatId);

    // Emit real-time socket notification to the user's sessions
    const io = getIO();
    io.to(userId.toString()).emit(chat.isGroupChat ? "group:deleted" : "chat:deleted", {
      chatId: chat._id.toString(),
    });

    res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    console.error("Delete Chat Error:", error);
    res.status(500).json({ message: "Failed to delete chat" });
  }
};

/* =========================================================
   CLEAR CHAT FOR CURRENT USER (WhatsApp Style)
========================================================= */
const clearChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === userId.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not a participant in this chat" });
    }

    // Update clearedBy array
    const existingIndex = chat.clearedBy.findIndex(
      (c) => c.user.toString() === userId.toString()
    );

    if (existingIndex !== -1) {
      chat.clearedBy[existingIndex].clearedAt = new Date();
    } else {
      chat.clearedBy.push({
        user: userId,
        clearedAt: new Date(),
      });
    }

    await chat.save();

    // Clear unread counts for this user
    const Unread = require("../../models/Unread");
    await Unread.findOneAndUpdate(
      { userId, chatId },
      { unreadCount: 0 },
      { upsert: true, new: true }
    );

    // Invalidate Redis caches
    await invalidateChatsCache(chatId);

    // Emit real-time socket notification to the user's sessions
    const io = getIO();
    io.to(userId.toString()).emit("chat:cleared", {
      chatId: chat._id.toString(),
    });

    res.status(200).json({ message: "Chat cleared successfully" });
  } catch (error) {
    console.error("Clear Chat Error:", error);
    res.status(500).json({ message: "Failed to clear chat" });
  }
};

const toggleArchiveChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const existingIndex = chat.archivedBy.findIndex(
      (a) => a.user.toString() === userId.toString()
    );

    let isArchived = false;
    if (existingIndex !== -1) {
      chat.archivedBy.splice(existingIndex, 1);
    } else {
      chat.archivedBy.push({ user: userId, archivedAt: new Date() });
      isArchived = true;
    }

    await chat.save();
    await invalidateChatsCache(chatId);

    const io = getIO();
    io.to(userId.toString()).emit("chat:archived", {
      chatId,
      isArchived,
    });

    res.status(200).json({ message: isArchived ? "Chat archived" : "Chat unarchived", isArchived });
  } catch (error) {
    console.error("Toggle Archive Error:", error);
    res.status(500).json({ message: "Failed to toggle archive state" });
  }
};

const togglePinChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const existingIndex = chat.pinnedBy.findIndex(
      (p) => p.user.toString() === userId.toString()
    );

    let isPinned = false;
    if (existingIndex !== -1) {
      chat.pinnedBy.splice(existingIndex, 1);
    } else {
      const pinnedCount = await Chat.countDocuments({
        "pinnedBy.user": userId,
      });
      if (pinnedCount >= 3) {
        return res.status(400).json({ message: "You can only pin up to 3 chats" });
      }

      chat.pinnedBy.push({ user: userId, pinnedAt: new Date() });
      isPinned = true;
    }

    await chat.save();
    await invalidateChatsCache(chatId);

    const io = getIO();
    io.to(userId.toString()).emit("chat:pinned", {
      chatId,
      isPinned,
    });

    res.status(200).json({ message: isPinned ? "Chat pinned" : "Chat unpinned", isPinned });
  } catch (error) {
    console.error("Toggle Pin Error:", error);
    res.status(500).json({ message: "Failed to toggle pin state" });
  }
};

const lockChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { passcode } = req.body;
    const userId = req.user._id;

    if (!passcode || passcode.length < 4) {
      return res.status(400).json({ message: "Passcode must be at least 4 digits" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const bcrypt = require("bcrypt");
    const salt = await bcrypt.genSalt(10);
    const passcodeHash = await bcrypt.hash(passcode, salt);

    const existingIndex = chat.lockedBy.findIndex(
      (l) => l.user.toString() === userId.toString()
    );

    if (existingIndex !== -1) {
      chat.lockedBy[existingIndex].passcodeHash = passcodeHash;
      chat.lockedBy[existingIndex].lockedAt = new Date();
    } else {
      chat.lockedBy.push({ user: userId, passcodeHash, lockedAt: new Date() });
    }

    await chat.save();
    await invalidateChatsCache(chatId);

    const io = getIO();
    io.to(userId.toString()).emit("chat:locked", { chatId, isLocked: true });

    res.status(200).json({ message: "Chat locked successfully", isLocked: true });
  } catch (error) {
    console.error("Lock Chat Error:", error);
    res.status(500).json({ message: "Failed to lock chat" });
  }
};

const unlockChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { passcode } = req.body;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const lockEntry = chat.lockedBy.find(
      (l) => l.user.toString() === userId.toString()
    );

    if (!lockEntry) {
      return res.status(400).json({ message: "Chat is not locked for this user" });
    }

    const bcrypt = require("bcrypt");
    const isMatch = await bcrypt.compare(passcode, lockEntry.passcodeHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect passcode" });
    }

    chat.lockedBy = chat.lockedBy.filter(
      (l) => l.user.toString() !== userId.toString()
    );

    await chat.save();
    await invalidateChatsCache(chatId);

    const io = getIO();
    io.to(userId.toString()).emit("chat:unlocked", { chatId, isLocked: false });

    res.status(200).json({ message: "Chat unlocked successfully", isLocked: false });
  } catch (error) {
    console.error("Unlock Chat Error:", error);
    res.status(500).json({ message: "Failed to unlock chat" });
  }
};

const toggleMarkUnread = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const existingIndex = chat.markedUnreadBy.findIndex(
      (u) => u.user.toString() === userId.toString()
    );

    let isMarkedUnread = false;
    if (existingIndex !== -1) {
      chat.markedUnreadBy.splice(existingIndex, 1);
    } else {
      chat.markedUnreadBy.push({ user: userId, markedAt: new Date() });
      isMarkedUnread = true;
    }

    await chat.save();
    await invalidateChatsCache(chatId);

    const io = getIO();
    io.to(userId.toString()).emit("chat:marked-unread", {
      chatId,
      isMarkedUnread,
    });

    res.status(200).json({ message: isMarkedUnread ? "Marked as unread" : "Marked as read", isMarkedUnread });
  } catch (error) {
    console.error("Toggle Mark Unread Error:", error);
    res.status(500).json({ message: "Failed to toggle unread mark" });
  }
};

/* =========================================================
   GET CHAT PRIVILEGES / PERMISSIONS
========================================================= */
const getChatPermissions = async (req, res) => {
  try {
    const { chatId } = req.params;
    const currentUserId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (chat.isGroupChat) {
      // For groups, check if they have left
      const userRole = chat.roles?.find((r) => r.user.toString() === currentUserId.toString());
      if (userRole && userRole.role === "left") {
        return res.status(200).json({
          allowed: false,
          reason: "left_group",
          message: "You are no longer a participant in this group.",
        });
      }
      return res.status(200).json({ allowed: true });
    }

    // 1-to-1 chat:
    const otherUserId = chat.participants.find(
      (p) => p.toString() !== currentUserId.toString()
    );
    if (!otherUserId) {
      return res.status(200).json({ allowed: true });
    }

    // Block status
    const blockExists = await Block.findOne({
      $or: [
        { blocker: currentUserId, blocked: otherUserId },
        { blocker: otherUserId, blocked: currentUserId },
      ],
    });
    if (blockExists) {
      const blockerId = blockExists.blocker.toString();
      const isBlockedByMe = blockerId === currentUserId.toString();
      return res.status(200).json({
        allowed: false,
        reason: "blocked",
        isBlockedByMe,
        message: isBlockedByMe 
          ? "You have blocked this user. Unblock to message or call."
          : "You cannot message or call this user because you have been blocked.",
      });
    }

    const senderFollowsReceiver = await Follow.findOne({ follower: currentUserId, following: otherUserId, status: "accepted" });
    const receiverFollowsSender = await Follow.findOne({ follower: otherUserId, following: currentUserId, status: "accepted" });
    const isMutual = !!(senderFollowsReceiver && receiverFollowsSender);

    let receiverSettings = await PrivacySettings.findOne({ user: otherUserId });
    if (!receiverSettings) receiverSettings = await PrivacySettings.create({ user: otherUserId });

    let senderSettings = await PrivacySettings.findOne({ user: currentUserId });
    if (!senderSettings) senderSettings = await PrivacySettings.create({ user: currentUserId });

    if (receiverSettings.accountType === "private") {
      if (!isMutual) {
        return res.status(200).json({
          allowed: false,
          reason: "private_mutual_required",
          message: "You must follow each other mutually to message or call.",
        });
      }
    } else {
      if (receiverSettings.messagesPermission === "nobody") {
        return res.status(200).json({
          allowed: false,
          reason: "nobody",
          message: "This user has disabled messages and calls.",
        });
      }
      if (receiverSettings.messagesPermission === "followers" && !receiverFollowsSender) {
        return res.status(200).json({
          allowed: false,
          reason: "followers_only",
          message: "You must follow this user to message or call them.",
        });
      }
      if (receiverSettings.messagesPermission === "mutual" && !isMutual) {
        return res.status(200).json({
          allowed: false,
          reason: "mutual_only",
          message: "You must follow each other mutually to message or call.",
        });
      }

    }

    return res.status(200).json({ allowed: true });
  } catch (error) {
    console.error("Failed to get chat permissions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  accessChat,
  getChats,
  createGroupChat,
  updateGroupInfo,
  updateGroupAvatar,
  removeGroupAvatar,
  addToGroup,
  removeFromGroup,
  leaveGroup,
  updateMemberRole,
  transferOwnership,
  joinGroupByCode,
  deleteGroupChat,
  updateGroupRules,
  invalidateChatsCache,
  deleteChat,
  clearChat,
  toggleArchiveChat,
  togglePinChat,
  lockChat,
  unlockChat,
  toggleMarkUnread,
  getChatPermissions,
};
