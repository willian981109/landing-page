const studentModel = require("../models/studentModel");
const studyMaterialModel = require("../models/studyMaterialModel");
const uploadedFileService = require("./uploadedFileService");

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

function serializeStudyMaterial(material) {
  if (!material) {
    return material;
  }

  const {
    storage_bucket,
    storage_path,
    ...publicMaterial
  } = material;

  return publicMaterial;
}

async function normalizeStudyMaterialPayload(payload = {}) {
  const studentId = payload.student_id ?? payload.studentId;
  const title = normalizeString(payload.title);
  const description = normalizeString(payload.description) || null;
  const type = normalizeString(payload.type).toLowerCase();
  const url = normalizeString(payload.url);
  const uploadedFileId = payload.uploaded_file_id ?? payload.uploadedFileId ?? null;

  if (!isUuid(studentId)) {
    throw createStudyMaterialError("student_id must be a valid user id");
  }

  if (!title) {
    throw createStudyMaterialError("title is required");
  }

  if (!VALID_MATERIAL_TYPES.includes(type)) {
    throw createStudyMaterialError("type must be pdf, video, link, exercise, audio, document or vocabulary");
  }

  if (Boolean(url) === Boolean(uploadedFileId)) {
    throw createStudyMaterialError("url or uploaded_file_id is required");
  }

  if (url && !validateUrl(url)) {
    throw createStudyMaterialError("url must be a valid http or https link");
  }

  if (uploadedFileId && !isUuid(uploadedFileId)) {
    throw createStudyMaterialError("uploaded_file_id must be a valid id");
  }

  if (uploadedFileId && !["pdf", "video", "audio", "document"].includes(type)) {
    throw createStudyMaterialError("this material type does not accept file uploads");
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
    url: url || null,
    uploaded_file_id: uploadedFileId,
  };
}

async function createStudyMaterial(teacherId, payload) {
  if (!isUuid(teacherId)) {
    throw createStudyMaterialError("teacher_id must be a valid user id");
  }

  const normalizedPayload = await normalizeStudyMaterialPayload(payload);

  if (normalizedPayload.uploaded_file_id) {
    await uploadedFileService.assertUploadedFileReady(
      normalizedPayload.uploaded_file_id,
      teacherId,
      normalizedPayload.type
    );
  }

  const material = await studyMaterialModel.createStudyMaterial({
    ...normalizedPayload,
    teacher_id: teacherId,
  });

  return serializeStudyMaterial(material);
}

async function listTeacherStudyMaterials(teacherId, studentId = null) {
  if (!isUuid(teacherId)) {
    throw createStudyMaterialError("teacher_id must be a valid user id");
  }

  if (studentId !== null && studentId !== undefined && studentId !== "" && !isUuid(studentId)) {
    throw createStudyMaterialError("student_id must be a valid user id");
  }

  const materials = await studyMaterialModel.findTeacherStudyMaterials(teacherId, studentId || null);
  return materials.map(serializeStudyMaterial);
}

async function listStudentStudyMaterials(studentId) {
  if (!isUuid(studentId)) {
    throw createStudyMaterialError("student_id must be a valid user id");
  }

  const materials = await studyMaterialModel.findStudentStudyMaterials(studentId);
  return materials.map(serializeStudyMaterial);
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
  const isKeepingExistingFile = Boolean(
    normalizedPayload.uploaded_file_id
      && normalizedPayload.uploaded_file_id === existingMaterial.file_id
  );

  if (normalizedPayload.uploaded_file_id) {
    await uploadedFileService.assertUploadedFileReady(
      normalizedPayload.uploaded_file_id,
      teacherId,
      normalizedPayload.type,
      { allowAttached: isKeepingExistingFile }
    );
  }

  const updatedMaterial = await studyMaterialModel.updateTeacherStudyMaterial(
    materialId,
    teacherId,
    normalizedPayload
  );

  if (!updatedMaterial) {
    throw createStudyMaterialError("Study material not found", 404);
  }

  if (existingMaterial.file_id && existingMaterial.file_id !== updatedMaterial.file_id) {
    await uploadedFileService.removeDetachedUploadedFile({
      id: existingMaterial.file_id,
      storage_bucket: existingMaterial.storage_bucket,
      storage_path: existingMaterial.storage_path,
    });
  }

  return serializeStudyMaterial(updatedMaterial);
}

async function deleteStudyMaterial(materialId, teacherId) {
  if (!isUuid(materialId) || !isUuid(teacherId)) {
    throw createStudyMaterialError("material_id and teacher_id must be valid ids");
  }

  const existingMaterial = await studyMaterialModel.findTeacherStudyMaterialById(materialId, teacherId);

  if (!existingMaterial) {
    throw createStudyMaterialError("Study material not found", 404);
  }

  const deleted = await studyMaterialModel.deleteTeacherStudyMaterial(materialId, teacherId);

  if (!deleted) {
    throw createStudyMaterialError("Study material not found", 404);
  }

  if (existingMaterial.file_id) {
    await uploadedFileService.removeDetachedUploadedFile({
      id: existingMaterial.file_id,
      storage_bucket: existingMaterial.storage_bucket,
      storage_path: existingMaterial.storage_path,
    });
  }
}

module.exports = {
  createStudyMaterial,
  listTeacherStudyMaterials,
  listStudentStudyMaterials,
  updateStudyMaterial,
  deleteStudyMaterial,
};
