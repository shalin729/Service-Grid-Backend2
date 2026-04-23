const express = require("express");
const router = express.Router();
const JobPost = require("../models/JobPost");
const User = require("../models/User");
const auth = require("../middleware/auth");
const cloudinary = require("cloudinary").v2;
const { sendNotification } = require("../firebase-config");

cloudinary.config({
  cloudinary_url: process.env.CLOUDINARY_URL,
});

const uploadMedia = async (mediaArray) => {
  if (!mediaArray || !mediaArray.length) return [];
  const uploadPromises = mediaArray.map(async (file) => {
    // If it's already a secure url, ignore
    if (file.startsWith("http")) return file;
    // Upload base64 string
    const result = await cloudinary.uploader.upload(file, {
      folder: "service finder app",
      resource_type: "auto",
    });
    return result.secure_url;
  });
  return Promise.all(uploadPromises);
};

// @route   POST api/jobs
// @desc    Customer creates a new job post
// @access  Private (Customer only)
router.post("/", auth, async (req, res) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({ msg: "Access denied. Customers only." });
  }

  const { title, description, address, category, latitude, longitude, media } =
    req.body;

  try {
    const uploadedMedia = await uploadMedia(media);

    const newJobPost = new JobPost({
      customer: req.user.id,
      title,
      description,
      address,
      category,
      latitude,
      longitude,
      media: uploadedMedia,
    });

    const jobPost = await newJobPost.save();

    // -- FIREBASE NOTIFICATIONS FOR NEARBY WORKERS --
    if (latitude && longitude) {
        try {
            const nearbyWorkers = await User.find({
                role: "worker",
                category: category,
                latitude: { $gte: latitude - 0.1, $lte: latitude + 0.1 },
                longitude: { $gte: longitude - 0.1, $lte: longitude + 0.1 },
                fcmToken: { $exists: true, $ne: null }
            });

            nearbyWorkers.forEach(worker => {
                sendNotification(
                    worker.fcmToken,
                    "New Job Opportunity!",
                    `New ${category} job posted near you: "${title}"`,
                    { jobId: jobPost._id.toString() }
                );
            });
        } catch (notifErr) {
            console.error("Failed to process notifications:", notifErr);
        }
    }

    // Trigger Admin Real-time Sync
    const io = req.app.get("io");
    if (io) io.emit("admin_stats_update", { type: "job_created", id: jobPost.id });

    res.json(jobPost);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// @route   GET api/jobs
// @desc    Get job posts (filter by customer or category)
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    let query = {};
    if (req.query.myJobs && req.user.role === "customer") {
      query.customer = req.user.id;
    } else if (req.user.role === "worker") {
      // Worker fetching jobs (could filter by their category, but let's get all for now to show)
      query.status = "open";
    }

    let jobs = await JobPost.find(query)
      .populate("customer", "name")
      .sort({ createdAt: -1 });

    // Privacy for workers' list view
    if (req.user.role === "worker") {
      jobs = jobs.map(job => {
        const j = job.toObject();
        const isUnlocked = j.unlockedByWorkers && j.unlockedByWorkers.some(id => id.toString() === req.user.id);
        j.unlockCount = j.unlockedByWorkers ? j.unlockedByWorkers.length : 0;
        if (!isUnlocked) {
            j.customer.name = "Locked User";
            j.address = "Location Hidden (Unlock to view)";
        }
        return j;
      });
    }
    
    res.json(jobs);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// @route   PUT api/jobs/:id
// @desc    Update a job post
// @access  Private (Customer only)
router.put("/:id", auth, async (req, res) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({ msg: "Access denied. Customers only." });
  }

  const {
    title,
    description,
    address,
    category,
    status,
    latitude,
    longitude,
    media,
  } = req.body;

  try {
    let jobPost = await JobPost.findById(req.params.id);

    if (!jobPost) {
      return res.status(404).json({ msg: "Job post not found" });
    }

    // Make sure user owns the job post
    if (jobPost.customer.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "Not authorized to update this post" });
    }

    jobPost.title = title || jobPost.title;
    jobPost.description = description || jobPost.description;
    jobPost.address = address || jobPost.address;
    jobPost.category = category || jobPost.category;
    jobPost.status = status || jobPost.status;
    if (media !== undefined) {
      const uploadedMedia = await uploadMedia(media);
      jobPost.media = uploadedMedia;
    }
    if (latitude !== undefined) jobPost.latitude = latitude;
    if (longitude !== undefined) jobPost.longitude = longitude;

    jobPost = await jobPost.save();
    res.json(jobPost);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// @route   DELETE api/jobs/:id
// @desc    Delete a job post
// @access  Private (Customer only)
router.delete("/:id", auth, async (req, res) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({ msg: "Access denied. Customers only." });
  }

  try {
    let jobPost = await JobPost.findById(req.params.id);

    if (!jobPost) {
      return res.status(404).json({ msg: "Job post not found" });
    }

    // Make sure user owns the job post
    if (jobPost.customer.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ msg: "Not authorized to delete this post" });
    }

    await jobPost.deleteOne();
    res.json({ msg: "Job post removed" });
  } catch (err) {
    console.error(err.message);
    if (err.kind === "ObjectId") {
      return res.status(404).json({ msg: "Job post not found" });
    }
    res.status(500).json({ msg: "Server error" });
  }
});

// @route   GET api/jobs/:id
// @desc    Get job details
// @access  Private
router.get("/:id", auth, async (req, res) => {
  try {
    const jobPost = await JobPost.findById(req.params.id)
      .populate("customer", "name email contactNumber address");
      
    if (!jobPost) {
      return res.status(404).json({ msg: "Job post not found" });
    }

    const job = jobPost.toObject();
    job.unlockCount = job.unlockedByWorkers ? job.unlockedByWorkers.length : 0;
    
    // Privacy Logic: Only show contact details (email/phone) to:
    // 1. The customer who posted it
    // 2. An admin
    // 3. A worker who has unlocked this job
    const isOwner = job.customer._id.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";
    const isAuthorizedWorker = req.user.role === "worker" && 
                               job.unlockedByWorkers && 
                               job.unlockedByWorkers.some(id => id.toString() === req.user.id);

    if (!isOwner && !isAdmin && !isAuthorizedWorker) {
      // Mask contact info for unauthorized workers/users
      job.customer.name = "PRIVATE CUSTOMER";
      job.customer.email = "HIDDEN (Unlock required)";
      job.customer.contactNumber = "HIDDEN (Unlock required)";
      job.customer.address = "HIDDEN (Unlock required)";
      job.address = "HIDDEN (Unlock required)";
      job.isLocked = true;
    } else {
      job.isLocked = false;
    }

    res.json(job);
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// @route   POST api/jobs/:id/unlock
// @desc    Unlock customer details for a job (Mock payment)
// @access  Private (Worker only)
router.post("/:id/unlock", auth, async (req, res) => {
  if (req.user.role !== "worker") {
    return res.status(403).json({ msg: "Access denied. Workers only." });
  }

  try {
    let jobPost = await JobPost.findById(req.params.id);
    if (!jobPost) return res.status(404).json({ msg: "Job post not found" });

    // Actual Credit Deduction
    const worker = await User.findById(req.user.id);
    if (!worker || worker.credits < 50) {
        return res.status(400).json({ msg: "Insufficient credits to unlock this lead. Please upgrade your plan." });
    }

    worker.credits -= 50;
    jobPost.unlockedByWorkers.push(req.user.id);
    
    await Promise.all([worker.save(), jobPost.save()]);

    // Log transaction
    const Transaction = require("../models/Transaction");
    await Transaction.create({
        user: req.user.id,
        type: "platform_fee",
        amount: 50, // Flat fee for unlocking
        status: "completed",
        category: jobPost.category,
        region: "Nexus Cloud"
    });

    res.json({ msg: "Successfully unlocked!", jobPost });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
