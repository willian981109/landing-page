const { pool } = require("../database/pool");

async function findAllStudents() {
  const result = await pool.query(
    `
      SELECT id, name
      FROM users
      WHERE role = 'student'
      ORDER BY name ASC
    `
  );

  return result.rows;
}

async function findStudentById(id) {
  const result = await pool.query(
    `
      SELECT id, name
      FROM users
      WHERE id = $1 AND role = 'student'
    `,
    [id]
  );

  return result.rows[0];
}

module.exports = {
  findAllStudents,
  findStudentById,
};
