const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function run() {
    const client = new MongoClient(process.env.MONGO_URI);
    try {
        await client.connect();
        const db = client.db();
        const users = db.collection('users');
        
        await users.deleteMany({ email: 'admin@gmail.com' });
        
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash("Password@123", salt);
        
        await users.insertOne({
            name: "Super Admin",
            email: "admin@gmail.com",
            password: hashed,
            role: "admin",
            referralCode: "ADMIN001",
            walletBalance: 0,
            credits: 0,
            reputationScore: 5.0,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        console.log("Admin account (re)created: admin@gmail.com / Password@123");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
