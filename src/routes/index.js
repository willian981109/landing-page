const { Router } = require("express");

const healthRoutes = require("./healthRoutes");

const router = Router();

router.use(healthRoutes);

module.exports = router;
