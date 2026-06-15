const mongoose = require("mongoose");

const userAppearanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    themeMode: {
      type: String,
      enum: ["light", "dark"],
      default: "dark",
    },
    wallpaperType: {
      type: String,
      enum: ["default", "color", "gradient", "custom"],
      default: "default",
    },
    wallpaperValue: {
      type: String, // Hex color, CSS gradient, or Cloudinary custom image URL
      default: "",
    },
    wallpaperOpacity: {
      type: Number, // Opacity level from 0 to 100
      default: 100,
    },
    fontSize: {
      type: String,
      enum: ["small", "medium", "large"],
      default: "medium",
    },
    fontStyle: {
      type: String,
      default: "system",
    },
    compactMode: {
      type: Boolean,
      default: false,
    },
    enterToSend: {
      type: Boolean,
      default: true,
    },
    soundsEnabled: {
      type: Boolean,
      default: true,
    },
    autoScroll: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("UserAppearance", userAppearanceSchema);
