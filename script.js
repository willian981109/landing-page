/**
 * Lightweight interactions today, ready to be replaced by typed modules when the
 * future Node.js + PostgreSQL integration owns forms, authentication and content.
 */

const appConfig = {
  apiBaseUrl: "/api",
  endpoints: {
    leads: "/leads",
    studentArea: "/student-area",
  },
};

const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const navToggle = document.querySelector("[data-nav-toggle]");
const studentAccess = document.querySelector("[data-student-access]");
const studentMenuToggle = document.querySelector("[data-student-menu-toggle]");
const studentLoginOpen = document.querySelector("[data-student-login-open]");
const studentLoginForm = document.querySelector("[data-student-login-form]");
const revealItems = document.querySelectorAll(".reveal");

function updateHeaderState() {
  header?.classList.toggle("is-scrolled", window.scrollY > 12);
}

function closeMobileNav() {
  document.body.classList.remove("nav-open");
  nav?.classList.remove("is-open");
  navToggle?.setAttribute("aria-expanded", "false");
}

function closeStudentAccess() {
  studentAccess?.classList.remove("is-open");
  studentAccess?.classList.remove("is-login");
  studentMenuToggle?.setAttribute("aria-expanded", "false");

  if (studentLoginForm) {
    studentLoginForm.hidden = true;
  }
}

function setupNavigation() {
  navToggle?.addEventListener("click", () => {
    const isOpen = nav?.classList.toggle("is-open");

    document.body.classList.toggle("nav-open", Boolean(isOpen));
    navToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));

    if (isOpen) {
      closeStudentAccess();
    }
  });

  nav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileNav);
  });
}

function setupStudentAccess() {
  studentMenuToggle?.addEventListener("click", () => {
    const isOpen = studentAccess?.classList.toggle("is-open");

    studentMenuToggle.setAttribute("aria-expanded", String(Boolean(isOpen)));
    closeMobileNav();

    if (!isOpen && studentLoginForm) {
      studentAccess?.classList.remove("is-login");
      studentLoginForm.hidden = true;
    }
  });

  studentLoginOpen?.addEventListener("click", () => {
    studentAccess?.classList.add("is-login");

    if (studentLoginForm) {
      studentLoginForm.hidden = false;
      studentLoginForm.querySelector("input")?.focus();
    }
  });

  studentLoginForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    window.location.href = "student.html";
  });

  document.addEventListener("click", (event) => {
    if (!studentAccess?.contains(event.target)) {
      closeStudentAccess();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeStudentAccess();
    }
  });
}

function setupRevealAnimation() {
  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function prepareFutureIntegrations() {
  window.englishStudio = {
    config: appConfig,
    submitLead: async (payload) => {
      // Future hook: POST payload to `${appConfig.apiBaseUrl}${appConfig.endpoints.leads}`.
      return { ok: true, payload };
    },
  };
}

window.addEventListener("scroll", updateHeaderState, { passive: true });
window.addEventListener("load", updateHeaderState);

setupNavigation();
setupStudentAccess();
setupRevealAnimation();
prepareFutureIntegrations();
