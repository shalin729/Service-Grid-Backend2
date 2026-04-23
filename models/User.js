const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["customer", "worker", "admin"],
      required: true,
    },

    // Financial & Growth
    walletBalance: { type: Number, default: 0 },
    credits: { type: Number, default: 0 },
    referralCode: { type: String, unique: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
    // Performance & Tech
    reputationScore: { type: Number, default: 5.0 },
    fcmToken: { type: String },

    // Worker specific fields
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
      required: function () {
        return this.role === "worker";
      },
    },
    contactNumber: { type: String },
    address: { type: String }, // Legacy field, might move to Address model
    latitude: { type: Number },
    longitude: { type: Number },
    rating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Pre-save hook to generate referral code
UserSchema.pre("save", async function () {
  if (!this.referralCode) {
    this.referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
});

module.exports = mongoose.model("User", UserSchema);
