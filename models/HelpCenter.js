const mongoose = require("mongoose");

const HelpCenterSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "in-progress", "resolved"],
      default: "open",
    },
    adminReply: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("HelpCenter", HelpCenterSchema);
