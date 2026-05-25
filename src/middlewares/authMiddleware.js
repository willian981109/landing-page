const jwt = require("jsonwebtoken");
const { pool } = require("../database/pool");

function createAuthError(message, statusCode = 401, code = "AUTH_REQUIRED") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: process.env.JWT_ISSUER || "english-studio",
    });
  } catch (error) {
    const previousSecret = process.env.JWT_PREVIOUS_SECRET;

    if (!previousSecret) {
      throw error;
    }

    return jwt.verify(token, previousSecret, {
      issuer: process.env.JWT_ISSUER || "english-studio",
    });
  }
}

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw createAuthError("Authorization header is required", 401, "AUTH_REQUIRED");
    }

    const [type, token] = authHeader.split(" ");

    if (type !== "Bearer" || !token) {
      throw createAuthError("Bearer token is required", 401, "AUTH_REQUIRED");
    }

    const decoded = verifyToken(token);
    const userResult = await pool.query(
      "SELECT id, role FROM users WHERE id = $1 AND role = $2",
      [decoded.sub, decoded.role]
    );

    if (userResult.rowCount === 0) {
      throw createAuthError("Invalid or expired token", 401, "TOKEN_INVALID");
    }

    req.user = {
      id: decoded.sub,
      role: decoded.role,
    };

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(createAuthError("Invalid or expired token", 401, "TOKEN_EXPIRED"));
    }

    if (error.name === "JsonWebTokenError") {
      return next(createAuthError("Invalid or expired token", 401, "TOKEN_INVALID"));
    }

    return next(error);
  }
}

module.exports = authMiddleware;
