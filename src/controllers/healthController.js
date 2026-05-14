const healthService = require("../services/healthService");

function getHealth(req, res) {
  return res.json(healthService.getHealthStatus());
}

module.exports = {
  getHealth,
};
