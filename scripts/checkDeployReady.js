const { loadEnvironment } = require("../src/config/loadEnvironment");
const { validateEnvironment } = require("../src/config/validateEnvironment");

let pool;

async function countInvalidRows(label, query) {
  const result = await pool.query(query);
  const count = Number(result.rows[0]?.count || 0);

  return {
    label,
    count,
  };
}

async function checkDatabaseIntegrity() {
  const checks = await Promise.all([
    countInvalidRows(
      "activity material URLs without http/https",
      "SELECT COUNT(*) FROM activity_materials WHERE url !~* '^https?://'"
    ),
    countInvalidRows(
      "study material URLs without http/https",
      "SELECT COUNT(*) FROM study_materials WHERE url !~* '^https?://'"
    ),
    countInvalidRows(
      "class meet links without http/https",
      "SELECT COUNT(*) FROM class_schedules WHERE meet_link IS NOT NULL AND meet_link !~* '^https?://'"
    ),
    countInvalidRows(
      "activity grades outside 0-100",
      "SELECT COUNT(*) FROM activity_students WHERE teacher_grade IS NOT NULL AND (teacher_grade < 0 OR teacher_grade > 100)"
    ),
    countInvalidRows(
      "activities with negative points",
      "SELECT COUNT(*) FROM activities WHERE points < 0"
    ),
    countInvalidRows(
      "duplicated active teacher schedule slots",
      `
        SELECT COUNT(*) FROM (
          SELECT teacher_id, class_date, class_time
          FROM class_schedules
          WHERE status <> 'canceled'
          GROUP BY teacher_id, class_date, class_time
          HAVING COUNT(*) > 1
        ) duplicated_slots
      `
    ),
    countInvalidRows(
      "duplicated active student schedule slots",
      `
        SELECT COUNT(*) FROM (
          SELECT student_id, class_date, class_time
          FROM class_schedules
          WHERE status <> 'canceled'
          GROUP BY student_id, class_date, class_time
          HAVING COUNT(*) > 1
        ) duplicated_slots
      `
    ),
    countInvalidRows(
      "schedules with more than one pending change request",
      `
        SELECT COUNT(*) FROM (
          SELECT schedule_id
          FROM schedule_change_requests
          WHERE status = 'pending'
          GROUP BY schedule_id
          HAVING COUNT(*) > 1
        ) duplicated_requests
      `
    ),
  ]);

  return checks.filter((check) => check.count > 0);
}

async function checkDeployReady() {
  const { args } = loadEnvironment();
  const strict = args.includes("--strict") ||
    process.env.CHECK_STRICT === "true" ||
    process.env.NODE_ENV === "production";
  const environment = validateEnvironment(process.env, {
    strict,
  });

  ({ pool } = require("../src/database/pool"));

  const invalidDatabaseRows = await checkDatabaseIntegrity();

  environment.warnings.forEach((warning) => {
    console.warn(`Environment warning: ${warning}`);
  });

  environment.issues.forEach((issue) => {
    const label = strict ? "Environment issue" : "Environment warning";
    const writer = strict ? console.error : console.warn;
    writer(`${label}: ${issue}`);
  });

  if ((strict && environment.issues.length) || invalidDatabaseRows.length) {
    invalidDatabaseRows.forEach((check) => {
      console.error(`Database issue: ${check.count} ${check.label}`);
    });

    throw new Error("Deploy readiness check failed.");
  }

  console.log("Deploy readiness check passed.");
}

checkDeployReady()
  .catch((error) => {
    error.warnings?.forEach((warning) => {
      console.error(`Environment warning: ${warning}`);
    });
    error.issues?.forEach((issue) => {
      console.error(`Environment issue: ${issue}`);
    });
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (pool) {
      await pool.end();
    }
  });
