const EMAIL_MAX_LENGTH = 160;
const NAME_MAX_LENGTH = 120;
const PASSWORD_MIN_LENGTH = 8;

function createValidationError(message, details = []) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "VALIDATION_ERROR";
  error.details = details;
  return error;
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function stripControlCharacters(value) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "");
}

function sanitizePlainText(value, maxLength = 1000) {
  return stripControlCharacters(normalizeWhitespace(value)).slice(0, maxLength);
}

function isValidEmail(email) {
  if (!email || email.length > EMAIL_MAX_LENGTH) {
    return false;
  }

  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/i.test(email);
}

function getPasswordIssues(password) {
  const value = String(password ?? "");
  const issues = [];

  if (value.length < PASSWORD_MIN_LENGTH) {
    issues.push("A senha deve ter no minimo 8 caracteres.");
  }

  if (!/[A-Z]/.test(value)) {
    issues.push("A senha deve conter pelo menos 1 letra maiuscula.");
  }

  if (!/[a-z]/.test(value)) {
    issues.push("A senha deve conter pelo menos 1 letra minuscula.");
  }

  if (!/\d/.test(value)) {
    issues.push("A senha deve conter pelo menos 1 numero.");
  }

  if (!/[^\w\s]/.test(value)) {
    issues.push("A senha deve conter pelo menos 1 caractere especial.");
  }

  return issues;
}

function normalizeRegisterPayload(payload = {}) {
  const name = sanitizePlainText(payload.name, NAME_MAX_LENGTH);
  const email = normalizeEmail(payload.email);
  const password = String(payload.password ?? "");
  const details = [];

  if (!name || name.length < 2) {
    details.push("Informe um nome com pelo menos 2 caracteres.");
  }

  if (!isValidEmail(email)) {
    details.push("Informe um e-mail valido.");
  }

  details.push(...getPasswordIssues(password));

  if (details.length) {
    throw createValidationError("Revise os dados informados.", details);
  }

  return {
    name,
    email,
    password,
  };
}

function normalizeLoginPayload(payload = {}) {
  const email = normalizeEmail(payload.email);
  const password = String(payload.password ?? "");
  const details = [];

  if (!isValidEmail(email)) {
    details.push("Informe um e-mail valido.");
  }

  if (!password) {
    details.push("Informe sua senha.");
  }

  if (details.length) {
    throw createValidationError("Revise os dados informados.", details);
  }

  return {
    email,
    password,
  };
}

module.exports = {
  createValidationError,
  getPasswordIssues,
  isValidEmail,
  normalizeEmail,
  normalizeLoginPayload,
  normalizeRegisterPayload,
  sanitizePlainText,
};
