const redisClient = require("../config/redis");

const otpStore = {
  get: async (email) => {
    try {
      const data = await redisClient.get(`otp:${email}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Failed to get OTP from Redis:", error);
      return null;
    }
  },

  set: async (email, data) => {
    try {
      // Keep OTP active for 5 minutes (300 seconds)
      await redisClient.set(`otp:${email}`, JSON.stringify(data), {
        EX: 300,
      });
    } catch (error) {
      console.error("Failed to set OTP in Redis:", error);
    }
  },

  delete: async (email) => {
    try {
      await redisClient.del(`otp:${email}`);
    } catch (error) {
      console.error("Failed to delete OTP from Redis:", error);
    }
  }
};

module.exports = otpStore;
