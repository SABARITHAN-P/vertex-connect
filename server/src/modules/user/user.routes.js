const express = require("express");
const router = express.Router();

const { searchUsers, updateProfile, updateAvatar, removeAvatar, blockUser, unblockUser, getBlockedUsers, sendFeedbackEmail } = require("./user.controller");
const { toggleFollow, getFollowStatus, getFollowersList, getFollowingList, getFollowRequests, acceptFollowRequest, rejectFollowRequest, removeFollower } = require("./follow.controller");
const { getPrivacySettings, updatePrivacySettings } = require("./privacy.controller");
const { getAppearanceSettings, updateAppearanceSettings, uploadWallpaperImage } = require("./appearance.controller");
const protect = require("../../middleware/authMiddleware");
const upload = require("../../middleware/uploadMiddleware");

router.get("/search", protect, searchUsers);
router.put("/profile", protect, updateProfile);
router.put("/avatar", protect, upload.single("avatar"), updateAvatar);
router.delete("/avatar", protect, removeAvatar);

router.post("/block/:userId", protect, blockUser);
router.post("/unblock/:userId", protect, unblockUser);
router.get("/blocked", protect, getBlockedUsers);
router.post("/feedback", protect, sendFeedbackEmail);

// Follow System Endpoints
router.post("/follow/:userId", protect, toggleFollow);
router.get("/follow/status/:userId", protect, getFollowStatus);
router.get("/follow/followers/:userId", protect, getFollowersList);
router.get("/follow/following/:userId", protect, getFollowingList);
router.get("/follow/requests", protect, getFollowRequests);
router.post("/follow/request/:requestId/accept", protect, acceptFollowRequest);
router.post("/follow/request/:requestId/reject", protect, rejectFollowRequest);
router.delete("/follow/follower/:userId", protect, removeFollower);

// Privacy Settings Endpoints
router.get("/privacy", protect, getPrivacySettings);
router.put("/privacy", protect, updatePrivacySettings);

// Appearance Settings Endpoints
router.get("/appearance", protect, getAppearanceSettings);
router.put("/appearance", protect, updateAppearanceSettings);
router.post("/appearance/wallpaper", protect, upload.single("wallpaper"), uploadWallpaperImage);

module.exports = router;
