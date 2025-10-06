const mongoose = require("mongoose");

const OrganizationSchema = new mongoose.Schema({
  orgId: { type: String, required: true, unique: true },
  orgName: { type: String, required: true },
  roles: { type: [String], default: ["super_admin"] },
  empCount: { type: Number, default: 20 }, // static
  employees: [{ type: mongoose.Schema.Types.ObjectId, ref: "Profile" }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Organization", OrganizationSchema);
