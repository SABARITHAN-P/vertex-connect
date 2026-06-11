const Follow = require("../../models/Follow");
const Block = require("../../models/Block");
const User = require("../../models/User");
const PrivacySettings = require("../../models/PrivacySettings");
const redisClient = require("../../config/redis");
const { getIO } = require("../../sockets/socket");

const { invalidateChatsCache, invalidateFollowCache } = require("../../utils/cacheHelper");

/* =========================================================
   FOLLOW / UNFOLLOW TOGGLE
========================================================= */
const toggleFollow = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (userId.toString() === currentUserId.toString()) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if block relationship exists
    const blockExists = await Block.findOne({
      $or: [
        { blocker: currentUserId, blocked: userId },
        { blocker: userId, blocked: currentUserId },
      ],
    });

    if (blockExists) {
      return res.status(400).json({ message: "Cannot perform action due to blocks" });
    }

    const targetPrivacy = await PrivacySettings.findOne({ user: userId });
    const isPrivate = targetPrivacy ? targetPrivacy.accountType === "private" : false;

    const existingFollow = await Follow.findOne({
      follower: currentUserId,
      following: userId,
    });

    let followStatus = "not_following";
    let isFollowing = false;

    if (existingFollow) {
      // Cancel request or Unfollow
      await Follow.deleteOne({ _id: existingFollow._id });
    } else {
      // Follow / Request
      const statusValue = isPrivate ? "pending" : "accepted";
      await Follow.create({
        follower: currentUserId,
        following: userId,
        status: statusValue,
      });
      followStatus = isPrivate ? "requested" : "following";
      isFollowing = true;
    }

    // Invalidate active chats cache for both users and follow relationship cache
    await invalidateChatsCache(currentUserId);
    await invalidateChatsCache(userId);
    await invalidateFollowCache(currentUserId, userId);

    // Emit follow status update through socket.io
    const io = getIO();
    io.to(userId.toString()).emit("follow:update", {
      followerId: currentUserId,
      followingId: userId,
      isFollowing,
      status: followStatus,
    });
    io.to(currentUserId.toString()).emit("follow:update", {
      followerId: currentUserId,
      followingId: userId,
      isFollowing,
      status: followStatus,
    });

    res.status(200).json({
      message: isFollowing 
        ? (isPrivate ? "Follow request sent" : "Successfully followed user") 
        : "Successfully unfollowed user",
      isFollowing,
      status: followStatus,
    });
  } catch (error) {
    console.error("Toggle Follow Error:", error);
    res.status(500).json({ message: "Failed to update follow relationship" });
  }
};

/* =========================================================
   GET STATUS (Mutuals, Count, Relationship)
========================================================= */
const getFollowStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Fetch counts (only accepted)
    const followersCount = await Follow.countDocuments({ following: userId, status: "accepted" });
    const followingCount = await Follow.countDocuments({ follower: userId, status: "accepted" });

    // Block status
    const blockedMe = await Block.findOne({ blocker: userId, blocked: currentUserId });
    const IBlocked = await Block.findOne({ blocker: currentUserId, blocked: userId });

    if (blockedMe || IBlocked) {
      return res.status(200).json({
        followersCount,
        followingCount,
        status: "blocked",
      });
    }

    // Fetch follow states
    const IFollowTarget = await Follow.findOne({ follower: currentUserId, following: userId });
    const targetFollowsMe = await Follow.findOne({ follower: userId, following: currentUserId });

    let status = "not_following";
    if (IFollowTarget) {
      if (IFollowTarget.status === "pending") {
        status = "requested";
      } else {
        if (targetFollowsMe && targetFollowsMe.status === "accepted") {
          status = "mutual_follow";
        } else {
          status = "following";
        }
      }
    } else if (targetFollowsMe && targetFollowsMe.status === "accepted") {
      status = "follower";
    }

    res.status(200).json({
      followersCount,
      followingCount,
      status,
    });
  } catch (error) {
    console.error("Get Follow Status Error:", error);
    res.status(500).json({ message: "Failed to get relationship status" });
  }
};

/* =========================================================
   GET FOLLOWERS LIST
========================================================= */
const getFollowersList = async (req, res) => {
  try {
    const { userId } = req.params;

    const followers = await Follow.find({ following: userId, status: "accepted" })
      .populate("follower", "username avatar status about email")
      .lean();

    const list = followers.map((f) => {
      if (!f.follower) return null;
      return {
        ...f.follower,
        followedAt: f.createdAt,
      };
    }).filter(Boolean);
    
    res.status(200).json(list);
  } catch (error) {
    console.error("Get Followers List Error:", error);
    res.status(500).json({ message: "Failed to get followers list" });
  }
};

/* =========================================================
   GET FOLLOWING LIST
========================================================= */
const getFollowingList = async (req, res) => {
  try {
    const { userId } = req.params;

    const followings = await Follow.find({ follower: userId, status: "accepted" })
      .populate("following", "username avatar status about email")
      .lean();

    const list = followings.map((f) => {
      if (!f.following) return null;
      return {
        ...f.following,
        followedAt: f.createdAt,
      };
    }).filter(Boolean);

    res.status(200).json(list);
  } catch (error) {
    console.error("Get Following List Error:", error);
    res.status(500).json({ message: "Failed to get following list" });
  }
};

/* =========================================================
   GET INCOMING FOLLOW REQUESTS
========================================================= */
const getFollowRequests = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const requests = await Follow.find({ following: currentUserId, status: "pending" })
      .populate("follower", "username avatar status about email")
      .lean();

    const list = requests.map(r => ({
      requestId: r._id,
      user: r.follower
    })).filter(item => item.user);

    res.status(200).json(list);
  } catch (error) {
    console.error("Get Follow Requests Error:", error);
    res.status(500).json({ message: "Failed to get follow requests" });
  }
};

/* =========================================================
   ACCEPT FOLLOW REQUEST
========================================================= */
const acceptFollowRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.user._id;

    const request = await Follow.findOne({ _id: requestId, following: currentUserId });
    if (!request) {
      return res.status(404).json({ message: "Follow request not found" });
    }

    request.status = "accepted";
    await request.save();

    await invalidateChatsCache(currentUserId);
    await invalidateChatsCache(request.follower);
    await invalidateFollowCache(currentUserId, request.follower);

    const io = getIO();
    io.to(request.follower.toString()).emit("follow:update", {
      followerId: request.follower,
      followingId: currentUserId,
      isFollowing: true,
      status: "following",
    });
    io.to(currentUserId.toString()).emit("follow:update", {
      followerId: request.follower,
      followingId: currentUserId,
      isFollowing: true,
      status: "follower",
    });

    res.status(200).json({ message: "Follow request accepted" });
  } catch (error) {
    console.error("Accept Follow Request Error:", error);
    res.status(500).json({ message: "Failed to accept follow request" });
  }
};

/* =========================================================
   REJECT FOLLOW REQUEST
========================================================= */
const rejectFollowRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.user._id;

    const request = await Follow.findOne({ _id: requestId, following: currentUserId });
    if (!request) {
      return res.status(404).json({ message: "Follow request not found" });
    }

    await Follow.deleteOne({ _id: request._id });

    const io = getIO();
    io.to(request.follower.toString()).emit("follow:update", {
      followerId: request.follower,
      followingId: currentUserId,
      isFollowing: false,
      status: "not_following",
    });
    io.to(currentUserId.toString()).emit("follow:update", {
      followerId: request.follower,
      followingId: currentUserId,
      isFollowing: false,
      status: "not_following",
    });

    res.status(200).json({ message: "Follow request rejected" });
  } catch (error) {
    console.error("Reject Follow Request Error:", error);
    res.status(500).json({ message: "Failed to reject follow request" });
  }
};

/* =========================================================
   REMOVE FOLLOWER (Force someone to unfollow me)
========================================================= */
const removeFollower = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const followRelation = await Follow.findOne({
      follower: userId,
      following: currentUserId,
      status: "accepted"
    });

    if (!followRelation) {
      return res.status(404).json({ message: "Follower relationship not found" });
    }

    await Follow.deleteOne({ _id: followRelation._id });

    // Invalidate active chats cache for both users and follow relationship cache
    await invalidateChatsCache(currentUserId);
    await invalidateChatsCache(userId);
    await invalidateFollowCache(currentUserId, userId);

    // Emit follow status update through socket.io
    const io = getIO();
    io.to(userId.toString()).emit("follow:update", {
      followerId: userId,
      followingId: currentUserId,
      isFollowing: false,
      status: "not_following",
    });
    io.to(currentUserId.toString()).emit("follow:update", {
      followerId: userId,
      followingId: currentUserId,
      isFollowing: false,
      status: "not_following",
    });

    res.status(200).json({ message: "Successfully removed follower" });
  } catch (error) {
    console.error("Remove Follower Error:", error);
    res.status(500).json({ message: "Failed to remove follower" });
  }
};

module.exports = {
  toggleFollow,
  getFollowStatus,
  getFollowersList,
  getFollowingList,
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  removeFollower,
};
