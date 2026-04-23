const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function auth(req, res, next) {
  const token = req.header("Authorization");

  if (!token)
    return res.status(401).json({ msg: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(
      token.replace("Bearer ", ""),
      process.env.JWT_SECRET,
    );
    
    // Safety check: ensure user still exists in DB (especially after seed/reset)
    const user = await User.findById(decoded.user.id).select("role");
    if (!user) {
      return res.status(401).json({ msg: "User account no longer exists. Please re-login." });
    }

    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: "Token is not valid" });
  }
}

module.exports = auth;
