const express = require("express");
const router = express.Router();
const User = require("../models/Profile");
const Organization = require("../models/Organization");
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcrypt");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ----------------- Signup -----------------
router.post("/signup", async (req, res) => {
  try {
    const {fullName, email, password, countryCode, phoneNumber, serviceName, planId, role = "super_admin"} = req.body;

    // Basic validation
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "Full name, email, and password are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    // 1️⃣ Create user in Supabase
    const { data: supabaseUser, error: supabaseError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role } // store role in Supabase metadata
      }
    });

    if (supabaseError) return res.status(400).json({ error: supabaseError.message });

    const supabaseUserId = supabaseUser?.user?.id;
    if (!supabaseUserId) return res.status(500).json({ error: "Failed to create Supabase user" });

    // 2️⃣ Hash password before saving in MongoDB
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3️⃣ Create new user in MongoDB
    const newUser = new User({
      userId: supabaseUserId,
      fullName,
      email,
      password: hashedPassword,
      role,
      countryCode,
      phone: phoneNumber || "",
    });

    await newUser.save();

    // 4️⃣ Automatically log in to generate access token
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) return res.status(400).json({ error: loginError.message });

    const accessToken = loginData?.session?.access_token;

    // 5️⃣ Return signup response (service info forwarded to setup)
    res.status(201).json({
      message: "Signup successful",
      user: {
        id: supabaseUserId,
      },
      serviceDetails: {
        serviceName: serviceName || "default",
        planId: planId || null, 
      },
      accessToken,
      nextStep: "Setup Organization",
    });

  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});
// ----------------- Login (Public) -----------------
router.post("/login", async (req, res) => {
  try {
    const { email, password, serviceName, freePlanId } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    // 1️⃣ Supabase login
    const { data: supabaseData, error: supabaseError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (supabaseError)
      return res.status(400).json({ supabaseError: supabaseError.message });

    const supabaseUserId = supabaseData.user?.id;
    if (!supabaseUserId)
      return res.status(400).json({ message: "Login failed — no user ID returned" });

    // 2️⃣ Fetch user profile
    const user = await User.findOne({ userId: supabaseUserId });
    if (!user)
      return res.status(404).json({ message: "User not found in MongoDB" });

    // 3️⃣ Get organization using orgId in user (UUID safe)
    let org = null;
    if (user.orgId) {
      org = await Organization.findOne({ orgId: user.orgId }); // ✅ use findOne for UUID
    }

    // 4️⃣ If org found, check service entry
    if (org) {
      const serviceExists = org.orgServices.some(
        ([sName]) => sName === serviceName
      );

      if (!serviceExists) {
        org.orgServices.push([serviceName, freePlanId]);
        await org.save();
      }
    }

    // 5️⃣ Respond
    res.status(200).json({
      message: "Login successful",
      userId: user.userId,
      role: user.role,
      accessToken: supabaseData.session?.access_token,
      expiresIn: supabaseData.session?.expires_in,
      organization: org?.orgId || null,
      service: serviceName,
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed", details: err.message });
  }
});

// ----------------- Update Profile (Self-Access Only) -----------------
router.put("/update-profile/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, phone, countryCode, country, state, language, profilePicUrl } = req.body;

    // 1️⃣ Update user data in MongoDB
    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;
    if (countryCode) user.countryCode = countryCode;
    if (country) user.country = country;
    if (state) user.state = state;
    if (language) user.language = language;
    if (profilePicUrl) user.profilePic = { ...user.profilePic, url: profilePicUrl };

    await user.save();

    // 2️⃣ Update Supabase user metadata (role, etc.)
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { role: user.role },
    });

    res.status(200).json({
      message: "Profile updated successfully",
      userId: user.userId,
    });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Profile update failed", details: err.message });
  }
});

module.exports = router;
