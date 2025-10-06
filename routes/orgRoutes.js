const express = require("express");
const router = express.Router();
const Organization = require("../models/Organization");
const Profile = require("../models/Profile");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const supabaseAuth = require("../middleware/supabaseAuth"); // import middleware

// ----------------- Setup Org for Super Admin -----------------
router.post("/setup", supabaseAuth, async (req, res) => {
  try {
    const { userId, orgName } = req.body;

    // Only allow the authenticated user to setup their org
    if (req.user.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const orgId = uuidv4();
    const newOrg = new Organization({ orgId, orgName, roles: ["super_admin"], empCount: 20 });
    await newOrg.save();

    const updatedUser = await Profile.findOneAndUpdate(
      { userId },
      { orgId, role: "super_admin" },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ error: "User not found" });

    res.status(201).json({ message: "Organization created and linked", organization: newOrg, user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: "Organization setup failed", details: err.message });
  }
});

// ----------------- Assign New User Under Org (Super Admin Only) -----------------
router.post("/assign-user", supabaseAuth, async (req, res) => {
  try {
    const { fullName, email, password, countryCode, phoneNumber, role, orgId } = req.body;

    const superAdmin = await Profile.findOne({ userId: req.user.id });
    if (!superAdmin || superAdmin.role !== "super_admin") 
      return res.status(403).json({ error: "Only super_admin can assign users" });

    // 1️⃣ Create user in Supabase with role
    const { data: supabaseData, error: supabaseError } = await supabase.auth.admin.createUser({
      email,
      password,
    //   email_confirm: true,
      user_metadata: { role },
    });

    if (supabaseError) return res.status(400).json({ error: supabaseError.message });
    const userId = supabaseData.id;

    // 2️⃣ Hash password and store in MongoDB
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new Profile({
      userId,
      fullName,
      email,
      password: hashedPassword,
      countryCode,
      phone: phoneNumber,
      role,
      orgId,
    });
    await newUser.save();

    // 3️⃣ Link user to org
    const org = await Organization.findOne({ orgId });
    org.employees.push(newUser._id);
    await org.save();

    res.status(201).json({ message: "User created and assigned to org", user: newUser });
  } catch (err) {
    res.status(500).json({ error: "Creating user failed", details: err.message });
  }
});

// ----------------- Edit Organization Details (Super Admin Only) -----------------
router.put("/:orgId", supabaseAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { orgName, roles } = req.body;

    const adminUser = await Profile.findOne({ userId: req.user.userId });
    if (!adminUser || adminUser.role !== "super_admin") 
      return res.status(403).json({ error: "Only super_admin can update organization" });

    const org = await Organization.findOne({ orgId });
    if (!org) return res.status(404).json({ error: "Organization not found" });

    if (orgName) org.orgName = orgName;
    if (roles && roles.length) org.roles = roles;

    await org.save();
    res.status(200).json({ message: "Organization updated successfully", organization: org });
  } catch (err) {
    res.status(500).json({ error: "Updating organization failed", details: err.message });
  }
});

// ----------------- Get Organization Details (Public) -----------------
router.get("/:orgId", async (req, res) => {
  try {
    const { orgId } = req.params;

    const org = await Organization.findOne({ orgId });
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const users = await Profile.find({ orgId });
    res.status(200).json({ organization: org, users });
  } catch (err) {
    res.status(500).json({ error: "Fetching organization failed", details: err.message });
  }
});

module.exports = router;
