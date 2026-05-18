const studentModel = require("../models/studentModel");

function createStudentError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function normalizeRating(value, fieldName) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 0 || number > 5) {
    throw createStudentError(`${fieldName} must be an integer from 0 to 5`);
  }

  return number;
}

function getEmptyFeedbackProfile(studentId) {
  return {
    student_id: studentId,
    speaking_rating: 0,
    listening_rating: 0,
    writing_rating: 0,
    reading_rating: 0,
    teacher_comment: "",
    updated_at: null,
  };
}

async function listStudents() {
  return studentModel.findAllStudents();
}

async function getFeedbackProfile(studentId) {
  if (!isUuid(studentId)) {
    throw createStudentError("student_id must be a valid user id");
  }

  const student = await studentModel.findStudentById(studentId);

  if (!student) {
    throw createStudentError("Student not found", 404);
  }

  const profile = await studentModel.findFeedbackProfileByStudentId(studentId);

  return profile || getEmptyFeedbackProfile(studentId);
}

async function updateFeedbackProfile(studentId, payload = {}) {
  if (!isUuid(studentId)) {
    throw createStudentError("student_id must be a valid user id");
  }

  const student = await studentModel.findStudentById(studentId);

  if (!student) {
    throw createStudentError("Student not found", 404);
  }

  const normalizedPayload = {
    speaking_rating: normalizeRating(payload.speaking_rating, "speaking_rating"),
    listening_rating: normalizeRating(payload.listening_rating, "listening_rating"),
    writing_rating: normalizeRating(payload.writing_rating, "writing_rating"),
    reading_rating: normalizeRating(payload.reading_rating, "reading_rating"),
    teacher_comment: String(payload.teacher_comment || "").trim(),
  };

  return studentModel.upsertFeedbackProfile(studentId, normalizedPayload);
}

module.exports = {
  listStudents,
  getFeedbackProfile,
  updateFeedbackProfile,
};
