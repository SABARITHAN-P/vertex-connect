const crypto = require("crypto");
const cloudinary = require("../../config/cloudinary");
const streamifier = require("streamifier");
const path = require("path");
const redisClient = require("../../config/redis");
const UploadedFile = require("../../models/UploadedFile");

/* =========================================================
   HASH HELPER
========================================================= */

const getFileHash = (buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

/* =========================================================
   CHECK FILE HASH FOR INSTANT UPLOAD
========================================================= */

const checkFileHash = async (req, res) => {
  try {
    const { hash } = req.params;
    if (!hash) {
      return res.status(400).json({ message: "Hash is required" });
    }

    const cacheKey = `file_hash:${hash}`;

    // Check Redis first
    if (redisClient && redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.status(200).json({ exists: true, media: JSON.parse(cached) });
      }
    }

    // Check MongoDB
    const existingFile = await UploadedFile.findOne({ hash }).lean();
    if (existingFile) {
      const resData = {
        url: existingFile.url,
        type: existingFile.type,
        fileName: existingFile.fileName,
        fileSize: existingFile.fileSize,
        mimeType: existingFile.mimeType,
        duration: existingFile.duration,
        thumbnailUrl: existingFile.thumbnailUrl,
      };

      if (redisClient && redisClient.isOpen) {
        await redisClient.set(cacheKey, JSON.stringify(resData), { EX: 86400 * 30 });
      }

      return res.status(200).json({ exists: true, media: resData });
    }

    return res.status(200).json({ exists: false });
  } catch (error) {
    console.error("Check hash error:", error);
    return res.status(500).json({ message: "Server error checking hash" });
  }
};

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
  const hash = getFileHash(file.buffer);
  const cacheKey = `file_hash:${hash}`;

  try {
    // Check Redis first
    if (redisClient && redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log("Redis Upload Cache Hit for hash:", hash);
        return JSON.parse(cached);
      }
    }

    // Check MongoDB
    const existingFile = await UploadedFile.findOne({ hash }).lean();
    if (existingFile) {
      console.log("MongoDB Upload Cache Hit for hash:", hash);
      const resData = {
        url: existingFile.url,
        type: existingFile.type,
        fileName: existingFile.fileName,
        fileSize: existingFile.fileSize,
        mimeType: existingFile.mimeType,
        duration: existingFile.duration,
        thumbnailUrl: existingFile.thumbnailUrl,
      };
      if (redisClient && redisClient.isOpen) {
        await redisClient.set(cacheKey, JSON.stringify(resData), { EX: 86400 * 30 });
      }
      return resData;
    }
  } catch (cacheErr) {
    console.error("Cache read error during upload:", cacheErr);
  }

  const resourceType = detectResourceType(file.mimetype);

  const result = await new Promise((resolve, reject) => {
    const parsedPath = path.parse(file.originalname);
    const safeName = parsedPath.name.replace(/[^a-zA-Z0-9-_]/g, "_");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    
    const publicId = resourceType === "raw" 
      ? `${safeName}_${uniqueSuffix}${parsedPath.ext}`
      : `${safeName}_${uniqueSuffix}`;

    const uploadOptions = {
      folder: "vertex-connect",
      resource_type: resourceType,
      public_id: publicId,
      chunk_size: 6000000,
      overwrite: false,
    };

    if (resourceType === "image" || resourceType === "video") {
      uploadOptions.transformation = [
        { quality: "auto", fetch_format: "auto" }
      ];
    }

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, cloudinaryResult) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            url: cloudinaryResult.secure_url,
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
            duration: cloudinaryResult.duration || 0,
            thumbnailUrl: cloudinaryResult.secure_url || "",
          });
        }
      },
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  });

  try {
    // Persist to MongoDB
    await UploadedFile.create({
      hash,
      url: result.url,
      type: result.type,
      fileName: result.fileName,
      fileSize: result.fileSize,
      mimeType: result.mimeType,
      duration: result.duration,
      thumbnailUrl: result.thumbnailUrl,
    });

    // Cache in Redis
    if (redisClient && redisClient.isOpen) {
      await redisClient.set(cacheKey, JSON.stringify(result), { EX: 86400 * 30 });
    }
  } catch (saveErr) {
    console.error("Cache save error during upload:", saveErr);
  }

  return result;
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
  checkFileHash,
};
