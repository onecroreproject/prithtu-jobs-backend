exports.getDriveDashboard = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Drive dashboard is decommissioned",
    usage: { imagesGB: "0.00", videosGB: "0.00" },
    roles: { admin: { files: 0 }, childAdmin: { files: 0 }, users: { files: 0 } },
    recentUploads: []
  });
};

exports.driveCommand = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Feeds are decommissioned",
  });
};

