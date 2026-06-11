const PrivacySettings = require("../../models/PrivacySettings");
const { getIO } = require("../../sockets/socket");
const { invalidateChatsCache, invalidatePrivacyCache } = require("../../utils/cacheHelper");

/* =========================================================
   GET PRIVACY SETTINGS
========================================================= */
const getPrivacySettings = async (req, res) => {
  try {
    const userId = req.user._id;

    let settings = await PrivacySettings.findOne({ user: userId });
    if (!settings) {
      settings = await PrivacySettings.create({
        user: userId,
        accountType: "public",
        messagesPermission: "everyone",
        groupsPermission: "everyone",
        showLastSeen: true,
        showOnline: true,
        profilePhotoPermission: "everyone",
        emailVisibility: "everyone",
      });
    }

    res.status(200).json(settings);
  } catch (error) {
    console.error("Get Privacy Settings Error:", error);
    res.status(500).json({ message: "Failed to retrieve privacy settings" });
  }
};

/* =========================================================
   UPDATE PRIVACY SETTINGS
 ========================================================= */
const updatePrivacySettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountType, messagesPermission, groupsPermission, showLastSeen, showOnline, profilePhotoPermission, emailVisibility } = req.body;

    let settings = await PrivacySettings.findOne({ user: userId });
    if (!settings) {
      settings = new PrivacySettings({ user: userId });
    }

    if (accountType !== undefined) settings.accountType = accountType;
    if (messagesPermission !== undefined) settings.messagesPermission = messagesPermission;
    if (groupsPermission !== undefined) settings.groupsPermission = groupsPermission;
    if (showLastSeen !== undefined) settings.showLastSeen = showLastSeen;
    if (showOnline !== undefined) settings.showOnline = showOnline;
    if (profilePhotoPermission !== undefined) settings.profilePhotoPermission = profilePhotoPermission;
    if (emailVisibility !== undefined) settings.emailVisibility = emailVisibility;

    await settings.save();

    // Invalidate active chats cache and privacy settings cache
    await invalidateChatsCache(userId);
    await invalidatePrivacyCache(userId);

    // Emit real-time update socket event
    const io = getIO();
    io.to(userId.toString()).emit("privacy:updated", {
      userId,
      accountType: settings.accountType,
      messagesPermission: settings.messagesPermission,
      groupsPermission: settings.groupsPermission,
      showLastSeen: settings.showLastSeen,
      showOnline: settings.showOnline,
      profilePhotoPermission: settings.profilePhotoPermission,
      emailVisibility: settings.emailVisibility,
    });

    res.status(200).json(settings);
  } catch (error) {
    console.error("Update Privacy Settings Error:", error);
    res.status(500).json({ message: "Failed to update privacy settings" });
  }
};

module.exports = {
  getPrivacySettings,
  updatePrivacySettings,
};
