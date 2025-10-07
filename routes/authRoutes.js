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

// ----------------- Signup (Public) -----------------
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
      options: { data: { role } },
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

    // 3️⃣ Store user in MongoDB
    const newUser = new User({
      userId: supabaseUserId,
      fullName,
      email,
      password: hashedPassword,
      countryCode,
      ...(phoneNumber && { phone: phoneNumber }),// include only if provided

      role,
    });

    await newUser.save();

    res.status(201).json({
      message: "Signup successful",
      userId: supabaseUserId,
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Signup failed", details: err.message });
  }
});

// ----------------- Login (Public) -----------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    // 1️⃣ Log in via Supabase
    const { data: supabaseData, error: supabaseError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (supabaseError)
      return res.status(400).json({ supabaseError: supabaseError.message });

    const supabaseUserId = supabaseData.user?.id;
    if (!supabaseUserId)
      return res.status(400).json({ message: "Login failed — no user ID returned" });

    // 2️⃣ Fetch user profile from MongoDB
    const user = await User.findOne({ userId: supabaseUserId });
    if (!user)
      return res.status(404).json({ message: "User not found in MongoDB" });

    res.status(200).json({
      message: "Login successful",
      userId: user.userId,
      accessToken: supabaseData.session?.access_token,
      expiresIn: supabaseData.session?.expires_in,
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
