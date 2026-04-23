const mongoose = require("mongoose");

const ServiceRequestSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    problemDescription: { type: String, required: true },
    address: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "completed", "rejected"],
      default: "pending",
    },
    isUnlockedByWorker: { type: Boolean, default: false }, // Worker pays to make this true
    amount: { type: Number, default: 0 },
    isPaid: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ServiceRequest", ServiceRequestSchema);
