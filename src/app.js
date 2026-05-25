const cors = require("cors");
const express = require("express");
const path = require("path");

const routes = require("./routes");
const errorHandler = require("./middlewares/errorHandler");
const notFoundHandler = require("./middlewares/notFoundHandler");
const createRateLimit = require("./middlewares/rateLimit");
const sanitizeRequest = require("./middlewares/sanitizeRequest");
const securityHeaders = require("./middlewares/securityHeaders");

const app = express();
const publicPath = path.join(__dirname, "..", "public");

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === "production";

const authRateLimit = createRateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  keyPrefix: "auth",
});

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (!isProduction && allowedOrigins.length === 0) {
        return callback(null, true);
      }

      const error = new Error(
        allowedOrigins.length === 0
          ? "CORS origin is not configured"
          : "Origin not allowed by CORS"
      );
      error.statusCode = 403;
      error.code = allowedOrigins.length === 0 ? "CORS_NOT_CONFIGURED" : "CORS_BLOCKED";
      return callback(error);
    },
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(sanitizeRequest);
app.use(express.static(publicPath));

const pageRoutes = {
  "/": "index.html",
  "/login": "login.html",
  "/student": "student.html",
  "/admin-login": "admin-login.html",
  "/teacher-create-activity": "teacher-create-activity.html",
  "/admin-activities": "admin-activities.html",
  "/admin-schedule": "admin-schedule.html",
  "/teacher-materials": "teacher-materials.html",
};

Object.entries(pageRoutes).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(publicPath, file));
  });
});

app.use("/auth", authRateLimit);
app.use(routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
