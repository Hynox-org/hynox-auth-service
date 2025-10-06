const mongoose = require("mongoose");

// Helper function to generate profile pic (first letter + random color)
function generateProfilePic(fullName) {
  const colors = [
    "#FFB6C1", "#87CEFA", "#98FB98", "#FFD700",
    "#FFA07A", "#AFEEEE", "#DA70D6", "#90EE90",
  ];
  const bgColor = colors[Math.floor(Math.random() * colors.length)];
  const initial = fullName ? fullName.charAt(0).toUpperCase() : "?";

  return { initial, bgColor };
}

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  countryCode: { type: String, default: "" },
  country: { type: String, default: "" },
  state: { type: String, default: "" },
  language: { type: String, default: "" },
  profilePic: {
    type: Object,
    default: function () {
      return generateProfilePic(this.fullName);
    },
  },
  role: { type: String, enum: ["employee", "manager", "super_admin"], default: "super_admin" },
  orgId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Profile", userSchema);