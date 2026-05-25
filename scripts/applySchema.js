require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");

const { pool } = require("../src/database/pool");

async function applySchema() {
  const schemaPath = path.join(__dirname, "..", "src", "database", "schema.sql");
  const schema = await fs.readFile(schemaPath, "utf8");

  await pool.query(schema);
  console.log("Database schema applied successfully.");
}

applySchema()
  .catch((error) => {
    console.error("Could not apply database schema.");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
