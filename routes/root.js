const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/jwtAuthentication');

const {
  newAdmin,
  adminLogin,
  adminSendOtp,
  existAdminVerifyOtp,
  newAdminVerifyOtp,
  adminPasswordReset,
  verifyToken,
  checkAvailability,
} = require('../controllers/auth/adminAuthController');

const {
  getUserDetailWithId,
  setAppLanguage,
  getAppLanguage,
  getFeedLanguage,
  setFeedLanguage,
  checkUsernameAvailability,
  blockUserById,
} = require('../controllers/user/userDetailController');




const {
  userProfileDetailUpdate,
  getUserProfileDetail,
  childAdminProfileDetailUpdate,
  adminProfileDetailUpdate,
  getAdminProfileDetail,
  getChildAdminProfileDetail,
  toggleFieldVisibility,
  getVisibilitySettings,
  updateCoverPhoto,
  deleteCoverPhoto,
  getProfileOverview,
  getVisibilitySettingsWeb,
  updateFieldVisibilityWeb,
  getProfileCompletion,
} = require('../controllers/profile/profileController');

const {
  getUsersStatus,
  getUsersByDate,
  getAllUserDetails,
  searchAllUserDetails,
  deleteUserAndAllRelated,
  getReports,
} = require('../controllers/admin/adminUserControllers');


const {
  getDashboardMetricCount,
  getDashUserRegistrationRatio,
} = require('../controllers/admin/dashboardController');

const {
  refreshAccessToken,
  heartbeat,
} = require('../controllers/sessionController')

const {
  getChildAdmins,
  getChildAdminPermissions,
  updateChildAdminPermissions,
  getChildAdminById,
  blockChildAdmin,
  deleteChildAdmin,
} = require('../controllers/admin/adminChildAdminController');

const {
  saveUserLocation,
  getUserLocation,
} = require("../controllers/user/userLoactionController");

const {
  addReportQuestion,
  getQuestionsByType,
  createReportType,
  adminGetReportTypes,
  updateReportStatus,
  getReportLogs,
  getQuestionById,
  deleteQuestion,
  toggleReportType,
  deleteReportType,
  linkNextQuestion,
  adminTakeActionOnReport,
  getAllQuestions,
  getAllReports
} = require("../controllers/admin/adminReportController");

const { getJobDashboardStats } = require('../controllers/companyDashboardController');

const {
  getAllCompanies,
  getCompanyById,
  inactivateCompany,
  removeCompany,
  activateCompany,
} = require('../controllers/admin/company/adminCompanyController');

const {
  getAllJobs,
  approveJob,
  rejectJob,
  deleteJob,
  suspendJob,
  getJobByIdforAdmin,
} = require('../controllers/admin/company/adminJobController');

const { getDriveDashboard, driveCommand } = require('../controllers/admin/driverStatusController');

const {
  createHelpSection,
  updateHelpSection,
  deleteHelpSection,
  getHelpFAQ,
  bulkCreateHelpFAQ,
} = require("../controllers/admin/adminHelpController");

const { getAllUserFeedback, updateFeedbackStatus } = require('../controllers/feedBackController');

const {
  upsertPrithuCompany,
  getPrithuCompany,
  togglePrithuCompanyStatus,
} = require("../controllers/admin/companyDetailController");


/* --------------------- Admin User API --------------------- */
router.get('/admin/getall/users', getAllUserDetails);
router.get("/admin/search/user", searchAllUserDetails);
router.get("/admin/users/status", getUsersStatus);
router.get("/admin/user/detail/by-date", getUsersByDate);
router.patch("/admin/block/user/:userId", blockUserById);
router.delete('/admin/delete/user/:userId', deleteUserAndAllRelated);

// /*-------------------Admin Report API -------------------------*/
router.post("/admin/add/report/questions", addReportQuestion);
router.get("/admin/get/Questions/ByType", getQuestionsByType);
router.patch("/admin/linkNextQuestion", linkNextQuestion);
router.get("/admin/get/QuestionById", getQuestionById);
router.get("/admin/getAllQuestions", getAllQuestions);
router.post("/admin/report-type", createReportType);
router.get("/admin/get/ReportTypes", adminGetReportTypes);
router.patch("/admin/toggleReportType", toggleReportType);
router.delete("/admin/deleteReportType", deleteReportType);
router.delete("/admin/deleteQuestion", deleteQuestion);
router.put("/:reportId/status", updateReportStatus);
router.get("/:reportId/logs", auth, getReportLogs);
router.get('/admin/user/report', getAllReports);
router.put("/admin/report/action/update/:reportId", auth, adminTakeActionOnReport);

/*---------------------Admin DashBoard API---------------------*/
router.get("/admin/dashboard/metricks/counts", getDashboardMetricCount);
router.get("/admin/users/monthly-registrations", getDashUserRegistrationRatio);

/*-------------------AdminCompny---------------------------*/
router.get("/get/comapany/status", getJobDashboardStats);
router.get("/get/all/companies", getAllCompanies);
router.delete('/companies/:companyId', removeCompany);
router.put('/companies/:companyId/suspend', inactivateCompany);
router.put('/companies/:companyId/activate', activateCompany);
router.get('/companies/:companyId', getCompanyById);

/*----------------AdminJobs--------------------------------- */
router.get("/get/all/company/jobs", getAllJobs)
router.put('/jobs/:jobId/approve', approveJob);
router.put('/jobs/:jobId/suspend', suspendJob);
router.put("/jobs/:jobId/reject", rejectJob);
router.get("/admin/get/job/:jobId", getJobByIdforAdmin);

/* --------------------- Child Admin Profile API --------------------- */
router.get("/admin/childadmin/list", auth, getChildAdmins);
router.get("/admin/childadmin/permissions/:childAdminId", getChildAdminPermissions);
router.put("/admin/childadmin/permissions/:id", updateChildAdminPermissions);
router.get("/child/admin/:id", getChildAdminById);
router.patch("/block/child/admin/:id", blockChildAdmin);
router.delete("/delete/child/admin/:id", deleteChildAdmin);


/*----------------------ProfileUpdate-------------------*/
router.put("/profile/toggle-visibility", auth,
  toggleFieldVisibility
);
router.get(
  "/profile/visibility", auth,
  getVisibilitySettings
);

/*---------------Admin Driver API----------------------*/
router.get("/admin/drive/dashboard", auth, getDriveDashboard);
router.post("/admin/drive/command", auth, driveCommand);

// Admin
router.post("/admin/help", createHelpSection);
router.put("/admin/help/:id", updateHelpSection);
router.delete("/admin/help/:id", deleteHelpSection);
router.post("/admin/help/bulk", bulkCreateHelpFAQ);
router.get("/help", getHelpFAQ);

// Admin
router.get("/admin/feedback", getAllUserFeedback);
router.put("/admin/feedback/:id", updateFeedbackStatus);

router.post("/admin/company", upsertPrithuCompany);
router.patch("/admin/company/status", togglePrithuCompanyStatus);
router.get("/company", getPrithuCompany);

/*---------------------Website----------------------------------*/
router.get("/get/profile/overview", auth, getProfileOverview);
router.get("/user/profile/completion", auth, getProfileCompletion);

module.exports = router;
