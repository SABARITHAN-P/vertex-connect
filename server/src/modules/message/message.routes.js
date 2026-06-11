const express = require("express");

const router = express.Router();

const protect = require("../../middleware/authMiddleware");

const {
  sendMessage,
  fetchMessages,
  markAsDelivered,
  markAsRead,
  markVoiceAsRead,
  reactToMessage,
  deleteMessage,
  editMessage,
  pinMessage,
  getMediaMessages,
  getMessageInfo,
  votePoll,
  searchMessages,
} = require("./message.controller");

router.post("/", protect, sendMessage);

router.get("/media/:chatId", protect, getMediaMessages);
router.get("/info/:messageId", protect, getMessageInfo);
router.get("/search/:chatId", protect, searchMessages);
router.get("/:chatId", protect, fetchMessages);

router.patch("/delivered/:messageId", protect, markAsDelivered);

router.patch("/read/:chatId", protect, markAsRead);

router.patch("/read-voice/:messageId", protect, markVoiceAsRead);

router.put("/react/:messageId", protect, reactToMessage);

router.put("/edit/:messageId", protect, editMessage);

router.put("/pin/:messageId", protect, pinMessage);

router.put("/poll/vote/:messageId", protect, votePoll);

router.delete("/:messageId", protect, deleteMessage);

module.exports = router;
