const crypto = require("crypto");

const { areMaterialTypesCompatible, validateUploadMetadata } = require("../config/uploadRules");
const uploadedFileModel = require("../models/uploadedFileModel");
const fileStorageService = require("./fileStorageService");

function createUploadedFileError(message, statusCode = 400, code = "UPLOAD_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

async function createUploadAuthorization(teacherId, payload) {
  if (!isUuid(teacherId)) {
    throw createUploadedFileError("teacher_id must be a valid user id");
  }

  const metadata = validateUploadMetadata({
    materialType: payload.material_type ?? payload.materialType,
    fileName: payload.file_name ?? payload.fileName,
    mimeType: payload.mime_type ?? payload.mimeType,
    sizeBytes: payload.size_bytes ?? payload.sizeBytes,
  });
  const fileId = crypto.randomUUID();
  const storagePath = `${teacherId}/${fileId}${metadata.extension}`;
  let file;

  try {
    const signedUpload = await fileStorageService.createSignedUpload(storagePath);
    file = await uploadedFileModel.createPendingUploadedFile({
      id: fileId,
      teacher_id: teacherId,
      storage_bucket: signedUpload.bucket,
      storage_path: signedUpload.path,
      original_name: metadata.originalName,
      mime_type: metadata.mimeType,
      size_bytes: metadata.sizeBytes,
      material_type: metadata.materialType,
    });

    return {
      id: file.id,
      file_name: file.original_name,
      mime_type: file.mime_type,
      size_bytes: Number(file.size_bytes),
      material_type: file.material_type,
      signed_url: signedUpload.signedUrl,
    };
  } catch (error) {
    if (file) {
      await uploadedFileModel.deletePendingUploadedFile(file.id, teacherId).catch(() => {});
    }

    throw error;
  }
}

async function assertUploadedFileReady(fileId, teacherId, materialType, { allowAttached = false } = {}) {
  if (!isUuid(fileId)) {
    throw createUploadedFileError("uploaded_file_id must be a valid id");
  }

  const file = await uploadedFileModel.findTeacherUploadedFile(fileId, teacherId);

  if (!file) {
    throw createUploadedFileError("Arquivo enviado não encontrado.", 404, "UPLOAD_NOT_FOUND");
  }

  if (!areMaterialTypesCompatible(materialType, file.material_type)) {
    throw createUploadedFileError("O arquivo enviado não corresponde ao tipo do material.");
  }

  if (file.status !== "pending" && !(allowAttached && file.status === "attached")) {
    throw createUploadedFileError("Este arquivo já está associado a outro material.");
  }

  const exists = await fileStorageService.uploadedObjectExists(
    file.storage_path,
    file.storage_bucket
  );

  if (!exists) {
    throw createUploadedFileError(
      "O envio do arquivo não foi concluído. Selecione o arquivo novamente."
    );
  }

  return file;
}

async function cancelPendingUpload(fileId, teacherId) {
  if (!isUuid(fileId) || !isUuid(teacherId)) {
    throw createUploadedFileError("upload_id and teacher_id must be valid ids");
  }

  const file = await uploadedFileModel.findTeacherUploadedFile(fileId, teacherId);

  if (!file || file.status !== "pending") {
    return;
  }

  await fileStorageService.removeStoredObject(file).catch(() => {});
  await uploadedFileModel.deletePendingUploadedFile(fileId, teacherId);
}

async function removeDetachedUploadedFile(file) {
  if (!file?.id) {
    return;
  }

  try {
    await fileStorageService.removeStoredObject(file);
    await uploadedFileModel.deleteUploadedFileRecord(file.id);
  } catch (error) {
    console.error({
      message: "Failed to remove detached uploaded file",
      fileId: file.id,
      storagePath: file.storage_path,
    });
  }
}

async function getFileAccess(fileId, user, { download = false } = {}) {
  if (!isUuid(fileId) || !isUuid(user?.id)) {
    throw createUploadedFileError("file_id and user_id must be valid ids");
  }

  const file = await uploadedFileModel.findUploadedFileById(fileId);

  if (!file || file.status !== "attached") {
    throw createUploadedFileError("Arquivo não encontrado.", 404, "FILE_NOT_FOUND");
  }

  const allowed = user.role === "teacher"
    ? file.teacher_id === user.id
    : user.role === "student"
      ? await uploadedFileModel.canStudentAccessUploadedFile(fileId, user.id)
      : false;

  if (!allowed) {
    throw createUploadedFileError("Arquivo não encontrado.", 404, "FILE_NOT_FOUND");
  }

  const url = await fileStorageService.createSignedDownload(file, { download });

  return {
    url,
    file_name: file.original_name,
    mime_type: file.mime_type,
    size_bytes: Number(file.size_bytes),
  };
}

module.exports = {
  assertUploadedFileReady,
  cancelPendingUpload,
  createUploadAuthorization,
  getFileAccess,
  removeDetachedUploadedFile,
};
