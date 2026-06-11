const express = require("express");

const router = express.Router();

const { uploadMedia } = require("./upload.controller");

const upload = require("../../middleware/uploadMiddleware");

const protect = require("../../middleware/authMiddleware");

/* =========================================================
   MULTIPLE MEDIA UPLOAD
========================================================= */

router.post(
  "/",

  protect,

  (req, res, next) => {
    upload.array("files", 20)(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          message: err.message,
        });
      }

      next();
    });
  },

  uploadMedia,
);

module.exports = router;
