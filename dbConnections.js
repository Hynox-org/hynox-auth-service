// utils/dbConnections.js
const mongoose = require("mongoose");

const connections = {};

const DB_URIS = {
  crm: process.env.CRM_DB_URI,
  // add more services as needed
};

async function getServiceDB(serviceName) {
  const uri = DB_URIS[serviceName];
  if (!uri) throw new Error(`No DB URI configured for service: ${serviceName}`);

  // Reuse connection if already established
  if (connections[serviceName]) return connections[serviceName];

  // Create new connection
  const conn = await mongoose.createConnection(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  connections[serviceName] = conn;
  return conn;
}

module.exports = { getServiceDB };
