const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { pool } = require("../database/pool");
const {
  normalizeLoginPayload,
  normalizeRegisterPayload,
} = require("../utils/securityValidation");

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

function createAuthError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
  };
}

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw createAuthError("JWT secret is not configured", 500);
  }

  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      issuer: process.env.JWT_ISSUER || "english-studio",
    }
  );
}

async function registerUser(payload) {
  const { name, email, password } = normalizeRegisterPayload(payload);

  const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

  if (existingUser.rowCount > 0) {
    throw createAuthError("Email already registered", 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const role = "student";
  const result = await pool.query(
    `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at
    `,
    [name, email, passwordHash, role]
  );

  const user = result.rows[0];

  return {
    user: sanitizeUser(user),
    token: createToken(user),
  };
}

async function loginUser(payload) {
  const { email, password } = normalizeLoginPayload(payload);

  const result = await pool.query(
    "SELECT id, name, email, password_hash, role, created_at FROM users WHERE email = $1",
    [email]
  );

  if (result.rowCount === 0) {
    throw createAuthError("Invalid email or password", 401);
  }

  const user = result.rows[0];
  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    throw createAuthError("Invalid email or password", 401);
  }

  return {
    user: sanitizeUser(user),
    token: createToken(user),
  };
}

module.exports = {
  registerUser,
  loginUser,
};
