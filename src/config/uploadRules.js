const path = require("path");

const MEGABYTE = 1024 * 1024;

const FILE_RULES = {
  pdf: {
    extensions: [".pdf"],
    maxSize: 15 * MEGABYTE,
    mimeTypes: {
      ".pdf": "application/pdf",
    },
  },
  docs: {
    extensions: [".doc", ".docx", ".odt"],
    maxSize: 15 * MEGABYTE,
    mimeTypes: {
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".odt": "application/vnd.oasis.opendocument.text",
    },
  },
  document: {
    extensions: [".doc", ".docx", ".odt"],
    maxSize: 15 * MEGABYTE,
    mimeTypes: {
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".odt": "application/vnd.oasis.opendocument.text",
    },
  },
  audio: {
    extensions: [".mp3", ".wav", ".ogg", ".m4a"],
    maxSize: 30 * MEGABYTE,
    mimeTypes: {
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".ogg": "audio/ogg",
      ".m4a": "audio/mp4",
    },
    compatibleMimeTypes: ["audio/x-wav", "audio/x-m4a"],
  },
  video: {
    extensions: [".mp4", ".mov", ".webm", ".avi"],
    maxSize: 50 * MEGABYTE,
    mimeTypes: {
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
      ".avi": "video/x-msvideo",
    },
    compatibleMimeTypes: ["video/avi", "video/msvideo"],
  },
};

const ALLOWED_STORAGE_MIME_TYPES = [
  ...new Set(
    Object.values(FILE_RULES).flatMap((rule) => [
      ...Object.values(rule.mimeTypes),
      ...(rule.compatibleMimeTypes || []),
    ])
  ),
];

function createUploadValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "INVALID_UPLOAD";
  return error;
}

function normalizeOriginalName(value) {
  return path.basename(String(value || "").trim()).replace(/[\u0000-\u001f\u007f]/g, "");
}

function validateUploadMetadata({ materialType, fileName, mimeType, sizeBytes }) {
  const normalizedType = String(materialType || "").trim().toLowerCase();
  const rule = FILE_RULES[normalizedType];

  if (!rule) {
    throw createUploadValidationError("Este tipo de material não aceita upload de arquivo.");
  }

  const originalName = normalizeOriginalName(fileName);
  const extension = path.extname(originalName).toLowerCase();
  const normalizedSize = Number(sizeBytes);
  const suppliedMimeType = String(mimeType || "").trim().toLowerCase();

  if (!originalName || !rule.extensions.includes(extension)) {
    throw createUploadValidationError(
      `Formato inválido. Use apenas: ${rule.extensions.join(", ")}.`
    );
  }

  if (!Number.isSafeInteger(normalizedSize) || normalizedSize <= 0) {
    throw createUploadValidationError("O arquivo selecionado está vazio ou possui tamanho inválido.");
  }

  if (normalizedSize > rule.maxSize) {
    throw createUploadValidationError(
      `O arquivo excede o limite de ${Math.round(rule.maxSize / MEGABYTE)} MB.`
    );
  }

  const canonicalMimeType = rule.mimeTypes[extension];
  const acceptedMimeTypes = new Set([
    canonicalMimeType,
    ...(rule.compatibleMimeTypes || []),
    "application/octet-stream",
  ]);

  if (suppliedMimeType && !acceptedMimeTypes.has(suppliedMimeType)) {
    throw createUploadValidationError("O tipo interno do arquivo não corresponde ao formato selecionado.");
  }

  return {
    materialType: normalizedType,
    originalName,
    extension,
    mimeType: canonicalMimeType,
    sizeBytes: normalizedSize,
    maxSize: rule.maxSize,
  };
}

function areMaterialTypesCompatible(expectedType, uploadedType) {
  const normalizedExpected = String(expectedType || "").toLowerCase();
  const normalizedUploaded = String(uploadedType || "").toLowerCase();

  if (normalizedExpected === normalizedUploaded) {
    return true;
  }

  return ["docs", "document"].includes(normalizedExpected)
    && ["docs", "document"].includes(normalizedUploaded);
}

module.exports = {
  ALLOWED_STORAGE_MIME_TYPES,
  FILE_RULES,
  areMaterialTypesCompatible,
  validateUploadMetadata,
};
