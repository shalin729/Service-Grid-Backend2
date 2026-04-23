const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: "JobPost" }, // Optional, for job-related tx
    type: { 
      type: String, 
      enum: ["deposit", "withdrawal", "payment", "referral_bonus", "platform_fee", "refund"],
      required: true 
    },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["pending", "completed", "failed"], default: "completed" },
    paymentMethod: { type: String, enum: ["wallet", "gateway", "credits"], default: "wallet" },
    gatewayTransactionId: { type: String },
    
    // For Admin Reporting
    category: { type: String }, // e.g., plumber, electrician
    region: { type: String }, // e.g., City name
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", TransactionSchema);
