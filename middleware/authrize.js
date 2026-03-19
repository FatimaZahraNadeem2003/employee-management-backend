const { UnauthenticatedError } = require("../errors");

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new UnauthenticatedError("You are not allowed to access this route");
    }
    next();
  };
};

module.exports = authorize;
