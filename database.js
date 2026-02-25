const mongoose = require("mongoose");

// 🟢 JOB Database (Primary DB)
const jobDB = mongoose.createConnection(process.env.JOB_DB_URI, {
  maxPoolSize: 20,
  minPoolSize: 5,
  autoIndex: true,
});

// Connection logs
jobDB.on("connected", () => console.log("✅ JOB DB connected"));
jobDB.on("error", (err) => console.error("❌ JOB DB Error:", err));

module.exports = { jobDB };
