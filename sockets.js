const { Server } = require("socket.io");
const Telemetry = require("./models/Telemetry");

const setupSockets = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Join room for specific job (tracking/messaging context)
    socket.on("join_job", (jobId) => {
      socket.join(jobId);
      console.log(`User joined job room: ${jobId}`);
    });

    // Handle Real-time Location Updates (Worker -> Customer)
    socket.on("location_update", async (data) => {
      const { jobId, workerId, latitude, longitude, heading, speed } = data;
      
      // Broadcast to everyone in the job room (Customer)
      socket.to(jobId).emit("worker_location", {
        lat: latitude,
        lng: longitude,
        heading,
        speed
      });

      // Persist to Telemetry for history
      try {
        await Telemetry.create({
          job: jobId,
          worker: workerId,
          location: { type: "Point", coordinates: [longitude, latitude] },
          heading,
          speed
        });
      } catch (err) {
        console.error("Telemetry save error:", err);
      }
    });

    // Handle Real-time Messaging
    socket.on("send_message", async (data) => {
      const { jobId, senderId, text } = data;
      
      // Broadcast message to room
      socket.to(jobId).emit("receive_message", {
        senderId,
        text,
        timestamp: new Date()
      });
      
      // Note: Message persistence is handled via REST API or here
      // For simplicity, we'll assume the client calls API to save then emits here
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });

  return io;
};

module.exports = setupSockets;
