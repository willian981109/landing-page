const fs = require("fs/promises");
const path = require("path");

const { loadEnvironment } = require("../src/config/loadEnvironment");
const { validateEnvironment } = require("../src/config/validateEnvironment");

function getDatabaseTarget() {
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      const database = url.pathname.replace(/^\//, "") || "(default)";

      return `${url.hostname}${url.port ? `:${url.port}` : ""}/${database}`;
    } catch (error) {
      return "DATABASE_URL";
    }
  }

  return `${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || ""}`;
}

async function applySchema() {
  const { args, envFile, isProduction } = loadEnvironment();
  const strict = args.includes("--strict") || isProduction;
  const dryRun = args.includes("--dry-run");
  const confirmed = args.includes("--yes") || process.env.APPLY_SCHEMA_CONFIRM === "YES";
  const environment = validateEnvironment(process.env, { strict });

  environment.warnings.forEach((warning) => {
    console.warn(`Environment warning: ${warning}`);
  });

  environment.issues.forEach((issue) => {
    const label = strict ? "Environment issue" : "Environment warning";
    const writer = strict ? console.error : console.warn;
    writer(`${label}: ${issue}`);
  });

  const schemaPath = path.join(__dirname, "..", "src", "database", "schema.sql");
  const schema = await fs.readFile(schemaPath, "utf8");
  const target = getDatabaseTarget();

  console.log(`Environment file: ${envFile}`);
  console.log(`Database target: ${target}`);

  if (dryRun) {
    console.log("Dry run enabled. Schema was not applied.");
    return;
  }

  if (isProduction && !confirmed) {
    throw new Error(
      "Production schema apply requires --yes or APPLY_SCHEMA_CONFIRM=YES."
    );
  }

  const { pool } = require("../src/database/pool");

  try {
    await pool.query("BEGIN");
    await pool.query(schema);
    await pool.query("COMMIT");
    console.log("Database schema applied successfully.");
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await pool.end();
  }
}

applySchema()
  .catch((error) => {
    console.error("Could not apply database schema.");
    error.warnings?.forEach((warning) => {
      console.error(`Environment warning: ${warning}`);
    });
    error.issues?.forEach((issue) => {
      console.error(`Environment issue: ${issue}`);
    });
    console.error(error.message);
    process.exitCode = 1;
  });
