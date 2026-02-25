const User = require("../../models/user/userModel");



exports.getDashboardMetricCount = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // -----------------------------------
    // Run all queries in parallel
    // -----------------------------------
    const [
      totalUsers,
      activeUsersToday,     // using isOnline instead of lastActiveAt
      newRegistrationsToday,
      suspendedUsers,
      totalReports,
    ] = await Promise.all([
      // 1️⃣ Total Users
      User.countDocuments(),

      // 2️⃣ Active Users Today → users who are ONLINE
      User.countDocuments({
        isOnline: true,
      }),

      // 3️⃣ New registrations today
      User.countDocuments({
        createdAt: { $gte: startOfToday },
      }),

      // 4️⃣ Suspended users
      User.countDocuments({
        isBlocked: true,
      }),

      // 5️⃣ Total reports (stubbed)
      Promise.resolve(0),
    ]);

    // -----------------------------------
    // Send response
    // -----------------------------------
    return res.status(200).json({
      success: true,
      totalUsers,
      activeUsersToday,
      newRegistrationsToday,
      suspendedUsers,
      totalReports,
    });
  } catch (error) {
    console.error("Dashboard metric error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard metrics",
      error: error.message,
    });
  }
};





exports.getDashUserRegistrationRatio = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    // ---------------------------------------
    // Aggregate monthly data in a single trip
    // ---------------------------------------
    const result = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`)
          }
        }
      },
      {
        $project: {
          month: { $month: "$createdAt" },
          isActiveToday: {
            $cond: [
              { $gte: ["$lastActiveAt", new Date(new Date().setHours(0, 0, 0, 0))] },
              1,
              0
            ]
          },
          isSuspended: { $cond: [{ $eq: ["$isBlocked", true] }, 1, 0] },
          subscriptionActive: {
            $cond: [{ $eq: ["$subscription.isActive", true] }, 1, 0]
          }
        }
      },
      {
        $group: {
          _id: "$month",
          registrations: { $sum: 1 },
          activeUsers: { $sum: "$isActiveToday" },
          suspendedUsers: { $sum: "$isSuspended" },
          subscriptionUsers: { $sum: "$subscriptionActive" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // ---------------------------------------
    // Prepare full 12-month formatted dataset
    // ---------------------------------------
    const data = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      registrations: 0,
      activeUsers: 0,
      suspendedUsers: 0,
      subscriptionUsers: 0,
      growthPercent: 0
    }));

    // Insert aggregated values
    result.forEach(item => {
      const index = item._id - 1;
      data[index] = {
        ...data[index],
        registrations: item.registrations || 0,
        activeUsers: item.activeUsers || 0,
        suspendedUsers: item.suspendedUsers || 0,
        subscriptionUsers: item.subscriptionUsers || 0
      };
    });

    // ---------------------------------------
    // Calculate month-to-month growth %
    // ---------------------------------------
    for (let i = 1; i < 12; i++) {
      const prev = data[i - 1].registrations;
      const curr = data[i].registrations;

      data[i].growthPercent =
        prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;
    }

    // ---------------------------------------
    // Return the dataset
    // ---------------------------------------
    return res.status(200).json({
      success: true,
      year: currentYear,
      monthlyData: data
    });

  } catch (err) {
    console.error("❌ Monthly Growth Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};





exports.getDashUserSubscriptionRatio = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Subscription stats are currently unavailable",
    totalUsers: 0,
    totalSubscriptionAmount: 0,
    todaySubscriptionUsers: 0,
    todaySubscriptionAmount: 0,
    overallSubscriptionUsers: 0,
    ratioPercentage: "0.00",
  });
};











exports.getManiBoardStats = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Board stats are currently unavailable",
    data: {}
  });
};
