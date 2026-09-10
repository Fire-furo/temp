/**
 * config/db.js -- Part 5
 *
 * Connects to MongoDB via Mongoose. Deliberately fails GRACEFULLY: if
 * Mongo is unreachable at startup (or drops mid-demo), we log a warning
 * and disable only the scenario-history endpoints -- prediction and
 * optimization keep working with zero dependency on the database. This
 * is a real production pattern worth explaining to a judge, not an
 * accident.
 */
const mongoose = require("mongoose");

let isConnected = false;

async function connectDB(uri) {
  if (!uri) {
    console.warn("[db] No MONGO_URI provided -- scenario history endpoints will be disabled.");
    return false;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    isConnected = true;
    console.log("[db] Connected to MongoDB.");

    mongoose.connection.on("disconnected", () => {
      isConnected = false;
      console.warn("[db] MongoDB disconnected -- scenario history endpoints will return 503 until it reconnects.");
    });
    mongoose.connection.on("reconnected", () => {
      isConnected = true;
      console.log("[db] MongoDB reconnected.");
    });
    return true;
  } catch (err) {
    isConnected = false;
    console.warn(`[db] Could not connect to MongoDB (${err.message}). ` +
      "Continuing without it -- prediction/optimization endpoints are unaffected, " +
      "but /api/scenarios will return 503 until Mongo is reachable.");
    return false;
  }
}

function dbIsConnected() {
  return isConnected;
}

module.exports = { connectDB, dbIsConnected };
