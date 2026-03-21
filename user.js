const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,     
  provider: {            
    type: String,
    default: "local"
  },
  providerId: String,   
  avatar: String
});

module.exports = mongoose.model("User", userSchema);
//auth controller
const User = require("./user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const axios = require("axios");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Hàm tạo JWT
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "15m" });
};

// ----------------- LOCAL AUTH -----------------
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!email || !password) return res.status(400).json({ msg: "Missing fields" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: "Email exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      provider: "local"
    });

    const token = generateToken(user._id);
    res.json({ msg: "Register success", token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });

    if (user.provider !== "local")
      return res.status(400).json({ msg: `Please login with ${user.provider}` });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Wrong password" });

    const token = generateToken(user._id);
    res.json({ msg: "Login success", token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------- GOOGLE AUTH -----------------
exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();

    const { email, name, picture, sub } = payload;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        username: name,
        email,
        provider: "google",
        providerId: sub,
        avatar: picture
      });
    }

    const token = generateToken(user._id);
    res.json({ msg: "Google login success", token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------- FACEBOOK AUTH -----------------
exports.facebookLogin = async (req, res) => {
  try {
    const { accessToken } = req.body;

    const response = await axios.get(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
    );

    const { id, name, email, picture } = response.data;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        username: name,
        email,
        provider: "facebook",
        providerId: id,
        avatar: picture.data.url
      });
    }

    const token = generateToken(user._id);
    res.json({ msg: "Facebook login success", token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
//auth routest
const express = require("express");
const router = express.Router();
const authController = require("./auth.controller");

// Local auth
router.post("/register", authController.register);
router.post("/login", authController.login);

// Social auth
router.post("/google", authController.googleLogin);
router.post("/facebook", authController.facebookLogin);

module.exports = router;
//
const express = require("express");
const mongoose = require("mongoose");
const authRoutes = require("./auth/auth.routes");
require("dotenv").config();

const app = express();
app.use(express.json());

mongoose.connect("mongodb://localhost:27017/chess", {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

app.use("/auth", authRoutes);

app.listen(3000, () => {
  console.log("Auth server running at http://localhost:3000");
});