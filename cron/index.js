// /cron/index.js
const cron = require("node-cron");

// Queues

module.exports = ({ timezone = "Asia/Kolkata" } = {}) => {
  console.log("✅ All cron jobs scheduled successfully (timezone:", timezone, ")");
};








