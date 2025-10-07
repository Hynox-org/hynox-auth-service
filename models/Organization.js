const mongoose = require("mongoose");

const OrganizationSchema = new mongoose.Schema({
  orgId: { type: String, required: true, unique: true },
  orgName: { type: String, required: true },
  roles: { type:[String], enum: ["employee", "manager","admin", "super_admin"] },
  empCount: { type: Number, default: 20 }, // static
  employees: [{ type: String, ref: "Profile" }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Organization", OrganizationSchema);
