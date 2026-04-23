const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

const User = require("./models/User");
const JobPost = require("./models/JobPost");
const ServiceRequest = require("./models/ServiceRequest");
const Transaction = require("./models/Transaction");
const HelpCenter = require("./models/HelpCenter");

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        await User.deleteMany({});
        await JobPost.deleteMany({});
        await ServiceRequest.deleteMany({});
        await Transaction.deleteMany({});
        await HelpCenter.deleteMany({});

        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash("Password@123", salt);

        await User.create({
            name: "Super Admin",
            email: "admin@gmail.com",
            password: hashed,
            role: "admin",
            referralCode: "ADM001"
        });

        const rahul = await User.create({
            name: "Rahul S",
            email: "rahul@gmail.com",
            password: hashed,
            role: "customer",
            address: "Mumbai",
            walletBalance: 5000,
            referralCode: "RHL123"
        });

        const suresh = await User.create({
            name: "Suresh S",
            email: "suresh@gmail.com",
            password: hashed,
            role: "worker",
            category: "plumber",
            contactNumber: "9876543210",
            address: "Mumbai",
            reputationScore: 4.8,
            rating: 4.8,
            referralCode: "SUR321"
        });

        await JobPost.create({
            customer: rahul._id,
            title: "Leaking Pipe in Kitchen",
            description: "Need a plumber ASAP!",
            address: "Andheri, Mumbai",
            category: "plumber",
            status: "open"
        });

        await ServiceRequest.create({
            customer: rahul._id,
            worker: suresh._id,
            problemDescription: "Tap check",
            address: "Mumbai",
            status: "pending",
            isUnlockedByWorker: false
        });

        await Transaction.create({
            user: rahul._id,
            type: "deposit",
            amount: 5000,
            status: "completed",
            region: "Mumbai"
        });

        console.log("SUCCESS: Lively data seeded!");
        process.exit(0);
    } catch (e) {
        console.error("FAIL:", e);
        process.exit(1);
    }
}
seed();
