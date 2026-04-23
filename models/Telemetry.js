const mongoose = require("mongoose");

const TelemetrySchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: "JobPost", required: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    heading: { type: Number },
    speed: { type: Number },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

TelemetrySchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Telemetry", TelemetrySchema);
