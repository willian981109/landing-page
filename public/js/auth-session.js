(function () {
  const STORAGE_PREFIX = "englishStudio";
  const HOME_URL = "index.html";
  const ACTIVE_ROLE_KEY = "englishStudioActiveRole";
  const STUDENT_KEYS = ["englishStudioStudentToken", "englishStudioStudentUser"];
  const TEACHER_KEYS = [
    "englishStudioAdminToken",
    "englishStudioAdminUser",
    "englishStudioSelectedStudentId",
  ];
  const SESSION_CONFIG = {
    student: {
      tokenKey: "englishStudioStudentToken",
      userKey: "englishStudioStudentUser",
      keys: STUDENT_KEYS,
    },
    teacher: {
      tokenKey: "englishStudioAdminToken",
      userKey: "englishStudioAdminUser",
      keys: TEACHER_KEYS,
    },
  };

  function removeKeys(keys) {
    keys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }

  function clearSession() {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });

    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
  }

  function clearStudentSession() {
    removeKeys(STUDENT_KEYS);

    if (getActiveRole() === "student") {
      sessionStorage.removeItem(ACTIVE_ROLE_KEY);
    }
  }

  function clearTeacherSession() {
    removeKeys(TEACHER_KEYS);

    if (getActiveRole() === "teacher") {
      sessionStorage.removeItem(ACTIVE_ROLE_KEY);
    }
  }

  function getActiveRole() {
    return sessionStorage.getItem(ACTIVE_ROLE_KEY) || "";
  }

  function setActiveRole(role) {
    if (!SESSION_CONFIG[role]) {
      sessionStorage.removeItem(ACTIVE_ROLE_KEY);
      return;
    }

    sessionStorage.setItem(ACTIVE_ROLE_KEY, role);
  }

  function decodeBase64Url(value) {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

    return atob(padded);
  }

  function getTokenPayload(token) {
    try {
      return JSON.parse(decodeBase64Url(token.split(".")[1]));
    } catch (error) {
      return null;
    }
  }

  function getStoredUser(role) {
    const config = SESSION_CONFIG[role];

    if (!config) {
      return null;
    }

    try {
      return JSON.parse(localStorage.getItem(config.userKey));
    } catch (error) {
      return null;
    }
  }

  function hasValidStoredSession(role) {
    const config = SESSION_CONFIG[role];
    const token = config ? localStorage.getItem(config.tokenKey) : "";
    const user = getStoredUser(role);
    const payload = token ? getTokenPayload(token) : null;
    const expiresAt = payload?.exp ? payload.exp * 1000 : 0;

    return Boolean(token && user?.role === role && payload?.role === role && expiresAt > Date.now());
  }

  function canAdoptSession(role) {
    const otherRole = role === "student" ? "teacher" : "student";

    return hasValidStoredSession(role) && !hasValidStoredSession(otherRole);
  }

  function isSessionValid(role) {
    if (!SESSION_CONFIG[role]) {
      return false;
    }

    const activeRole = getActiveRole();

    if (activeRole === role) {
      return hasValidStoredSession(role);
    }

    if (activeRole && activeRole !== role) {
      return false;
    }

    if (hasValidStoredSession(role)) {
      setActiveRole(role);
      return true;
    }

    return false;
  }

  function canAutoRedirect(role) {
    if (!SESSION_CONFIG[role]) {
      return false;
    }

    const activeRole = getActiveRole();

    if (activeRole) {
      return activeRole === role && hasValidStoredSession(role);
    }

    return canAdoptSession(role);
  }

  function getSession(role) {
    const config = SESSION_CONFIG[role];

    if (!isSessionValid(role) || !config) {
      return null;
    }

    return {
      token: localStorage.getItem(config.tokenKey),
      user: getStoredUser(role),
    };
  }

  function saveSession(role, { token, user }) {
    const config = SESSION_CONFIG[role];

    if (!config || user?.role !== role || !token) {
      return false;
    }

    removeKeys(config.keys);

    localStorage.setItem(config.tokenKey, token);
    localStorage.setItem(config.userKey, JSON.stringify(user));
    setActiveRole(role);
    return true;
  }

  function redirectHome() {
    window.location.href = HOME_URL;
  }

  function logout(role) {
    if (role === "student") {
      clearStudentSession();
    } else if (role === "teacher") {
      clearTeacherSession();
    } else {
      clearSession();
    }

    redirectHome();
  }

  window.EnglishStudioAuth = {
    clearSession,
    clearStudentSession,
    clearTeacherSession,
    getActiveRole,
    getSession,
    getStoredUser,
    hasValidStoredSession,
    isSessionValid,
    canAutoRedirect,
    logout,
    redirectHome,
    saveSession,
    setActiveRole,
  };
})();
