function roleMiddleware(allowedRoles) {
  return function checkUserRole(req, res, next) {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      const error = new Error("Forbidden");
      error.statusCode = 403;
      return next(error);
    }

    return next();
  };
}

module.exports = roleMiddleware;
