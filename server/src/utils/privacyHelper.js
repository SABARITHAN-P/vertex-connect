const { getCachedPrivacySettings, checkFollowStatusCached } = require("./cacheHelper");
const Block = require("../models/Block");
const PrivacySettings = require("../models/PrivacySettings");

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

/**
 * Checks call permissions between a caller and a receiver.
 * @param {string|ObjectId} callerId - ID of the caller.
 * @param {string|ObjectId} receiverId - ID of the receiver.
 * @returns {object} { allowed: boolean, reason?: string, message?: string }
 */
const checkCallPermission = async (callerId, receiverId) => {
  if (callerId.toString() === receiverId.toString()) {
    return { allowed: true };
  }

  // 1. Check Block relationship
  const blockExists = await Block.findOne({
    $or: [
      { blocker: callerId, blocked: receiverId },
      { blocker: receiverId, blocked: callerId },
    ],
  });
  if (blockExists) {
    const isBlockedByMe = blockExists.blocker.toString() === callerId.toString();
    return {
      allowed: false,
      reason: "blocked",
      isBlockedByMe,
      message: isBlockedByMe 
        ? "You have blocked this user. Unblock to call."
        : "You cannot call this user because you have been blocked.",
    };
  }

  // 2. Fetch Follow status and settings
  const senderFollowsReceiver = await checkFollowStatusCached(callerId, receiverId);
  const receiverFollowsSender = await checkFollowStatusCached(receiverId, callerId);
  const isMutual = !!(senderFollowsReceiver && receiverFollowsSender);

  let receiverSettings = await getCachedPrivacySettings(receiverId);
  if (!receiverSettings) {
    receiverSettings = await PrivacySettings.findOne({ user: receiverId });
    if (!receiverSettings) {
      receiverSettings = { accountType: "public", messagesPermission: "everyone" };
    }
  }

  // 3. Evaluate Privacy Permissions (Call matches Messages settings)
  if (receiverSettings.accountType === "private") {
    if (!isMutual) {
      return {
        allowed: false,
        reason: "private_mutual_required",
        message: "You must follow each other mutually to message or call.",
      };
    }
  } else {
    const permission = receiverSettings.messagesPermission || "everyone";
    if (permission === "nobody") {
      return {
        allowed: false,
        reason: "nobody",
        message: "This user has disabled messages and calls.",
      };
    }
    if (permission === "followers" && !receiverFollowsSender) {
      return {
        allowed: false,
        reason: "followers_only",
        message: "You must follow this user to message or call them.",
      };
    }
    if (permission === "mutual" && !isMutual) {
      return {
        allowed: false,
        reason: "mutual_only",
        message: "You must follow each other mutually to message or call.",
      };
    }
  }

  return { allowed: true };
};

module.exports = { redactUserPrivacy, checkCallPermission };
