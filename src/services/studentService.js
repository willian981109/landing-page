const studentModel = require("../models/studentModel");

async function listStudents() {
  return studentModel.findAllStudents();
}

module.exports = {
  listStudents,
};
