const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/jwtAuthentication');
const { userUpload, attachUserFile } = require("../middlewares/services/userprofileUploadSpydy");

// Controllers
const {
  createNewUser,
  userLogin,
  userSendOtp,
  userPasswordReset,
  existUserVerifyOtp,
  newUserVerifyOtp,
  userLogOut,
} = require('../controllers/auth/userAuthController');


const {
  newAdmin,
  adminLogin,
  adminSendOtp,
  existAdminVerifyOtp,
  newAdminVerifyOtp,
  adminPasswordReset,
  verifyToken,
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
  getDashboardMetricCount,
  getDashUserRegistrationRatio,
  getManiBoardStats,
} = require('../controllers/admin/dashboardController');

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
  getProfileByUsername,
  getUserVisibilityByUserId,
} = require('../controllers/profile/profileController');

const {
  deleteUserAndAllRelated,
} = require('../controllers/admin/adminUserControllers');

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
} = require("../controllers/user/userLoactionController");

const {
  createOrGetProfile,
  getFullProfile,
  addEducation,
  updateEducation,
  deleteEducation,
  addExperience,
  updateExperience,
  deleteExperience,
  addSkill,
  updateSkill,
  deleteSkill,
  addCertification,
  deleteCertification,
  updateCertification,
  addOrUpdateProject,
  getUserProjects,
  deleteProject,
  checkCurriculumStatus,
} = require("../controllers/user/userCurriculamController");


const {
  togglePublish,
  getPublicResume,
  getPublicPortfolio,
} = require("../controllers/user/userResumeController");

const {
  getMyActivities,
} = require("../controllers/user/userActivitController");

const {
  globalSearch
} = require("../controllers/searchController");


const {
  deactivateUser,
  deleteUserNow
} = require("../controllers/user/userDeleteController")


const { getAllCompanies } = require('../controllers/admin/company/adminCompanyController');
const { getAllActiveJobLocations, getPlatformStats } = require('../controllers/job/jobpostController');
const { applyForJob, getAppliedJobsByUser, getSavedJobsByUser } = require('../controllers/user/userJobController');
const { getHelpFAQ } = require('../controllers/admin/adminHelpController');
const { submitUserFeedback, getMyFeedbackAndReports } = require('../controllers/feedBackController');
const { getPrithuCompany } = require('../controllers/admin/companyDetailController');
const { refreshAccessToken, userPresence, heartbeat } = require('../controllers/sessionController');
const { getNotifications } = require('../controllers/admin/notificationController');

// /* --------------------- User Authentication --------------------- */
router.post('/auth/user/register', createNewUser);
router.post('/auth/user/login', userLogin);
router.post('/auth/user/otp-send', userSendOtp);
router.post('/auth/exist/user/verify-otp', existUserVerifyOtp);
router.post('/auth/new/user/verify-otp', newUserVerifyOtp);
router.post('/auth/user/reset-password', userPasswordReset);
router.post('/auth/user/logout', auth, userLogOut);

// /* --------------------- Fresh Users API --------------------- */
router.post('/user/app/language', auth, setAppLanguage);
router.get('/user/get/app/language', auth, getAppLanguage);
router.get("/check/username/availability", checkUsernameAvailability);

/*_______________________User JOB API_____________________________*/
router.post("/apply/job", auth, applyForJob);
router.get("/get/job/locations", getAllActiveJobLocations);
router.get("/company/platform/status", getPlatformStats);
router.get("/job-applications/applied-jobs", auth, getAppliedJobsByUser);
router.get("/get/user/saved/jobs", auth, getSavedJobsByUser);

/* --------------------- User Profile API --------------------- */
router.post(
  "/user/profile/detail/update",
  auth,
  userUpload.single("file"),
  (req, res, next) => { req.baseUrl = "/profile"; next(); },
  attachUserFile,
  userProfileDetailUpdate
);

router.post(
  "/user/profile/cover/update",
  auth,
  userUpload.single("coverPhoto"),
  (req, res, next) => { req.baseUrl = "/cover"; next(); },
  attachUserFile,
  updateCoverPhoto
);


router.delete("/user/cover/photo/delete", auth, deleteCoverPhoto);
router.get('/get/profile/detail', auth, getUserProfileDetail);
router.get('/get/single/profile/detail', getUserProfileDetail);

// Session & Presence
router.post('/refresh-token', refreshAccessToken);
router.post('/user/session/presence', auth, userPresence);
router.post('/heartbeat', heartbeat);

// Notifications
router.get('/get/user/all/notification', auth, getNotifications);

/* --------------------- Admin Authentication --------------------- */
router.post('/auth/admin/register', auth, newAdmin);
router.post('/auth/admin/login', adminLogin);
router.post('/auth/admin/sent-otp', adminSendOtp);
router.post('/auth/exist/admin/verify-otp', existAdminVerifyOtp);
router.post('/auth/new/admin/verify-otp', newAdminVerifyOtp);
router.post('/auth/admin/reset-password', adminPasswordReset);
router.get('/api/admin/verify-token', auth, verifyToken);



/*----------------------ProfileUpdate-------------------*/
router.put("/profile/toggle-visibility", auth,
  toggleFieldVisibility
);

router.get(
  "/profile/visibility", auth,
  getVisibilitySettings
);

/*---------------------Website----------------------------------*/
router.get("/get/profile/overview", auth, getProfileOverview);
router.get("/user/profile/completion", auth, getProfileCompletion);

// ✅ Profile
router.post("/create", createOrGetProfile);
router.get("/get/full/curriculam/profile", auth, getFullProfile);
router.get("/user/curicullam/status", auth, checkCurriculumStatus)

// ✅ Education
router.post("/profile/education", auth, addEducation);
router.put("/profile/education/:userId/:educationId", auth, updateEducation);
router.delete("/education/profile/delete/:userId/:educationId", auth, deleteEducation);

// ✅ Experience
router.post("/user/job/experience", auth, addExperience);
router.put("/user/job/experience/:userId/:experienceId", auth, updateExperience);
router.delete("/user/job/experience/detele/:userId/:experienceId", auth, deleteExperience);

// ✅ Skills
router.post("/user/education/skill", auth, addSkill);
router.put("/user/eduction/skill/:userId/:skillId", auth, updateSkill);
router.delete("/user/eduction/skill/delete/:userId/:skillId", auth, deleteSkill);

// ✅ Certifications
router.post("/user/education/certification", auth, addCertification);
router.put("/user/certification/update/:userId/:certificationId", auth, updateCertification)
router.delete("/user/eduction/certification/delete/:userId/:certificationId", auth, deleteCertification);

router.patch("/user/deactivate", auth, deactivateUser);
router.delete("/user/delete", auth, deleteUserNow);

router.post("/user/add/education/project", auth, addOrUpdateProject);
router.put("/user/update/projects/:projectId", auth, addOrUpdateProject)
router.delete("/user/delete/projects/:projectId", auth, deleteProject);

// Public
router.get("/help", getHelpFAQ);

router.get("/main/board/status", getManiBoardStats);
router.get("/get/all/companies", getAllCompanies);

router.post("/feedback", auth, submitUserFeedback);
router.get("/feedback/my", auth, getMyFeedbackAndReports);

router.get("/company", getPrithuCompany);

module.exports = router;
