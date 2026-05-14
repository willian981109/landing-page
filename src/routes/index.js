const { Router } = require("express");

const activityRoutes = require("./activityRoutes");
const authRoutes = require("./authRoutes");
const healthRoutes = require("./healthRoutes");

const router = Router();

router.use(activityRoutes);
router.use(authRoutes);
router.use(healthRoutes);

module.exports = router;
