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
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
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
});
// Nodemon trigger reload after axios install
