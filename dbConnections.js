// utils/dbConnections.js
const mongoose = require("mongoose");

const connections = {}; // cache for multiple service connections

// Define URIs for each service
const DB_URIS = {
  crm: process.env.CRM_DB_URI,
  // add more services if needed
};

// Define DB names for each service (same key as above)
const DB_NAMES = {
  crm: process.env.CRM_DB_NAME,
  // add more services if needed
};

async function getServiceDB(serviceName) {
  const uri = DB_URIS[serviceName];
  const dbName = DB_NAMES[serviceName];

  console.log(`🧩 Connecting to service: ${serviceName}`);
  console.log(`URI: ${uri}`);
  console.log(`DB Name: ${dbName}`);

  if (!uri) throw new Error(`No DB URI configured for service: ${serviceName}`);
  if (!dbName) throw new Error(`No DB name configured for service: ${serviceName}`);

  // Reuse existing connection if already established
  if (connections[serviceName]) {
    console.log(`🔁 Reusing existing connection for "${serviceName}"`);
    return connections[serviceName];
  }

  // Create new connection and wait for it to open
  const conn = mongoose.createConnection(uri, { dbName });

  return new Promise((resolve, reject) => {
    conn.once("open", () => {
      console.log(`✅ Connected to service "${serviceName}" → DB: ${dbName}`);
      connections[serviceName] = conn;
      resolve(conn);
    });

    conn.on("error", (err) => {
      console.error(`❌ MongoDB connection error for service "${serviceName}":`, err);
      reject(err);
    });
  });
}

module.exports = { getServiceDB };
