const cloudinary = require("../../config/cloudinary");
const streamifier = require("streamifier");
const path = require("path");

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
    const parsedPath = path.parse(file.originalname);
    const safeName = parsedPath.name.replace(/[^a-zA-Z0-9-_]/g, "_");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    
    // For raw resources, Cloudinary requires the extension in the public_id to serve it correctly.
    // For images/videos, we should not include the extension in public_id because Cloudinary adds it automatically.
    const publicId = resourceType === "raw" 
      ? `${safeName}_${uniqueSuffix}${parsedPath.ext}`
      : `${safeName}_${uniqueSuffix}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "vertex-connect",

        resource_type: resourceType,

        public_id: publicId,

        /* =========================
                 PERFORMANCE
              ========================== */

        chunk_size: 6000000,

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
