const express = require("express");

const router = express.Router();

const { uploadMedia, checkFileHash } = require("./upload.controller");

const upload = require("../../middleware/uploadMiddleware");

const protect = require("../../middleware/authMiddleware");

/* =========================================================
   CHECK FILE HASH FOR INSTANT UPLOAD
========================================================= */
router.get("/check/:hash", protect, checkFileHash);

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
