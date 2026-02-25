const mongoose=require("mongoose")
const {jobDB}=require("../database");


const ProfileVisibilitySchema = new mongoose.Schema(
  {
    // 🔹 Basic Details
    name: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    lastName: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    displayName: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    gender: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    userName: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    bio: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    dateOfBirth: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "followers",
    },
    maritalDate: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "followers",
    },
    maritalStatus: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "followers",
    },

    // 🔹 Contact Details
    phoneNumber: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "private",
    },
    whatsAppNumber: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "private",
    },
    email: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "private",
    },

    // 🔹 Location
    address: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "followers",
    },
    country: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    city: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },

    // 🔹 Avatar & Cover
    profileAvatar: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    coverPhoto: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },

    // 🔹 Social Links (visibility for the entire social link section)
    socialLinks: {
      facebook: {
        type: String,
        enum: ["public", "followers", "private"],
        default: "public",
      },
      instagram: {
        type: String,
        enum: ["public", "followers", "private"],
        default: "public",
      },
      twitter: {
        type: String,
        enum: ["public", "followers", "private"],
        default: "public",
      },
      linkedin: {
        type: String,
        enum: ["public", "followers", "private"],
        default: "public",
      },
      github: {
        type: String,
        enum: ["public", "followers", "private"],
        default: "public",
      },
      youtube: {
        type: String,
        enum: ["public", "followers", "private"],
        default: "public",
      },
      website: {
        type: String,
        enum: ["public", "followers", "private"],
        default: "public",
      },
    },

    // 🔹 Extra / Privacy fields
    location: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "followers",
    },
  },
  { timestamps: true }
);

module.exports = jobDB.model("ProfileVisibility", ProfileVisibilitySchema, "ProfileVisibility");
