const multer = require("multer");

/* =========================================================
   MEMORY STORAGE
========================================================= */

const storage = multer.memoryStorage();

/* =========================================================
   ALLOWED MIME TYPES
========================================================= */

const allowedMimeTypes = [
  /* =========================
     IMAGES
  ========================== */

  "image/png",

  "image/jpeg",

  "image/jpg",

  "image/webp",

  "image/gif",

  "image/heic",

  "image/heif",

  /* =========================
     VIDEOS
  ========================== */

  "video/mp4",

  "video/webm",

  "video/quicktime",

  "video/x-matroska",

  /* =========================
     AUDIO
  ========================== */

  "audio/mpeg",

  "audio/mp3",

  "audio/wav",

  "audio/ogg",

  "audio/webm",

  "audio/mp4",

  /* =========================
     DOCUMENTS
  ========================== */

  "application/pdf",

  "application/zip",

  "application/x-zip-compressed",

  "application/msword",

  "application/vnd.ms-powerpoint",

  "application/vnd.ms-excel",

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  "text/plain",

  /* =========================
     CODE / DEV FILES
  ========================== */

  "application/json",

  "text/javascript",

  "text/html",

  "text/css",
];

/* =========================================================
   FILE FILTER
========================================================= */

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

/* =========================================================
   MULTER CONFIG
========================================================= */

const upload = multer({
  storage,

  /* =========================
     100MB LIMIT
  ========================== */

  limits: {
    fileSize: 100 * 1024 * 1024,

    /* MAX FILE COUNT */
    files: 20,
  },

  fileFilter,
});

module.exports = upload;
