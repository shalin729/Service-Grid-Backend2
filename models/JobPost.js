const mongoose = require("mongoose");

const JobPostSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    address: { type: String, required: true },
    latitude: { type: Number },
    longitude: { type: Number },
    category: {
      type: String,
      enum: [
        "plumber",
        "electrician",
        "carpenter",
        "painter",
        "ac",
        "gas geyser",
        "electric geyser",
        "other",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    media: [{ type: String }],
    unlockedByWorkers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

module.exports = mongoose.model("JobPost", JobPostSchema);
