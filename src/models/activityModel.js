const { pool } = require("../database/pool");

async function createActivity({ title, description, deadline, points, teacher_id }) {
  const result = await pool.query(
    `
      INSERT INTO activities (title, description, deadline, points, teacher_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, title, description, deadline, points, teacher_id, created_at
    `,
    [title, description, deadline, points, teacher_id]
  );

  return result.rows[0];
}

async function findAllActivities() {
  const result = await pool.query(
    `
      SELECT id, title, description, deadline, points, teacher_id, created_at
      FROM activities
      ORDER BY created_at DESC
    `
  );

  return result.rows;
}

async function updateActivity(id, { title, description, deadline, points }) {
  const result = await pool.query(
    `
      UPDATE activities
      SET
        title = $1,
        description = $2,
        deadline = $3,
        points = $4
      WHERE id = $5
      RETURNING id, title, description, deadline, points, teacher_id, created_at
    `,
    [title, description, deadline, points, id]
  );

  return result.rows[0];
}

async function deleteActivity(id) {
  const result = await pool.query(
    `
      DELETE FROM activities
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return result.rows[0];
}

module.exports = {
  createActivity,
  findAllActivities,
  updateActivity,
  deleteActivity,
};
