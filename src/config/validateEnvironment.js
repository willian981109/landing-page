const { getPasswordIssues } = require("../utils/securityValidation");

const PLACEHOLDER_VALUES = new Set([
  "change_this_secret",
  "replace_with_a_long_random_secret_before_deploy",
  "replace_with_a_strong_admin_password",
  "replace_with_supabase_server_secret",
  "your_service_role_jwt",
]);

const PLACEHOLDER_SUPABASE_HOSTS = new Set([
  "your-project.supabase.co",
  "your_project.supabase.co",
]);

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch (error) {
    return false;
  }
}

function getSupabaseUrlIssue(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "SUPABASE_URL is missing.";
  }

  try {
    const url = new URL(rawValue);

    if (url.protocol !== "https:") {
      return "SUPABASE_URL must use HTTPS.";
    }

    if (PLACEHOLDER_SUPABASE_HOSTS.has(url.hostname.toLowerCase())) {
      return "SUPABASE_URL still contains the example project hostname.";
    }

    if (!url.hostname || ["localhost", "127.0.0.1"].includes(url.hostname.toLowerCase())) {
      return "SUPABASE_URL must point to the deployed Supabase project.";
    }

    if (url.username || url.password || url.search || url.hash) {
      return "SUPABASE_URL must contain only the project API URL.";
    }

    return "";
  } catch (error) {
    return "SUPABASE_URL must be a valid project HTTPS URL.";
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

function getSupabaseKeyRole(value) {
  const key = String(value || "").trim();

  if (!key) {
    return "missing";
  }

  if (key.startsWith("sb_secret_")) {
    return "secret";
  }

  if (key.startsWith("sb_publishable_")) {
    return "publishable";
  }

  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
    return payload.role || "unknown";
  } catch (error) {
    return "unknown";
  }
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

    const hasSupabaseUrl = Boolean(String(env.SUPABASE_URL || "").trim());
    const supabaseServerKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    const normalizedSupabaseKey = String(supabaseServerKey || "").trim();
    const hasSupabaseServiceKey = Boolean(normalizedSupabaseKey);

    if (hasSupabaseUrl || hasSupabaseServiceKey) {
      const supabaseUrlIssue = getSupabaseUrlIssue(env.SUPABASE_URL);

      if (supabaseUrlIssue) {
        issues.push(supabaseUrlIssue);
      }

      if (!hasSupabaseServiceKey) {
        issues.push(
          "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY must be configured for private file storage."
        );
      } else if (
        PLACEHOLDER_VALUES.has(normalizedSupabaseKey) ||
        !["secret", "service_role"].includes(getSupabaseKeyRole(normalizedSupabaseKey))
      ) {
        issues.push(
          "The Supabase server key must be a secret key (sb_secret_...) or legacy service_role key, never a placeholder or anon/publishable key."
        );
      }
    } else {
      warnings.push(
        "Supabase Storage is not configured. File uploads will remain unavailable until SUPABASE_URL and a server secret key are set."
      );
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
  getSupabaseKeyRole,
  getSupabaseUrlIssue,
  validateEnvironment,
};
