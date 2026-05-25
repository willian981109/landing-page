const { getPasswordIssues } = require("../utils/securityValidation");

const PLACEHOLDER_VALUES = new Set([
  "change_this_secret",
  "replace_with_a_long_random_secret_before_deploy",
  "replace_with_a_strong_admin_password",
]);

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch (error) {
    return false;
  }
}

function splitOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function hasDatabaseConfig(env) {
  return Boolean(
    env.DATABASE_URL ||
      (env.DB_HOST && env.DB_NAME && env.DB_USER && env.DB_PASSWORD)
  );
}

function validateEnvironment(env = process.env, { strict = env.NODE_ENV === "production" } = {}) {
  const issues = [];
  const warnings = [];
  const isProduction = env.NODE_ENV === "production";
  const jwtSecret = String(env.JWT_SECRET || "");
  const corsOrigins = splitOrigins(env.CORS_ORIGIN);

  if (!jwtSecret || jwtSecret.length < 32 || PLACEHOLDER_VALUES.has(jwtSecret)) {
    issues.push("JWT_SECRET must be configured with a strong random value of at least 32 characters.");
  }

  if (!hasDatabaseConfig(env)) {
    issues.push("Database connection must be configured with DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.");
  }

  if (isProduction) {
    if (!corsOrigins.length) {
      issues.push("CORS_ORIGIN must be configured in production.");
    }

    corsOrigins.forEach((origin) => {
      if (!isHttpUrl(origin)) {
        issues.push(`CORS_ORIGIN contains an invalid origin: ${origin}`);
      } else if (!origin.startsWith("https://")) {
        warnings.push(`CORS_ORIGIN should use HTTPS in production: ${origin}`);
      }
    });

    if (env.ADMIN_PASSWORD) {
      const passwordIssues = getPasswordIssues(env.ADMIN_PASSWORD);

      if (passwordIssues.length || PLACEHOLDER_VALUES.has(env.ADMIN_PASSWORD)) {
        issues.push("ADMIN_PASSWORD must be strong before running production seed.");
      }
    }

    if (String(env.DB_SSL || "").toLowerCase() !== "true") {
      warnings.push("DB_SSL is not enabled. Enable it if your production PostgreSQL requires encrypted connections.");
    }
  }

  if (strict && issues.length) {
    const error = new Error("Production environment is not ready.");
    error.issues = issues;
    error.warnings = warnings;
    throw error;
  }

  return {
    ok: issues.length === 0,
    issues,
    warnings,
  };
}

module.exports = {
  validateEnvironment,
};
