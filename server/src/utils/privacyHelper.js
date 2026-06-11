const { getCachedPrivacySettings, checkFollowStatusCached } = require("./cacheHelper");

/**
 * Redacts lastSeen and avatar properties of a user based on their privacy settings.
 * @param {string|ObjectId} requestingUserId - ID of the requesting user.
 * @param {object} user - User document or object.
 * @returns {object} The user object, potentially modified.
 */
const redactUserPrivacy = async (requestingUserId, user) => {
  if (!user) return user;
  
  const targetUserId = user._id || user.id;
  if (!targetUserId) return user;

  if (requestingUserId.toString() === targetUserId.toString()) {
    return user; // Never redact own profile info
  }

  // Fetch privacy settings for the target user
  const settings = await getCachedPrivacySettings(targetUserId);
  if (!settings) {
    return user; // Return unchanged if no settings found (defaults allow viewing)
  }

  // 1. Check Last Seen Visibility
  if (settings.showLastSeen === false) {
    user.lastSeen = null;
  }

  // 2. Check Profile Photo Visibility
  let canViewPhoto = true;
  if (settings.profilePhotoPermission === "nobody") {
    canViewPhoto = false;
  } else if (settings.profilePhotoPermission === "followers") {
    const isFollower = await checkFollowStatusCached(requestingUserId, targetUserId);
    if (!isFollower) canViewPhoto = false;
  } else if (settings.profilePhotoPermission === "mutual") {
    const targetFollows = await checkFollowStatusCached(targetUserId, requestingUserId);
    const sourceFollows = await checkFollowStatusCached(requestingUserId, targetUserId);
    if (!targetFollows || !sourceFollows) canViewPhoto = false;
  }

  if (!canViewPhoto) {
    user.avatar = null;
  }

  // 3. Check Email Visibility
  let canViewEmail = true;
  const emailVis = settings.emailVisibility || "everyone";
  if (emailVis === "nobody") {
    canViewEmail = false;
  } else if (emailVis === "followers") {
    const isFollower = await checkFollowStatusCached(requestingUserId, targetUserId);
    if (!isFollower) canViewEmail = false;
  } else if (emailVis === "mutual") {
    const targetFollows = await checkFollowStatusCached(targetUserId, requestingUserId);
    const sourceFollows = await checkFollowStatusCached(requestingUserId, targetUserId);
    if (!targetFollows || !sourceFollows) canViewEmail = false;
  }

  if (!canViewEmail) {
    if (user._doc) {
      user._doc.email = undefined;
    }
    user.email = undefined;
  }

  return user;
};

module.exports = { redactUserPrivacy };
