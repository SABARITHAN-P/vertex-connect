const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../../models/User");
const sendEmail = require("../../utils/sendEmail");
const generateOTP = require("../../utils/generateOTP");
const otpStore = require("../../utils/otpStore");

const sendOTP = async (req, res) => {
  try {
    const { email, username } = req.body;

    // Check existing user
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({
          message: "Email already registered",
        });
      }

      if (existingUser.username === username) {
        return res.status(400).json({
          message: "Username already taken",
        });
      }
    }

    // Check resend cooldown
    const existingOTPData = await otpStore.get(email);

    if (existingOTPData) {
      const timePassed = Date.now() - existingOTPData.lastSentAt;

      // 30 seconds cooldown
      if (timePassed < 30 * 1000) {
        const remainingTime = Math.ceil((30 * 1000 - timePassed) / 1000);

        return res.status(400).json({
          message: `Please wait ${remainingTime} seconds before requesting another OTP`,
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP
    await otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      lastSentAt: Date.now(),
    });

    // Send Email
    await sendEmail(
      email,
      "Vertex Connect • OTP Verification",
      `
        Hello,

        Use the verification code below to securely access your Vertex Connect account:

        🔐 OTP Code: ${otp}

        This code will expire in 5 minutes. Please do not share this code with anyone.

        If you did not request this verification, you can safely ignore this email.

        — Vertex Connect Security Team
        `,
    );

    res.status(200).json({
      message: "OTP sent successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const registerUser = async (req, res) => {
  try {
    const { username, email, password, otp } = req.body;

    // Check OTP exists
    const storedOTP = await otpStore.get(email);

    if (!storedOTP) {
      return res.status(400).json({
        message: "OTP not found",
      });
    }

    // Check expiry
    if (Date.now() > storedOTP.expiresAt) {
      await otpStore.delete(email);

      return res.status(400).json({
        message: "OTP expired",
      });
    }

    // Verify OTP
    if (storedOTP.otp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    // Check existing user
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    // Remove OTP after successful verification
    await otpStore.delete(email);

    // Generate JWT
    const token = jwt.sign(
      {
        id: newUser._id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

     res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        avatar: newUser.avatar,
        status: newUser.status,
        about: newUser.about,
        customAiApiKey: newUser.customAiApiKey || "",
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Check user
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials",
        showForgotPassword: true,
      });
    }

    // Generate JWT Token
    const token = jwt.sign(
      {
        id: user._id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        about: user.about,
        customAiApiKey: user.customAiApiKey || "",
      },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Cooldown check
    const existingOTPData = await otpStore.get(email);

    if (existingOTPData) {
      const timePassed = Date.now() - existingOTPData.lastSentAt;

      if (timePassed < 30 * 1000) {
        const remainingTime = Math.ceil((30 * 1000 - timePassed) / 1000);

        return res.status(400).json({
          message: `Please wait ${remainingTime} seconds before requesting another OTP`,
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP
    await otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
      lastSentAt: Date.now(),
    });

    // Send Email
    await sendEmail(
      email,
      "Vertex Connect • Password Reset OTP",
      `
      Hello,

      Use the OTP below to reset your Vertex Connect password:

      🔐 OTP Code: ${otp}

      This OTP will expire in 5 minutes.

      If you did not request this, ignore this email.

      — Vertex Connect Security Team
      `,
    );

    res.status(200).json({
      message: "Password reset OTP sent",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    // Password match check
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match",
      });
    }

    // Check OTP exists
    const storedOTP = await otpStore.get(email);

    if (!storedOTP) {
      return res.status(400).json({
        message: "OTP not found",
      });
    }

    // Check expiry
    if (Date.now() > storedOTP.expiresAt) {
      await otpStore.delete(email);

      return res.status(400).json({
        message: "OTP expired",
      });
    }

    // Verify OTP
    if (storedOTP.otp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const updatedUser = await User.findOneAndUpdate(
      { email },
      {
        password: hashedPassword,
      },
      { returnDocument: 'after' }
    );

    if (updatedUser) {
      const redisClient = require("../../config/redis");
      try {
        await redisClient.del(`user:profile:${updatedUser._id}`);
      } catch (err) {
        console.error("Cache clear failed on reset password:", err);
      }
    }

    // Delete OTP
    await otpStore.delete(email);

    res.status(200).json({
      message: "Password reset successful",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const verifyPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({
        message: "Password is required",
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Incorrect password",
      });
    }

    res.status(200).json({
      success: true,
      message: "Password verified",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  sendOTP,
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  getProfile,
  verifyPassword,
};
