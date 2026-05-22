const { sanitizePlainText } = require("../utils/securityValidation");

const SENSITIVE_KEYS = new Set(["password", "password_hash", "token"]);

function sanitizeValue(value, key = "") {
  if (SENSITIVE_KEYS.has(key)) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizePlainText(value, 5000);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, sanitizeValue(entryValue, entryKey)])
    );
  }

  return value;
}

function sanitizeRequest(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }

  return next();
}

module.exports = sanitizeRequest;
