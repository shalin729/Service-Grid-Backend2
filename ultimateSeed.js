const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

// Load models
const User = require("./models/User");
const JobPost = require("./models/JobPost");
const ServiceRequest = require("./models/ServiceRequest");
const Transaction = require("./models/Transaction");
const HelpCenter = require("./models/HelpCenter");

dotenv.config();

const CATEGORIES = ["plumber", "electrician", "carpenter", "painter", "ac", "gas geyser", "electric geyser", "other"];
const CITIES = ["Mumbai", "Delhi", "Bangalore", "Pune", "Ahmedabad", "Hyderabad", "Kolkata", "Lucknow"];

const generateRandomReferral = () => Math.random().toString(36).substring(2, 8).toUpperCase();

async function ultimateSeed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB for ultimate seeding...");

        // 1. Clear ALL data
        await User.deleteMany({});
        await JobPost.deleteMany({});
        await ServiceRequest.deleteMany({});
        await Transaction.deleteMany({});
        await HelpCenter.deleteMany({});

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("Password@123", salt);

        console.log("Creating Admin...");
        await User.create({
            name: "Super Admin",
            email: "admin@gmail.com",
            password: hashedPassword,
            role: "admin",
            referralCode: "ADMIN001"
        });

        // 2. Create 30+ Users (15 Customers, 15 Workers)
        console.log("Creating 30 Users...");
        const customers = [];
        for (let i = 1; i <= 15; i++) {
            const user = await User.create({
                name: `Customer ${i}`,
                email: `customer${i}@gmail.com`,
                password: hashedPassword,
                role: "customer",
                address: `${CITIES[i % CITIES.length]}, Area ${i}`,
                walletBalance: Math.floor(Math.random() * 10000),
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
                reputationScore: (Math.random() * (5 - 3.5) + 3.5).toFixed(1),
                rating: (Math.random() * (5 - 3.5) + 3.5).toFixed(1),
                walletBalance: 200,
                credits: 500,
                referralCode: `WORK${i}${generateRandomReferral()}`
            });
            workers.push(user);
        }

        // 3. Create 70+ Job Posts (mostly assigned to 5 customers)
        console.log("Creating 70 Job Posts...");
        const mainCustomers = customers.slice(0, 5);
        for (let i = 1; i <= 70; i++) {
            const customer = mainCustomers[i % mainCustomers.length];
            await JobPost.create({
                customer: customer._id,
                title: `Job Title ${i}: ${CATEGORIES[i % CATEGORIES.length]} Service Required`,
                description: `This is a detailed description for job number ${i}. We need a professional to finish this task as soon as possible.`,
                address: customer.address,
                category: CATEGORIES[i % CATEGORIES.length],
                status: i % 10 === 0 ? "closed" : "open",
                createdAt: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000))
            });
        }

        // 4. Create 50+ Service Requests (mostly assigned to 5 workers)
        console.log("Creating 50 Service Requests...");
        const mainWorkers = workers.slice(0, 5);
        for (let i = 1; i <= 50; i++) {
            const worker = mainWorkers[i % mainWorkers.length];
            const customer = customers[Math.floor(Math.random() * customers.length)];
            await ServiceRequest.create({
                customer: customer._id,
                worker: worker._id,
                problemDescription: `Inquiry ${i}: Problem with my ${worker.category} installation.`,
                address: customer.address,
                status: ["pending", "accepted", "completed", "rejected"][i % 4],
                isUnlockedByWorker: i % 2 === 0,
                createdAt: new Date(Date.now() - Math.floor(Math.random() * 15 * 24 * 60 * 60 * 1000))
            });
        }

        // 5. Create 30+ Transactions
        console.log("Creating 30 Transactions...");
        const types = ["payment", "platform_fee", "deposit", "withdrawal"];
        for (let i = 1; i <= 30; i++) {
            const user = i % 2 === 0 ? customers[i % 15] : workers[i % 15];
            const amount = Math.floor(Math.random() * 2000) + 100;
            await Transaction.create({
                user: user._id,
                type: types[i % types.length],
                amount: amount,
                status: "completed",
                category: user.role === "worker" ? user.category : CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
                region: CITIES[Math.floor(Math.random() * CITIES.length)],
                createdAt: new Date(Date.now() - Math.floor(Math.random() * 45 * 24 * 60 * 60 * 1000))
            });
        }

        // 6. Bonus: Help Center Tickets
        console.log("Creating Support Tickets...");
        for (let i = 1; i <= 10; i++) {
            const user = i % 2 === 0 ? customers[i] : workers[i];
            await HelpCenter.create({
                user: user._id,
                subject: `Issue #${i}: ${["Payment Error", "Login Issue", "Worker Dispute", "App Crash"][i % 4]}`,
                message: `Hello support, I am facing a problem with my account. Please help me with issue number ${i}.`,
                status: ["open", "in-progress", "resolved"][i % 3],
                adminReply: i % 3 === 2 ? "We have fixed the issue for you. Thank you for your patience." : ""
            });
        }

        console.log("**************************************************");
        console.log("SUCCESS: ULTIMATE DATABASE SEED COMPLETED!");
        console.log("- 31 Users (1 Admin, 15 Customers, 15 Workers)");
        console.log("- 70 Job Posts");
        console.log("- 50 Service Requests");
        console.log("- 30 Transactions");
        console.log("- 10 Support Tickets");
        console.log("**************************************************");
        console.log("Credentials for ALL users:");
        console.log("Email example: customer1@gmail.com, worker1@gmail.com, admin@gmail.com");
        console.log("Password for ALL users: Password@123");
        console.log("**************************************************");

        process.exit(0);
    } catch (err) {
        console.error("FATAL ERROR DURING ULTIMATE SEED:", err);
        process.exit(1);
    }
}

ultimateSeed();
