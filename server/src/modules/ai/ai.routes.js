const express = require("express");
const multer = require("multer");
const protect = require("../../middleware/authMiddleware");
const aiController = require("./ai.controller");

const router = express.Router();

// Self-contained memory storage multer for file parsing in buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file limit
  },
});

// Protect all routes
router.use(protect);

/* =========================================================
   ROUTES
========================================================= */

// Conversations CRUD
router.get("/conversations", aiController.getConversations);
router.post("/conversations", aiController.createConversation);
router.put("/conversations/:id", aiController.renameConversation);
router.delete("/conversations/:id", aiController.deleteConversation);

// Messages in Conversation
router.get("/conversations/:id/messages", aiController.getMessages);
router.post("/conversations/:id/messages", aiController.sendMessage);

// AI Models
router.get("/models", aiController.getModels);

// File Parser (extracts text from PDF/DOCX/TXT/MD buffers)
router.post("/parse-file", upload.single("file"), aiController.parseFile);

module.exports = router;
