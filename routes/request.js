const express = require("express");
const router = express.Router();
const ServiceRequest = require("../models/ServiceRequest");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const AdminConfig = require("../models/AdminConfig");
const auth = require("../middleware/auth");

// @route   POST api/requests
// @desc    Customer creates a new service request
// @access  Private (Customer only)
router.post("/", auth, async (req, res) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({ msg: "Access denied. Customers only." });
  }

  const { workerId, problemDescription, address } = req.body;

  try {
    const worker = await User.findById(workerId);
    if (!worker || worker.role !== "worker") {
      return res.status(404).json({ msg: "Worker not found" });
    }

    const newRequest = new ServiceRequest({
      customer: req.user.id,
      worker: workerId,
      problemDescription,
      address,
    });

    const request = await newRequest.save();

    // In a real app, send push notification to worker here

    res.json(request);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET api/requests/worker
// @desc    Worker gets their requests
// @access  Private (Worker only)
router.get("/worker", auth, async (req, res) => {
  if (req.user.role !== "worker") {
    return res.status(403).json({ msg: "Access denied. Workers only." });
  }

  try {
    const requests = await ServiceRequest.find({
      worker: req.user.id,
    })
    .populate("customer", "name contactNumber email")
    .sort({ createdAt: -1 });

    // Filter the sensitive data if the request is not unlocked
    const formattedRequests = requests.map((reqData) => {
      const r = reqData.toObject();
      if (!r.isUnlockedByWorker) {
        r.problemDescription = "Hidden until unlocked. Pay to view.";
        r.address = "Hidden until unlocked. Pay to view.";
        r.customer.contactNumber = "HIDDEN";
        r.customer.email = "HIDDEN";
      }
      return r;
    });

    res.json(formattedRequests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   GET api/requests/customer
// @desc    Customer gets their requests
// @access  Private (Customer only)
router.get("/customer", auth, async (req, res) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({ msg: "Access denied. Customers only." });
  }

  try {
    const requests = await ServiceRequest.find({
      customer: req.user.id,
    })
    .populate("worker", "name category reputationScore")
    .sort({ createdAt: -1 });
    
    res.json(requests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   PATCH api/requests/:id/amount
// @desc    Worker sets the service amount
// @access  Private (Worker only)
router.patch("/:id/amount", auth, async (req, res) => {
  if (req.user.role !== "worker") {
    return res.status(403).json({ msg: "Access denied. Workers only." });
  }

  const { amount } = req.body;
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.id);
    if (!serviceRequest || serviceRequest.worker.toString() !== req.user.id) {
       return res.status(404).json({ msg: "Request not found" });
    }
    
    serviceRequest.amount = amount;
    serviceRequest.status = "accepted"; // Auto-accept when quoting? Or manual? Let's say quote implies accepted.
    await serviceRequest.save();
    
    res.json(serviceRequest);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST api/requests/:id/pay
// @desc    Customer pays the worker
// @access  Private (Customer only)
router.post("/:id/pay", auth, async (req, res) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({ msg: "Access denied. Customers only." });
  }

  try {
    const request = await ServiceRequest.findById(req.params.id);
    if (!request || request.customer.toString() !== req.user.id) {
        return res.status(404).json({ msg: "Request not found" });
    }

    if (request.isPaid) {
        return res.status(400).json({ msg: "Already paid" });
    }

    if (request.amount <= 0) {
        return res.status(400).json({ msg: "Worker hasn't set an amount yet" });
    }

    // Process payment
    const config = await AdminConfig.findOne() || { servicePlatformFee: 15 };
    const PLATFORM_FEE = config.servicePlatformFee;

    const customer = await User.findById(req.user.id);
    const worker = await User.findById(request.worker);

    if (customer.walletBalance < request.amount) {
        return res.status(400).json({ msg: "Insufficient wallet balance" });
    }

    // Atomic-like update
    customer.walletBalance -= request.amount;
    worker.walletBalance += (request.amount - PLATFORM_FEE);
    worker.credits += 5; // Add bonus credits for job completion

    request.isPaid = true;
    request.status = "completed";

    await customer.save();
    await worker.save();
    await request.save();

    // Log Main Payment
    const newTx = new Transaction({
        user: req.user.id,
        type: "payment",
        amount: request.amount,
        status: "completed",
        paymentMethod: "wallet",
        category: worker.category,
        region: "Nexus Grid Local"
    });
    
    // Log Platform Fee
    const feeTx = new Transaction({
        user: worker._id,
        type: "platform_fee",
        amount: PLATFORM_FEE,
        status: "completed"
    });
    
    await Promise.all([newTx.save(), feeTx.save()]);

    res.json({ msg: "Payment successful", request });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

router.post("/unlock/:id", auth, async (req, res) => {
  if (req.user.role !== "worker") {
    return res.status(403).json({ msg: "Access denied. Workers only." });
  }

  const UNLOCK_FEE = 50; // Aligned with frontend UI

  try {
    // 1. Find the request
    const serviceRequest = await ServiceRequest.findById(req.params.id);

    if (!serviceRequest || serviceRequest.worker.toString() !== req.user.id) {
      return res.status(404).json({ msg: "Request not found" });
    }

    if (serviceRequest.isUnlockedByWorker) {
      return res.status(400).json({ msg: "Request already unlocked" });
    }

    // 2. Find the worker and check credits balance
    const worker = await User.findById(req.user.id);

    if (worker.credits < UNLOCK_FEE) {
      return res.status(400).json({ msg: "Insufficient credits balance. Please earn or buy more credits." });
    }

    // 3. Deduct fee and unlock request
    worker.credits -= UNLOCK_FEE;
    await worker.save();

    serviceRequest.isUnlockedByWorker = true;
    await serviceRequest.save();

    // 4. Return the full unmasked request
    const fullRequest = await ServiceRequest.findById(req.params.id).populate(
      "customer",
      "name contactNumber email",
    );

    res.json({ msg: "Request unlocked successfully", request: fullRequest });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;
