const jwt = require("jsonwebtoken");
const User = require("../models/User");
const redisClient = require("../config/redis");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const cacheKey = `user:profile:${decoded.id}`;
      let user = null;

      try {
        if (redisClient && redisClient.isOpen) {
          const cachedUser = await redisClient.get(cacheKey);
          if (cachedUser) {
            user = JSON.parse(cachedUser);
          }
        }
      } catch (err) {
        console.error("Redis read user profile failed:", err);
      }

      if (!user) {
        user = await User.findById(decoded.id).select("-password").lean();
        if (user) {
          try {
            if (redisClient && redisClient.isOpen) {
              await redisClient.set(cacheKey, JSON.stringify(user), { EX: 1800 }); // Cache for 30 minutes
            }
          } catch (err) {
            console.error("Redis write user profile failed:", err);
          }
        }
      }

      if (!user) {
        return res.status(401).json({
          message: "Not authorized",
        });
      }

      user.id = user._id.toString();
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      message: "No token provided",
    });
  }
};

module.exports = protect;
