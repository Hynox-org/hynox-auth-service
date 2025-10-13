// backend/middleware/supabaseAuth.js
module.exports = function roleAuth(allowedRoles = []) {
  return (req, res, next) => {
    try {
      const userId = req.headers["x-user-id"];
      const userRole = req.headers["x-user-role"];

      if (!userId) {
        return res
          .status(401)
          .json({ error: "User not authenticated by API Gateway" });
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        return res.status(403).json({
          error: `Access denied. Required role(s): ${allowedRoles.join(", ")}`,
        });
      }

      req.user = { id: userId, role: userRole };
      next();
    } catch (err) {
      console.error("Authorization middleware error:", err);  
      res.status(500).json({
        error: "Internal server error during role check",
        details: err.message,
      });
    }
  };
};
