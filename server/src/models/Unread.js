const mongoose = require("mongoose");

const unreadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    chatType: {
      type: String,
      enum: ["private", "group"],
      required: true,
    },
    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

/* Optimize lookup by indexing (userId, chatId) uniquely to avoid duplicates */
unreadSchema.index({ userId: 1, chatId: 1 }, { unique: true });
unreadSchema.index({ userId: 1 });

const Unread = mongoose.model("Unread", unreadSchema);

module.exports = Unread;
