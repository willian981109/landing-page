function notFoundHandler(req, res) {
  return res.status(404).json({
    error: "Route not found",
    code: "NOT_FOUND",
  });
}

module.exports = notFoundHandler;
