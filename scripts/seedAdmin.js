const bcrypt = require("bcrypt");

const { loadEnvironment } = require("../src/config/loadEnvironment");
const {
  getPasswordIssues,
  normalizeEmail,
  sanitizePlainText,
} = require("../src/utils/securityValidation");

let pool;

const DEFAULT_DEV_ADMIN_PASSWORD = "Admin#2026";

function getAdminUser() {
  const isProduction = process.env.NODE_ENV === "production";
  const password = process.env.ADMIN_PASSWORD || (isProduction ? "" : DEFAULT_DEV_ADMIN_PASSWORD);
  const passwordIssues = getPasswordIssues(password);

  if (!password) {
    throw new Error("ADMIN_PASSWORD must be configured before seeding production.");
  }

  if (passwordIssues.length) {
    throw new Error(`ADMIN_PASSWORD is not strong enough: ${passwordIssues.join(" ")}`);
  }

  return {
    name: sanitizePlainText(process.env.ADMIN_NAME || "Teacher Admin", 120),
    email: normalizeEmail(process.env.ADMIN_EMAIL || "admin@english.com"),
    password,
    role: "teacher",
  };
}

async function seedAdmin() {
  loadEnvironment();
  ({ pool } = require("../src/database/pool"));

  const ADMIN_USER = getAdminUser();
  const existingUser = await pool.query("SELECT id, email FROM users WHERE email = $1", [
    ADMIN_USER.email,
  ]);

  if (existingUser.rowCount > 0) {
    console.log(`Admin already exists: ${existingUser.rows[0].email}`);
    return;
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;
  const passwordHash = await bcrypt.hash(ADMIN_USER.password, saltRounds);
  const result = await pool.query(
    `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at
    `,
    [ADMIN_USER.name, ADMIN_USER.email, passwordHash, ADMIN_USER.role]
  );

  console.log("Admin created:");
  console.log(result.rows[0]);
}

seedAdmin()
  .catch((error) => {
    console.error("Could not seed admin user");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (pool) {
      await pool.end();
    }
  });
