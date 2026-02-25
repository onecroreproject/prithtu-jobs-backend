const mongoose = require("mongoose");

exports.getUserFeedsWeb = async (req, res) => {
  return res.status(200).json({
    success: true,
    totalFeeds: 0,
    feeds: [],
    message: "Feeds are decommissioned",
  });
};
