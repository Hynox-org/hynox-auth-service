const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  countryCode: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Profile", userSchema);
