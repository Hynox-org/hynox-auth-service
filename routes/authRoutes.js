const express = require("express");
const router = express.Router();
const User = require("../models/Profile");
const { createClient } = require("@supabase/supabase-js");
const supabaseAuth = require("../middleware/supabaseAuth");
const bcrypt = require("bcrypt");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ----------------- Signup -----------------
router.post("/signup", async (req, res) => {
  try {
    const { fullName, email, password, countryCode, phoneNumber, role = "employee" } = req.body;

    if (!fullName || !email || !password || !phoneNumber) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    // 1️⃣ Sign up user in Supabase
    const { data: supabaseData, error: supabaseError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { role }, // store role in Supabase
    });

    if (supabaseError) return res.status(400).json({ error: supabaseError.message });

    const userId = supabaseData.id;

    // 2️⃣ Hash password before storing in MongoDB
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3️⃣ Create user in MongoDB
    const newUser = new User({
      userId,
      fullName,
      email,
      password: hashedPassword,
      countryCode,
      phone: phoneNumber,
      role, // store role in MongoDB as well
    });

    await newUser.save();

    res.status(201).json({ message: "User registered successfully", user: newUser });
  } catch (err) {
    res.status(500).json({ error: "Signup failed", details: err.message });
  }
});

// ----------------- Login -----------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    // Login through Supabase
    const { data: supabaseData, error: supabaseError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (supabaseError) return res.status(400).json({ error: supabaseError.message });

    const userId = supabaseData.user.id;

    // Fetch user details from MongoDB
    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: "User not found in DB" });

    res.json({ message: "Login successful", user, session: supabaseData.session });
  } catch (err) {
    res.status(500).json({ error: "Login failed", details: err.message });
  }
});

// ----------------- Update Profile -----------------
router.put("/update-profile/:userId", supabaseAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Only allow the authenticated user to update their profile
    if (req.user.id !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { fullName, email, phone, countryCode, country, state, language, profilePicUrl } = req.body;

    // Update in MongoDB
    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (countryCode) user.countryCode = countryCode;
    if (country) user.country = country;
    if (state) user.state = state;
    if (language) user.language = language;
    if (profilePicUrl) user.profilePic.url = profilePicUrl;

    await user.save();

    // Optional: update Supabase metadata as well
    await supabase.auth.admin.updateUserById(userId, {
      email,
      user_metadata: { role: user.role },
    });

    res.status(200).json({ message: "Profile updated successfully", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Profile update failed", details: err.message });
  }
});

module.exports = router;
