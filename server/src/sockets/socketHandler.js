const User = require("../models/User");
const redisClient = require("../config/redis");
const PrivacySettings = require("../models/PrivacySettings");
const { getCachedPrivacySettings } = require("../utils/cacheHelper");

const emitOnlineUsers = async (io) => {
  try {
    const globalOnlineUsers = await redisClient.sMembers("online_users");
    const hiddenUsers = await PrivacySettings.find({ showOnline: false }).select("user");
    const hiddenIds = hiddenUsers.map(u => u.user.toString());
    const visibleOnlineUsers = globalOnlineUsers.filter(id => !hiddenIds.includes(id));
    io.emit("onlineUsers", visibleOnlineUsers);
  } catch (err) {
    console.error("Error emitting online users:", err);
  }
};

const socketHandler = (io) => {
  io.on("connection", (socket) => {
    console.log("New Socket Connected:", socket.id);

    /* =========================
       USER SETUP
    ========================== */
    socket.on("setup", async (userData) => {
      try {
        const userId = userData?.id || userData?._id;

        /* STORE USER ID */
        socket.userId = userId;

        /* PERSONAL ROOM */
        socket.join(userId);

        /* MULTIPLE TABS SUPPORT GLOBALLY VIA REDIS */
        await redisClient.sAdd(`user_sockets:${userId}`, socket.id);
        await redisClient.sAdd("online_users", userId);

        /* UPDATE USER ONLINE */
        await User.findByIdAndUpdate(userId, {
          status: "online",
        });

        console.log("User Joined Personal Room:", userId);

        /* SEND ONLINE USERS */
        await emitOnlineUsers(io);

        // Check if user has online visibility enabled before emitting individual user:online
        const userPrivacy = await getCachedPrivacySettings(userId);
        if (!userPrivacy || userPrivacy.showOnline !== false) {
          io.emit("user:online", { userId });
        }
      } catch (error) {
        console.error("Error setting up socket connection in Redis:", error);
      }
    });

    socket.on("user:last-seen-updated", async (data) => {
      // Check privacy before emitting
      const userPrivacy = await getCachedPrivacySettings(data.userId);
      if (!userPrivacy || userPrivacy.showLastSeen !== false) {
        io.emit("user:last-seen-updated", data);
      }
    });

    /* =========================
       JOIN CHAT ROOM
    ========================== */
    socket.on("joinChat", (chatId) => {
      socket.join(chatId);

      console.log("User Joined Chat Room:", chatId);
    });

    /* =========================
       LEAVE CHAT ROOM
    ========================== */
    socket.on("leaveChat", (chatId) => {
      socket.leave(chatId);

      console.log("User Left Chat Room:", chatId);
    });

    /* =========================
       TYPING
    ========================== */
    socket.on("typing", ({ chatId, receiverId, senderName, senderId, senderAvatar }) => {
      socket.to(receiverId).emit("typing", {
        senderName,
        senderId,
        senderAvatar,
        chatId,
      });
    });

    /* =========================
       STOP TYPING
    ========================== */
    socket.on("stopTyping", ({ chatId, receiverId, senderId }) => {
      socket.to(receiverId).emit("stopTyping", {
        senderId,
        chatId,
      });
    });

    /* =========================
       GROUP TYPING
    ========================== */
    socket.on("group:typing-start", ({ chatId, senderId, senderName, senderAvatar }) => {
      socket.to(chatId).emit("group:typing-start", {
        chatId,
        senderId,
        senderName,
        senderAvatar,
      });
    });

    socket.on("group:typing-stop", ({ chatId, senderId }) => {
      socket.to(chatId).emit("group:typing-stop", {
        chatId,
        senderId,
      });
    });

    /* =========================
       BACKGROUND UPLOAD EVENTS
       ========================= */
    socket.on("message:upload-started", (data) => {
      socket.to(data.chatId).emit("message:upload-started", data);
    });

    socket.on("message:upload-progress", (data) => {
      socket.to(data.chatId).emit("message:upload-progress", data);
    });

    socket.on("message:upload-complete", (data) => {
      socket.to(data.chatId).emit("message:upload-complete", data);
    });

    socket.on("message:upload-failed", (data) => {
      socket.to(data.chatId).emit("message:upload-failed", data);
    });

    /* =========================
       VOICE & VIDEO CALL SIGNALING
    ========================== */
    socket.on("call:initiate", async ({ receiverId, callerName, callerAvatar, type, callId, callDbId }) => {
      const callerId = socket.userId;
      if (!callerId) return;

      try {
        const callerBusy = await redisClient.get(`active_call:${callerId}`);
        if (callerBusy) {
          socket.emit("call:failed", { reason: "you_busy", callId });
          return;
        }

        const receiverBusy = await redisClient.get(`active_call:${receiverId}`);
        if (receiverBusy) {
          socket.emit("call:failed", { reason: "receiver_busy", callId });
          return;
        }

        await redisClient.set(`active_call:${callerId}`, callId, { EX: 60 });
        await redisClient.set(`active_call:${receiverId}`, callId, { EX: 60 });
        await redisClient.set(`call_peer:${callId}:${callerId}`, receiverId, { EX: 60 });
        await redisClient.set(`call_peer:${callId}:${receiverId}`, callerId, { EX: 60 });

        socket.to(receiverId).emit("call:incoming", {
          caller: {
            _id: callerId,
            username: callerName,
            avatar: callerAvatar
          },
          type,
          callId,
          callDbId
        });

        console.log(`Call Initiated: ${callId} from ${callerId} to ${receiverId}`);
      } catch (error) {
        console.error("Error initiating call:", error);
        socket.emit("call:failed", { reason: "error", callId });
      }
    });

    socket.on("call:ringing", ({ callerId, callId }) => {
      socket.to(callerId).emit("call:ringing", { callId });
    });

    socket.on("call:accept", async ({ callerId, callId }) => {
      const receiverId = socket.userId;
      if (!receiverId) return;

      try {
        await redisClient.expire(`active_call:${callerId}`, 7200);
        await redisClient.expire(`active_call:${receiverId}`, 7200);
        await redisClient.expire(`call_peer:${callId}:${callerId}`, 7200);
        await redisClient.expire(`call_peer:${callId}:${receiverId}`, 7200);

        socket.to(callerId).emit("call:accepted", { callId });
        console.log(`Call Accepted: ${callId} by ${receiverId}`);
      } catch (error) {
        console.error("Error accepting call:", error);
      }
    });

    socket.on("call:reject", async ({ callerId, callId }) => {
      const receiverId = socket.userId;

      try {
        await redisClient.del(`active_call:${callerId}`);
        if (receiverId) await redisClient.del(`active_call:${receiverId}`);
        await redisClient.del(`call_peer:${callId}:${callerId}`);
        if (receiverId) await redisClient.del(`call_peer:${callId}:${receiverId}`);

        socket.to(callerId).emit("call:rejected", { callId });
        console.log(`Call Rejected: ${callId} by ${receiverId}`);
      } catch (error) {
        console.error("Error rejecting call:", error);
      }
    });

    socket.on("call:end", async ({ peerId, callId }) => {
      const myId = socket.userId;

      try {
        if (myId) await redisClient.del(`active_call:${myId}`);
        if (peerId) await redisClient.del(`active_call:${peerId}`);
        await redisClient.del(`call_peer:${callId}:${myId}`);
        if (peerId) await redisClient.del(`call_peer:${callId}:${peerId}`);

        if (peerId) {
          socket.to(peerId).emit("call:ended", { callId });
        }
        console.log(`Call Ended: ${callId} by ${myId}`);
      } catch (error) {
        console.error("Error ending call:", error);
      }
    });

    socket.on("call:offer", ({ offer, peerId, callId }) => {
      socket.to(peerId).emit("call:offer", { offer, callId });
    });

    socket.on("call:answer", ({ answer, peerId, callId }) => {
      socket.to(peerId).emit("call:answer", { answer, callId });
    });

    socket.on("call:ice-candidate", ({ candidate, peerId, callId }) => {
      socket.to(peerId).emit("call:ice-candidate", { candidate, callId });
    });

    /* =========================
       DISCONNECT
    ========================== */
    socket.on("disconnect", async () => {
      try {
        const userId = socket.userId;

        if (!userId) return;

        // If user was in an active call, terminate it
        const activeCallId = await redisClient.get(`active_call:${userId}`);
        if (activeCallId) {
          const peerId = await redisClient.get(`call_peer:${activeCallId}:${userId}`);
          
          await redisClient.del(`active_call:${userId}`);
          if (peerId) {
            await redisClient.del(`active_call:${peerId}`);
            await redisClient.del(`call_peer:${activeCallId}:${peerId}`);
            io.to(peerId).emit("call:ended", { callId: activeCallId, reason: "peer_disconnected" });
          }
          await redisClient.del(`call_peer:${activeCallId}:${userId}`);
        }

        // Remove socket globally from Redis
        await redisClient.sRem(`user_sockets:${userId}`, socket.id);

        // Check if the user has any active sockets globally
        const remainingCount = await redisClient.sCard(`user_sockets:${userId}`);

        if (remainingCount === 0) {
          await redisClient.sRem("online_users", userId);

          /* UPDATE USER OFFLINE */
          const lastSeen = new Date();

          await User.findByIdAndUpdate(userId, {
            status: "offline",
            lastSeen,
          });

          /* EMIT OFFLINE EVENT */
          io.emit("userOffline", {
            userId,
            lastSeen,
          });

          io.emit("user:offline", {
            userId,
            lastSeen,
          });

          console.log("User Removed Globally:", userId);
        }

        /* UPDATE ONLINE USERS */
        const globalOnlineUsers = await redisClient.sMembers("online_users");
        io.emit("onlineUsers", globalOnlineUsers);

        console.log("Socket Disconnected:", socket.id);
      } catch (error) {
        console.error("Error disconnecting socket in Redis:", error);
      }
    });
  });
};

const isUserInChat = async (userId, chatId, io) => {
  if (!userId || !chatId || !io) return false;
  const roomSockets = io.sockets.adapter.rooms.get(chatId.toString());
  if (!roomSockets) return false;

  const userSockets = await redisClient.sMembers(`user_sockets:${userId.toString()}`);
  if (!userSockets || userSockets.length === 0) return false;

  for (const socketId of userSockets) {
    if (roomSockets.has(socketId)) {
      return true;
    }
  }
  return false;
};

socketHandler.isUserInChat = isUserInChat;

module.exports = socketHandler;

