const express = require("express");

const router = express.Router();

const {
  sendOTP,
  registerUser,
  loginUser,
  getProfile,
  forgotPassword,
  resetPassword,
  verifyPassword,
} = require("./auth.controller");

const protect = require("../../middleware/authMiddleware");

router.post("/send-otp", sendOTP);

router.post("/register", registerUser);

router.post("/login", loginUser);

router.get("/profile", protect, getProfile);

router.post("/forgot-password", forgotPassword);

router.post("/reset-password", resetPassword);

router.post("/verify-password", protect, verifyPassword);

module.exports = router;
