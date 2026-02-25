const JobPost = require("../models/job/jobPost/jobSchema");
const CompanyLogin = require("../models/job/company/companyLoginSchema");
const JobApplication = require("../models/user/job/userJobApplication");
const JobPayment = require("../models/job/jobPost/jobPaymentSchema");



exports.getJobDashboardStats = async (req, res) => {
  try {
    const [
      activeJobs,
      pendingJobApproval,
      updatedJobs,
      totalApplications,
      totalCompanies,
      totalHires,
      jobStatusSummary
    ] = await Promise.all([

      /* -------------------------------------------------
       * ✅ Active Jobs (Approved & Live)
       * ------------------------------------------------- */
      JobPost.countDocuments({
        status: "active",
        $or: [
          { isApproved: true },
          { isApproved: { $exists: false } }
        ]
      }),

      /* -------------------------------------------------
       * ⏳ Pending Job Approval
       * ------------------------------------------------- */
      JobPost.countDocuments({
        status: "submit",
        isApproved: false
      }),

      /* -------------------------------------------------
       * 🔄 Updated Jobs
       * ------------------------------------------------- */
      JobPost.countDocuments({
        status: "update"
      }),

      /* -------------------------------------------------
       * 📄 Total Job Applications
       * ------------------------------------------------- */
      JobApplication.countDocuments(),

      /* -------------------------------------------------
       * 🏢 Total Active Companies
       * ------------------------------------------------- */
      CompanyLogin.countDocuments({
        status: "active"
      }),

      /* -------------------------------------------------
       * 🏆 Total Hires (Shortlisted)
       * ------------------------------------------------- */
      JobApplication.countDocuments({
        status: "shortlisted"
      }),

      /* -------------------------------------------------
       * 📊 Job Status Breakdown (Auto updates)
       * ------------------------------------------------- */
      JobPost.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    /* -------------------------------------------------
     * Convert status array → object
     * ------------------------------------------------- */
    const statusMap = {};
    jobStatusSummary.forEach(item => {
      statusMap[item._id] = item.count;
    });

    return res.status(200).json({
      success: true,
      data: {
        activeJobs,
        pendingJobApproval,
        updatedJobs,
        totalApplications,
        totalCompanies,
        totalHires,
        jobStatusSummary: {
          draft: statusMap.draft || 0,
          submit: statusMap.submit || 0,
          update: statusMap.update || 0,
          active: statusMap.active || 0,
          paused: statusMap.paused || 0,
          expired: statusMap.expired || 0,
          closed: statusMap.closed || 0
        }
      }
    });

  } catch (error) {
    console.error("❌ Job Dashboard Stats Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job dashboard statistics"
    });
  }
};

