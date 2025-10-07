const express = require("express");
const router = express.Router();
const User = require("../models/Profile");
const { createClient } = require("@supabase/supabase-js");
const supabaseAuth = require("../middleware/supabaseAuth");
const bcrypt = require("bcrypt");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ----------------- Signup -----------------
router.post("/signup", async (req, res) => {
  try {
    const { fullName, email, password, countryCode, phoneNumber, role = "super_admin" } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    // 1️⃣ Create user in Supabase
    const { data: supabaseData, error: supabaseError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role }, // store role as metadata
      },
    });

    if (supabaseError) {
      return res.status(400).json({ supabaseError: supabaseError.message });
    }

    const supabaseUserId = supabaseData.user?.id;
    if (!supabaseUserId) {
      return res.status(400).json({ error: "Failed to retrieve Supabase user ID" });
    }

    // 2️⃣ Hash password before saving in MongoDB
    const hashedPassword = await bcrypt.hash(password, 10);
    if (phoneNumber) phone = phoneNumber;

    // 3️⃣ Store user in MongoDB
    const newUser = new User({
      userId: supabaseUserId,
      fullName,
      email,
      password: hashedPassword,
      countryCode,
      phone,
      role,
    });

    await newUser.save();

    // 4️⃣ Immediately sign in to get access token (Supabase doesn’t auto-return session on signup)
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      console.error("Signup loginError:", loginError.message);
      return res.status(201).json({
        message: "User registered successfully, but failed to auto-login",
        user: newUser,
      });
    }

    res.status(201).json({
      message: "Signup successful",
      Id: userId,
      accessToken: loginData.session.access_token,
      expiresIn: loginData.session.expires_in,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Signup failed", details: err.message });
  }
});

// ----------------- Login -----------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    // 1️⃣ Log in via Supabase
    const { data: supabaseData, error: supabaseError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (supabaseError)
      return res.status(400).json({ supabaseError: supabaseError.message });

    const supabaseUserId = supabaseData?.user?.id || supabaseData?.session?.user?.id;
    if (!supabaseUserId) {
      return res.status(400).json({ message: "Login failed — no user ID returned from Supabase" });
    }

    // 2️⃣ Fetch MongoDB profile
    const user = await User.findOne({ userId: supabaseUserId });
    if (!user) return res.status(404).json({ message: "User not found in MongoDB" });

    // ✅ Return access token & session info
    res.json({
      message: "Login successful",
      userId: user.userId,
      accessToken: supabaseData.session.access_token,
      expiresIn: supabaseData.session.expires_in,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed", details: err.message });
  }
});

// ----------------- Update Profile -----------------
router.put("/update-profile/:userId", supabaseAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Only allow the authenticated user to update their profile
    if (req.user.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { fullName, phone, countryCode, country, state, language, profilePicUrl } = req.body;

    // Update in MongoDB
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

    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { role: user.role },
    });

    res.status(200).json({ 
      message: "Profile updated successfully", 
      userId: user.userId,
      accessToken: req.user.accessToken, 
      expiresIn: req.user.expiresIn 
  });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Profile update failed", details: err.message });
  }
});

module.exports = router;
