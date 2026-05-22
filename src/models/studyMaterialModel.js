const { pool } = require("../database/pool");

function selectStudyMaterialsQuery(whereClause = "") {
  return `
    SELECT
      sm.id,
      sm.student_id,
      student.name AS student_name,
      student.email AS student_email,
      sm.teacher_id,
      teacher.name AS teacher_name,
      sm.title,
      sm.description,
      sm.type,
      sm.url,
      sm.created_at,
      sm.updated_at
    FROM study_materials sm
    INNER JOIN users student ON student.id = sm.student_id
    INNER JOIN users teacher ON teacher.id = sm.teacher_id
    ${whereClause}
    ORDER BY sm.created_at DESC
  `;
}

async function createStudyMaterial({ student_id, teacher_id, title, description, type, url }) {
  const result = await pool.query(
    `
      INSERT INTO study_materials (student_id, teacher_id, title, description, type, url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [student_id, teacher_id, title, description, type, url]
  );

  return findTeacherStudyMaterialById(result.rows[0].id, teacher_id);
}

async function findTeacherStudyMaterials(teacherId, studentId = null) {
  const values = [teacherId];
  const studentFilter = studentId ? `AND sm.student_id = $${values.push(studentId)}` : "";

  const result = await pool.query(
    selectStudyMaterialsQuery(`
      WHERE sm.teacher_id = $1
        ${studentFilter}
    `),
    values
  );

  return result.rows;
}

async function findTeacherStudyMaterialById(materialId, teacherId) {
  const result = await pool.query(
    selectStudyMaterialsQuery(`
      WHERE sm.id = $1
        AND sm.teacher_id = $2
    `),
    [materialId, teacherId]
  );

  return result.rows[0];
}

async function findStudentStudyMaterials(studentId) {
  const result = await pool.query(
    selectStudyMaterialsQuery("WHERE sm.student_id = $1"),
    [studentId]
  );

  return result.rows;
}

async function updateTeacherStudyMaterial(materialId, teacherId, payload) {
  const result = await pool.query(
    `
      UPDATE study_materials
      SET
        student_id = $1,
        title = $2,
        description = $3,
        type = $4,
        url = $5,
        updated_at = NOW()
      WHERE id = $6
        AND teacher_id = $7
      RETURNING id
    `,
    [
      payload.student_id,
      payload.title,
      payload.description,
      payload.type,
      payload.url,
      materialId,
      teacherId,
    ]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findTeacherStudyMaterialById(materialId, teacherId);
}

async function deleteTeacherStudyMaterial(materialId, teacherId) {
  const result = await pool.query(
    `
      DELETE FROM study_materials
      WHERE id = $1
        AND teacher_id = $2
      RETURNING id
    `,
    [materialId, teacherId]
  );

  return result.rowCount > 0;
}

module.exports = {
  createStudyMaterial,
  findTeacherStudyMaterials,
  findTeacherStudyMaterialById,
  findStudentStudyMaterials,
  updateTeacherStudyMaterial,
  deleteTeacherStudyMaterial,
};
