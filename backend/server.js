/**
 * server.js -- Part 5: Express app entry point.
 *
 * Connects to MongoDB (gracefully -- see config/db.js), mounts the API
 * routes, and starts listening. The ML microservice (ml-service/, a
 * separate FastAPI process running the trained XGBoost model) is
 * called over HTTP from services/mlClient.js -- it is NOT started by
 * this process, so run it separately (see README.md).
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const { connectDB } = require("./config/db");
const apiRoutes = require("./routes/api");

const PORT = process.env.PORT || 5050;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fleetwake";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", apiRoutes);

// Optional: if frontend/dist exists (i.e. someone ran `npm run build` in
// frontend/), serve it here too. This lets the whole app run behind a
// SINGLE port/tunnel -- handy for Colab or any single-port deployment,
// where exposing three separate ports isn't convenient. In normal local
// dev, frontend/dist won't exist and this block is skipped -- use the
// Vite dev server (npm run dev in frontend/) instead.
const FRONTEND_DIST = path.join(__dirname, "..", "frontend", "dist");
if (fs.existsSync(FRONTEND_DIST)) {
  console.log("[server] Serving built frontend from frontend/dist");
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.json({ service: "fleetwake-backend", status: "running", docs: "/api/health" });
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  await connectDB(MONGO_URI); // continues even if this fails -- see config/db.js
  app.listen(PORT, () => {
    console.log(`[server] Fleetwake backend listening on http://127.0.0.1:${PORT}`);
    console.log(`[server] ML service expected at ${process.env.ML_SERVICE_URL || "http://127.0.0.1:8000"}`);
  });
}

start();
