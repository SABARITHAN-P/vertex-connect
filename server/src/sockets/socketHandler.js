const User = require("../models/User");
const redisClient = require("../config/redis");
const PrivacySettings = require("../models/PrivacySettings");
const { getCachedPrivacySettings, invalidateChatsCache } = require("../utils/cacheHelper");

const invalidateChatsForUserContacts = async (userId) => {
  if (!userId) return;
  try {
    const Chat = require("../models/Chat");
    const userChats = await Chat.find({ participants: userId }).select("participants");
    const uniqueUserIds = new Set();
    for (const chat of userChats) {
      if (chat.participants) {
        for (const pId of chat.participants) {
          if (pId.toString() !== userId.toString()) {
            uniqueUserIds.add(pId.toString());
          }
        }
      }
    }
    for (const contactId of uniqueUserIds) {
      await invalidateChatsCache(contactId);
    }
  } catch (err) {
    console.error("Failed to invalidate contacts' chats cache:", err);
  }
};

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
  // Clear all stale sockets and online users from Redis on server startup/initialization!
  (async () => {
    try {
      if (!redisClient.isOpen) {
        await new Promise((resolve) => {
          redisClient.once("ready", resolve);
          // Safety timeout in case Redis is not running or down
          setTimeout(resolve, 3000);
        });
      }

      if (redisClient.isOpen) {
        console.log("Initializing socket handler, cleaning stale presence cache...");
        
        // 1. Delete all user_sockets:* keys
        const keys = await redisClient.keys("user_sockets:*");
        if (keys && keys.length > 0) {
          await redisClient.del(keys);
        }
        
        // 2. Delete the online_users set
        await redisClient.del("online_users");
        
        // 3. Set all users to offline in the database on server startup
        await User.updateMany({ status: "online" }, { status: "offline", lastSeen: new Date() });
        
        console.log("Presence cache cleared successfully on startup.");
      } else {
        console.warn("Skipping Redis presence cache cleanup: Redis client is not open.");
      }
    } catch (err) {
      console.error("Failed to clean presence cache on startup:", err);
    }
  })();

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
        await invalidateChatsForUserContacts(userId);

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

        // Check if the user has any active sockets on this server
        const activeRoomSockets = io.sockets.adapter.rooms.get(userId.toString());
        const hasActiveSockets = activeRoomSockets && activeRoomSockets.size > 0;

        if (!hasActiveSockets) {
          // No active sockets left! Clean up Redis and set offline
          await redisClient.del(`user_sockets:${userId}`);
          await redisClient.sRem("online_users", userId);

          /* UPDATE USER OFFLINE */
          const lastSeen = new Date();

          await User.findByIdAndUpdate(userId, {
            status: "offline",
            lastSeen,
          });

          await invalidateChatsForUserContacts(userId);

          /* EMIT OFFLINE EVENT */
          io.emit("userOffline", {
            userId,
            lastSeen,
          });

          io.emit("user:offline", {
            userId,
            lastSeen,
          });

          console.log("User Removed Globally (No active sockets):", userId);
        } else {
          // Prune any stale socket IDs from Redis that are not actually connected
          const cachedSockets = await redisClient.sMembers(`user_sockets:${userId}`);
          for (const sId of cachedSockets) {
            if (!activeRoomSockets.has(sId)) {
              await redisClient.sRem(`user_sockets:${userId}`, sId);
            }
          }
        }

        /* UPDATE ONLINE USERS */
        await emitOnlineUsers(io);

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

