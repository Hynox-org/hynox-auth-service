const mongoose = require("mongoose");

const OrganizationSchema = new mongoose.Schema({
  orgId: { type: String, required: true, unique: true },
  orgName: { type: String, required: true },
  userId: { type: String, required: true , ref: "Profile"}, //  user who created the org (Supabase ID)
  roles: { type: [String], default: ["standard", "admin", "guest","super_admin"] },
  empCount: { type: Number, default: 20 },
  employees: [{ type: String, ref: "Profile" }],
   orgServices: [
    {
      serviceName: { type: String, required: true },
      planId: { type: String, required: true }
    }
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Organization", OrganizationSchema);
