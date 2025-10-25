const express = require("express");
const router = express.Router();
const User = require("../models/Profile");
const Organization = require("../models/Organization");
const bcrypt = require("bcrypt");

// ----------------- Signup -----------------
router.post("/signup", async (req, res) => {
  try {
    const {
      userId,
      fullName,
      email,
      password,
      countryCode,
      phoneNumber,
      serviceName,
      planId,
      role = "super_admin",
    } = req.body;

    // ✅ Validate essential fields (password is optional)
    if (!fullName || !email || !userId) {
      return res.status(400).json({
        error: "Full name, email, and userId are required",
      });
    }

    // ✅ Check if user already exists
      const existingUser = await User.findOne({ $or: [{ email }, { userId }] });
      if (existingUser) {
        if (existingUser.orgId === null) {
          return res.status(200).json({
            message: "User already exists",
            userId: existingUser.userId,
            role: existingUser.role,
            action: "CREATE_ORG",
          });
        }
        return res.status(200).json({
          message: "User already exists",
          userId: existingUser.userId,
          role: existingUser.role,
          action: "EVERUTHING DONE",
        });
      }
let hashedPassword = null;
if (password) {
  hashedPassword = await bcrypt.hash(password, 10);
}


    // ✅ Create new user document
    const newUser = new User({
      userId,
      fullName,
      email,
      password: hashedPassword,
      role,
      countryCode,
      phone: phoneNumber || "",
    });

    await newUser.save();

    // ✅ Response
    res.status(201).json({
      message: "Signup successful",
      user: { id: userId },
      action: "CREATE_ORG",
      serviceDetails: {
        serviceName: serviceName || "default",
        planId: planId || null,
      },
      nextStep: "Setup Organization",
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});

// ----------------- Login -----------------
router.post("/login", async (req, res) => {
  try {
    const { email, password, serviceName, userId } = req.body;
    console.log(userId);
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ userId });
    if (!user)
      return res.status(404).json({ message: "User not found in MongoDB" });
    console.log(user);
    // Check org linkage
    if (!user.orgId) {
      if (user.role === "super_admin") {
        return res.status(200).json({
          message: "Organization setup required",
          action: "CREATE_ORG",
          userId: user.userId,
          role: user.role,
        });
      } else {
        return res.status(403).json({
          message: "Unauthorized: No organization linked",
          action: "UNAUTHORIZED_USER",
        });
      }
    }

    let org = null;
    if (user.orgId) org = await Organization.findOne({ orgId: user.orgId });

    // ✅ Fetch Free planId dynamically per service DB if missing
    if (org && serviceName) {
      const serviceExists = org.orgServices.some(
        (s) => s.serviceName === serviceName
      );

      if (!serviceExists) {
        try {
          const { getServiceDB } = require("../dbConnections");
          const serviceConn = await getServiceDB(serviceName);

          const freePlan = await serviceConn.db
            .collection("subscriptions")
            .findOne({ planName: "Free" });

          if (freePlan) {
            const planId = freePlan.planId || freePlan._id?.toString();
            org.orgServices.push({ serviceName, planId });
            await org.save();
          } else {
            console.warn(`No 'Free' plan found in ${serviceName} DB.`);
          }
        } catch (dbErr) {
          console.error(`Error fetching Free plan for ${serviceName}:`, dbErr);
        }
      }
    }

    res.status(200).json({
      message: "Login successful",
      user: { userId: user.userId, role: user.role },
      org: {
        organization: org.orgId ,
        service: serviceName,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res
      .status(500)
      .json({ error: "Login failed", details: err.message });
  }
});

// ----------------- Update Profile -----------------
router.put("/update/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, phone, countryCode, country, state, language, profilePicUrl } = req.body;

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;
    if (countryCode) user.countryCode = countryCode;
    if (country) user.country = country;
    if (state) user.state = state;
    if (language) user.language = language;
    if (profilePicUrl)
      user.profilePic = { ...user.profilePic, url: profilePicUrl };

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      userId: user.userId,
    });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Profile update failed", details: err.message });
  }
});

//-------------------- Get User by Supabase UID ----------------------    
router.get("/user/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🔍 Fetching user with Supabase UID:", id);

    const user = await User.findOne({ userId: id }).select("userId fullName email role");

    if (!user) {
      console.error("❌ User not found in DB");
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("🔥 Auth-Service Error:", error.message);
    res.status(500).json({ message: "Error fetching user", details: error.message });
  }
});



module.exports = router;
