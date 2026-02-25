
const ProfileSettings = require("../models/profileSettingModel");
const JobPost = require("../models/job/jobpost/jobSchema");
const mongoose = require("mongoose");





exports.globalSearch = async (req, res) => {
  try {
    const userId = req.Id ? new mongoose.Types.ObjectId(req.Id) : null;

    const query = req.query.q?.trim();
    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query cannot be empty.",
      });
    }

    const prefixRegex =
      query.length === 1
        ? new RegExp("^" + query, "i")
        : new RegExp(query, "i");

    /* -------------------------------------------
       1️⃣ JOB SEARCH (Regex + Full Text)
    --------------------------------------------*/
    const regexJobQuery = JobPost.find({
      status: "active",
      $or: [
        { title: prefixRegex },
        { role: prefixRegex },
        { jobRole: prefixRegex },
        { companyName: prefixRegex },
        { location: prefixRegex },
        { description: prefixRegex },
        { keyword: prefixRegex },
      ],
    })
      .select("title role jobRole companyName location")
      .limit(10);

    const textJobQuery =
      query.length >= 3
        ? JobPost.find({
          $text: { $search: query },
          status: "active",
        })
          .select("title role jobRole companyName location score")
          .limit(10)
          .sort({ score: { $meta: "textScore" } })
        : Promise.resolve([]);


    /* -------------------------------------------
       2️⃣ FEED SEARCH (Decommissioned)
    --------------------------------------------*/
    const enrichedFeeds = [];


    /* -------------------------------------------
       3️⃣ RUN JOB + PEOPLE + CATEGORY FETCHES
    --------------------------------------------*/
    const [categories, people, regexJobs, textJobs] = await Promise.all([
      Promise.resolve([]),

      ProfileSettings.find({
        $or: [
          { userName: prefixRegex },
          { name: prefixRegex },
          { lastName: prefixRegex },
        ],
      })
        .select("userName profileAvatar name userId")
        .limit(10),

      regexJobQuery,
      textJobQuery,
    ]);

    /* MERGE JOBS */
    const jobMap = new Map();
    [...regexJobs, ...textJobs].forEach(job => jobMap.set(String(job._id), job));
    const jobs = Array.from(jobMap.values()).slice(0, 10);


    /* -------------------------------------------
       RETURN FINAL RESPONSE
    --------------------------------------------*/
    return res.status(200).json({
      success: true,
      query,
      categories,
      people,
      jobs,
      feeds: enrichedFeeds,
    });

  } catch (error) {
    console.error("❌ Search Error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while searching.",
      error: error.message,
    });
  }
};

