const UserAppearance = require("../../models/UserAppearance");
const redisClient = require("../../config/redis");
const cloudinary = require("../../config/cloudinary");
const streamifier = require("streamifier");
const { getIO } = require("../../sockets/socket");

const uploadWallpaperToCloudinary = (file) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "vertex-connect/wallpapers",
        resource_type: "image",
        quality: "auto",
        fetch_format: "auto",
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(file.buffer).pipe(stream);
  });
};

const getAppearanceSettings = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const cacheKey = `user:appearance:${userId}`;

    // 1. Try Cache First
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (cacheErr) {
      console.error("Redis read error in getAppearanceSettings:", cacheErr);
    }

    // 2. Query Database
    let appearance = await UserAppearance.findOne({ user: req.user._id });
    if (!appearance) {
      appearance = await UserAppearance.create({
        user: req.user._id,
        themeMode: "dark",
        wallpaperType: "default",
        wallpaperValue: "",
        wallpaperOpacity: 100,
      });
    }

    // 3. Write Cache (expires in 7 days)
    try {
      await redisClient.setEx(cacheKey, 7 * 24 * 60 * 60, JSON.stringify(appearance));
    } catch (cacheErr) {
      console.error("Redis write error in getAppearanceSettings:", cacheErr);
    }

    res.status(200).json(appearance);
  } catch (error) {
    console.error("Failed to get appearance settings:", error);
    res.status(500).json({ message: "Failed to load appearance preferences" });
  }
};

const updateAppearanceSettings = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const cacheKey = `user:appearance:${userId}`;
    const { 
      themeMode, 
      wallpaperType, 
      wallpaperValue, 
      wallpaperOpacity,
      fontSize,
      fontStyle,
      compactMode,
      enterToSend,
      soundsEnabled,
      autoScroll
    } = req.body;

    // Validate inputs
    if (themeMode && !["light", "dark"].includes(themeMode)) {
      return res.status(400).json({ message: "Invalid theme mode" });
    }
    if (wallpaperType && !["default", "color", "gradient", "custom"].includes(wallpaperType)) {
      return res.status(400).json({ message: "Invalid wallpaper type" });
    }
    if (wallpaperOpacity !== undefined && (wallpaperOpacity < 0 || wallpaperOpacity > 100)) {
      return res.status(400).json({ message: "Wallpaper opacity must be between 0 and 100" });
    }
    if (fontSize && !["small", "medium", "large"].includes(fontSize)) {
      return res.status(400).json({ message: "Invalid font size" });
    }

    const updateFields = {};
    if (themeMode !== undefined) updateFields.themeMode = themeMode;
    if (wallpaperType !== undefined) updateFields.wallpaperType = wallpaperType;
    if (wallpaperValue !== undefined) updateFields.wallpaperValue = wallpaperValue;
    if (wallpaperOpacity !== undefined) updateFields.wallpaperOpacity = wallpaperOpacity;
    if (fontSize !== undefined) updateFields.fontSize = fontSize;
    if (fontStyle !== undefined) updateFields.fontStyle = fontStyle;
    if (compactMode !== undefined) updateFields.compactMode = compactMode;
    if (enterToSend !== undefined) updateFields.enterToSend = enterToSend;
    if (soundsEnabled !== undefined) updateFields.soundsEnabled = soundsEnabled;
    if (autoScroll !== undefined) updateFields.autoScroll = autoScroll;

    // 1. Update Database
    const updatedAppearance = await UserAppearance.findOneAndUpdate(
      { user: req.user._id },
      { $set: updateFields },
      { returnDocument: 'after', upsert: true }
    );

    // 2. Update Cache
    try {
      await redisClient.setEx(cacheKey, 7 * 24 * 60 * 60, JSON.stringify(updatedAppearance));
    } catch (cacheErr) {
      console.error("Redis write error in updateAppearanceSettings:", cacheErr);
    }

    // 3. Emit Live Socket Update to User's Personal Room
    try {
      const io = getIO();
      io.to(userId).emit("appearance:updated", updatedAppearance);
    } catch (socketErr) {
      console.error("Socket emit error in updateAppearanceSettings:", socketErr);
    }

    res.status(200).json(updatedAppearance);
  } catch (error) {
    console.error("Failed to update appearance settings:", error);
    res.status(500).json({ message: "Failed to save appearance preferences" });
  }
};

const uploadWallpaperImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No wallpaper file provided" });
    }

    const imageUrl = await uploadWallpaperToCloudinary(req.file);
    res.status(200).json({ url: imageUrl });
  } catch (error) {
    console.error("Wallpaper upload failed:", error);
    res.status(500).json({ message: "Wallpaper upload failed" });
  }
};

module.exports = {
  getAppearanceSettings,
  updateAppearanceSettings,
  uploadWallpaperImage,
};
