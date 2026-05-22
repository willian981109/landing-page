function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    console.error({
      message: error.message,
      stack: error.stack,
      path: req.originalUrl,
      method: req.method,
    });
  } else {
    console.warn({
      message: error.message,
      code: error.code,
      path: req.originalUrl,
      method: req.method,
    });
  }

  return res.status(statusCode).json({
    error: isServerError ? "Internal server error" : error.message,
    code: error.code || (isServerError ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
    ...(Array.isArray(error.details) && error.details.length ? { details: error.details } : {}),
  });
}

module.exports = errorHandler;
