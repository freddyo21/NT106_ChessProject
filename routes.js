const express = require("express");
const router = express.Router();
const User = require("./user");
const bcrypt = require("bcryptjs");


router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const exist = await User.findOne({ email });
    if (exist) return res.status(400).json({ msg: "Email exists" });

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hash
    });

    res.json({ msg: "Register success", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGIN 
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: "Wrong password" });

    res.json({ msg: "Login success", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;