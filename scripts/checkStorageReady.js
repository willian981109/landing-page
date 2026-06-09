const { loadEnvironment } = require("../src/config/loadEnvironment");

loadEnvironment();

const { ensurePrivateBucket } = require("../src/services/fileStorageService");

async function checkStorageReady() {
  try {
    const bucket = await ensurePrivateBucket();
    console.log(`Supabase Storage ready. Private bucket: ${bucket}`);
  } catch (error) {
    console.error("Supabase Storage check failed.");
    console.error(error.message);
    process.exitCode = 1;
  }
}

checkStorageReady();
