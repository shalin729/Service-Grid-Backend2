const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

// @route   POST api/auth/register
// @desc    Register a user
router.post("/register", async (req, res) => {
  const { name, email, password, role, category, contactNumber, address, referrerCode } =
    req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const userProps = {
      name,
      email,
      password,
      role,
    };

    // Link referrer if provided
    if (referrerCode) {
      const referrer = await User.findOne({ referralCode: referrerCode.trim().toUpperCase() });
      if (referrer) {
        userProps.referredBy = referrer._id;
      }
    }

    if (role === "worker") {
      userProps.category = category;
      userProps.contactNumber = contactNumber;
      userProps.address = address;
    }

    user = new User(userProps);

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    // Trigger Admin Real-time Sync
    const io = req.app.get("io");
    if (io) io.emit("admin_stats_update", { type: "user_registered", id: user.id });

    // Reward logic could happen here or upon first job completion
    // For simplicity, we'll mark the referral but reward later

    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 360000 },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: { 
            id: user.id, 
            name: user.name, 
            role: user.role,
            referralCode: user.referralCode
          },
        });
      },
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

// @route   GET api/auth/referrals
// @desc    Get user referral stats
router.get("/referrals", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const referrals = await User.find({ referredBy: user._id }).select("name createdAt");
    res.json({
      referralCode: user.referralCode,
      referralCount: referrals.length,
      referrals
    });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// @route   POST api/auth/admin-login
// @desc    Authenticate admin & get token
router.post("/admin-login", async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    if (user.role !== "admin") {
      return res.status(403).json({ msg: "Access Forbidden: Not an Admin" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 86400 }, // 24 hours for admin
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: { id: user.id, name: user.name, role: user.role },
        });
      },
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 360000 },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: { id: user.id, name: user.name, role: user.role },
        });
      },
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// @route   GET api/auth/me
// @desc    Get user data
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: err.message || "Server error" });
  }
});

// @route   PUT api/auth/me/location
// @desc    Update user location
router.put("/me/location", auth, async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    let user = await User.findById(req.user.id);

    if (latitude !== undefined) user.latitude = parseFloat(latitude);
    if (longitude !== undefined) user.longitude = parseFloat(longitude);
    if (address !== undefined) user.address = address;

    await user.save();
    res.json({
      msg: "Location updated",
      location: {
        latitude: user.latitude,
        longitude: user.longitude,
        address: user.address,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// @route   POST api/auth/fcm-token
// @desc    Register FCM device token for notifications
// @access  Private
router.post("/fcm-token", auth, async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    user.fcmToken = token;
    await user.save();
    res.json({ msg: "Device token saved successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST api/auth/test-wallet
// @desc    Refill test wallet balance (For development only)
// @access  Private
router.post("/test-wallet", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    user.walletBalance += 5000;
    await user.save();
    res.json({ msg: "₹5000 Test Wallet balance added!", balance: user.walletBalance });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST api/auth/test-credits
// @desc    Refill test credits (For development only)
// @access  Private
router.post("/test-credits", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    user.credits = 500;
    await user.save();
    res.json({ msg: "500 Test Credits added!", credits: user.credits });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
