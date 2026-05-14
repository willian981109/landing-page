require("dotenv").config();

const app = require("./src/app");
const { testDatabaseConnection } = require("./src/database/pool");

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await testDatabaseConnection();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Could not connect to PostgreSQL");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();
