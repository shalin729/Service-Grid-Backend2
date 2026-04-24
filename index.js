const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Routes
const authRoutes = require("./routes/auth");
const workerRoutes = require("./routes/worker");
const requestRoutes = require("./routes/request");
const jobRoutes = require("./routes/job");
const adminRoutes = require("./routes/admin");

app.use("/api/auth", authRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/admin", adminRoutes);

const http = require("http");
const setupSockets = require("./sockets");

const server = http.createServer(app);
const io = setupSockets(server);

// Make io accessible in routes if needed
app.set("io", io);

app.get("/", (req, res) => {
  res.send("Nexus Service Grid API is running...");
});

const PORT = process.env.PORT || 5000;

const startServer = () => {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

if (require.main === module) {
  if (process.env.MONGO_URI) {
    mongoose
      .connect(process.env.MONGO_URI)
      .then(() => {
        console.log("MongoDB Connected");
        startServer();
      })
      .catch((err) => {
        console.error("MongoDB connection failed:", err);
        console.warn("Starting server without DB connection.");
        startServer();
      });
  } else {
    console.warn("MONGO_URI not set — skipping DB connection. Starting server without DB.");
    startServer();
  }
}

module.exports = app;
