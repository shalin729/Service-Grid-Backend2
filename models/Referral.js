const mongoose = require("mongoose");

const ReferralSchema = new mongoose.Schema(
  {
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    referee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rewardAmount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "completed"], default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Referral", ReferralSchema);
