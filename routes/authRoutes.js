const express = require("express");
const router = express.Router();
const User = require("../models/Profile");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ----------------- Signup -----------------
router.post("/signup", async (req, res) => {
  try {
    const { fullName, email, password, countryCode, phoneNumber } = req.body;

    if (!fullName || !email || !password || !countryCode || !phoneNumber) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    // 1️⃣ Sign up in Supabase
    const { data: supabaseData, error: supabaseError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (supabaseError) return res.status(400).json({ error: supabaseError.message });

    const userId = supabaseData.user.id;

    // 2️⃣ Create user in MongoDB
    const newUser = new User({
      userId,
      fullName,
      email,
      countryCode,
      phoneNumber,
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

    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    // 1️⃣ Login through Supabase
    const { data: supabaseData, error: supabaseError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (supabaseError) return res.status(400).json({ error: supabaseError.message });

    const userId = supabaseData.user.id;

    // 2️⃣ Fetch user details from MongoDB
    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: "User not found in DB" });

    res.json({ message: "Login successful", user, session: supabaseData.session });
  } catch (err) {
    res.status(500).json({ error: "Login failed", details: err.message });
  }
});

module.exports = router;
