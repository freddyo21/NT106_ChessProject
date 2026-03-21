const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());


const authRoutes = require("./routes");

mongoose.connect("mongodb://localhost:27017/auth_demo");

app.use("/auth", authRoutes);

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});