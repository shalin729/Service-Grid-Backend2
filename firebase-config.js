// Firebase is temporarily disabled to avoid deploy-time errors
// Exports a minimal stub so other modules can import safely.

const admin = { apps: [] };

const sendNotification = async (token, title, body, data = {}) => {
  // Firebase disabled: no-op for now
  console.log('Firebase disabled — skipping sendNotification', { token, title, body });
  return null;
};

module.exports = { admin, sendNotification };
