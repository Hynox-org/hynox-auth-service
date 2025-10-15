const express = require("express");
const router = express.Router();
const Organization = require("../models/Organization");
const Profile = require("../models/Profile");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");

// ----------------- Setup Org -----------------
router.post("/setup", async (req, res) => {
  try {
    const { orgName, empCount, serviceName, userId, role } = req.body;

    if (!orgName || !serviceName)
      return res.status(400).json({ error: "orgName and serviceName are required" });

    // Check if organization name exists
    const existingOrg = await Organization.findOne({ orgName: orgName.trim() });
    if (existingOrg)
      return res.status(400).json({ error: "Organization name already exists." });

    // ✅ Connect to the corresponding service DB
    const { getServiceDB } = require("../dbConnections");
    const serviceConn = await getServiceDB(serviceName);

    const freePlan = await serviceConn.db
      .collection("subscriptions")
      .findOne({ planName: "Free" });

    if (!freePlan)
      return res.status(404).json({ error: `Free plan not found in ${serviceName} DB` });

    const planId = freePlan.planId || freePlan._id?.toString();
    const orgId = uuidv4();

    const newOrg = new Organization({
      orgId,
      orgName: orgName.trim(),
      userId,
      empCount: empCount || 20,
      employees: [userId],
      orgServices: [{ serviceName, planId }],
    });

    await newOrg.save();

    // Update user's orgId
    const updatedUser = await Profile.findOne(
      { userId });
      
      if (!updatedUser) return res.status(404).json({ error: "User not found" });
      updatedUser.orgId = orgId;
      await updatedUser.save();

    res.status(201).json({
      message: "Organization created and linked successfully",
      org: {
        orgId: newOrg.orgId,
        orgName: newOrg.orgName,
        orgServices: newOrg.orgServices,
      },
      user: {
        userId: updatedUser.userId,
      },
    });
  } catch (err) {
    console.error("Organization setup failed:", err);
    res.status(500).json({ error: "Organization setup failed", details: err.message });
  }
});

// ----------------- Assign New User Under Org -----------------
router.post("/assign-user", async (req, res) => {
  try {
    const { fullName, email, password, countryCode, phoneNumber, orgId, role } = req.body;

    const org = await Organization.findOne({ orgId });
    if (!org)
      return res.status(404).json({ error: "Organization not found" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new Profile({
      userId: uuidv4(),
      fullName,
      email,
      password: hashedPassword,
      countryCode,
      phone: phoneNumber,
      role,
      orgId,
    });

    await newUser.save();

    org.employees.push(newUser.userId);
    await org.save();

    res.status(201).json({
      message: "User created and assigned to organization successfully",
      userId: newUser.userId,
    });
  } catch (err) {
    console.error("Assign user failed:", err);
    res.status(500).json({ error: "Creating user failed", details: err.message });
  }
});

// ----------------- Edit Organization -----------------
router.put("/:orgId", async (req, res) => {
  try {
    const { orgId } = req.params;
    const { orgName, roles } = req.body;

    const org = await Organization.findOne({ orgId });
    if (!org) return res.status(404).json({ error: "Organization not found" });

    if (orgName) org.orgName = orgName;
    if (roles && roles.length)
      org.roles = [...new Set([...org.roles, ...roles])];

    await org.save();
    res.status(200).json({ message: "Organization updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Updating organization failed", details: err.message });
  }
});

// ----------------- Get Organization -----------------
router.get("/:orgId", async (req, res) => {
  try {
    const { orgId } = req.params;
console.log(orgId)
    const org = await Organization.findOne({ orgId });
    if (!org) return res.status(404).json({ error: "Organization not found" });

    const users = await Profile.find({ orgId });
    res.status(200).json({
      organization: org.orgName,
      users: users.map((u) => ({
        fullName: u.fullName,
        email: u.email,
        role: u.role,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Fetching organization failed", details: err.message });
  }
});

module.exports = router;
