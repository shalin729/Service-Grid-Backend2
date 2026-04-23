const express = require("express");
const router = express.Router();
const AdminConfig = require("../models/AdminConfig");
const User = require("../models/User");
const PaymentAccount = require("../models/PaymentAccount");
const HelpCenter = require("../models/HelpCenter");
const JobPost = require("../models/JobPost");
const ServiceRequest = require("../models/ServiceRequest");

const auth = require("../middleware/auth");

const verifyAdmin = (req, res, next) => {
  auth(req, res, () => {
    if (req.user && req.user.role === "admin") {
      next();
    } else {
      res.status(403).json({ msg: "Access denied. Admin only." });
    }
  });
};

// -- ADMIN CONFIG (Fees) --
router.get("/config", verifyAdmin, async (req, res) => {
  try {
    let config = await AdminConfig.findOne();
    if (!config) {
      config = await AdminConfig.create({});
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/config", verifyAdmin, async (req, res) => {
  try {
    let config = await AdminConfig.findOne();
    if (!config) {
      config = new AdminConfig(req.body);
    } else {
      Object.assign(config, req.body);
    }
    await config.save();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -- USERS --
router.get("/users", verifyAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/users/:id", verifyAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -- PAYMENT ACCOUNTS --
router.get("/payments", verifyAdmin, async (req, res) => {
  try {
    const payments = await PaymentAccount.find().populate(
      "user",
      "name email role",
    );
    res.json(payments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/payments/:id/status", verifyAdmin, async (req, res) => {
  try {
    const payment = await PaymentAccount.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true },
    );
    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -- HELP CENTER --
router.get("/help-centers", verifyAdmin, async (req, res) => {
  try {
    const tickets = await HelpCenter.find().populate("user", "name email");
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/help-centers/:id/reply", verifyAdmin, async (req, res) => {
  try {
    const ticket = await HelpCenter.findByIdAndUpdate(
      req.params.id,
      {
        adminReply: req.body.adminReply,
        status: req.body.status || "resolved",
      },
      { new: true },
    );
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const Transaction = require("../models/Transaction");

// -- TRANSACTIONS & EARNINGS --
router.get("/transactions", verifyAdmin, async (req, res) => {
  try {
    const { userId, type, status, category, startDate, endDate } = req.query;
    let query = {};
    
    if (userId) query.user = userId;
    if (type) query.type = type;
    if (status) query.status = status;
    if (category) query.category = category;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .populate("user", "name email role")
      .sort("-createdAt");
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/earnings-report", verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let matchStage = { type: "payment" };
    
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const report = await Transaction.aggregate([
      { $match: matchStage },
      { $group: {
        _id: null,
        totalEarnings: { $sum: "$amount" },
        count: { $sum: 1 },
        averageValue: { $avg: "$amount" }
      }}
    ]);

    const byCategory = await Transaction.aggregate([
      { $match: matchStage },
      { $group: {
        _id: "$category",
        total: { $sum: "$amount" },
        count: { $sum: 1 }
      }}
    ]);

    res.json({
      summary: report[0] || { totalEarnings: 0, count: 0, averageValue: 0 },
      byCategory
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -- DASHBOARD STATS --
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const users = await User.countDocuments();
    const activeJobs = await JobPost.countDocuments({ status: "open" });
    const pendingRequests = await ServiceRequest.countDocuments({
      status: "pending",
    });
    const config = (await AdminConfig.findOne()) || {};

    // Calculate total transactions value
    const transactionAggregate = await Transaction.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const revenue = transactionAggregate[0]?.total || 0;

    // Generate dynamic chart data (mocked for recent days if no data exists)
    const trafficStats = [45, 75, 50, 95, 70, 90, 100, 85, 60, 80, 65, 98];

    res.json({ 
      users, 
      activeJobs, 
      pendingRequests, 
      config,
      totalRevenue: revenue,
      trafficStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -- DEV ONLY SEEDER (Bypass Auth for convenience) --
router.post("/seed-dev", async (req, res) => {
  try {
    const bcrypt = require("bcryptjs");
    const CATEGORIES = ["plumber", "electrician", "carpenter", "painter", "ac", "gas geyser", "electric geyser", "other"];
    const CITIES = ["Mumbai", "Delhi", "Bangalore", "Pune", "Ahmedabad", "Hyderabad", "Kolkata", "Lucknow"];
    const generateRandomReferral = () => Math.random().toString(36).substring(2, 8).toUpperCase();

    // Clear existing
    await User.deleteMany({});
    await JobPost.deleteMany({});
    await ServiceRequest.deleteMany({});
    await Transaction.deleteMany({});
    await HelpCenter.deleteMany({});

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("Password@123", salt);

    // Create Admin
    await User.create({
      name: "Super Admin",
      email: "admin@gmail.com",
      password: hashedPassword,
      role: "admin",
      referralCode: "ADMIN001"
    });

    const customers = [];
    for (let i = 1; i <= 15; i++) {
      const user = await User.create({
        name: `Customer ${i}`,
        email: `customer${i}@gmail.com`,
        password: hashedPassword,
        role: "customer",
        address: `${CITIES[i % CITIES.length]}, Area ${i}`,
        walletBalance: 5000,
        referralCode: `CUST${i}${generateRandomReferral()}`
      });
      customers.push(user);
    }

    const workers = [];
    for (let i = 1; i <= 15; i++) {
      const cat = CATEGORIES[i % CATEGORIES.length];
      const user = await User.create({
        name: `Worker ${i} (${cat})`,
        email: `worker${i}@gmail.com`,
        password: hashedPassword,
        role: "worker",
        category: cat,
        contactNumber: `98765432${i.toString().padStart(2, '0')}`,
        address: `${CITIES[i % CITIES.length]}, Street ${i}`,
        reputationScore: 4.8,
        rating: 4.8,
        walletBalance: 1000,
        credits: 1000,
        referralCode: `WORK${i}${generateRandomReferral()}`
      });
      workers.push(user);
    }

    const mainCustomers = customers.slice(0, 5);
    for (let i = 1; i <= 70; i++) {
      const customer = mainCustomers[i % mainCustomers.length];
      await JobPost.create({
        customer: customer._id,
        title: `Job Title ${i}: ${CATEGORIES[i % CATEGORIES.length]} Service Required`,
        description: `This is a detailed description for job number ${i}.`,
        address: customer.address,
        category: CATEGORIES[i % CATEGORIES.length],
        status: "open",
        createdAt: new Date()
      });
    }

    res.json({ msg: "Database Seeded Successfully! Login with: customer1@gmail.com / Password@123" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
