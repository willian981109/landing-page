const { Router } = require("express");

const activityRoutes = require("./activityRoutes");
const authRoutes = require("./authRoutes");
const healthRoutes = require("./healthRoutes");
const studentRoutes = require("./studentRoutes");

const router = Router();

router.use(activityRoutes);
router.use(authRoutes);
router.use(healthRoutes);
router.use(studentRoutes);

module.exports = router;
