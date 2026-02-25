const Users = require("../../models/user/userModel.js");
const { userTimeAgo } = require('../../middlewares/userStatusTimeAgo.js');
const ProfileSettings = require('../../models/profileSettingModel.js');
const mongoose = require("mongoose");


const { extractPublicId } = require("../../middlewares/helper/cloudnaryDetete.js");
const { deleteCloudinaryBatch } = require("../../middlewares/helper/geatherPubliceIds.js");
const Devices = require("../../models/user/sessionDevice/deviceModel.js");
const JobPost = require("../../models/job/jobPost/jobSchema.js");





// Get single user detail
exports.getUserProfileDetail = async (req, res) => {
  try {
    const { userId } = req.body; // from auth middleware

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    // ✅ Run queries in parallel
    const [user, profile, languages] = await Promise.all([
      User.findById(userId).select("userName email").lean(),
      Profile.findOne({ userId }).lean(),
      UserLanguage.find({ userId, active: true }).select("appLanguageCode feedLanguageCode").lean()
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        profile,
        languages
      }
    });
  } catch (err) {
    console.error("Error fetching user profile:", err);
    return res.status(500).json({
      success: false,
      message: "Cannot fetch user profile",
      error: err.message
    });
  }
};

// Get user status with devices
exports.getUserStatus = async (req, res) => {

  try {
    const client = await getRedis();

    const users = await User.find({}, "_id name role").lean();

    const result = [];

    for (const user of users) {
      const lastSeen = await client.get(`lastseen:${user._id}`);
      console.log(lastSeen)
      const sockets = await client.sMembers(`user:sockets:${user._id}`);

      // get devices
      const devices = [];
      for (const s of sockets) {
        const d = await client.hGetAll(`user:device:${user._id}:${s}`);
        if (Object.keys(d).length > 0) devices.push(d);
      }

      result.push({
        ...user,
        status: sockets.length > 0 ? "online" : "offline",
        lastSeen: sockets.length > 0 ? "now" : lastSeen ? userTimeAgo(lastSeen) : "unknown",
        devices,
      });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
};


exports.getUsersByDate = async (req, res) => {
  try {
    const { date, type = "created" } = req.query;
    // type = "created" (default) or "updated"

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    // Create start & end range for the day
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    // Choose filter field dynamically
    const filterField = type === "updated" ? "updatedAt" : "createdAt";

    // ✅ Query only required fields + populate
    const users = await Users.find(
      { [filterField]: { $gte: start, $lte: end } },
      "userName email profileSettings createdAt updatedAt" // projection
    )
      .populate("profileSettings") // one populate instead of multiple queries
      .lean(); // return plain JS objects (faster, less memory)

    if (!users || users.length === 0) {
      return res.status(404).json({ message: "No users found for this date" });
    }

    res.status(200).json({ users });
  } catch (err) {
    console.error("Error fetching users by date:", err);
    res.status(500).json({ message: "Cannot fetch user details", error: err.message });
  }
};


exports.getAllUserDetails = async (req, res) => {
  try {
    // 1️⃣ Get all users (online + lastLoginAt directly from User schema)
    const allUsers = await Users.find()
      .select(
        "userName _id email lastActiveAt lastLoginAt createdAt subscription isBlocked isOnline profileSettings"
      )
      .lean();

    if (!allUsers || allUsers.length === 0) {
      return res.status(404).json({ message: "Users details not found" });
    }

    // 2️⃣ Extract userIds
    const userIds = allUsers.map((u) => u._id);

    // 3️⃣ Fetch profile settings (profile avatar)
    const profileSettingsList = await ProfileSettings.find({
      userId: { $in: userIds },
    })
      .select("userId profileAvatar")
      .lean();

    // Create quick lookup map for avatars
    const profileMap = {};
    profileSettingsList.forEach((p) => {
      profileMap[p.userId.toString()] = p.profileAvatar || null;
    });

    // 4️⃣ Format final response
    const formattedUsers = allUsers.map((user) => ({
      userId: user._id,
      userName: user.userName,
      email: user.email,
      createdAt: user.createdAt,

      // 📌 USER ONLINE STATUS (Directly from User schema)
      isOnline: user.isOnline || false,

      // 📌 LAST ACTIVE TIME (Already in User schema)
      lastActiveAt: user.lastActiveAt || null,

      // 📌 LAST LOGIN TIME (From User schema)
      lastLoginAt: user.lastLoginAt || null,

      // 📌 Avatar
      profileAvatar: profileMap[user._id.toString()] || null,

      // 📌 Subscription info
      subscriptionActive: user.subscription?.isActive || false,

      // 📌 Block status
      isBlocked: user.isBlocked,
    }));

    return res.status(200).json({ users: formattedUsers });
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).json({
      message: "Cannot fetch user details",
      error: err.message,
    });
  }
};





exports.searchAllUserDetails = async (req, res) => {
  try {
    const { search } = req.query;
    let searchFilter = {};

    // -----------------------------------------
    // 1️⃣ APPLY SMART SEARCH FILTER
    // -----------------------------------------
    if (search && search.trim() !== "") {
      const trimmed = search.trim();

      // A) Referral code: ABC123 (3 letters + 3 digits)
      if (/^[A-Za-z]{3}\d{3}$/.test(trimmed)) {
        searchFilter.referralCode = trimmed.toUpperCase();
      }

      // B) Mobile number: exactly 10 digits
      else if (/^\d{10}$/.test(trimmed)) {
        searchFilter.phone = trimmed;
      }

      // C) Name: alphabets only → full or partial match
      else if (/^[A-Za-z]+$/.test(trimmed)) {
        searchFilter.userName = { $regex: trimmed, $options: "i" };
      }
    }

    // -----------------------------------------
    // 2️⃣ Fetch all users with search filter
    // -----------------------------------------
    const allUsers = await Users.find(searchFilter)
      .select(
        "userName _id email phone lastActiveAt lastLoginAt createdAt subscription isBlocked isOnline profileSettings referralCode"
      )
      .lean();

    if (!allUsers || allUsers.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    // -----------------------------------------
    // 3️⃣ Fetch profile settings (avatars)
    // -----------------------------------------
    const userIds = allUsers.map((u) => u._id);

    const profileSettingsList = await ProfileSettings.find({
      userId: { $in: userIds },
    })
      .select("userId profileAvatar")
      .lean();

    const profileMap = {};
    profileSettingsList.forEach((p) => {
      profileMap[p.userId.toString()] = p.profileAvatar || null;
    });

    // -----------------------------------------
    // 4️⃣ Build formatted response
    // -----------------------------------------
    const formattedUsers = allUsers.map((user) => ({
      userId: user._id,
      userName: user.userName,
      email: user.email,
      phone: user.phone || null,
      referralCode: user.referralCode || null,
      createdAt: user.createdAt,
      isOnline: user.isOnline,
      lastActiveAt: user.lastActiveAt,
      lastLoginAt: user.lastLoginAt,
      subscriptionActive: user.subscription?.isActive || false,
      isBlocked: user.isBlocked,
      profileAvatar: profileMap[user._id.toString()] || null,
    }));

    return res.status(200).json({ users: formattedUsers });
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).json({
      message: "Cannot fetch user details",
      error: err.message,
    });
  }
};
















exports.getAnaliticalCountforUser = async (req, res) => {
  try {
    let userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    userId = userId.trim();

    const objectId = new mongoose.Types.ObjectId(userId);

    // 🔹 Fetch the UserActions doc for this user
    const userAction = await mongoose.connection
      .collection("UserFeedActions")
      .findOne({ userId: objectId });

    // 🔹 Count comments from UserComments
    const commentCount = await mongoose.connection
      .collection("UserComments")
      .countDocuments({ userId: objectId });

    // 🔹 Build response (count based on new object-array structure)
    const result = {
      likes: userAction?.likedFeeds?.length || 0,
      saves: userAction?.savedFeeds?.length || 0,
      shares: userAction?.sharedFeeds?.length || 0,
      downloads: userAction?.downloadedFeeds?.length || 0,
      comments: commentCount || 0,
    };

    res.status(200).json({
      message: "Analytical count fetched successfully",
      data: result,
    });
  } catch (err) {
    console.error("Error fetching analytical counts:", err);
    res.status(500).json({
      message: "Error fetching analytical counts",
      error: err.message,
    });
  }
};



exports.getUserLikedFeedsforAdmin = async (req, res) => {
  return res.status(200).json({
    message: "Feeds are decommissioned",
    count: 0,
    data: []
  });
};





exports.getUsersStatus = async (req, res) => {
  try {
    // 1️⃣ Fetch users with required fields
    const users = await Users.find({}, "username email isOnline lastSeenAt").lean();

    if (!users.length) {
      return res.json({ totalOnline: 0, totalOffline: 0, users: [] });
    }

    // 2️⃣ Get devices in a single query (only needed fields)
    const userIds = users.map((u) => u._id);
    const devices = await UserDevices.find(
      { userId: { $in: userIds } },
      "userId deviceId deviceType ipAddress lastActiveAt"
    ).lean();

    // 3️⃣ Group devices by userId
    const devicesByUser = devices.reduce((acc, d) => {
      const id = d.userId.toString();
      if (!acc[id]) acc[id] = [];
      acc[id].push({
        deviceId: d.deviceId,
        deviceType: d.deviceType,
        ipAddress: d.ipAddress,
        lastActiveAt: d.lastActiveAt,
      });
      return acc;
    }, {});

    // 4️⃣ Build result + online/offline count
    let totalOnline = 0;
    let totalOffline = 0;

    const result = users.map((user) => {
      if (user.isOnline) totalOnline++;
      else totalOffline++;

      const userDevices = devicesByUser[user._id.toString()] || [];

      return {
        ...user,
        deviceCount: userDevices.length,
        devices: userDevices,
      };
    });

    // 5️⃣ Final response
    res.json({
      totalOnline,
      totalOffline,
      totalUsers: users.length,
      users: result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUserSocialMeddiaDetailWithIdForAdmin = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const user = await Users.findById(userId)
      .select("userName email referralCode referralByUserId totalEarnings withdrawableEarnings isActive lastActiveAt lastLoginAt isOnline")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    const profile = await ProfileSettings.findOne({ userId }).lean();
    const language = await UserLanguage.findOne({ userId }).lean();
    const device = await UserDevices.findOne({ userId }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        profile,
        language,
        device,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Error fetching user details", error: err.message });
  }
};






exports.getUserAnalyticalData = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, type, tab } = req.query;

    if (!userId) return res.status(400).json({ message: "userId is required" });

    // Build base query for date filtering
    const buildDateQuery = (field) => {
      const query = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Start of day
        query[field] = { $gte: start };
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
        query[field] = { ...query[field], $lte: end };
      }
      return Object.keys(query).length > 0 ? query : {};
    };

    // -------------------------------------------------------------------
    // 1️⃣ BASIC USER PROFILE
    // -------------------------------------------------------------------
    const userProfile = await ProfileSettings.findOne({ userId })
      .select("userName profileAvatar createdAt lastSeen")
      .lean();

    const selectedUser = {
      userName: userProfile?.userName || "Unknown User",
      userAvatar: userProfile?.profileAvatar || "",
      joinedAt: userProfile?.createdAt || new Date(),
      lastSeen: userProfile?.lastSeen || null,
    };

    // -------------------------------------------------------------------
    // 2️⃣ USER POSTS (Full image/video posts with all engagement details)
    // -------------------------------------------------------------------
    const postsQuery = {
      createdByAccount: userId,
      roleRef: "User",
      ...buildDateQuery('createdAt'),
      ...(type && type !== 'all' ? { type } : {})
    };

    const postsRaw = await Feed.find(postsQuery)
      .select("_id type contentUrl title description createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const postIds = postsRaw.map(p => p._id);

    // ----- Fetch views from image/video stats -----
    const imageViews = await ImageStats.find({ imageId: { $in: postIds } })
      .select("imageId totalViews")
      .lean();

    const videoViews = await VideoStats.find({ videoId: { $in: postIds } })
      .select("videoId totalViews")
      .lean();

    const viewMap = {};
    imageViews.forEach(v => (viewMap[v.imageId.toString()] = v.totalViews || 0));
    videoViews.forEach(v => (viewMap[v.videoId.toString()] = v.totalViews || 0));

    // ----- Fetch like/share/download activity from all users -----
    const actionsAll = await UserFeedActions.find({})
      .select("likedFeeds sharedFeeds downloadedFeeds disLikeFeeds")
      .lean();

    const likeMap = {};
    const shareMap = {};
    const downloadMap = {};
    const dislikeMap = {};

    actionsAll.forEach(u => {
      u.likedFeeds?.forEach(l => {
        likeMap[l.feedId] = (likeMap[l.feedId] || 0) + 1;
      });

      u.sharedFeeds?.forEach(s => {
        shareMap[s.feedId] = (shareMap[s.feedId] || 0) + 1;
      });

      u.downloadedFeeds?.forEach(d => {
        downloadMap[d.feedId] = (downloadMap[d.feedId] || 0) + 1;
      });

      u.disLikeFeeds?.forEach(d => {
        dislikeMap[d.feedId] = (dislikeMap[d.feedId] || 0) + 1;
      });
    });

    // ----- Fetch comment counts -----
    const commentCounts = await UserComments.aggregate([
      { $match: { feedId: { $in: postIds } } },
      { $group: { _id: "$feedId", count: { $sum: 1 } } },
    ]);

    const commentMap = {};
    commentCounts.forEach(c => (commentMap[c._id.toString()] = c.count));

    // ----- FINAL POSTS -----
    const posts = postsRaw.map(p => ({
      id: p._id,
      type: p.type,
      url: p.contentUrl,
      title: p.title || `${p.type} post`,
      description: p.description || "",
      createdAt: p.createdAt,
      views: viewMap[p._id.toString()] || 0,
      likes: likeMap[p._id.toString()] || 0,
      shares: shareMap[p._id.toString()] || 0,
      downloads: downloadMap[p._id.toString()] || 0,
      dislikes: dislikeMap[p._id.toString()] || 0,
      comments: commentMap[p._id.toString()] || 0,
    }));

    const imageCount = posts.filter(p => p.type === "image").length;
    const videoCount = posts.filter(p => p.type === "video").length;

    // -------------------------------------------------------------------
    // 3️⃣ FOLLOWERS (Users who follow THIS user) with date filtering
    // -------------------------------------------------------------------
    const followersQuery = {
      creatorId: userId,
      ...buildDateQuery('createdAt')
    };

    const followers = await Followers.find(followersQuery)
      .select("followerId createdAt")
      .lean();

    const followerIds = followers.map(f => f.followerId);

    const followerProfiles = await ProfileSettings.find({
      userId: { $in: followerIds }
    }).select("userId userName profileAvatar").lean();

    const followerDateMap = {};
    followers.forEach(f => (followerDateMap[f.followerId.toString()] = f.createdAt));

    const followersList = followerProfiles.map(p => ({
      id: p.userId,
      userName: p.userName,
      profileAvatar: p.profileAvatar,
      followedAt: followerDateMap[p.userId.toString()],
    }));

    // -------------------------------------------------------------------
    // 4️⃣ FOLLOWING (Who THIS user follows) with date filtering
    // -------------------------------------------------------------------
    const followingQuery = {
      followerId: userId,
      ...buildDateQuery('createdAt')
    };

    const following = await Followers.find(followingQuery)
      .select("creatorId createdAt")
      .lean();

    const followingIds = following.map(f => f.creatorId);

    const followingProfiles = await ProfileSettings.find({
      userId: { $in: followingIds }
    }).select("userId userName profileAvatar").lean();

    const followingDateMap = {};
    following.forEach(f => (followingDateMap[f.creatorId.toString()] = f.createdAt));

    const followingList = followingProfiles.map(p => ({
      id: p.userId,
      userName: p.userName,
      profileAvatar: p.profileAvatar,
      followedAt: followingDateMap[p.userId.toString()],
    }));

    // -------------------------------------------------------------------
    // 5️⃣ USER INTERACTIONS (Liked, Shared, Downloaded…) with date filtering
    // -------------------------------------------------------------------
    const userAction = await UserFeedActions.findOne({ userId })
      .populate({
        path: 'likedFeeds.feedId',
        select: '_id type contentUrl title description createdAt',
        model: 'Feed'
      })
      .populate({
        path: 'sharedFeeds.feedId',
        select: '_id type contentUrl title description createdAt',
        model: 'Feed'
      })
      .populate({
        path: 'downloadedFeeds.feedId',
        select: '_id type contentUrl title description createdAt',
        model: 'Feed'
      })
      .populate({
        path: 'disLikeFeeds.feedId',
        select: '_id type contentUrl title description createdAt',
        model: 'Feed'
      })
      .populate({
        path: 'savedFeeds.feedId',
        select: '_id type contentUrl title description createdAt',
        model: 'Feed'
      })
      .lean();

    // Filter interactions by date if provided
    const filterByDate = (items, dateField) => {
      if (!startDate && !endDate) return items || [];

      const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
      const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

      return (items || []).filter(item => {
        if (!item || !item[dateField]) return false;

        const itemDate = new Date(item[dateField]).getTime();

        if (start && itemDate < start) return false;
        if (end && itemDate > end) return false;

        return true;
      });
    };

    const likedPosts = filterByDate(userAction?.likedFeeds?.map(f => ({
      id: f.feedId?._id,
      type: f.feedId?.type,
      url: f.feedId?.contentUrl,
      title: f.feedId?.title || 'Liked post',
      description: f.feedId?.description || '',
      likedAt: f.likedAt,
    })), 'likedAt');

    const dislikedPosts = filterByDate(userAction?.disLikeFeeds?.map(f => ({
      id: f.feedId?._id,
      type: f.feedId?.type,
      url: f.feedId?.contentUrl,
      title: f.feedId?.title || 'Disliked post',
      description: f.feedId?.description || '',
      dislikedAt: f.dislikedAt,
    })), 'dislikedAt');

    const sharedPosts = filterByDate(userAction?.sharedFeeds?.map(f => ({
      id: f.feedId?._id,
      type: f.feedId?.type,
      url: f.feedId?.contentUrl,
      title: f.feedId?.title || 'Shared post',
      description: f.feedId?.description || '',
      sharedAt: f.sharedAt,
    })), 'sharedAt');

    const downloadedPosts = filterByDate(userAction?.downloadedFeeds?.map(f => ({
      id: f.feedId?._id,
      type: f.feedId?.type,
      url: f.feedId?.contentUrl,
      title: f.feedId?.title || 'Downloaded post',
      description: f.feedId?.description || '',
      downloadedAt: f.downloadedAt,
    })), 'downloadedAt');

    const savedPosts = filterByDate(userAction?.savedFeeds?.map(f => ({
      id: f.feedId?._id,
      type: f.feedId?.type,
      url: f.feedId?.contentUrl,
      title: f.feedId?.title || 'Saved post',
      description: f.feedId?.description || '',
      savedAt: f.savedAt,
    })), 'savedAt');

    const interactions = {
      liked: likedPosts.length,
      disliked: dislikedPosts.length,
      shared: sharedPosts.length,
      downloaded: downloadedPosts.length,
      saved: savedPosts.length,
    };

    const hidden = [];

    const interested = [];
    const nonInterested = [];

    // -------------------------------------------------------------------
    // 8️⃣ USER COMMENTS WITH POST DETAILS with date filtering
    // -------------------------------------------------------------------
    const commentsQuery = {
      userId,
      ...buildDateQuery('createdAt')
    };

    const comments = await UserComments.find(commentsQuery)
      .select("_id commentText feedId createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const commentFeedIds = comments.map(c => c.feedId);

    const commentFeeds = await Feed.find({ _id: { $in: commentFeedIds } })
      .select("_id type contentUrl title description createdByAccount")
      .lean();

    const commentFeedMap = {};
    commentFeeds.forEach(f => {
      commentFeedMap[f._id.toString()] = f;
    });

    const userComments = comments.map(c => ({
      id: c._id,
      text: c.commentText,
      createdAt: c.createdAt,
      post: commentFeedMap[c.feedId] || null,
    }));

    // -------------------------------------------------------------------
    // 9️⃣ ENGAGEMENT SUMMARY
    // -------------------------------------------------------------------
    const engagementSummary = {
      totalPosts: posts.length,
      totalFollowers: followersList.length,
      totalFollowing: followingList.length,
      totalPostLikes: posts.reduce((a, b) => a + b.likes, 0),
      totalPostViews: posts.reduce((a, b) => a + b.views, 0),
      totalComments: userComments.length,
      totalInteractions:
        likedPosts.length +
        dislikedPosts.length +
        sharedPosts.length +
        downloadedPosts.length +
        userComments.length,
    };

    // -------------------------------------------------------------------
    // 🔟 FINAL RESPONSE
    // -------------------------------------------------------------------
    return res.status(200).json({
      success: true,
      selectedUser,
      posts,
      imageCount,
      videoCount,
      followers: followersList,
      following: followingList,
      interactions,
      likedPosts,
      dislikedPosts,
      sharedPosts,
      downloadedPosts,
      savedPosts,
      hidden,
      interested,
      nonInterested,
      comments: userComments,
      engagementSummary,
      stats: engagementSummary,
      filters: {
        startDate,
        endDate,
        type,
        applied: !!(startDate || endDate || type)
      }
    });

  } catch (err) {
    console.error("Error fetching analytics:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};






exports.getUserLevelWithEarnings = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    // 1️⃣ Get current user's profile with fallback
    const currentUserProfile = await ProfileSettings.findOne({ userId })
      .select("userName profileAvatar")
      .lean();

    const currentUser = {
      userId: userId || null,
      userName: currentUserProfile?.userName || "Unknown User",
      profileAvatar: currentUserProfile?.profileAvatar,
    };

    // 2️⃣ Find the topmost level for this user
    const topLevel = await UserLevel.findOne({ userId })
      .sort({ level: -1 }) // highest level
      .select("level leftUsers rightUsers")
      .lean();

    const level = topLevel?.level || 0; // fallback to level 1
    const leftUserIds = topLevel?.leftUsers || [];
    const rightUserIds = topLevel?.rightUsers || [];

    // 3️⃣ Fetch left and right users with profile info, with fallbacks
    const fetchUsersWithProfile = async (userIds) => {
      if (!userIds || userIds.length === 0) return [];

      const profiles = await ProfileSettings.find({ userId: { $in: userIds } })
        .select("userId userName profileAvatar")
        .lean();

      return userIds.map(uId => {
        const profile = profiles.find(p => p.userId.toString() === uId.toString()) || {};
        return {
          _id: uId,
          userName: profile.userName || "Unknown User",
          profileAvatar: profile.profileAvatar || defaultAvater,
        };
      });
    };

    const leftUsers = await fetchUsersWithProfile(leftUserIds);
    const rightUsers = await fetchUsersWithProfile(rightUserIds);

    // 4️⃣ Calculate total earnings for current user
    const earnings = await UserEarning.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$userId", totalEarned: { $sum: "$amount" } } }
    ]);
    const totalEarned = earnings[0]?.totalEarned || 0;

    const totalWithdrawn = 0;
    const pendingWithdrawable = 0;

    // 6️⃣ Send response with all fallbacks
    return res.status(200).json({
      user: currentUser,
      level,
      totalEarned,
      totalWithdrawn,
      pendingWithdrawable,
      leftUsers,
      rightUsers,
    });

  } catch (err) {
    console.error("getUserLevelWithEarnings error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};




exports.getUserProfileDashboardMetricCount = async (req, res) => {
  try {
    // 1️⃣ Total registered users
    const totalUsers = await Users.countDocuments();

    // 2️⃣ Active subscriptions
    const subscriptionCount = await Users.countDocuments({
      "subscription.isActive": true,
    });

    const accountCount = 0;

    // 4️⃣ Blocked users
    const blockedUserCount = await Users.countDocuments({ isBlocked: true });

    // 5️⃣ Online users (⚡ from User schema)
    const onlineUsersCount = await Users.countDocuments({ isOnline: true });

    // 6️⃣ Offline users = total - online
    const offlineUsersCount = totalUsers - onlineUsersCount;

    return res.status(200).json({
      totalUsers,
      onlineUsers: onlineUsersCount,
      offlineUsers: offlineUsersCount,
      blockedUserCount,
      subscriptionCount,
      accountCount,
    });
  } catch (error) {
    console.error("Dashboard metric error:", error);
    return res.status(500).json({
      message: "Failed to fetch dashboard metrics",
      error: error.message,
    });
  }
};








exports.getReports = async (req, res) => {
  try {
    // Fetch all reports
    const reports = await Report.find().lean();

    if (!reports || reports.length === 0) {
      return res.status(404).json({ message: "No reports found" });
    }

    // Map reports with extra data
    const formattedReports = await Promise.all(
      reports.map(async (report, index) => {
        // ✅ Report Type
        const reportType = await ReportType.findById(report.typeId).lean();

        // ✅ Reported By (User info from ProfileSettings)
        const reporterProfile = await ProfileSettings.findOne({
          userId: report.reportedBy,
        }).lean();

        // ✅ Target Feed Info
        let feedData = null;
        let creatorProfile = null;

        if (report.targetType === "Feed") {
          feedData = await Feed.findById(report.targetId).lean();


        }

        return {
          _id: report._id,
          reportId: index + 1, // convert to 1,2,3,4...
          type: reportType ? reportType.name : "Unknown",
          reportedBy: reporterProfile
            ? {
              username: reporterProfile.userName || "Unknown",
              avatar: reporterProfile.profileAvatar || null,
            }
            : { username: "Unknown", avatar: null },

          target: feedData
            ? {
              contentUrl: feedData.contentUrl || null,
              createdBy: creatorProfile
                ? {
                  username: creatorProfile.userName || "Unknown",
                  avatar: creatorProfile.profileAvatar || null,
                }
                : { username: "Unknown", avatar: null },
            }
            : null,

          answers:
            report.answers && report.answers.length > 0
              ? report.answers.map((a) => ({
                questionId: a.questionId,
                questionText: a.questionText,
                selectedOption: a.selectedOption,
              }))
              : "Not Available",

          status: report.status,
          actionTaken: report.actionTaken,
          actionDate: report.actionDate,
          createdAt: report.createdAt,
        };
      })
    );

    res.status(200).json({ reports: formattedReports });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




exports.deleteUserAndAllRelated = async (req, res) => {
  console.log("🟦 [STEP 0] Controller entered");

  const { userId } = req.params;
  console.log("🧾 Starting deletion for user:", userId);

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    console.log("❌ Invalid userId");
    return res.status(400).json({ message: "Invalid userId" });
  }

  // 1️⃣ Minimal check (fast)
  console.log("🟦 [STEP 1] Fetching user...");
  let user;
  try {
    user = await Users.findById(userId).select("profileAvatar").lean();
    console.log("✅ User fetch success");
  } catch (err) {
    console.error("❌ ERROR fetching user:", err);
    return res.status(500).json({
      message: "Error fetching user",
      error: err.message,
    });
  }

  if (!user) {
    console.log("❌ User not found");
    return res.status(404).json({ message: "User not found" });
  }

  // 2️⃣ Start session on the SAME connection as Users model
  console.log("🟦 [STEP 2] Starting DB session from Users.db...");
  let session;
  try {
    const start = Date.now();

    // IMPORTANT CHANGE ⬇️
    session = await Users.db.startSession();
    // or if you prefer and have prithuDB imported:
    // session = await prithuDB.startSession();

    console.log(
      `✅ startSession SUCCESS on DB "${Users.db.name}" (⏱ ${Date.now() - start} ms)`
    );
  } catch (err) {
    console.error("❌ FAILED at startSession() using Users.db:", err);
    return res.status(500).json({
      message: "DB Session initialization failed",
      error: err.message,
    });
  }

  try {
    console.log("🟦 [STEP 3] Starting transaction...");
    session.startTransaction();
    console.log("✅ Transaction started");

    // --------------------------------------------
    // 🔥 DELETE RELATED RECORDS USING FAST FILTERS
    // --------------------------------------------
    await timedDelete("ImageView.deleteMany", () =>
      ImageView.deleteMany({ userId }, { session })
    );
    await timedDelete("ProfileSettings.deleteMany", () =>
      ProfileSettings.deleteMany({ userId }, { session })
    );
    await timedDelete("Report.deleteMany", () =>
      Report.deleteMany({ reportedBy: userId }, { session })
    );
    await timedDelete("UserComments.deleteMany", () =>
      UserComments.deleteMany({ userId }, { session })
    );
    await timedDelete("UserDevices.deleteMany", () =>
      UserDevices.deleteMany({ userId }, { session })
    );

    await timedDelete("UserFeedActions.deleteMany", () =>
      UserFeedActions.deleteMany(
        { userId },
        { session }
      )
    );
    await timedDelete("UserLanguage.deleteMany", () =>
      UserLanguage.deleteMany({ userId }, { session })
    );
    await timedDelete("UserLevels.deleteMany", () =>
      UserLevels.deleteMany({ userId }, { session })
    );
    await timedDelete("UserNotification.deleteMany", () =>
      UserNotification.deleteMany({ userId }, { session })
    );
    await timedDelete("UserSubscriptions.deleteMany", () =>
      UserSubscriptions.deleteMany({ userId }, { session })
    );

    await timedDelete("VideoView.deleteMany", () =>
      VideoView.deleteMany({ userId }, { session })
    );
    await timedDelete("Users.deleteOne", () =>
      Users.deleteOne({ _id: userId }, { session })
    );

    console.log("🟦 [STEP 6] Committing transaction...");
    const commitStart = Date.now();
    await session.commitTransaction();
    console.log(`✅ Transaction committed (⏱ ${Date.now() - commitStart}ms)`);
  } catch (error) {
    console.error("❌ ERROR inside transaction:", error);
    console.log("⚠️ Aborting transaction...");
    await session.abortTransaction();
    await session.endSession();
    return res.status(500).json({
      message: "Failed to delete user",
      error: error.message,
    });
  }

  await session.endSession();
  console.log("🟦 [STEP 6.5] Session ended");

  // --------------------------------------------------------
  // 3️⃣ DELETE CLOUDINARY FILES AFTER COMMIT (not inside DB)
  // --------------------------------------------------------
  console.log("🟦 [STEP 7] Deleting Cloudinary resources...");
  let deleteCount = 0;

  const extractPid = (url) => {
    if (!url) return null;
    try {
      const file = url.split("/").pop();
      return file.split(".")[0];
    } catch {
      return null;
    }
  };

  if (user.profileAvatar) {
    const pid = extractPid(user.profileAvatar);
    console.log("🔎 Avatar PID:", pid);

    if (pid) {
      try {
        await cloudinary.api.delete_resources([pid]);
        deleteCount++;
        console.log("✔ Cloudinary deleted:", pid);
      } catch (err) {
        console.error("❌ Cloudinary deletion failed:", err.message);
      }
    }
  }

  console.log("🎉 ALL STEPS COMPLETE");

  return res.status(200).json({
    message: "User deleted successfully",
    cloudinaryMediaDeleted: deleteCount,
  });
};







exports.getUpcomingBirthdays = async (req, res) => {
  try {
    const userId = req.Id; // Logged-in user

    // -----------------------------
    // 1️⃣ Find all users current user follows
    // -----------------------------
    const following = await Followers.find({ followerId: userId }).select("creatorId");

    const followingUserIds = following.map(f => f.creatorId);

    if (followingUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        birthdays: [],
        message: "No followed users"
      });
    }

    // -----------------------------
    // 2️⃣ Get current and next month
    // -----------------------------
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

    // -----------------------------
    // 3️⃣ Query profiles with birthday in current or next month
    // -----------------------------
    const profiles = await ProfileSettings.aggregate([
      {
        $match: {
          userId: { $in: followingUserIds },
          dateOfBirth: { $ne: null }
        }
      },
      {
        $project: {
          userId: 1,
          name: 1,
          lastName: 1,
          profileAvatar: 1,
          dateOfBirth: 1,
          month: { $month: "$dateOfBirth" },
          day: { $dayOfMonth: "$dateOfBirth" }
        }
      },
      {
        $match: {
          month: { $in: [currentMonth, nextMonth] }
        }
      },
      {
        $sort: { month: 1, day: 1 } // Upcoming order
      }
    ]);

    return res.status(200).json({
      success: true,
      birthdays: profiles
    });

  } catch (error) {
    console.error("❌ Error fetching upcoming birthdays:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};









