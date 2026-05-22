const API_BASE_URL = "";
const ADMIN_TOKEN_KEY = "englishStudioAdminToken";
const ADMIN_USER_KEY = "englishStudioAdminUser";

const loginForm = document.querySelector("[data-admin-login-form]");
const authMessage = document.querySelector("[data-auth-message]");

function setAuthMessage(message, type = "") {
  authMessage.classList.remove("is-error", "is-success");

  if (type) {
    authMessage.classList.add(`is-${type}`);
  }

  authMessage.textContent = message;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isEmailValid(email) {
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/i.test(email);
}

function validateEmailInput(input) {
  if (!input) {
    return true;
  }

  input.value = normalizeEmail(input.value);

  if (!isEmailValid(input.value)) {
    input.setCustomValidity("Informe um e-mail valido.");
    return false;
  }

  input.setCustomValidity("");
  return true;
}

function saveAdminSession({ token, user }) {
  window.EnglishStudioAuth?.saveSession("teacher", { token, user });
}

function clearAdminSession() {
  window.EnglishStudioAuth?.clearTeacherSession();
}

function hasTeacherSession() {
  return Boolean(window.EnglishStudioAuth?.canAutoRedirect("teacher"));
}

if (hasTeacherSession()) {
  window.location.href = "admin-schedule.html";
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const emailInput = loginForm.querySelector("[name='email']");

  if (!validateEmailInput(emailInput)) {
    emailInput.reportValidity();
    return;
  }

  const payload = {
    email: normalizeEmail(formData.get("email")),
    password: formData.get("password"),
  };

  setAuthMessage("Entrando...");

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Não foi possível fazer login.");
    }

    if (data.user?.role !== "teacher") {
      throw new Error("Apenas usuários teacher podem acessar esta área.");
    }

    saveAdminSession(data);
    setAuthMessage("Login realizado com sucesso.", "success");
    window.location.href = "admin-schedule.html";
  } catch (error) {
    clearAdminSession();
    setAuthMessage(error.message, "error");
  }
});
