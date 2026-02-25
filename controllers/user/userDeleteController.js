const UserDeleteLog = require("../../models/userDeleteLog");
const Users = require("../../models/user/userModel.js");
const { userTimeAgo } = require('../../middlewares/userStatusTimeAgo.js');
const ProfileSettings = require('../../models/profileSettingModel.js');
const mongoose = require("mongoose");
const UserDevices = require("../../models/user/sessionDevice/deviceModel");
const UserLanguage = require('../../models/user/userLanguageModel.js');

const Session = require('../../models/user/sessionDevice/sessionModel.js');

const { extractPublicId } = require("../../middlewares/helper/cloudnaryDetete.js");
const { deleteCloudinaryBatch } = require("../../middlewares/helper/geatherPubliceIds.js");
const Devices = require("../../models/user/sessionDevice/deviceModel.js");



// ===================================================
// 1️⃣ DEACTIVATE USER
// ===================================================
exports.deactivateUser = async (req, res) => {
  try {
    const userId = req.Id;
    const { reason } = req.body;

    const user = await Users.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Save log only
    await UserDeleteLog.create({
      userId,
      actionType: "deactivate",
      reason: reason || "Not specified",
      nameSnapshot: user.name,
      mobileSnapshot: user.mobile,
    });

    return res.status(200).json({
      message: "User successfully deactivated.",
      deactivatedOn: new Date(),
    });
  } catch (error) {
    res.status(500).json({ message: "Deactivation failed", error: error.message });
  }
};



// ===================================================
// 2️⃣ DELETE USER NOW (FULL DELETE + LOG + SNAPSHOT)
// ===================================================
exports.deleteUserNow = async (req, res) => {
  try {
    const userId = req.Id; // From auth
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: "Invalid userId" });

    // -----------------------------------------
    // STEP 0: Fetch user and profile
    // -----------------------------------------
    const user = await Users.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const profile = await ProfileSettings.findOne({ userId });

    // Snapshot values (safe fallback)
    const snapshotUserName = profile?.userName || user?.userName || "";
    const snapshotPhone = profile?.phoneNumber || user?.mobile || "";

    // -----------------------------------------
    // STEP 1: Save delete log snapshot
    // -----------------------------------------
    await UserDeleteLog.create({
      userId,
      actionType: "delete_now",
      reason: reason || "Not provided",

      // 🔥 Snapshot taken from ProfileSettings
      nameSnapshot: snapshotUserName,
      mobileSnapshot: snapshotPhone,
    });

    // -----------------------------------------
    // STEP 2: Collect Cloudinary Public IDs
    // -----------------------------------------
    const publicIdSet = new Set();

    if (profile?.profileAvatar) {
      const pid = extractPublicId(profile.profileAvatar);
      if (pid) publicIdSet.add(pid);
    }

    const publicIds = [...publicIdSet];

    // -----------------------------------------
    // STEP 3: Delete Cloudinary images
    // -----------------------------------------
    if (publicIds.length > 0) await deleteCloudinaryBatch(publicIds);

    // -----------------------------------------
    // STEP 4: Delete everything using transaction
    // -----------------------------------------
    const session = await mongoose.startSession();
    session.startTransaction();

    await Devices.deleteMany({ userId }, { session });

    // Delete profile settings
    await ProfileSettings.deleteMany({ userId }, { session });

    // Delete user LAST
    await Users.deleteOne({ _id: userId }, { session });

    await session.commitTransaction();
    session.endSession();

    // -----------------------------------------
    // STEP 5: Success response
    // -----------------------------------------
    return res.status(200).json({
      message: "User permanently deleted",
      cloudinaryDeleted: publicIds.length,
      snapshot: {
        name: snapshotUserName,
        phone: snapshotPhone,
      },
    });

  } catch (err) {
    console.error("❌ Delete error:", err);
    return res.status(500).json({ message: "Failed to delete", error: err.message });
  }
};



const DEACTIVATE_VALID_DAYS = 20;


exports.checkAndClearDeactivatedUser = async (userId) => {
  try {
    const log = await UserDeleteLog.findOne({
      userId,
      actionType: "deactivate"
    });

    if (!log) return false; // No deactivate → normal login

    // --------------------------------------
    // CHECK VALIDITY OF DEACTIVATE DATE
    // --------------------------------------
    const deactivateDate = log.createdAt; // stored automatically
    const now = new Date();

    const diffMs = now - deactivateDate;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    const isStillValid = diffDays <= DEACTIVATE_VALID_DAYS;

    if (!isStillValid) {
      // expired → keep log, do nothing
      return false;
    }

    // --------------------------------------
    // VALID → User is returning → allow login
    // Delete deactivate request
    // --------------------------------------
    await UserDeleteLog.deleteMany({ userId, actionType: "deactivate" });

    return true; // Means deactivate request was cleared

  } catch (error) {
    console.error("Deactivate check error:", error.message);
    return false;
  }
};