const validRoles = ["employee", "manager", "super_admin"];

const OrganizationSchema = new mongoose.Schema({
  orgId: { type: String, required: true, unique: true },
  orgName: { type: String, required: true },
  roles: { 
    type: [String], 
    enum: validRoles,  
    default: ["super_admin"], 
  },
  empCount: { type: Number, default: 20 },
  employees: [{ type: String, ref: "Profile" }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Organization", OrganizationSchema);
