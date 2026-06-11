const { createClient } = require("redis");

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error("WARNING: REDIS_URL is not set in environment variables!");
}

const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      const delay = Math.min(retries * 100, 3000);
      return delay;
    }
  }
});

redisClient.on("error", (err) => console.error("Redis Client Error:", err));
redisClient.on("ready", () => console.log("Redis Client Connected Successfully!"));

// Establish connection asynchronously
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error("Failed to connect to Redis on startup:", error);
  }
})();

module.exports = redisClient;
