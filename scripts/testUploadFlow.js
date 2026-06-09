require("dotenv").config();

const bcrypt = require("bcrypt");

const { pool } = require("../src/database/pool");
const activityService = require("../src/services/activityService");
const fileStorageService = require("../src/services/fileStorageService");
const studyMaterialService = require("../src/services/studyMaterialService");
const uploadedFileService = require("../src/services/uploadedFileService");

const TEST_PASSWORD = "Test#1234";
const TEST_PREFIX = `upload.${process.pid}.${Date.now()}`;

async function createStudent(suffix) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const result = await pool.query(
    `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, 'student')
      RETURNING id
    `,
    [`Upload Test ${suffix}`, `${TEST_PREFIX}.${suffix}@english.test`, passwordHash]
  );

  return result.rows[0];
}

async function run() {
  const createdStudentIds = [];
  const createdActivityIds = [];
  const createdMaterialIds = [];
  const createdFileIds = [];
  const removedStoragePaths = [];

  fileStorageService.createSignedUpload = async (storagePath) => ({
    bucket: "test-private-bucket",
    path: storagePath,
    signedUrl: `https://storage.test/upload/${encodeURIComponent(storagePath)}`,
  });
  fileStorageService.uploadedObjectExists = async () => true;
  fileStorageService.createSignedDownload = async (file) =>
    `https://storage.test/download/${encodeURIComponent(file.storage_path)}`;
  fileStorageService.removeStoredObject = async (file) => {
    removedStoragePaths.push(file.storage_path);
  };

  try {
    const teacherResult = await pool.query(
      "SELECT id FROM users WHERE role = 'teacher' ORDER BY created_at ASC LIMIT 1"
    );
    const teacherId = teacherResult.rows[0]?.id;

    if (!teacherId) {
      throw new Error("A teacher user is required for the upload test");
    }

    const studentOne = await createStudent("student-one");
    const studentTwo = await createStudent("student-two");
    createdStudentIds.push(studentOne.id, studentTwo.id);

    console.log("1. Authorize and attach a PDF to an activity");
    const activityUpload = await uploadedFileService.createUploadAuthorization(teacherId, {
      material_type: "pdf",
      file_name: "lesson-unit-1.pdf",
      mime_type: "application/pdf",
      size_bytes: 2048,
    });
    createdFileIds.push(activityUpload.id);

    const activity = await activityService.createActivity({
      title: "Uploaded PDF activity",
      description: "Activity used to validate private file attachments.",
      deadline: "2026-07-01",
      points: 10,
      teacher_id: teacherId,
      student_id: studentOne.id,
      materials: [
        {
          type: "pdf",
          title: "Lesson PDF",
          uploaded_file_id: activityUpload.id,
        },
      ],
    });
    createdActivityIds.push(activity.id);

    const studentActivities = await activityService.listStudentActivities(studentOne.id);
    const persistedActivity = studentActivities.find((item) => item.id === activity.id);
    const persistedFile = persistedActivity?.materials?.[0];

    if (persistedFile?.file_id !== activityUpload.id || persistedFile.file_name !== "lesson-unit-1.pdf") {
      throw new Error("Uploaded activity file metadata was not persisted");
    }

    console.log("2. Validate student file authorization");
    const ownAccess = await uploadedFileService.getFileAccess(activityUpload.id, {
      id: studentOne.id,
      role: "student",
    });

    if (!ownAccess.url.includes("storage.test/download")) {
      throw new Error("Assigned student did not receive file access");
    }

    let accessDenied = false;

    try {
      await uploadedFileService.getFileAccess(activityUpload.id, {
        id: studentTwo.id,
        role: "student",
      });
    } catch (error) {
      accessDenied = error.statusCode === 404;
    }

    if (!accessDenied) {
      throw new Error("Uploaded activity file leaked to another student");
    }

    console.log("3. Delete activity and clean its private file");
    await activityService.deleteActivity(activity.id, teacherId);
    createdActivityIds.splice(createdActivityIds.indexOf(activity.id), 1);

    const deletedActivityFile = await pool.query(
      "SELECT id FROM uploaded_files WHERE id = $1",
      [activityUpload.id]
    );

    if (deletedActivityFile.rowCount !== 0 || !removedStoragePaths.length) {
      throw new Error("Activity file was not cleaned after activity deletion");
    }

    console.log("4. Attach and remove an audio study material");
    const materialUpload = await uploadedFileService.createUploadAuthorization(teacherId, {
      material_type: "audio",
      file_name: "listening-practice.mp3",
      mime_type: "audio/mpeg",
      size_bytes: 4096,
    });
    createdFileIds.push(materialUpload.id);

    const material = await studyMaterialService.createStudyMaterial(teacherId, {
      student_id: studentOne.id,
      title: "Listening practice",
      description: "Private audio material",
      type: "audio",
      uploaded_file_id: materialUpload.id,
    });
    createdMaterialIds.push(material.id);

    const studentMaterials = await studyMaterialService.listStudentStudyMaterials(studentOne.id);
    const persistedMaterial = studentMaterials.find((item) => item.id === material.id);

    if (persistedMaterial?.file_id !== materialUpload.id) {
      throw new Error("Uploaded study material was not persisted");
    }

    await studyMaterialService.deleteStudyMaterial(material.id, teacherId);
    createdMaterialIds.splice(createdMaterialIds.indexOf(material.id), 1);

    const deletedMaterialFile = await pool.query(
      "SELECT id FROM uploaded_files WHERE id = $1",
      [materialUpload.id]
    );

    if (deletedMaterialFile.rowCount !== 0) {
      throw new Error("Study material file was not cleaned after deletion");
    }

    console.log("Upload flow completed successfully");
  } finally {
    for (const activityId of createdActivityIds) {
      await pool.query("DELETE FROM activities WHERE id = $1", [activityId]);
    }

    for (const materialId of createdMaterialIds) {
      await pool.query("DELETE FROM study_materials WHERE id = $1", [materialId]);
    }

    for (const fileId of createdFileIds) {
      await pool.query("DELETE FROM uploaded_files WHERE id = $1", [fileId]);
    }

    for (const studentId of createdStudentIds) {
      await pool.query("DELETE FROM users WHERE id = $1", [studentId]);
    }

    await pool.end();
  }
}

run().catch((error) => {
  console.error("Upload flow failed");
  console.error(error);
  process.exitCode = 1;
});
