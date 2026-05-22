const studentModel = require("../models/studentModel");
const studyMaterialModel = require("../models/studyMaterialModel");

const VALID_MATERIAL_TYPES = ["pdf", "video", "link", "exercise", "audio", "document", "vocabulary"];

function createStudyMaterialError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function validateUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return ["http:", "https:"].includes(parsedUrl.protocol);
  } catch (error) {
    return false;
  }
}

async function normalizeStudyMaterialPayload(payload = {}) {
  const studentId = payload.student_id ?? payload.studentId;
  const title = normalizeString(payload.title);
  const description = normalizeString(payload.description) || null;
  const type = normalizeString(payload.type).toLowerCase();
  const url = normalizeString(payload.url);

  if (!isUuid(studentId)) {
    throw createStudyMaterialError("student_id must be a valid user id");
  }

  if (!title) {
    throw createStudyMaterialError("title is required");
  }

  if (!VALID_MATERIAL_TYPES.includes(type)) {
    throw createStudyMaterialError("type must be pdf, video, link, exercise, audio, document or vocabulary");
  }

  if (!url || !validateUrl(url)) {
    throw createStudyMaterialError("url must be a valid http or https link");
  }

  const student = await studentModel.findStudentById(studentId);

  if (!student) {
    throw createStudyMaterialError("Student not found", 404);
  }

  return {
    student_id: studentId,
    title,
    description,
    type,
    url,
  };
}

async function createStudyMaterial(teacherId, payload) {
  if (!isUuid(teacherId)) {
    throw createStudyMaterialError("teacher_id must be a valid user id");
  }

  const normalizedPayload = await normalizeStudyMaterialPayload(payload);

  return studyMaterialModel.createStudyMaterial({
    ...normalizedPayload,
    teacher_id: teacherId,
  });
}

async function listTeacherStudyMaterials(teacherId, studentId = null) {
  if (!isUuid(teacherId)) {
    throw createStudyMaterialError("teacher_id must be a valid user id");
  }

  if (studentId !== null && studentId !== undefined && studentId !== "" && !isUuid(studentId)) {
    throw createStudyMaterialError("student_id must be a valid user id");
  }

  return studyMaterialModel.findTeacherStudyMaterials(teacherId, studentId || null);
}

async function listStudentStudyMaterials(studentId) {
  if (!isUuid(studentId)) {
    throw createStudyMaterialError("student_id must be a valid user id");
  }

  return studyMaterialModel.findStudentStudyMaterials(studentId);
}

async function updateStudyMaterial(materialId, teacherId, payload) {
  if (!isUuid(materialId) || !isUuid(teacherId)) {
    throw createStudyMaterialError("material_id and teacher_id must be valid ids");
  }

  const existingMaterial = await studyMaterialModel.findTeacherStudyMaterialById(materialId, teacherId);

  if (!existingMaterial) {
    throw createStudyMaterialError("Study material not found", 404);
  }

  const normalizedPayload = await normalizeStudyMaterialPayload(payload);
  const updatedMaterial = await studyMaterialModel.updateTeacherStudyMaterial(
    materialId,
    teacherId,
    normalizedPayload
  );

  if (!updatedMaterial) {
    throw createStudyMaterialError("Study material not found", 404);
  }

  return updatedMaterial;
}

async function deleteStudyMaterial(materialId, teacherId) {
  if (!isUuid(materialId) || !isUuid(teacherId)) {
    throw createStudyMaterialError("material_id and teacher_id must be valid ids");
  }

  const deleted = await studyMaterialModel.deleteTeacherStudyMaterial(materialId, teacherId);

  if (!deleted) {
    throw createStudyMaterialError("Study material not found", 404);
  }
}

module.exports = {
  createStudyMaterial,
  listTeacherStudyMaterials,
  listStudentStudyMaterials,
  updateStudyMaterial,
  deleteStudyMaterial,
};
