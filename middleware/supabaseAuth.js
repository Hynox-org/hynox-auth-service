module.exports = function supabaseAuth(allowedRoles = []) {
  return (req, res, next) => {
    try {
      //  API Gateway must have attached the user object
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated by API Gateway" });
      }

      const { role } = req.user;

      //  If route requires specific roles, validate
      if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
        return res.status(403).json({
          error: `Access denied. Required role(s): ${allowedRoles.join(", ")}`
        });
      }

      // All checks passed
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
