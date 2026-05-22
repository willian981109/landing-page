const studyMaterialService = require("../services/studyMaterialService");

async function create(req, res, next) {
  try {
    const material = await studyMaterialService.createStudyMaterial(req.user.id, req.body);

    return res.status(201).json(material);
  } catch (error) {
    return next(error);
  }
}

async function listTeacherMaterials(req, res, next) {
  try {
    const hasStudentFilter = Object.prototype.hasOwnProperty.call(req.query, "studentId");
    const materials = await studyMaterialService.listTeacherStudyMaterials(
      req.user.id,
      hasStudentFilter ? req.query.studentId : null
    );

    return res.json(materials);
  } catch (error) {
    return next(error);
  }
}

async function listMine(req, res, next) {
  try {
    const materials = await studyMaterialService.listStudentStudyMaterials(req.user.id);

    return res.json(materials);
  } catch (error) {
    return next(error);
  }
}

async function update(req, res, next) {
  try {
    const material = await studyMaterialService.updateStudyMaterial(req.params.materialId, req.user.id, req.body);

    return res.json(material);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    await studyMaterialService.deleteStudyMaterial(req.params.materialId, req.user.id);

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  create,
  listTeacherMaterials,
  listMine,
  update,
  remove,
};
