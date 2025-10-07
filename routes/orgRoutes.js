const express = require("express");
const router = express.Router();
const Organization = require("../models/Organization");
const Profile = require("../models/Profile");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const supabaseAuth = require("../middleware/supabaseAuth");
const { createClient } = require("@supabase/supabase-js");

//  Use environment variables for security
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

//  Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ----------------- Setup Org for Super Admin -----------------
router.post("/setup", supabaseAuth, async (req, res) => {
  try {
    const { userId, orgName } = req.body;

    // Only allow the authenticated user to setup their org
    if (req.user.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const orgId = uuidv4();
    const newOrg = new Organization({ orgId, orgName, roles:validRoles, empCount: 20 });
    await newOrg.save();

    const updatedUser = await Profile.findOneAndUpdate(
      { userId },
      { orgId },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ error: "User not found" });
    
    res.status(201).json({ message: "Organization created and linked", organization: orgId, user: userId });
  } 
  catch (err) {
    res.status(500).json({ error: "Organization setup failed", details: err.message });
  }
});

// ----------------- Assign New User Under Org (Super Admin Only) -----------------
router.post("/assign-user", supabaseAuth, async (req, res) => {
  try {
    const { fullName, email, password, countryCode, phoneNumber, role, orgId } = req.body;

    // Ensure only super_admin can assign
    const superAdmin = await Profile.findOne({ userId: req.user.id });
    if (!superAdmin || superAdmin.role !== "super_admin")
      return res.status(403).json({ error: "Only super_admin can assign users" });

    // Validate role
    const validRoles = ["employee", "manager", "super_admin"];
    if (!validRoles.includes(role))
      return res.status(400).json({ error: "Invalid role provided" });

    // Create user in Supabase
    const { data: supabaseData, error: supabaseError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { role },
    });

    if (supabaseError)
      return res.status(400).json({ supabaseError: supabaseError.message });

    const userId = supabaseData.user?.id;
    if (!userId)
      return res.status(400).json({ error: "User ID missing from Supabase response" });

    // Hash password and save in MongoDB
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new Profile({
      userId, fullName, email,
      password: hashedPassword,
      countryCode, phone: phoneNumber,
      role, orgId,
    });
    await newUser.save();

    // Link user to org using Supabase userId (string)
    const org = await Organization.findOne({ orgId });
    if (!org) return res.status(404).json({ error: "Organization not found" });

    org.employees.push(userId); // ✅ store Supabase UUID
    await org.save();

    res.status(201).json({
      message: "User created and assigned to organization successfully",
    });
  } catch (err) {
    console.error("❌ Assign user failed:", err);
    res.status(500).json({ error: "Creating user failed", details: err.message });
  }
});

// ----------------- Edit Organization Details (Super Admin Only) -----------------
router.put("/:orgId", supabaseAuth, async (req, res) => {//supabaseAuth(["super_admin" , " admin "])
  try {
    const { orgId } = req.params;
    const { orgName, roles } = req.body;

    const adminUser = await Profile.findOne({ userId: req.user.userId });
    if (!adminUser || adminUser.role !== "super_admin")
      return res.status(403).json({ error: "Only super_admin can update organization" });

    const org = await Organization.findOne({ orgId });
    if (!org) return res.status(404).json({ error: "Organization not found" });

    if (orgName) org.orgName = orgName;

    // ✅ Merge or replace roles if provided
    if (roles && roles.length) {
      const mergedRoles = [...new Set([...org.roles, ...roles])]; // remove duplicates
      org.roles = mergedRoles;
    }

    await org.save();
    res.status(200).json({ message: "Organization updated successfully" });
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
    res.status(200).json({
        organization: org.orgName,
        users: users.map((user) => ({
            fullName: user.fullName,
            email: user.email,
            role: user.role,
        })),
    });
  } catch (err) {
        res.status(500).json({ error: "Fetching organization failed", details: err.message });
  }
});

module.exports = router;
