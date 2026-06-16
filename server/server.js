const http = require("http");
const dotenv = require("dotenv");
const { Server } = require("socket.io");

dotenv.config();

const app = require("./src/app");
const connectDB = require("./src/config/db");

const socketHandler = require("./src/sockets/socketHandler");

const { initSocket } = require("./src/sockets/socket");

connectDB();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      const clientUrl = process.env.CLIENT_URL
        ? process.env.CLIENT_URL.replace(/\/$/, "")
        : null;

      const allowedOrigins = [
        /^http:\/\/localhost(:\d+)?$/,
        /^https:\/\/vertex-connect.*\.vercel\.app$/,
        clientUrl
      ].filter(Boolean);
      
      const isAllowed = !origin || allowedOrigins.some(pattern => {
        if (pattern instanceof RegExp) {
          return pattern.test(origin);
        }
        return pattern === origin;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`Blocked socket connection from unauthorized origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  },

  /* FASTER OFFLINE DETECTION */
  pingTimeout: 5000,
  pingInterval: 2000,
});

// Configure Socket.io Redis Adapter for horizontal scaling
const { createAdapter } = require("@socket.io/redis-adapter");
const redisClient = require("./src/config/redis");

const pubClient = redisClient;
const subClient = redisClient.duplicate();

subClient.on("error", (err) => console.error("Redis Sub Client Error:", err));

(async () => {
  try {
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.io Redis Adapter Initialized Successfully!");
  } catch (error) {
    console.error("Failed to initialize Socket.io Redis Adapter:", error);
  }
})();

/* INITIALIZE SOCKET GLOBALLY */
initSocket(io);

socketHandler(io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // 1. Keep-Alive Ping for Render Free Tier to prevent sleep/spin-down.
  // Pings the public URL every 10 minutes to reset Render's 15-minute inactivity timer.
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
  if (RENDER_URL) {
    const axios = require("axios");
    const intervalMs = 10 * 60 * 1000; // 10 minutes
    
    // Start self-pinging
    setInterval(async () => {
      try {
        console.log(`Sending keep-alive self-ping to: ${RENDER_URL}`);
        await axios.get(RENDER_URL);
        console.log("Keep-alive self-ping successful.");
      } catch (error) {
        console.error("Keep-alive self-ping failed:", error.message);
      }
    }, intervalMs);
  }

  // 2. Keep-Alive for Brevo API Key to prevent 90-day inactivity deactivation.
  // Makes a simple account lookup call to Brevo every 20 days (within JS 32-bit timer limits).
  const BREVO_KEY = process.env.BREVO_API_KEY;
  if (BREVO_KEY) {
    const axios = require("axios");
    const twentyDaysMs = 20 * 24 * 60 * 60 * 1000; // 20 days in milliseconds
    
    setInterval(async () => {
      try {
        console.log("Sending keep-alive check to Brevo API...");
        await axios.get("https://api.brevo.com/v3/account", {
          headers: {
            "api-key": BREVO_KEY,
            "Accept": "application/json",
          },
        });
        console.log("Brevo API key keep-alive successful.");
      } catch (error) {
        console.error("Brevo API key keep-alive failed:", error.response?.data?.message || error.message);
      }
    }, twentyDaysMs);
  }
});

