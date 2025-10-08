const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const authRoutes = require("./routes/authRoutes");
const orgRoutes = require("./routes/orgRoutes"); 

const app = express();
app.use(express.json());
// ------------------- MIDDLEWARE -------------------
// app.use(express.json());
// app.use(
//   cors({
    // origin: process.env.CLIENT_URL || "http://localhost:3000",
    // credentials: true,
//   })
// );
// ------------------- DATABASE CONNECTION -------------------
mongoose
  .connect(process.env.MONGO_URI, {
    dbName: "hynox-auth",
  })
  .then(() => console.log("✅ MongoDB connected to hynox-auth"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ------------------- ROUTES -------------------
app.use("/identity/api/auth", authRoutes);
app.use("/identity/api/org", orgRoutes);

// ------------------- DEFAULT ROUTE -------------------
app.get("/", (req, res) => {
  res.send("🚀 Auth Backend is running...");
});

// ------------------- SERVER START -------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));
