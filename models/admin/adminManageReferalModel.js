
const mongoose = require("mongoose");
const {jobDB}=require("../../database");

const LevelConfigSchema = new mongoose.Schema({
  userLevel: { 
    type: Number, 
    required: true, 
    unique: true 
  },

  levelLimit: { 
    type: Number, 
    required: true 
  },

  tier: { 
    type: Number, 
    required: true 
  },

  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = jobDB.model(
  "LevelConfig",
  LevelConfigSchema,
  "LevelConfig"
);

