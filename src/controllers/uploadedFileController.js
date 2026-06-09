const uploadedFileService = require("../services/uploadedFileService");

async function signUpload(req, res, next) {
  try {
    const upload = await uploadedFileService.createUploadAuthorization(req.user.id, req.body);
    return res.status(201).json(upload);
  } catch (error) {
    return next(error);
  }
}

async function cancelUpload(req, res, next) {
  try {
    await uploadedFileService.cancelPendingUpload(req.params.fileId, req.user.id);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function getAccess(req, res, next) {
  try {
    const access = await uploadedFileService.getFileAccess(req.params.fileId, req.user, {
      download: req.query.download === "1",
    });
    return res.json(access);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  cancelUpload,
  getAccess,
  signUpload,
};
