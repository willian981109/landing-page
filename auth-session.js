(function () {
  const STORAGE_PREFIX = "englishStudio";
  const HOME_URL = "index.html";

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

  function redirectHome() {
    window.location.href = HOME_URL;
  }

  function logout() {
    clearSession();
    redirectHome();
  }

  window.EnglishStudioAuth = {
    clearSession,
    logout,
    redirectHome,
  };
})();
