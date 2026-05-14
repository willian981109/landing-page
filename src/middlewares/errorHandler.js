function errorHandler(error, req, res, next) {
  console.error(error);

  return res.status(error.statusCode || 500).json({
    error: error.message || "Internal server error",
  });
}

module.exports = errorHandler;
