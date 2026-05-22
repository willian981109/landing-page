const { Router } = require("express");

const studyMaterialController = require("../controllers/studyMaterialController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = Router();
const teacherOnly = [authMiddleware, roleMiddleware(["teacher"])];
const studentOnly = [authMiddleware, roleMiddleware(["student"])];

router.get("/teacher/materials", teacherOnly, studyMaterialController.listTeacherMaterials);
router.post("/teacher/materials", teacherOnly, studyMaterialController.create);
router.patch("/teacher/materials/:materialId", teacherOnly, studyMaterialController.update);
router.delete("/teacher/materials/:materialId", teacherOnly, studyMaterialController.remove);
router.get("/my-materials", studentOnly, studyMaterialController.listMine);

module.exports = router;
