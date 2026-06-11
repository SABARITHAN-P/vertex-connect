const mongoose = require("mongoose");

const aiMessageAttachmentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      default: "",
    },
    extractedText: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const aiMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AiConversation",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    attachments: [aiMessageAttachmentSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("AiMessage", aiMessageSchema);
