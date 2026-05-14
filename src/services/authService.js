const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { pool } = require("../database/pool");

const SALT_ROUNDS = 10;
const VALID_ROLES = ["teacher", "student"];

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
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );
}

function validateRegisterInput({ name, email, password, role }) {
  if (!name || !email || !password || !role) {
    throw createAuthError("Name, email, password and role are required");
  }

  if (!VALID_ROLES.includes(role)) {
    throw createAuthError("Role must be teacher or student");
  }

  if (password.length < 6) {
    throw createAuthError("Password must have at least 6 characters");
  }
}

function validateLoginInput({ email, password }) {
  if (!email || !password) {
    throw createAuthError("Email and password are required");
  }
}

async function registerUser({ name, email, password, role }) {
  validateRegisterInput({ name, email, password, role });

  const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

  if (existingUser.rowCount > 0) {
    throw createAuthError("Email already registered", 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
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

async function loginUser({ email, password }) {
  validateLoginInput({ email, password });

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
