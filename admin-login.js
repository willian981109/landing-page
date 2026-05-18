const API_BASE_URL = "http://localhost:3000";
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

function saveAdminSession({ token, user }) {
  window.EnglishStudioAuth?.clearSession();
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
}

function clearAdminSession() {
  window.EnglishStudioAuth?.clearSession();
}

function getTokenPayload(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch (error) {
    return null;
  }
}

function isTeacherTokenValid(token) {
  const payload = getTokenPayload(token);
  const expiresAt = payload?.exp ? payload.exp * 1000 : 0;

  return Boolean(payload?.role === "teacher" && expiresAt > Date.now());
}

function hasTeacherSession() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const storedUser = localStorage.getItem(ADMIN_USER_KEY);

  if (!token || !storedUser) {
    return false;
  }

  try {
    return JSON.parse(storedUser).role === "teacher" && isTeacherTokenValid(token);
  } catch (error) {
    clearAdminSession();
    return false;
  }
}

if (hasTeacherSession()) {
  window.location.href = "admin-schedule.html";
} else {
  clearAdminSession();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const payload = {
    email: formData.get("email"),
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
