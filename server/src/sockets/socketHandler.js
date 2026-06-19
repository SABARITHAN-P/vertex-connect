const crypto = require("crypto");
const User = require("../models/User");
const redisClient = require("../config/redis");
const PrivacySettings = require("../models/PrivacySettings");
const { getCachedPrivacySettings, invalidateChatsCache } = require("../utils/cacheHelper");

const SERVER_ID = crypto.randomUUID();
console.log(`[Presence] Generated unique Server ID: ${SERVER_ID}`);

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

const startHeartbeat = async () => {
  try {
    if (redisClient.isOpen) {
      await redisClient.sAdd("active_servers", SERVER_ID);
      await redisClient.set(`server_heartbeat:${SERVER_ID}`, "alive", { EX: 30 });
    }
  } catch (err) {
    console.error(`[Presence] Failed to send heartbeat for server ${SERVER_ID}:`, err);
  }
};

const cleanupDeadServers = async (io) => {
  try {
    if (!redisClient.isOpen) return;

    const servers = await redisClient.sMembers("active_servers");
    for (const sId of servers) {
      if (sId === SERVER_ID) continue;

      const isAlive = await redisClient.exists(`server_heartbeat:${sId}`);
      if (!isAlive) {
        console.log(`[Presence] Server ${sId} is dead/inactive. Cleaning up orphaned sockets...`);

        // Get all sockets associated with this dead server
        const orphanedSockets = await redisClient.sMembers(`server_sockets:${sId}`);
        for (const socketId of orphanedSockets) {
          const userId = await redisClient.get(`socket_user:${socketId}`);
          if (userId) {
            // Remove from the user's global socket list
            await redisClient.sRem(`user_sockets:${userId}`, socketId);
            await redisClient.del(`socket_user:${socketId}`);

            // Check if user has no sockets left globally
            const remainingCount = await redisClient.sCard(`user_sockets:${userId}`);
            if (remainingCount === 0) {
              await redisClient.sRem("online_users", userId);

              const lastSeen = new Date();
              await User.findByIdAndUpdate(userId, {
                status: "offline",
                lastSeen,
              });

              // Notify other users
              io.emit("userOffline", { userId, lastSeen });
              io.emit("user:offline", { userId, lastSeen });
              console.log(`[Presence] Cleanup marked user ${userId} offline (last socket was on dead server ${sId})`);
            }
          }
        }

        // Clean up server-specific keys
        await redisClient.del(`server_sockets:${sId}`);
        await redisClient.sRem("active_servers", sId);
        console.log(`[Presence] Completed cleanup for dead server ${sId}`);
      }
    }
  } catch (err) {
    console.error("[Presence] Error during dead servers cleanup:", err);
  }
};

const cleanShutdown = async (io) => {
  try {
    console.log(`[Presence] Clean shutdown initiated for server ${SERVER_ID}. Cleaning up local sockets...`);
    if (redisClient.isOpen) {
      const localSockets = await redisClient.sMembers(`server_sockets:${SERVER_ID}`);
      for (const socketId of localSockets) {
        const userId = await redisClient.get(`socket_user:${socketId}`);
        if (userId) {
          await redisClient.sRem(`user_sockets:${userId}`, socketId);
          await redisClient.del(`socket_user:${socketId}`);

          const remainingCount = await redisClient.sCard(`user_sockets:${userId}`);
          if (remainingCount === 0) {
            await redisClient.sRem("online_users", userId);

            const lastSeen = new Date();
            await User.findByIdAndUpdate(userId, {
              status: "offline",
              lastSeen,
            });

            if (io) {
              io.emit("userOffline", { userId, lastSeen });
              io.emit("user:offline", { userId, lastSeen });
            }
          }
        }
      }

      await redisClient.del(`server_sockets:${SERVER_ID}`);
      await redisClient.sRem("active_servers", SERVER_ID);
      await redisClient.del(`server_heartbeat:${SERVER_ID}`);
      console.log(`[Presence] Clean shutdown socket cleanup completed for server ${SERVER_ID}.`);
    }
  } catch (err) {
    console.error("[Presence] Error during clean shutdown:", err);
  }
};

const socketHandler = (io) => {
  // Initialize server presence and run cleanup scan for dead servers
  (async () => {
    try {
      if (!redisClient.isOpen) {
        await new Promise((resolve) => {
          redisClient.once("ready", resolve);
          setTimeout(resolve, 3000);
        });
      }

      if (redisClient.isOpen) {
        console.log("Initializing socket handler, checking for dead servers...");
        
        // Register this server in the active server registry
        await startHeartbeat();
        // Start the periodic heartbeat
        setInterval(startHeartbeat, 10000);

        // Run the startup scan for dead servers
        await cleanupDeadServers(io);
        
        console.log("Server presence registration and cleanup scan completed.");
      } else {
        console.warn("Skipping Redis server presence registration: Redis client is not open.");
      }
    } catch (err) {
      console.error("Failed to initialize server presence:", err);
    }
  })();

  // Handle clean shutdowns
  const shutdownHandler = async () => {
    await cleanShutdown(io);
    process.exit(0);
  };

  process.once("SIGINT", shutdownHandler);
  process.once("SIGTERM", shutdownHandler);

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
        await redisClient.sAdd(`server_sockets:${SERVER_ID}`, socket.id);
        await redisClient.set(`socket_user:${socket.id}`, userId, { EX: 86400 });
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
        const { checkCallPermission } = require("../utils/privacyHelper");
        const permission = await checkCallPermission(callerId, receiverId);
        if (!permission.allowed) {
          socket.emit("call:failed", { reason: "permission_denied", message: permission.message, callId });
          return;
        }

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
        await redisClient.sRem(`server_sockets:${SERVER_ID}`, socket.id);
        await redisClient.del(`socket_user:${socket.id}`);

        // Check if the user has any active sockets globally
        const remainingSockets = await redisClient.sMembers(`user_sockets:${userId}`);
        const hasActiveSockets = remainingSockets && remainingSockets.length > 0;

        if (!hasActiveSockets) {
          // No active sockets left globally! Clean up Redis and set offline
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
          // Prune any stale socket IDs from Redis that belong to this server but are not actually active
          const activeRoomSockets = io.sockets.adapter.rooms.get(userId.toString());
          for (const sId of remainingSockets) {
            const isLocal = io.sockets.sockets.has(sId);
            if (isLocal && (!activeRoomSockets || !activeRoomSockets.has(sId))) {
              await redisClient.sRem(`user_sockets:${userId}`, sId);
              await redisClient.sRem(`server_sockets:${SERVER_ID}`, sId);
              await redisClient.del(`socket_user:${sId}`);
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
  
  // Get all socket IDs in the chat room across the entire cluster
  const roomSockets = await io.in(chatId.toString()).allSockets();
  if (!roomSockets || roomSockets.size === 0) return false;

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

