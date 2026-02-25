const jwt = require("jsonwebtoken");
const Session = require("../models/user/sessionDevice/sessionModel");
const User = require("../models/user/userModel");
const { getIO } = require("../middlewares/webSocket");
const Device = require("../models/user/sessionDevice/deviceModel");
const mongoose = require("mongoose")// Ensure this correctly exports from your socket setup

// 🔄 Refresh Access Token
exports.refreshAccessToken = async (req, res) => {
  console.time("🔁 Total Refresh Process");
  const stepTime = (label) => console.time(label);
  const stepEnd = (label) => console.timeEnd(label);

  try {
    const { refreshToken, deviceId, os, browser, deviceType } = req.body;

    if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });
    if (!deviceId) return res.status(400).json({ error: "Device ID required" });

    console.log("🔁 Refresh Token Request:", { deviceId });

    // ✅ Track DB connection state before anything
    console.log("🔌 Mongoose readyState:", mongoose.connection.readyState);

    // 1️⃣ Find session
    stepTime("DB: Session.findOne");
    const session = await Session.findOne({ refreshToken }).populate("deviceId");
    stepEnd("DB: Session.findOne");

    if (!session) {
      console.warn("⚠️ No session found for refresh token");
      return res.status(401).json({ error: "Invalid session or refresh token" });
    }

    // 2️⃣ Verify refresh token (async + timed)
    stepTime("JWT Verify");
    let decoded;
    try {
      decoded = await new Promise((resolve, reject) => {
        jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    } catch (err) {
      stepEnd("JWT Verify");
      console.warn("⚠️ Invalid or expired refresh token");
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }
    stepEnd("JWT Verify");

    // 3️⃣ Find user
    stepTime("DB: User.findById");
    const user = await User.findById(decoded.userId);
    stepEnd("DB: User.findById");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 4️⃣ Issue new access token
    stepTime("JWT Sign");
    const accessToken = jwt.sign(
      {
        userName: user.userName,
        userId: user._id,
        role: "User",
        referralCode: user.referralCode,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    stepEnd("JWT Sign");

    // 5️⃣ Update session
    stepTime("DB: Session.save");
    session.isOnline = true;
    session.lastSeenAt = new Date();
    await session.save();
    stepEnd("DB: Session.save");

    // 6️⃣ Update or create device
    stepTime("DB: Device.findOne");
    let device = await Device.findOne({ userId: user._id, deviceId });
    stepEnd("DB: Device.findOne");

    const deviceName = `${os || device?.os || "Unknown OS"} - ${browser || device?.browser || "Unknown Browser"
      }`;

    if (device) {
      stepTime("DB: Device.save");
      device.os = os || device.os;
      device.browser = browser || device.browser;
      device.deviceType = deviceType || device.deviceType;
      device.deviceName = deviceName;
      device.isOnline = true;
      device.lastActiveAt = new Date();
      await device.save();
      stepEnd("DB: Device.save");
    } else {
      stepTime("DB: Device.create");
      device = await Device.create({
        userId: user._id,
        deviceId,
        os: os || "Unknown OS",
        browser: browser || "Unknown Browser",
        deviceType: deviceType || "web",
        deviceName,
        ipAddress: req.ip,
        isOnline: true,
        lastActiveAt: new Date(),
      });
      stepEnd("DB: Device.create");
    }

    // 7️⃣ Update user status
    stepTime("DB: User.findByIdAndUpdate");
    await User.findByIdAndUpdate(user._id, {
      isOnline: true,
      lastSeenAt: new Date(),
    });
    stepEnd("DB: User.findByIdAndUpdate");

    // 8️⃣ WebSocket notify (safe)
    stepTime("Socket Emit");
    try {
      const io = getIO();
      if (io) io.emit("userOnline", { userId: user._id });
    } catch (err) {
      console.warn("⚠️ WebSocket emit failed:", err.message);
    }
    stepEnd("Socket Emit");

    console.log(`✅ Token refreshed for user ${user.userName} (${device.deviceName})`);
    console.timeEnd("🔁 Total Refresh Process");

    // 9️⃣ Return new token & device info
    return res.json({
      success: true,
      message: "Access token refreshed successfully",
      accessToken,
      userId: user._id,
      deviceId: device.deviceId,
      deviceType: device.deviceType,
      deviceName: device.deviceName,
      os: device.os,
      browser: device.browser,
    });
  } catch (error) {
    console.error("❌ Refresh token error:", error);
    console.timeEnd("🔁 Total Refresh Process");
    return res.status(500).json({ error: error.message });
  }
};


// 💓 Heartbeat (called periodically to confirm user is active)
exports.heartbeat = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Session ID required" });
    }

    // ✅ Update session "lastSeenAt" fast + async (no blocking)
    Session.updateOne(
      { _id: sessionId },
      { $set: { lastSeenAt: new Date(), isOnline: true } }
    ).exec(); // 🚀 No await → no timeouts

    // ✅ Update user online status async
    Session.findById(sessionId)
      .select("userId")
      .lean()
      .then((session) => {
        if (!session) return;

        // Update user status async
        User.updateOne(
          { _id: session.userId },
          { $set: { isOnline: true } }
        ).exec();

        // ✅ Emit presence change ONLY if user was previously offline
        const io = getIO();
        if (io) {
          io.emit("userOnline", { userId: session.userId });
        }
      });

    // ✅ Return instantly → no waiting → no timeout
    return res.status(200).json({ message: "Heartbeat OK" });

  } catch (error) {
    console.error("Heartbeat error:", error.message);
    return res.status(500).json({ error: "Server Error" });
  }
};






// controllers/sessionController.js
exports.userPresence = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    const { sessionId, isOnline } = req.body;

    if (!userId || !sessionId) {
      return res.status(400).json({ error: "userId and sessionId are required" });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const previousStatus = session.isOnline;
    const now = new Date();

    // 🕒 Update session presence
    if (previousStatus !== isOnline) {
      session.isOnline = isOnline;
      session.lastSeenAt = now;
      await session.save();

      // 🧠 Update user document only if status changed
      await User.findByIdAndUpdate(userId, {
        isOnline,
        lastSeenAt: now,
      });

      // 📡 Emit socket presence event
      const io = getIO();
      if (io) {
        const event = isOnline ? "userOnline" : "userOffline";
        io.emit(event, { userId });
        console.log(`📡 Emitted ${event} for user ${userId}`);
      }
    } else {
      // No change, just refresh timestamp
      session.lastSeenAt = now;
      await session.save();
    }

    res.json({
      success: true,
      message: `User presence updated: ${isOnline ? "Online" : "Offline"}`,
      userId,
      isOnline,
      lastSeenAt: now,
    });
  } catch (err) {
    console.error("❌ userPresence Error:", err);
    res.status(500).json({ error: err.message });
  }
};

