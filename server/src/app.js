const express = require("express");
const cors = require("cors");

const authRoutes = require("./modules/auth/auth.routes");
const chatRoutes = require("./modules/chat/chat.routes");
const messageRoutes = require("./modules/message/message.routes");
const userRoutes = require("./modules/user/user.routes");
const uploadRoutes = require("./modules/media/upload.routes");
const callRoutes = require("./modules/call/call.routes");
const aiRoutes = require("./modules/ai/ai.routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

app.get("/", (req, res) => {
  res.send("Vertex Connect API Running...");
});

// Auth Routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/user", userRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/call", callRoutes);
app.use("/api/ai", aiRoutes);

module.exports = app;
