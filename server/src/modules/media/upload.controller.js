const cloudinary = require("../../config/cloudinary");

const streamifier = require("streamifier");

/* =========================================================
   DETECT RESOURCE TYPE
========================================================= */

const detectResourceType = (mimeType) => {
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
    return "video";
  }

  return "raw";
};

/* =========================================================
   SINGLE CLOUDINARY UPLOAD
========================================================= */

const uploadToCloudinary = async (file) => {
  const resourceType = detectResourceType(file.mimetype);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "vertex-connect",

        resource_type: resourceType,

        /* =========================
                 PERFORMANCE
              ========================== */

        chunk_size: 6000000,

        use_filename: true,

        unique_filename: true,

        overwrite: false,
      },

      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            url: result.secure_url,

            type: file.mimetype.startsWith("image/")
              ? "image"
              : file.mimetype.startsWith("video/")
                ? "video"
                : file.mimetype.startsWith("audio/")
                  ? "audio"
                  : "file",

            fileName: file.originalname,

            fileSize: file.size,

            mimeType: file.mimetype,

            duration: result.duration || 0,

            thumbnailUrl: result.secure_url || "",
          });
        }
      },
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  });
};

/* =========================================================
   MULTIPLE MEDIA UPLOAD
========================================================= */

const uploadMedia = async (req, res) => {
  try {
    /* =========================
       VALIDATION
    ========================== */

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "No files uploaded",
      });
    }

    /* =========================
       CONCURRENT UPLOADS
    ========================== */

    const uploadPromises = req.files.map((file) => uploadToCloudinary(file));

    const uploadedFiles = await Promise.all(uploadPromises);

    /* =========================
       RESPONSE
    ========================== */

    res.status(200).json({
      success: true,

      media: uploadedFiles,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Upload failed",
    });
  }
};

module.exports = {
  uploadMedia,
};
