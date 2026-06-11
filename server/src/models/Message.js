const mongoose = require("mongoose");

/* =========================
   MEDIA SCHEMA
========================== */

const mediaSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },

    type: {
      type: String,

      enum: ["image", "video", "audio", "file"],

      required: true,
    },

    thumbnailUrl: {
      type: String,
      default: "",
    },

    fileName: {
      type: String,
      default: "",
    },

    fileSize: {
      type: Number,
      default: 0,
    },

    mimeType: {
      type: String,
      default: "",
    },

    duration: {
      type: Number,
      default: 0,
    },

    peaks: {
      type: [Number],
      default: [],
    },
  },
  {
    _id: false,
  },
);

const messageSchema = new mongoose.Schema(
  {
    /* =========================
         CHAT
      ========================== */

    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },

    /* =========================
         SENDER
      ========================== */

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /* =========================
         MESSAGE TYPE
      ========================== */

    messageType: {
      type: String,

      enum: [
        "text",
        "media",
        "image",
        "video",
        "audio",
        "file",
        "poll",
      ],

      default: "text",
    },

    /* =========================
         TEXT CONTENT
      ========================== */

    content: {
      type: String,
      trim: true,
      default: "",
    },

    /* =========================
         CAPTION
      ========================== */

    caption: {
      type: String,
      trim: true,
      default: "",
    },

    /* =========================
         MULTIPLE MEDIA
      ========================== */

    media: [mediaSchema],

    /* =========================
         LEGACY SINGLE MEDIA
         (TEMPORARY BACKWARD SUPPORT)
      ========================== */

    mediaUrl: {
      type: String,
      default: "",
    },

    thumbnailUrl: {
      type: String,
      default: "",
    },

    fileName: {
      type: String,
      default: "",
    },

    fileSize: {
      type: Number,
      default: 0,
    },

    mimeType: {
      type: String,
      default: "",
    },

    duration: {
      type: Number,
      default: 0,
    },

    /* =========================
         REACTIONS
      ========================== */

    reactions: [
      {
        _id: false,

        user: {
          type: mongoose.Schema.Types.ObjectId,

          ref: "User",
        },

        emoji: {
          type: String,
        },
      },
    ],

    /* =========================
         MESSAGE STATUS
      ========================== */

    messageStatus: [
      {
        _id: false,

        user: {
          type: mongoose.Schema.Types.ObjectId,

          ref: "User",
        },

        delivered: {
          type: Boolean,
          default: false,
        },

        deliveredAt: Date,

        read: {
          type: Boolean,
          default: false,
        },

        readAt: Date,
      },
    ],

    /* =========================
         DELETE / EDIT
      ========================== */

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: [],
      },
    ],

    edited: {
      type: Boolean,
      default: false,
    },

    isSystem: {
      type: Boolean,
      default: false,
    },

    editedAt: Date,

    replyTo: {
      messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      senderName: {
        type: String,
      },
      text: {
        type: String,
      },
      messageType: {
        type: String,
      },
      mediaThumbnail: {
        type: String,
      },
    },

    poll: {
      question: {
        type: String,
        trim: true,
      },
      options: [
        {
          optionText: {
            type: String,
            trim: true,
          },
          votes: [
            {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
              default: [],
            },
          ],
        },
      ],
      allowMultiple: {
        type: Boolean,
        default: false,
      },
      showVoters: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Message", messageSchema);
