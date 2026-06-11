const express = require("express");
const router = express.Router();
const {
  getCallHistory,
  getUnseenMissedCallsCount,
  createCallHistory,
  updateCallHistory,
} = require("./call.controller");
const protect = require("../../middleware/authMiddleware");

router.get("/history", protect, getCallHistory);
router.get("/unseen-count", protect, getUnseenMissedCallsCount);
router.post("/history", protect, createCallHistory);
router.patch("/history/:callId", protect, updateCallHistory);

module.exports = router;
