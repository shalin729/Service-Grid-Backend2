const mongoose = require("mongoose");

const AdminConfigSchema = new mongoose.Schema(
  {
    workerVisitingFee: { type: Number, default: 50 },
    customerPlatformFee: { type: Number, default: 20 },
    baseCommissionRate: { type: Number, default: 10 }, // percentage
    servicePlatformFee: { type: Number, default: 15 }, // direct deduction from service payment
  },
  { timestamps: true },
);

module.exports = mongoose.model("AdminConfig", AdminConfigSchema);
