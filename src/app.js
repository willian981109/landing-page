const cors = require("cors");
const express = require("express");

const routes = require("./routes");
const errorHandler = require("./middlewares/errorHandler");
const notFoundHandler = require("./middlewares/notFoundHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.use(routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
