const mongoose = require("mongoose");

const privacySettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    accountType: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    messagesPermission: {
      type: String,
      enum: ["everyone", "followers", "mutual", "nobody"],
      default: "everyone",
    },
    groupsPermission: {
      type: String,
      enum: ["everyone", "followers", "mutual"],
      default: "everyone",
    },
    showLastSeen: {
      type: Boolean,
      default: true,
    },
    showOnline: {
      type: Boolean,
      default: true,
    },
    profilePhotoPermission: {
      type: String,
      enum: ["everyone", "followers", "mutual", "nobody"],
      default: "everyone",
    },
    emailVisibility: {
      type: String,
      enum: ["everyone", "followers", "mutual", "nobody"],
      default: "everyone",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("PrivacySettings", privacySettingsSchema);
