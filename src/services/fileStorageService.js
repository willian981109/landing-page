const { createClient } = require("@supabase/supabase-js");

const { ALLOWED_STORAGE_MIME_TYPES } = require("../config/uploadRules");

const DEFAULT_BUCKET = "english-studio-materials";
const MAX_BUCKET_FILE_SIZE = 200 * 1024 * 1024;

let storageClient;
let bucketInitialization;

function createStorageError(message, statusCode = 503, code = "STORAGE_UNAVAILABLE") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function getStorageConfig() {
  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const bucket = String(process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET).trim();

  if (!supabaseUrl || !serviceRoleKey || !bucket) {
    throw createStorageError(
      "O armazenamento de arquivos ainda não foi configurado no servidor."
    );
  }

  return { supabaseUrl, serviceRoleKey, bucket };
}

function getStorageClient() {
  if (!storageClient) {
    const { supabaseUrl, serviceRoleKey } = getStorageConfig();
    storageClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return storageClient;
}

async function ensurePrivateBucket() {
  if (!bucketInitialization) {
    bucketInitialization = (async () => {
      const { bucket } = getStorageConfig();
      const client = getStorageClient();
      const { data, error } = await client.storage.getBucket(bucket);

      if (!error && data) {
        return bucket;
      }

      const statusCode = Number(error?.statusCode || error?.status);

      if (statusCode && statusCode !== 404) {
        throw createStorageError("Não foi possível validar o armazenamento de arquivos.");
      }

      const { error: createError } = await client.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: MAX_BUCKET_FILE_SIZE,
        allowedMimeTypes: ALLOWED_STORAGE_MIME_TYPES,
      });

      if (createError) {
        throw createStorageError("Não foi possível criar o espaço privado de arquivos.");
      }

      return bucket;
    })().catch((error) => {
      bucketInitialization = null;
      throw error;
    });
  }

  return bucketInitialization;
}

async function createSignedUpload(storagePath) {
  const bucket = await ensurePrivateBucket();
  const { data, error } = await getStorageClient()
    .storage
    .from(bucket)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl) {
    throw createStorageError("Não foi possível preparar o envio do arquivo.");
  }

  return {
    bucket,
    path: data.path,
    signedUrl: data.signedUrl,
  };
}

async function uploadedObjectExists(storagePath, bucketName) {
  const bucket = bucketName || (await ensurePrivateBucket());
  const { data, error } = await getStorageClient().storage.from(bucket).exists(storagePath);

  if (error && !data) {
    throw createStorageError("Não foi possível confirmar o arquivo enviado.");
  }

  return Boolean(data);
}

async function createSignedDownload(file, { download = false } = {}) {
  const { data, error } = await getStorageClient()
    .storage
    .from(file.storage_bucket)
    .createSignedUrl(file.storage_path, 300, {
      download: download ? file.original_name : false,
    });

  if (error || !data?.signedUrl) {
    throw createStorageError("Não foi possível abrir este arquivo.");
  }

  return data.signedUrl;
}

async function removeStoredObject(file) {
  const { error } = await getStorageClient()
    .storage
    .from(file.storage_bucket)
    .remove([file.storage_path]);

  if (error) {
    throw createStorageError("Não foi possível remover o arquivo do armazenamento.");
  }
}

function resetStorageClientForTests() {
  storageClient = null;
  bucketInitialization = null;
}

module.exports = {
  createSignedDownload,
  createSignedUpload,
  removeStoredObject,
  resetStorageClientForTests,
  uploadedObjectExists,
};
