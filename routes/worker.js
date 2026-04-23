const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");

// @route   GET api/workers
// @desc    Get all workers or search by name
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const { name } = req.query;
    let query = { role: "worker" };
    if (name) {
      query.name = { $regex: name, $options: "i" };
    }
    const workers = await User.find(query).select("-password -walletBalance");
    res.json(workers);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET api/workers/:category
// @desc    Get all workers by category
// @access  Private
router.get("/:category", auth, async (req, res) => {
  try {
    const workers = await User.find({
      role: "worker",
      category: req.params.category,
    }).select("-password -walletBalance"); // Do not expose other users' wallet balance
    res.json(workers);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET api/workers/profile/:id
// @desc    Get specific worker details (basic info)
// @access  Private
router.get("/profile/:id", auth, async (req, res) => {
  try {
    const worker = await User.findById(req.params.id).select(
      "name category rating contactNumber",
    ); // Exposing just enough for the customer
    if (!worker || worker.role !== "worker") {
      return res.status(404).json({ msg: "Worker not found" });
    }
    res.json(worker);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST api/workers/rate/:id
// @desc    Rate a worker
// @access  Private (Customer only)
router.post("/rate/:id", auth, async (req, res) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({ msg: "Access denied. Customers only." });
  }

  const { ratingScore } = req.body;
  if (!ratingScore || ratingScore < 1 || ratingScore > 5) {
    return res.status(400).json({ msg: "Rating must be between 1 and 5" });
  }

  try {
    const worker = await User.findById(req.params.id);
    if (!worker || worker.role !== "worker") {
      return res.status(404).json({ msg: "Worker not found" });
    }

    // New average calculation
    const currentTotalWeight = worker.rating * worker.totalRatings;
    worker.totalRatings += 1;
    worker.rating = (currentTotalWeight + ratingScore) / worker.totalRatings;
    worker.reputationScore = worker.rating; // Keep reputation in sync with average rating

    await worker.save();
    res.json({ msg: "Rating submitted", rating: worker.rating });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
