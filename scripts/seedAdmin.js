require("dotenv").config();

const bcrypt = require("bcrypt");

const { pool } = require("../src/database/pool");

const ADMIN_USER = {
  name: "Teacher Admin",
  email: "admin@english.com",
  password: process.env.ADMIN_PASSWORD || "Admin#2026",
  role: "teacher",
};

async function seedAdmin() {
  const existingUser = await pool.query("SELECT id, email FROM users WHERE email = $1", [
    ADMIN_USER.email,
  ]);

  if (existingUser.rowCount > 0) {
    console.log(`Admin already exists: ${existingUser.rows[0].email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_USER.password, 10);
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
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
