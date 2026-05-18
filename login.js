const API_BASE_URL = "http://localhost:3000";
const STUDENT_TOKEN_KEY = "englishStudioStudentToken";
const STUDENT_USER_KEY = "englishStudioStudentUser";
const ADMIN_TOKEN_KEY = "englishStudioAdminToken";
const ADMIN_USER_KEY = "englishStudioAdminUser";

const loginForm = document.querySelector("[data-login-form]");
const registerForm = document.querySelector("[data-register-form]");
const authTabs = document.querySelectorAll("[data-auth-tab]");
const authMessage = document.querySelector("[data-auth-message]");

function setAuthMessage(message, type = "") {
  authMessage.classList.remove("is-error", "is-success");

  if (type) {
    authMessage.classList.add(`is-${type}`);
  }

  authMessage.textContent = message;
}

function getTokenPayload(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (error) {
    return null;
  }
}

function isTokenValidForRole(token, role) {
  const payload = getTokenPayload(token);
  const expiresAt = payload?.exp ? payload.exp * 1000 : 0;

  return Boolean(payload?.role === role && expiresAt > Date.now());
}

function readStoredUser(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (error) {
    return null;
  }
}

function saveSession({ token, user }) {
  window.EnglishStudioAuth?.clearSession();

  if (user.role === "teacher") {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
    return;
  }

  localStorage.setItem(STUDENT_TOKEN_KEY, token);
  localStorage.setItem(STUDENT_USER_KEY, JSON.stringify(user));
}

function redirectByRole(user) {
  if (user.role === "teacher") {
    window.location.href = "teacher-create-activity.html";
    return;
  }

  window.location.href = "student.html";
}

function redirectExistingSession() {
  const studentToken = localStorage.getItem(STUDENT_TOKEN_KEY);
  const studentUser = readStoredUser(STUDENT_USER_KEY);

  if (studentToken && studentUser?.role === "student" && isTokenValidForRole(studentToken, "student")) {
    window.location.href = "student.html";
    return true;
  }

  const adminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
  const adminUser = readStoredUser(ADMIN_USER_KEY);

  if (adminToken && adminUser?.role === "teacher" && isTokenValidForRole(adminToken, "teacher")) {
    window.location.href = "teacher-create-activity.html";
    return true;
  }

  window.EnglishStudioAuth?.clearSession();
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

  saveSession(data);
  setAuthMessage(successMessage, "success");
  redirectByRole(data.user);
}

if (!redirectExistingSession()) {
  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => showPanel(tab.dataset.authTab));
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);

    try {
      await submitAuth(
        "/auth/login",
        {
          email: formData.get("email"),
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

    try {
      await submitAuth(
        "/auth/register",
        {
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password"),
        },
        "Conta criada com sucesso."
      );
    } catch (error) {
      setAuthMessage(error.message, "error");
    }
  });
}
