const studentService = require("../services/studentService");

async function list(req, res, next) {
  try {
    const students = await studentService.listStudents();

    return res.json(students);
  } catch (error) {
    return next(error);
  }
}

async function getFeedbackProfile(req, res, next) {
  try {
    const profile = await studentService.getFeedbackProfile(req.params.studentId);

    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}

async function getMyFeedbackProfile(req, res, next) {
  try {
    const profile = await studentService.getFeedbackProfile(req.user.id);

    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}

async function updateFeedbackProfile(req, res, next) {
  try {
    const profile = await studentService.updateFeedbackProfile(req.params.studentId, req.body);

    return res.json(profile);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  getFeedbackProfile,
  getMyFeedbackProfile,
  updateFeedbackProfile,
};
