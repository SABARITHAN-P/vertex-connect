const User = require("../../models/User");
const Follow = require("../../models/Follow");
const Block = require("../../models/Block");
const redisClient = require("../../config/redis");
const cloudinary = require("../../config/cloudinary");
const streamifier = require("streamifier");
const { getIO } = require("../../sockets/socket");
const sendEmail = require("../../utils/sendEmail");

const uploadAvatarToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "vertex-connect/avatars",
        resource_type: "image",
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

const { redactUserPrivacy } = require("../../utils/privacyHelper");
const { invalidateChatsCache, invalidateFollowCache } = require("../../utils/cacheHelper");

const searchUsers = async (req, res) => {
  try {
    const query = req.query.query || "";

    const users = await User.find({
      username: {
        $regex: query,
        $options: "i",
      },
      _id: {
        $ne: req.user._id,
      },
    }).select("_id username email status lastSeen avatar").lean();

    const processedUsers = await Promise.all(
      users.map((u) => redactUserPrivacy(req.user._id, u))
    );

    res.status(200).json(processedUsers);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      message: "User search failed",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { username, status } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ message: "Username is required" });
    }

    const trimmedUsername = username.trim();

    // Check if the username is already taken by another user (case-insensitive check)
    const existingUser = await User.findOne({
      username: { $regex: new RegExp(`^${trimmedUsername}$`, "i") },
      _id: { $ne: req.user._id }
    });

    if (existingUser) {
      return res.status(400).json({ message: "Username is already taken" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { username: trimmedUsername, status, about: status },
      { new: true }
    ).select("-password");

    // Invalidate Redis chats cache for all users sharing a chat with this user
    try {
      const Chat = require("../../models/Chat");
      const userChats = await Chat.find({ participants: req.user._id }).select("participants");
      const uniqueUserIds = new Set();
      uniqueUserIds.add(req.user._id.toString());
      for (const chat of userChats) {
        if (chat.participants) {
          for (const pId of chat.participants) {
            uniqueUserIds.add(pId.toString());
          }
        }
      }
      for (const pId of uniqueUserIds) {
        await invalidateChatsCache(pId);
      }
      await redisClient.del(`user:profile:${req.user._id}`);
    } catch (cacheError) {
      console.error("Failed to invalidate caches on profile update:", cacheError);
    }

    const io = getIO();
    io.emit("user:profile-updated", {
      userId: req.user._id,
      username: updatedUser.username,
      avatar: updatedUser.avatar,
      status: updatedUser.status,
      about: updatedUser.about,
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Profile update failed" });
  }
};

const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No avatar file provided" });
    }
    const avatarUrl = await uploadAvatarToCloudinary(req.file);

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true }
    ).select("-password");

    try {
      await redisClient.del(`user:profile:${req.user._id}`);
      const Chat = require("../../models/Chat");
      const userChats = await Chat.find({ participants: req.user._id }).select("participants");
      for (const chat of userChats) {
        if (chat.participants) {
          for (const pId of chat.participants) {
            await invalidateChatsCache(pId);
          }
        }
      }
    } catch (cacheError) {
      console.error("Failed to invalidate caches on avatar update:", cacheError);
    }

    const io = getIO();
    io.emit("user:profile-updated", {
      userId: req.user._id,
      username: updatedUser.username,
      avatar: updatedUser.avatar,
      status: updatedUser.status,
      about: updatedUser.about,
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Avatar upload failed" });
  }
};

const removeAvatar = async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: "" },
      { new: true }
    ).select("-password");

    try {
      await redisClient.del(`user:profile:${req.user._id}`);
      const Chat = require("../../models/Chat");
      const userChats = await Chat.find({ participants: req.user._id }).select("participants");
      for (const chat of userChats) {
        if (chat.participants) {
          for (const pId of chat.participants) {
            await invalidateChatsCache(pId);
          }
        }
      }
    } catch (cacheError) {
      console.error("Failed to invalidate caches on avatar removal:", cacheError);
    }

    const io = getIO();
    io.emit("user:profile-updated", {
      userId: req.user._id,
      username: updatedUser.username,
      avatar: "",
      status: updatedUser.status,
      about: updatedUser.about,
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Avatar removal failed" });
  }
};

const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot block yourself" });
    }

    const user = await User.findById(req.user._id);
    if (!user.blockedUsers.includes(userId)) {
      user.blockedUsers.push(userId);
      await user.save();
    }

    // Save block in Block model
    await Block.findOneAndUpdate(
      { blocker: req.user._id, blocked: userId },
      { blocker: req.user._id, blocked: userId },
      { upsert: true, new: true }
    );

    // Delete any Follow relationships between the blocker and the blocked user
    await Follow.deleteMany({
      $or: [
        { follower: req.user._id, following: userId },
        { follower: userId, following: req.user._id }
      ]
    });

    // Invalidate active chats cache and follow relationships cache
    try {
      await invalidateChatsCache(req.user._id);
      await invalidateChatsCache(userId);
      await invalidateFollowCache(req.user._id, userId);
    } catch (cacheErr) {
      console.error("Cache clear failed during block:", cacheErr);
    }

    const io = getIO();
    io.to(req.user._id.toString()).emit("block:update", { blockerId: req.user._id, blockedId: userId, isBlocked: true });
    io.to(userId.toString()).emit("block:update", { blockerId: req.user._id, blockedId: userId, isBlocked: true });
    io.emit("user:blocked", { blockerId: req.user._id, blockedId: userId });

    res.status(200).json({ message: "User blocked successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to block user" });
  }
};

const unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(req.user._id);
    user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== userId.toString());
    await user.save();

    // Delete block in Block model
    await Block.deleteOne({ blocker: req.user._id, blocked: userId });

    // Invalidate active chats cache and follow relationships cache
    try {
      await invalidateChatsCache(req.user._id);
      await invalidateChatsCache(userId);
      await invalidateFollowCache(req.user._id, userId);
    } catch (cacheErr) {
      console.error("Cache clear failed during unblock:", cacheErr);
    }

    const io = getIO();
    io.to(req.user._id.toString()).emit("block:update", { blockerId: req.user._id, blockedId: userId, isBlocked: false });
    io.to(userId.toString()).emit("block:update", { blockerId: req.user._id, blockedId: userId, isBlocked: false });
    io.emit("user:unblocked", { blockerId: req.user._id, blockedId: userId });

    res.status(200).json({ message: "User unblocked successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to unblock user" });
  }
};

const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("blockedUsers", "_id username email status avatar");
    res.status(200).json(user.blockedUsers || []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get blocked list" });
  }
};

const sendFeedbackEmail = async (req, res) => {
  try {
    const { issue, details } = req.body;
    if (!issue || !issue.trim()) {
      return res.status(400).json({ message: "Issue summary is required" });
    }
    if (!details || !details.trim()) {
      return res.status(400).json({ message: "Issue details are required" });
    }

    const emailSubject = `Vertex Connect Support - Issue: ${issue.trim()}`;
    const emailBody = `User: ${req.user.username} (${req.user.email})
Issue: ${issue.trim()}

Details:
${details.trim()}

Sent via Vertex Connect App Support Portal.`;

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log("=== DEV MODE / NO EMAIL CREDENTIALS ===");
      console.log(`Sending Mock Email to vertexconnect.team@gmail.com:`);
      console.log(`Subject: ${emailSubject}`);
      console.log(`Body: ${emailBody}`);
      console.log("=========================================");
      return res.status(200).json({ message: "Feedback submitted successfully (Mock Send)" });
    }

    await sendEmail("vertexconnect.team@gmail.com", emailSubject, emailBody);
    res.status(200).json({ message: "Feedback submitted successfully" });
  } catch (error) {
    console.error("Feedback Email Error:", error);
    res.status(500).json({ message: "Failed to send feedback email" });
  }
};

module.exports = {
  searchUsers,
  updateProfile,
  updateAvatar,
  removeAvatar,
  blockUser,
  unblockUser,
  getBlockedUsers,
  sendFeedbackEmail,
};
