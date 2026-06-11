const redisClient = require("../config/redis");
const PrivacySettings = require("../models/PrivacySettings");
const Follow = require("../models/Follow");

/**
 * Invalidates the populated chats cache for a specific user.
 * @param {string|ObjectId} userId - ID of the user.
 */
const invalidateChatsCache = async (userId) => {
  if (!userId) return;
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.del(`user:chats_populated:${userId.toString()}`);
    }
  } catch (error) {
    console.error("Cache invalidation error:", error);
  }
};

/**
 * Invalidates cached follow relationship statuses between two users.
 * @param {string|ObjectId} userA - ID of user A.
 * @param {string|ObjectId} userB - ID of user B.
 */
const invalidateFollowCache = async (userA, userB) => {
  if (!userA || !userB) return;
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.del(`follow:accepted:${userA.toString()}:${userB.toString()}`);
      await redisClient.del(`follow:accepted:${userB.toString()}:${userA.toString()}`);
    }
  } catch (error) {
    console.error("Redis follow invalidate error:", error);
  }
};

/**
 * Retrieves privacy settings for a user, checking Redis first, then falling back to MongoDB.
 * @param {string|ObjectId} userId - ID of the user.
 * @returns {object|null} Privacy settings document or null.
 */
const getCachedPrivacySettings = async (userId) => {
  if (!userId) return null;
  const cacheKey = `user:privacy_settings:${userId.toString()}`;
  try {
    if (redisClient && redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }
  } catch (err) {
    console.error("Redis read for privacy settings failed:", err);
  }

  const settings = await PrivacySettings.findOne({ user: userId });
  if (settings) {
    try {
      if (redisClient && redisClient.isOpen) {
        await redisClient.set(cacheKey, JSON.stringify(settings), { EX: 3600 });
      }
    } catch (err) {
      console.error("Redis write for privacy settings failed:", err);
    }
  }
  return settings;
};

/**
 * Checks follow relationship status with Redis caching.
 * @param {string|ObjectId} followerId - ID of follower.
 * @param {string|ObjectId} followingId - ID of following.
 * @returns {boolean} Whether follower follows following.
 */
const checkFollowStatusCached = async (followerId, followingId) => {
  if (!followerId || !followingId) return false;
  const cacheKey = `follow:accepted:${followerId.toString()}:${followingId.toString()}`;
  try {
    if (redisClient && redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached !== null) {
        return cached === "true";
      }
    }
  } catch (err) {
    console.error("Redis read for follow accepted failed:", err);
  }

  const isFollower = await Follow.findOne({
    follower: followerId,
    following: followingId,
    status: "accepted"
  });
  const result = !!isFollower;
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.set(cacheKey, String(result), { EX: 3600 });
    }
  } catch (err) {
    console.error("Redis write for follow accepted failed:", err);
  }
  return result;
};

/**
 * Invalidates populated chats cache for all participants in a given chat.
 * @param {string|ObjectId} chatId - ID of the chat.
 */
const invalidateChatsCacheForChat = async (chatId) => {
  if (!chatId) return;
  try {
    const Chat = require("../models/Chat");
    const chat = await Chat.findById(chatId).select("participants");
    if (chat && chat.participants) {
      for (const participantId of chat.participants) {
        await invalidateChatsCache(participantId);
      }
    }
  } catch (error) {
    console.error("Error invalidating chats cache for chat:", error);
  }
};

/**
 * Invalidates the cached privacy settings for a user.
 * @param {string|ObjectId} userId - ID of the user.
 */
const invalidatePrivacyCache = async (userId) => {
  if (!userId) return;
  const cacheKey = `user:privacy_settings:${userId.toString()}`;
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.del(cacheKey);
    }
  } catch (err) {
    console.error("Redis delete privacy settings failed:", err);
  }
};

module.exports = {
  invalidateChatsCache,
  invalidateFollowCache,
  getCachedPrivacySettings,
  checkFollowStatusCached,
  invalidateChatsCacheForChat,
  invalidatePrivacyCache,
};
