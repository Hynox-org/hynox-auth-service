const mongoose = require("mongoose");

const OrganizationSchema = new mongoose.Schema({
  orgId: { type: String, required: true, unique: true },
  orgName: { type: String, required: true },
  userId: { type: String, required: true , ref: "Profile"}, // ✅ user who created the org (Supabase ID)
  roles: { type: [String], default: ["employee", "manager", "admin","super_admin"] },
  empCount: { type: Number, default: 20 },
  employees: [{ type: String, ref: "Profile" }],
  orgServices: { type: [[String]], default: [] }, // ✅ [["crm", "67110a6f4b3d2d8f8a1c1111"], ...]
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Organization", OrganizationSchema);
