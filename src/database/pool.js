const { Pool } = require("pg");

const {
  DATABASE_URL,
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_SSL,
  DB_SSL_REJECT_UNAUTHORIZED,
  DB_POOL_MAX,
  DB_IDLE_TIMEOUT_MS,
  DB_CONNECTION_TIMEOUT_MS,
} = process.env;

const dbConfig = DATABASE_URL
  ? {
      connectionString: DATABASE_URL,
    }
  : {
      host: DB_HOST,
      port: Number(DB_PORT) || 5432,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    };

if (String(DB_SSL || "").toLowerCase() === "true") {
  dbConfig.ssl = {
    rejectUnauthorized: String(DB_SSL_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false",
  };
}

dbConfig.max = Number(DB_POOL_MAX) || 10;
dbConfig.idleTimeoutMillis = Number(DB_IDLE_TIMEOUT_MS) || 30000;
dbConfig.connectionTimeoutMillis = Number(DB_CONNECTION_TIMEOUT_MS) || 5000;

const pool = new Pool(dbConfig);

async function testDatabaseConnection() {
  const client = await pool.connect();

  try {
    await client.query("SELECT 1");
    console.log("PostgreSQL connection established");
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  testDatabaseConnection,
};
