const studentService = require("../services/studentService");

async function list(req, res, next) {
  try {
    const students = await studentService.listStudents();

    return res.json(students);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
};
