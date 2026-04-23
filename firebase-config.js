const admin = require("firebase-admin");
const dotenv = require("dotenv");

dotenv.config();

// The user mentioned they will provide the keys. 
// For now, I will use environment variables for security.
// To use a serviceAccountKey.json file, you would use:
// const serviceAccount = require("./serviceAccountKey.json");

try {
  if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    console.log("🔥 Firebase Admin initialized successfully");
  } else {
    console.log("⚠️ Firebase Keys missing. Skipping initialization.");
  }
} catch (error) {
  console.log("❌ Firebase Initialization Error:", error.message);
}

const sendNotification = async (token, title, body, data = {}) => {
  if (!admin.apps.length) return;
  const message = {
    notification: { title, body },
    data,
    token,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("✅ Successfully sent notification:", response);
  } catch (error) {
    console.log("❌ Error sending notification:", error.message);
  }
};

module.exports = { admin, sendNotification };
