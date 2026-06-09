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
      uf.id AS file_id,
      uf.storage_bucket,
      uf.storage_path,
      uf.original_name AS file_name,
      uf.mime_type,
      uf.size_bytes,
      sm.created_at,
      sm.updated_at
    FROM study_materials sm
    INNER JOIN users student ON student.id = sm.student_id
    INNER JOIN users teacher ON teacher.id = sm.teacher_id
    LEFT JOIN uploaded_files uf ON uf.id = sm.uploaded_file_id
    ${whereClause}
    ORDER BY sm.created_at DESC
  `;
}

async function createStudyMaterial({
  student_id,
  teacher_id,
  title,
  description,
  type,
  url,
  uploaded_file_id,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (uploaded_file_id) {
      const claimedFile = await client.query(
        `
          UPDATE uploaded_files
          SET status = 'attached', attached_at = NOW()
          WHERE id = $1
            AND teacher_id = $2
            AND status = 'pending'
          RETURNING id
        `,
        [uploaded_file_id, teacher_id]
      );

      if (claimedFile.rowCount === 0) {
        const error = new Error("Uploaded file is no longer available");
        error.statusCode = 409;
        throw error;
      }
    }

    const result = await client.query(
      `
        INSERT INTO study_materials (
          student_id,
          teacher_id,
          title,
          description,
          type,
          url,
          uploaded_file_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
      [student_id, teacher_id, title, description, type, url, uploaded_file_id]
    );

    await client.query("COMMIT");
    return findTeacherStudyMaterialById(result.rows[0].id, teacher_id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `
        SELECT uploaded_file_id
        FROM study_materials
        WHERE id = $1
          AND teacher_id = $2
        FOR UPDATE
      `,
      [materialId, teacherId]
    );

    if (existing.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const existingFileId = existing.rows[0].uploaded_file_id;

    if (payload.uploaded_file_id && payload.uploaded_file_id !== existingFileId) {
      const claimedFile = await client.query(
        `
          UPDATE uploaded_files
          SET status = 'attached', attached_at = NOW()
          WHERE id = $1
            AND teacher_id = $2
            AND status = 'pending'
          RETURNING id
        `,
        [payload.uploaded_file_id, teacherId]
      );

      if (claimedFile.rowCount === 0) {
        const error = new Error("Uploaded file is no longer available");
        error.statusCode = 409;
        throw error;
      }
    }

    const result = await client.query(
      `
        UPDATE study_materials
        SET
          student_id = $1,
          title = $2,
          description = $3,
          type = $4,
          url = $5,
          uploaded_file_id = $6,
          updated_at = NOW()
        WHERE id = $7
          AND teacher_id = $8
        RETURNING id
      `,
      [
        payload.student_id,
        payload.title,
        payload.description,
        payload.type,
        payload.url,
        payload.uploaded_file_id,
        materialId,
        teacherId,
      ]
    );

    await client.query("COMMIT");
    return findTeacherStudyMaterialById(result.rows[0].id, teacherId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deleteTeacherStudyMaterial(materialId, teacherId) {
  const result = await pool.query(
    `
      DELETE FROM study_materials
      WHERE id = $1
        AND teacher_id = $2
      RETURNING id, uploaded_file_id
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
