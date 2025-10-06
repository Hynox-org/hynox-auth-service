const { createClient } = require("@supabase/supabase-js");
const Profile = require("../models/Profile");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    // Validate token with Supabase
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: "Invalid token" });

    const userId = data.user.id;

    // Fetch user from MongoDB
    const user = await Profile.findOne({ userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    req.user = user; // attach MongoDB user info including role
    next();
  } catch (err) {
    console.error("❌ SupabaseAuth middleware error:", err);
    res.status(500).json({ error: "Authentication failed", details: err.message });
  }
};
