const Message = require("../../models/Message");

const Chat = require("../../models/Chat");
const Follow = require("../../models/Follow");
const Block = require("../../models/Block");
const PrivacySettings = require("../../models/PrivacySettings");

const { getIO } = require("../../sockets/socket");
const Unread = require("../../models/Unread");
const socketHandler = require("../../sockets/socketHandler");
const redisClient = require("../../config/redis");
const { invalidateChatsCacheForChat } = require("../../utils/cacheHelper");

const invalidateChatsCache = invalidateChatsCacheForChat;

/* =========================================================
   CHECK MESSAGING PRIVILEGES
========================================================= */
const checkMessagingPrivileges = async (senderId, receiverId) => {
  try {
    // 1. Block check
    const blockExists = await Block.findOne({
      $or: [
        { blocker: senderId, blocked: receiverId },
        { blocker: receiverId, blocked: senderId },
      ],
    });
    if (blockExists) {
      return {
        allowed: false,
        reason: "blocked",
        message: "You cannot send messages due to a block relationship.",
      };
    }

    // 2. Follow relationships (must be accepted!)
    const senderFollowsReceiver = await Follow.findOne({ follower: senderId, following: receiverId, status: "accepted" });
    const receiverFollowsSender = await Follow.findOne({ follower: receiverId, following: senderId, status: "accepted" });
    const isMutual = !!(senderFollowsReceiver && receiverFollowsSender);

    // 3. Privacy Settings of Receiver
    let receiverSettings = await PrivacySettings.findOne({ user: receiverId });
    if (!receiverSettings) {
      receiverSettings = await PrivacySettings.create({ user: receiverId });
    }

    // 4. Privacy Settings of Sender
    let senderSettings = await PrivacySettings.findOne({ user: senderId });
    if (!senderSettings) {
      senderSettings = await PrivacySettings.create({ user: senderId });
    }

    // Private Account Rules:
    if (receiverSettings.accountType === "private") {
      if (!isMutual) {
        return {
          allowed: false,
          reason: "private_mutual_required",
          message: "You must follow each other mutually to send messages. 🔒",
        };
      }
    } else {
      // Public Account Rules:
      if (receiverSettings.messagesPermission === "nobody") {
        return {
          allowed: false,
          reason: "nobody",
          message: "This user has disabled direct messaging. 🔒",
        };
      }
      if (receiverSettings.messagesPermission === "followers" && !receiverFollowsSender) {
        return {
          allowed: false,
          reason: "followers_only",
          message: "You must follow this user to send them messages. 🔒",
        };
      }
      if (receiverSettings.messagesPermission === "mutual" && !isMutual) {
        return {
          allowed: false,
          reason: "mutual_only",
          message: "You must follow each other mutually to send messages. 🔒",
        };
      }

    }

    return { allowed: true };
  } catch (err) {
    console.error("Privilege check error:", err);
    return { allowed: false, reason: "error", message: "Server privilege check failed." };
  }
};



/* =========================================================
   SEND MESSAGE
========================================================= */

const sendMessage = async (req, res) => {
  try {
    const {
      chatId,

      content,

      caption,

      messageType,

      media,

      replyTo,

      poll,

      /* LEGACY SUPPORT */
      mediaUrl,
      fileName,
      fileSize,
      mimeType,
      thumbnailUrl,
      duration,
    } = req.body;

    if (!chatId) {
      return res.status(400).json({
        message: "Chat ID is required",
      });
    }

    const chatDetails = await Chat.findById(chatId);
    if (!chatDetails) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    if (chatDetails.isGroupChat) {
      const senderRole = chatDetails.roles.find((r) => r.user.toString() === req.user.id.toString());
      if (senderRole && senderRole.role === "left") {
        return res.status(403).json({
          message: "You are no longer a participant in this group",
        });
      }
    } else {
      // 1-to-1 follow & chat privacy check
      const otherUserId = chatDetails.participants.find(
        (p) => p.toString() !== req.user.id.toString()
      );
      if (otherUserId) {
        const privCheck = await checkMessagingPrivileges(req.user.id, otherUserId);
        if (!privCheck.allowed) {
          return res.status(403).json({
            blocked: true,
            privacyBlocked: true,
            reason: privCheck.reason,
            message: privCheck.message,
          });
        }
      }
    }

    /* =========================
       DETERMINE TYPE
    ========================== */

    let finalMessageType = messageType || "text";

    if (media && Array.isArray(media) && media.length > 0) {
      finalMessageType = media.length === 1 ? media[0].type : "media";
    }

    /* =========================
       CREATE MESSAGE
    ========================== */

    const newMessage = await Message.create({
      chat: chatId,

      sender: req.user.id,

      messageType: finalMessageType,

      /* TEXT */
      content: content || "",

      caption: caption || "",

      /* MULTI MEDIA */
      media: media || [],

      replyTo: replyTo || undefined,

      /* POLL */
      poll: poll || undefined,

      /* =========================
           LEGACY FIELDS
        ========================== */

      mediaUrl: mediaUrl || "",

      thumbnailUrl: thumbnailUrl || "",

      fileName: fileName || "",

      fileSize: fileSize || 0,

      mimeType: mimeType || "",

      duration: duration || 0,

      /* =========================
           META
        ========================== */

      reactions: [],

      messageStatus: [],
    });

    /* =========================
       POPULATE
    ========================== */

    let populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "username email avatar")
      .populate("chat")
      .populate("reactions.user", "username avatar")
      .populate("poll.options.votes", "username avatar")
      .lean();

    // Check if the original message of the reply is deleted
    if (populatedMessage.replyTo && populatedMessage.replyTo.messageId) {
      const origMsg = await Message.findById(populatedMessage.replyTo.messageId).select("isDeleted").lean();
      if (origMsg && origMsg.isDeleted) {
        populatedMessage.replyTo.text = "Original message deleted";
      }
    }

    /* =========================
       UPDATE LAST MESSAGE
    ========================== */

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: populatedMessage._id,
    });

    // Invalidate chats cache for all participants so the sidebar preview updates instantly
    await invalidateChatsCache(chatId);

    const io = getIO();

    /* =========================
       MANAGE UNREAD STATE & SEND TO PARTICIPANTS
    ========================== */

    // 1. Sender has read their own message
    await Unread.findOneAndUpdate(
      { userId: req.user.id, chatId },
      {
        unreadCount: 0,
        chatType: chatDetails.isGroupChat ? "group" : "private",
        lastReadMessageId: populatedMessage._id,
        lastReadAt: new Date()
      },
      { upsert: true }
    );

    // 2. Loop through participants to update unread states
    for (const participant of chatDetails.participants) {
      const participantIdStr = participant.toString();
      if (participantIdStr === req.user.id) continue;

      if (chatDetails.isGroupChat && chatDetails.roles) {
        const partRole = chatDetails.roles.find(r => r.user.toString() === participantIdStr);
        if (partRole && partRole.role === "left") {
          continue; // do not send or count for left participant
        }
      }

      // Check if participant is actively viewing this chat room right now
      const isViewing = await socketHandler.isUserInChat(participant, chatId, io);

      if (isViewing) {
        // Participant is actively in the chat - clear unread and record read
        await Unread.findOneAndUpdate(
          { userId: participant, chatId },
          {
            unreadCount: 0,
            chatType: chatDetails.isGroupChat ? "group" : "private",
            lastReadMessageId: populatedMessage._id,
            lastReadAt: new Date()
          },
          { upsert: true }
        );

        // Append to messageStatus to mark read immediately
        await Message.findByIdAndUpdate(newMessage._id, {
          $push: {
            messageStatus: {
              user: participant,
              status: "read",
              readAt: new Date()
            }
          }
        });

        // Sync clear event to all their tabs
        io.to(participantIdStr).emit(chatDetails.isGroupChat ? "group:read" : "chat:read", { chatId: chatId.toString() });
      } else {
        // Participant is NOT in this chat right now - increment unreadCount
        const unread = await Unread.findOneAndUpdate(
          { userId: participant, chatId },
          {
            $inc: { unreadCount: 1 },
            chatType: chatDetails.isGroupChat ? "group" : "private",
            lastReadMessageId: populatedMessage._id
          },
          { upsert: true, new: true }
        );

        // Emit real-time unreadCount update
        io.to(participantIdStr).emit(
          chatDetails.isGroupChat ? "group:unread-updated" : "chat:unread-updated",
          { chatId: chatId.toString(), unreadCount: unread.unreadCount }
        );
      }

      // Send newMessage, message:new, and group:new-message to notify all sessions/tabs
      io.to(participantIdStr).emit("newMessage", populatedMessage);
      io.to(participantIdStr).emit(chatDetails.isGroupChat ? "group:new-message" : "message:new", populatedMessage);
    }

    res.status(201).json(populatedMessage);

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

/* =========================================================
   FETCH MESSAGES
========================================================= */

const fetchMessages = async (req, res) => {
  try {
    const { chatId } = req.params;

    const page = parseInt(req.query.page) || 1;

    const limit = parseInt(req.query.limit) || 20;

    const skip = (page - 1) * limit;

    /* FETCH CHAT FOR GROUP RESTRICTIONS */
    const chat = await Chat.findById(chatId).lean();
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const lockEntry = chat.lockedBy?.find(
      (l) => l.user.toString() === req.user._id.toString()
    );
    if (lockEntry) {
      const clientPasscode = req.headers["x-lock-passcode"];
      if (!clientPasscode) {
        return res.status(403).json({ locked: true, message: "Chat is locked" });
      }
      const bcrypt = require("bcrypt");
      const isMatch = await bcrypt.compare(clientPasscode, lockEntry.passcodeHash);
      if (!isMatch) {
        return res.status(403).json({ locked: true, message: "Incorrect passcode" });
      }
    }

    const query = {
      chat: chatId,
      deletedFor: { $ne: req.user.id },
    };

    if (chat.isGroupChat && chat.roles) {
      const userRole = chat.roles.find((r) => r.user.toString() === req.user.id.toString());
      if (userRole) {
        query.createdAt = { $gte: userRole.joinedAt || chat.createdAt };
        if (userRole.role === "left" && userRole.leftAt) {
          query.createdAt.$lte = userRole.leftAt;
        }
      } else {
        query.createdAt = { $gte: chat.createdAt };
      }
    }

    // Apply user-specific deletion and clearance filters
    const deletedEntry = chat.deletedBy?.find((d) => d.user.toString() === req.user.id.toString());
    const clearedEntry = chat.clearedBy?.find((c) => c.user.toString() === req.user.id.toString());

    let minVisibleDate = null;
    if (deletedEntry) minVisibleDate = new Date(deletedEntry.deletedAt);
    if (clearedEntry) {
      const clearDate = new Date(clearedEntry.clearedAt);
      if (!minVisibleDate || clearDate > minVisibleDate) {
        minVisibleDate = clearDate;
      }
    }

    if (minVisibleDate) {
      if (query.createdAt) {
        query.createdAt.$gt = minVisibleDate;
      } else {
        query.createdAt = { $gt: minVisibleDate };
      }
    }

    /* TOTAL */

    const totalMessages = await Message.countDocuments(query);

    /* FETCH */

    const messages = await Message.find(query)
      .populate("sender", "username email avatar")
      .populate("reactions.user", "username avatar")
      .populate("poll.options.votes", "username avatar")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean();

    // Check if any replyTo target is deleted
    const replyToMsgIds = messages
      .filter((m) => m.replyTo && m.replyTo.messageId)
      .map((m) => m.replyTo.messageId);

    const deletedMsgs = await Message.find({
      _id: { $in: replyToMsgIds },
      isDeleted: true,
    }).select("_id").lean();

    const deletedSet = new Set(deletedMsgs.map((d) => d._id.toString()));

    const processedMessages = messages.map((m) => {
      if (m.replyTo && m.replyTo.messageId && deletedSet.has(m.replyTo.messageId.toString())) {
        return {
          ...m,
          replyTo: {
            ...m.replyTo,
            text: "Original message deleted",
          },
        };
      }
      return m;
    });

    const hasMore = totalMessages > skip + processedMessages.length;

    res.status(200).json({
      messages: processedMessages.reverse(),

      hasMore,

      currentPage: page,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

/* =========================================================
   MARK AS DELIVERED
========================================================= */

const markAsDelivered = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    // A message should never be marked as delivered for the sender!
    if (message.sender.toString() === req.user.id.toString()) {
      return res.status(200).json({
        success: true,
      });
    }

    // Atomic update: only push if user is NOT already in messageStatus
    const updated = await Message.findOneAndUpdate(
      {
        _id: messageId,
        "messageStatus.user": { $ne: req.user.id }
      },
      {
        $push: {
          messageStatus: {
            user: req.user.id,
            delivered: true,
            deliveredAt: new Date()
          }
        }
      },
      { new: true }
    );

    if (updated) {
      const io = getIO();
      io.to(updated.sender.toString()).emit("messageStatusUpdated", {
        _id: updated._id,
        messageStatus: updated.messageStatus,
      });
    }

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server Error",
    });
  }
};

/* =========================================================
   MARK AS READ
========================================================= */

const markAsRead = async (req, res) => {
  try {
    const chatId = req.params.chatId;

    // 1. Update existing status entries where the user is already present but read is not true
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: req.user.id },
        "messageStatus.user": req.user.id,
        "messageStatus.read": { $ne: true }
      },
      {
        $set: {
          "messageStatus.$.read": true,
          "messageStatus.$.readAt": new Date()
        }
      }
    );

    // 2. Add new entries for messages where the user is not present in messageStatus at all
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: req.user.id },
        "messageStatus.user": { $ne: req.user.id }
      },
      {
        $push: {
          messageStatus: {
            user: req.user.id,
            delivered: true,
            read: true,
            deliveredAt: new Date(),
            readAt: new Date()
          }
        }
      }
    );

    // 3. Reset persistent unread counter for this user and chat
    const chatDetails = await Chat.findById(chatId);
    if (chatDetails) {
      await Unread.findOneAndUpdate(
        { userId: req.user.id, chatId },
        {
          unreadCount: 0,
          chatType: chatDetails.isGroupChat ? "group" : "private",
          lastReadAt: new Date()
        },
        { upsert: true }
      );
    }

    // Fetch the updated messages to broadcast the real-time status update to their senders
    const updatedMessages = await Message.find({
      chat: chatId,
      sender: { $ne: req.user.id }
    });

    const io = getIO();
    for (const msg of updatedMessages) {
      io.to(msg.sender.toString()).emit("messageStatusUpdated", {
        _id: msg._id,
        messageStatus: msg.messageStatus,
      });
    }

    // Broadcast synchronization read event to all user's connected socket tabs
    if (chatDetails) {
      io.to(req.user.id.toString()).emit(
        chatDetails.isGroupChat ? "group:read" : "chat:read",
        { chatId: chatId.toString() }
      );
    }

    res.status(200).json({
      message: "Messages marked as read",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "Server Error",
    });
  }
};


/* =========================================================
   MARK VOICE MESSAGE AS READ
========================================================= */

const markVoiceAsRead = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    const io = getIO();

    const status = message.messageStatus.find(
      (s) => s.user.toString() === req.user.id,
    );

    if (status) {
      if (!status.read) {
        status.read = true;

        status.readAt = new Date();
      }
    } else {
      message.messageStatus.push({
        user: req.user.id,

        delivered: true,

        read: true,

        deliveredAt: new Date(),

        readAt: new Date(),
      });
    }

    await message.save();

    io.to(message.sender.toString()).emit("messageStatusUpdated", {
      _id: message._id,

      messageStatus: message.messageStatus,
    });

    res.status(200).json({
      message: "Voice message marked as read",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

/* =========================================================
   REACT TO MESSAGE
========================================================= */

const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const { emoji } = req.body;

    const userId = req.user.id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    /* EXISTING */

    const existingReactionIndex = message.reactions.findIndex(
      (reaction) => reaction.user.toString() === userId.toString(),
    );

    /* REMOVE SAME */

    if (
      existingReactionIndex !== -1 &&
      message.reactions[existingReactionIndex].emoji === emoji
    ) {
      message.reactions.splice(existingReactionIndex, 1);
    } else {
      /* REPLACE */

      if (existingReactionIndex !== -1) {
        message.reactions[existingReactionIndex].emoji = emoji;
      } else {
        /* ADD */

        message.reactions.push({
          user: userId,
          emoji,
        });
      }
    }

    await message.save();

    /* UPDATED */

    const updatedMessage = await Message.findById(messageId)

      .populate("reactions.user", "username avatar")

      .populate("sender", "username avatar")

      .lean();

    const io = getIO();

    /* REALTIME */

    io.to(message.chat.toString()).emit("messageReactionUpdated", {
      messageId,

      reactions: updatedMessage.reactions,
    });

    res.status(200).json({
      success: true,

      reactions: updatedMessage.reactions,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Reaction failed",
    });
  }
};

/* =========================================================
   DELETE MESSAGE (FOR ME / FOR EVERYONE)
========================================================= */
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteType } = req.body; // "forMe" or "forEveryone"
    const userId = req.user.id;

    const message = await Message.findById(messageId).populate("chat");
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const io = getIO();

    if (deleteType === "forMe") {
      if (!message.deletedFor) {
        message.deletedFor = [];
      }
      if (!message.deletedFor.includes(userId)) {
        message.deletedFor.push(userId);
      }
      await message.save();

      // Emit to the actor only to update their state
      io.to(userId).emit("message:deleted-for-me", {
        messageId,
        chatId: message.chat._id.toString(),
      });

      return res.status(200).json({ success: true, deleteType: "forMe" });
    } else if (deleteType === "forEveryone") {
      // Permission check: Sender or Chat Admins
      const isSender = message.sender.toString() === userId.toString();
      let isAuthorized = isSender;

      if (!isAuthorized && message.chat.isGroupChat) {
        const userRoleObj = message.chat.roles?.find(
          (roleObj) => roleObj.user.toString() === userId.toString()
        );
        const userRole = userRoleObj ? userRoleObj.role : "member";
        isAuthorized = ["owner", "admin", "moderator"].includes(userRole);
      }

      if (!isAuthorized) {
        return res.status(403).json({
          message: "You are not authorized to delete this message for everyone",
        });
      }

      // Hard erase sensitive variables
      message.isDeleted = true;
      message.content = "This message was deleted";
      message.media = [];
      message.mediaUrl = "";
      message.thumbnailUrl = "";
      message.caption = "";
      message.fileName = "";
      message.fileSize = 0;
      message.mimeType = "";
      message.duration = 0;
      message.messageType = "text";
      message.poll = undefined;

      await message.save();

      const payload = {
        messageId,
        chatId: message.chat._id.toString(),
        updatedMessage: {
          _id: message._id,
          chat: message.chat._id,
          sender: message.sender,
          isDeleted: true,
          content: "This message was deleted",
          media: [],
          messageType: "text",
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        },
      };

      // Broadcast to everyone in the room
      io.to(message.chat._id.toString()).emit("message:deleted-for-everyone", payload);

      return res.status(200).json({ success: true, deleteType: "forEveryone" });
    } else {
      return res.status(400).json({ message: "Invalid delete type" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete message" });
  }
};

/* =========================================================
   EDIT MESSAGE
========================================================= */

const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Content cannot be empty" });
    }

    const message = await Message.findById(messageId).populate("chat");
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.isDeleted) {
      return res.status(400).json({ message: "Cannot edit a deleted message" });
    }

    if (message.edited) {
      return res.status(400).json({ message: "This message has already been edited and cannot be edited again" });
    }

    // Viewed if any status entry has read: true
    const isViewed = message.messageStatus && message.messageStatus.some(s => s.read);
    const timeDiff = Date.now() - new Date(message.createdAt).getTime();
    const editBufferLimit = isViewed ? (10 * 60 * 1000) : (2 * 60 * 60 * 1000); // 10 mins if viewed, 2 hours if not

    if (timeDiff > editBufferLimit) {
      const limitText = isViewed ? "10 minutes (since it has been viewed)" : "2 hours";
      return res.status(400).json({ message: `You can only edit messages within ${limitText}` });
    }

    // Permission check: only the sender of the message can edit it
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You are not authorized to edit this message" });
    }

    message.content = content;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    // Populate sender info for the frontend
    const updatedMessage = await Message.findById(messageId)
      .populate("sender", "username email avatar")
      .populate("reactions.user", "username avatar")
      .lean();

    const io = getIO();
    // Broadcast message edited event to the entire chat room (works for both group and direct chats!)
    io.to(message.chat._id.toString()).emit("group:message-edited", updatedMessage);

    return res.status(200).json(updatedMessage);
  } catch (error) {
    console.error("Failed to edit message:", error);
    res.status(500).json({ message: "Failed to edit message" });
  }
};

/* =========================================================
   PIN MESSAGE
========================================================= */

const createPinSystemMessage = async (chatId, senderId, content) => {
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
        io.to(participant.toString()).emit(chat.isGroupChat ? "group:new-message" : "message:new", populatedMessage);
      });
    }
    return populatedMessage;
  } catch (error) {
    console.error("Error creating pin system message:", error);
  }
};

const pinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId).populate("chat");
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const Chat = require("../../models/Chat");
    const chat = await Chat.findById(message.chat._id);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    if (!chat.pinnedMessages) {
      chat.pinnedMessages = [];
    }

    const User = require("../../models/User");
    const userObj = await User.findById(req.user.id);
    const username = userObj.username;

    const pinnedIdx = chat.pinnedMessages.indexOf(messageId);
    let systemMsgContent = "";
    if (pinnedIdx > -1) {
      // Unpin
      chat.pinnedMessages.splice(pinnedIdx, 1);
      systemMsgContent = `${username} unpinned a message`;
    } else {
      // Pin
      chat.pinnedMessages.push(messageId);
      systemMsgContent = `${username} pinned a message`;
    }

    await chat.save();

    // Populate pinned messages details for the frontend
    const updatedChat = await Chat.findById(chat._id)
      .populate({
        path: "pinnedMessages",
        populate: { path: "sender", select: "username avatar" }
      });

    // Create a system message in the chat history
    await createPinSystemMessage(chat._id, req.user.id, systemMsgContent);

    const io = getIO();
    // Broadcast the updated list of pinned messages to every participant in their personal rooms
    if (chat.participants) {
      chat.participants.forEach((participant) => {
        io.to(participant.toString()).emit("group:pinned-updated", {
          chatId: chat._id,
          pinnedMessages: updatedChat.pinnedMessages || [],
        });
      });
    }

    // Invalidate chats cache for all participants so the sidebar pinned states update instantly
    await invalidateChatsCache(chat._id);

    return res.status(200).json(updatedChat.pinnedMessages || []);
  } catch (error) {
    console.error("Failed to pin/unpin message:", error);
    res.status(500).json({ message: "Failed to pin/unpin message" });
  }
};


/* =========================================================
   GET MEDIA MESSAGES
========================================================= */
const getMediaMessages = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    // Find all media messages in the entire chat history (no member joinedAt limitations!)
    const mediaMessages = await Message.find({
      chat: chatId,
      isDeleted: { $ne: true },
      $or: [
        { messageType: { $in: ["image", "video", "file", "audio"] } },
        { media: { $exists: true, $ne: [] } },
        { mediaUrl: { $exists: true, $ne: "" } }
      ]
    })
    .populate("sender", "username avatar")
    .sort({ createdAt: -1 });

    res.status(200).json(mediaMessages);
  } catch (error) {
    console.error("Failed to fetch media messages:", error);
    res.status(500).json({ message: "Failed to fetch media messages" });
  }
};

/* =========================================================
   GET MESSAGE INFO (WhatsApp-Style Delivery/Read metrics)
========================================================= */
const getMessageInfo = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId)
      .populate("chat")
      .populate("sender", "username avatar")
      .populate("messageStatus.user", "username avatar");

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Failed to fetch message info:", error);
    res.status(500).json({ message: "Failed to fetch message info" });
  }
};

/* =========================================================
   VOTE POLL
========================================================= */
const votePoll = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { optionText } = req.body;
    const userId = req.user.id;

    if (!optionText) {
      return res.status(400).json({ message: "Option text is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.messageType !== "poll" || !message.poll) {
      return res.status(400).json({ message: "Message is not a poll" });
    }

    // Update the votes for the selected optionText
    message.poll.options.forEach((opt) => {
      const userIdx = opt.votes.indexOf(userId);

      if (opt.optionText === optionText) {
        if (userIdx > -1) {
          // Toggle off
          opt.votes.splice(userIdx, 1);
        } else {
          // Add vote
          opt.votes.push(userId);
        }
      } else {
        // Clear votes if allowMultiple is false
        if (!message.poll.allowMultiple) {
          const otherIdx = opt.votes.indexOf(userId);
          if (otherIdx > -1) {
            opt.votes.splice(otherIdx, 1);
          }
        }
      }
    });

    await message.save();

    const populatedMessage = await Message.findById(messageId)
      .populate("sender", "username email avatar")
      .populate("chat")
      .populate("reactions.user", "username avatar")
      .populate("poll.options.votes", "username avatar")
      .lean();

    const io = getIO();
    // Broadcast poll update to the entire chat room
    io.to(message.chat.toString()).emit("group:poll-voted", {
      messageId: message._id,
      poll: populatedMessage.poll,
    });

    return res.status(200).json(populatedMessage);
  } catch (error) {
    console.error("Failed to vote in poll:", error);
    res.status(500).json({ message: "Failed to vote in poll" });
  }
};

/* =========================================================
   SEARCH MESSAGES
========================================================= */
const searchMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { query: searchQuery } = req.query;

    if (!chatId) {
      return res.status(400).json({ message: "Chat ID is required" });
    }

    if (!searchQuery) {
      return res.status(200).json([]);
    }

    const chat = await Chat.findById(chatId).lean();
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const query = {
      chat: chatId,
      isDeleted: { $ne: true },
      deletedFor: { $ne: req.user.id },
      content: { $regex: searchQuery, $options: "i" },
    };

    if (chat.isGroupChat && chat.roles) {
      const userRole = chat.roles.find((r) => r.user.toString() === req.user.id.toString());
      if (userRole) {
        query.createdAt = { $gte: userRole.joinedAt || chat.createdAt };
        if (userRole.role === "left" && userRole.leftAt) {
          query.createdAt.$lte = userRole.leftAt;
        }
      } else {
        query.createdAt = { $gte: chat.createdAt };
      }
    }

    // Apply user-specific deletion and clearance filters
    const deletedEntry = chat.deletedBy?.find((d) => d.user.toString() === req.user.id.toString());
    const clearedEntry = chat.clearedBy?.find((c) => c.user.toString() === req.user.id.toString());

    let minVisibleDate = null;
    if (deletedEntry) minVisibleDate = new Date(deletedEntry.deletedAt);
    if (clearedEntry) {
      const clearDate = new Date(clearedEntry.clearedAt);
      if (!minVisibleDate || clearDate > minVisibleDate) {
        minVisibleDate = clearDate;
      }
    }

    if (minVisibleDate) {
      if (query.createdAt) {
        query.createdAt.$gt = minVisibleDate;
      } else {
        query.createdAt = { $gt: minVisibleDate };
      }
    }

    const messages = await Message.find(query)
      .populate("sender", "username email avatar")
      .populate("reactions.user", "username avatar")
      .populate("poll.options.votes", "username avatar")
      .sort({ createdAt: -1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Failed to search messages:", error);
    res.status(500).json({ message: "Failed to search messages" });
  }
};

module.exports = {
  sendMessage,

  fetchMessages,

  markAsDelivered,

  markAsRead,

  markVoiceAsRead,

  reactToMessage,

  deleteMessage,

  editMessage,

  pinMessage,

  getMediaMessages,

  getMessageInfo,

  votePoll,

  searchMessages,
};
