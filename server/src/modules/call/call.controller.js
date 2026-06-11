const CallHistory = require("../../models/CallHistory");
const Chat = require("../../models/Chat");
const Message = require("../../models/Message");
const redisClient = require("../../config/redis");
const { getIO } = require("../../sockets/socket");
const { invalidateChatsCache } = require("../../utils/cacheHelper");

/* =========================================================
   POST CALL SYSTEM MESSAGE UTILITY
========================================================= */
const postCallSystemMessage = async (callerId, receiverId, callType, callStatus, duration = 0) => {
  try {
    // 1. Find or create the direct 1-to-1 chat between the two users
    let chat = await Chat.findOne({
      isGroupChat: false,
      participants: { $all: [callerId, receiverId] }
    });

    if (!chat) {
      chat = await Chat.create({
        participants: [callerId, receiverId]
      });
      await invalidateChatsCache(callerId);
      await invalidateChatsCache(receiverId);
    }

    // 2. Format WhatsApp-style display content
    const typeLabel = callType === "video" ? "Video call" : "Voice call";
    let content = "";

    if (callStatus === "missed") {
      content = `Missed ${typeLabel}`;
    } else if (callStatus === "rejected") {
      content = `Declined ${typeLabel}`;
    } else if (callStatus === "answered") {
      if (duration > 0) {
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        content = `${typeLabel} (${durationStr})`;
      } else {
        content = `${typeLabel}`;
      }
    } else {
      return; // Skip intermediate statuses
    }

    // 3. Create isSystem message
    const newMessage = await Message.create({
      chat: chat._id,
      sender: callerId,
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

    // 4. Update chat's lastMessage reference
    await Chat.findByIdAndUpdate(chat._id, {
      lastMessage: populatedMessage._id
    });

    // 5. Invalidate chats cache for participants
    await invalidateChatsCache(callerId);
    await invalidateChatsCache(receiverId);

    // 6. Broadcast new message via Socket.IO
    const io = getIO();
    if (io) {
      io.to(callerId.toString()).emit("newMessage", populatedMessage);
      io.to(receiverId.toString()).emit("newMessage", populatedMessage);
    }
  } catch (err) {
    console.error("Failed to create call system message:", err);
  }
};

/* =========================================================
   GET RECENT CALL HISTORY & MARK AS SEEN
========================================================= */
const getCallHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const history = await CallHistory.find({
      $or: [{ caller: userId }, { receiver: userId }],
    })
      .populate("caller", "username avatar")
      .populate("receiver", "username avatar")
      .sort({ timestamp: -1 })
      .limit(50); // Get recent 50 calls

    // Mark receiver's incoming missed/rejected call logs as seen
    await CallHistory.updateMany(
      { receiver: userId, receiverSeen: false },
      { $set: { receiverSeen: true } }
    );

    return res.json(history);
  } catch (error) {
    console.error("Fetch call history failed:", error);
    return res.status(500).json({ message: "Failed to fetch call history" });
  }
};

/* =========================================================
   GET UNSEEN MISSED CALLS COUNT
========================================================= */
const getUnseenMissedCallsCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const count = await CallHistory.countDocuments({
      receiver: userId,
      status: { $in: ["missed", "rejected"] },
      receiverSeen: false,
    });
    return res.json({ count });
  } catch (error) {
    console.error("Failed to get unseen count:", error);
    return res.status(500).json({ message: "Failed to get unseen count" });
  }
};

/* =========================================================
   LOG INITIAL CALL STATE
========================================================= */
const createCallHistory = async (req, res) => {
  try {
    const { receiverId, type, status, duration } = req.body;
    const callerId = req.user._id;

    if (!receiverId || !type || !status) {
      return res.status(400).json({ message: "Required parameters missing" });
    }

    const log = new CallHistory({
      caller: callerId,
      receiver: receiverId,
      type,
      status,
      duration: duration || 0,
      timestamp: new Date(),
    });

    await log.save();

    const populatedLog = await CallHistory.findById(log._id)
      .populate("caller", "username avatar")
      .populate("receiver", "username avatar");

    // Post system message if status is rejected or answered immediately
    if (status === "rejected" || status === "answered") {
      await postCallSystemMessage(callerId, receiverId, type, status, duration || 0);
    }

    return res.status(201).json(populatedLog);
  } catch (error) {
    console.error("Create call history failed:", error);
    return res.status(500).json({ message: "Failed to create call history log" });
  }
};

/* =========================================================
   UPDATE CALL RECORD (AND EMIT CHAT NOTIFICATION)
========================================================= */
const updateCallHistory = async (req, res) => {
  try {
    const { status, duration } = req.body;
    const { callId } = req.params;

    if (!callId) {
      return res.status(400).json({ message: "Call ID is required" });
    }

    const log = await CallHistory.findById(callId);
    if (!log) {
      return res.status(444).json({ message: "Call log not found" });
    }

    if (status) log.status = status;
    if (duration !== undefined) log.duration = duration;

    await log.save();

    const populatedLog = await CallHistory.findById(log._id)
      .populate("caller", "username avatar")
      .populate("receiver", "username avatar");

    // Emit chat system message notification upon call finalization
    if (status === "answered" || status === "missed") {
      await postCallSystemMessage(log.caller, log.receiver, log.type, status, duration || 0);
    }

    return res.json(populatedLog);
  } catch (error) {
    console.error("Update call history failed:", error);
    return res.status(500).json({ message: "Failed to update call history log" });
  }
};

module.exports = {
  getCallHistory,
  getUnseenMissedCallsCount,
  createCallHistory,
  updateCallHistory,
};
