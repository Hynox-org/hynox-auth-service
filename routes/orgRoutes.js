const express = require("express");
const router = express.Router();
const Organization = require("../models/Organization");
const Profile = require("../models/Profile");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const roleAuth = require("../middleware/roleAuth");
const { createClient } = require("@supabase/supabase-js");

// Environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ----------------- Setup Org (Super Admin Only) -----------------
router.post("/setup", roleAuth(["super_admin"]), async (req, res) => {
  try {
    const { userId, orgName, empCount, serviceName, planId } = req.body;

    // Validate required fields
    if (!userId || !orgName) {
      return res.status(400).json({ error: "userId and orgName are required" });
    }

    // 🔍 Check if organization name already exists
    const existingOrg = await Organization.findOne({ orgName: orgName.trim() });
    if (existingOrg) {
      return res.status(400).json({
        error: "Organization name already exists.",
      });
    }

    // Generate unique orgId
    const orgId = uuidv4();

    // Create new organization
    const newOrg = new Organization({
      orgId,
      orgName: orgName.trim(),
      empCount: empCount || 20,
      employees: [userId],
      userId, // store super_admin userId (org creator)
      orgServices: serviceName && planId ? [[serviceName, planId]] : []
    });

    await newOrg.save();

    // Update user's orgId in Profile collection
    const updatedUser = await Profile.findOneAndUpdate(
      { userId },
      { orgId },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Success response
    res.status(201).json({
      message: "Organization created and linked successfully",
      organization: {
        orgId: newOrg.orgId,
        orgName: newOrg.orgName,
        orgServices: newOrg.orgServices,
      },
      user: {
        userId: updatedUser.userId,
        fullName: updatedUser.fullName,
      },
    });

  } catch (err) {
    console.error("Organization setup failed:", err);
    res.status(500).json({
      error: "Organization setup failed",
      details: err.message,
    });
  }
});

// ----------------- Assign New User Under Org (Super Admin Only) -----------------
router.post("/assign-user", roleAuth(["super_admin"]), async (req, res) => {
  try {
    const { fullName, email, password, countryCode, phoneNumber, role, orgId } = req.body;

    // Create user in Supabase
    const { data: supabaseData, error: supabaseError } =
      await supabase.auth.admin.createUser({
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

    // Link user to organization
    const org = await Organization.findOne({ orgId });
    if (!org) return res.status(404).json({ error: "Organization not found" });

    org.employees.push(userId);
    await org.save();

    res.status(201).json({
      message: "User created and assigned to organization successfully",
    });
  } catch (err) {
    console.error("❌ Assign user failed:", err);
    res.status(500).json({ error: "Creating user failed", details: err.message });
  }
});

// ----------------- Edit Organization (Super Admin Only) -----------------
router.put("/:orgId", roleAuth(["super_admin"]), async (req, res) => {
  try {
    const { orgId } = req.params;
    const { orgName, roles } = req.body;

    const org = await Organization.findOne({ orgId });
    if (!org) return res.status(404).json({ error: "Organization not found" });

    if (orgName) org.orgName = orgName;

    // ✅ Merge or replace roles if provided
    if (roles && roles.length) {
      const mergedRoles = [...new Set([...org.roles, ...roles])];
      org.roles = mergedRoles;
    }

    await org.save();
    res.status(200).json({ message: "Organization updated successfully" });
  } catch (err) {
    res.status(500).json({
      error: "Updating organization failed",
      details: err.message,
    });
  }
});

// ----------------- Get Organization (Public) -----------------
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
    res.status(500).json({
      error: "Fetching organization failed",
      details: err.message,
    });
  }
});

module.exports = router;
