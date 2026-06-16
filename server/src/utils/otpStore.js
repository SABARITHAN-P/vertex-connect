const redisClient = require("../config/redis");

// In-memory fallback store
const memoryStore = new Map();

const otpStore = {
  get: async (email) => {
    try {
      if (redisClient && redisClient.isOpen) {
        const data = await redisClient.get(`otp:${email}`);
        if (data) return JSON.parse(data);
      }
    } catch (error) {
      console.error("Failed to get OTP from Redis, using memory store:", error);
    }

    // Fallback to memory store
    const data = memoryStore.get(email);
    if (!data) return null;

    // Check if expired (5 minutes expiration)
    if (Date.now() > data.expiresAt) {
      memoryStore.delete(email);
      return null;
    }
    return data;
  },

  set: async (email, data) => {
    try {
      if (redisClient && redisClient.isOpen) {
        await redisClient.set(`otp:${email}`, JSON.stringify(data), {
          EX: 300,
        });
      }
    } catch (error) {
      console.error("Failed to set OTP in Redis, using memory store:", error);
    }

    // Always keep fallback set in memory
    memoryStore.set(email, data);
  },

  delete: async (email) => {
    try {
      if (redisClient && redisClient.isOpen) {
        await redisClient.del(`otp:${email}`);
      }
    } catch (error) {
      console.error("Failed to delete OTP from Redis, using memory store:", error);
    }

    // Clean up memory store
    memoryStore.delete(email);
  }
};

module.exports = otpStore;
