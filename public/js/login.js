const API_BASE_URL = "";
const STUDENT_TOKEN_KEY = "englishStudioStudentToken";
const STUDENT_USER_KEY = "englishStudioStudentUser";

const loginForm = document.querySelector("[data-login-form]");
const registerForm = document.querySelector("[data-register-form]");
const authTabs = document.querySelectorAll("[data-auth-tab]");
const authMessage = document.querySelector("[data-auth-message]");
const registerPasswordInput = document.querySelector("[data-register-password]");
const passwordStrength = document.querySelector("[data-password-strength]");
const passwordStrengthBar = document.querySelector("[data-password-strength-bar]");
const passwordStrengthLabel = document.querySelector("[data-password-strength-label]");
const passwordRuleItems = document.querySelectorAll("[data-password-rule]");

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

function getPasswordRules(password) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^\w\s]/.test(password),
  };
}

function updatePasswordStrength() {
  if (!registerPasswordInput || !passwordStrength || !passwordStrengthBar || !passwordStrengthLabel) {
    return true;
  }

  const rules = getPasswordRules(registerPasswordInput.value);
  const score = Object.values(rules).filter(Boolean).length;
  const labels = ["Muito fraca", "Muito fraca", "Fraca", "Boa", "Forte", "Excelente"];

  passwordStrength.dataset.score = String(score);
  passwordStrengthBar.style.width = `${(score / 5) * 100}%`;
  passwordStrengthLabel.textContent = score === 5 ? "Senha segura." : `Forca da senha: ${labels[score]}`;

  passwordRuleItems.forEach((item) => {
    item.classList.toggle("is-valid", Boolean(rules[item.dataset.passwordRule]));
  });

  return score === 5;
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

function saveSession({ token, user }) {
  window.EnglishStudioAuth?.saveSession("student", { token, user });
}

function redirectByRole(user) {
  if (user.role !== "student") {
    setAuthMessage("Use a área da professora para acessar essa conta.", "error");
    return;
  }

  window.location.href = "student.html";
}

function redirectExistingSession() {
  if (window.EnglishStudioAuth?.canAutoRedirect("student")) {
    window.location.href = "student.html";
    return true;
  }

  return false;
}

function showPanel(panelName) {
  authTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.authTab === panelName);
  });

  loginForm.hidden = panelName !== "login";
  registerForm.hidden = panelName !== "register";
  setAuthMessage("");
}

async function submitAuth(path, payload, successMessage) {
  setAuthMessage("Processando...");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Não foi possível concluir o acesso.");
  }

  if (data.user?.role !== "student") {
    throw new Error("Esta conta pertence à professora. Use a área da professora.");
  }

  saveSession(data);
  setAuthMessage(successMessage, "success");
  redirectByRole(data.user);
}

if (!redirectExistingSession()) {
  updatePasswordStrength();

  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => showPanel(tab.dataset.authTab));
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const emailInput = loginForm.querySelector("[name='email']");

    if (!validateEmailInput(emailInput)) {
      emailInput.reportValidity();
      return;
    }

    try {
      await submitAuth(
        "/auth/login",
        {
          email: normalizeEmail(formData.get("email")),
          password: formData.get("password"),
        },
        "Login realizado com sucesso."
      );
    } catch (error) {
      setAuthMessage(error.message, "error");
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(registerForm);
    const emailInput = registerForm.querySelector("[name='email']");

    if (!validateEmailInput(emailInput)) {
      emailInput.reportValidity();
      return;
    }

    if (!updatePasswordStrength()) {
      registerPasswordInput.focus();
      setAuthMessage("Crie uma senha mais segura antes de continuar.", "error");
      return;
    }

    try {
      await submitAuth(
        "/auth/register",
        {
          name: String(formData.get("name") || "").trim(),
          email: normalizeEmail(formData.get("email")),
          password: formData.get("password"),
        },
        "Conta criada com sucesso."
      );
    } catch (error) {
      setAuthMessage(error.message, "error");
    }
  });

  registerPasswordInput?.addEventListener("input", updatePasswordStrength);
  document.querySelectorAll("[data-login-email], [data-register-email]").forEach((input) => {
    input.addEventListener("blur", () => validateEmailInput(input));
    input.addEventListener("input", () => input.setCustomValidity(""));
  });
}
