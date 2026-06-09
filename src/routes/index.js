const { Router } = require("express");

const activityRoutes = require("./activityRoutes");
const authRoutes = require("./authRoutes");
const healthRoutes = require("./healthRoutes");
const scheduleRoutes = require("./scheduleRoutes");
const studentRoutes = require("./studentRoutes");
const studyMaterialRoutes = require("./studyMaterialRoutes");
const uploadedFileRoutes = require("./uploadedFileRoutes");

const router = Router();

router.use(activityRoutes);
router.use(authRoutes);
router.use(healthRoutes);
router.use(scheduleRoutes);
router.use(studentRoutes);
router.use(studyMaterialRoutes);
router.use(uploadedFileRoutes);

module.exports = router;
