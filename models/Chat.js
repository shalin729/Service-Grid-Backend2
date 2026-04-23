const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    job: { type: mongoose.Schema.Types.ObjectId, ref: "JobPost" },
    lastMessage: { type: String },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", ChatSchema);
