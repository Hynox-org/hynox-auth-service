const { createClient } = require("@supabase/supabase-js");
const Profile = require("../models/Profile");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

module.exports = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // ✅ Validate token using Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      console.error("❌ Supabase validation error:", error?.message);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const userId = data.user.id;

    // ✅ Fetch user from MongoDB (to verify existence and role)
    const user = await Profile.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: "User not found in MongoDB" });
    }

    // ✅ Attach both Supabase + Mongo user data to the request
    req.user = {
      userId: userId,             //  now available directly as req.user.userId
      email: data.user.email,
      role: user.role,
      mongoProfile: user,         // keep full MongoDB user doc if needed
      supabaseUser: data.user,    // keep Supabase user info
    };

    next();
  } catch (err) {
    console.error("❌ SupabaseAuth middleware error:", err);
    res.status(500).json({
      error: "Authentication failed",
      details: err.message,
    });
  }
};
