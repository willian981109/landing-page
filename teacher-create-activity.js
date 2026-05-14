const materialTypes = {
  link: {
    label: "Link externo",
    icon: "URL",
    placeholder: "https://...",
  },
  doc: {
    label: "Google Docs",
    icon: "DOC",
    placeholder: "https://docs.google.com/document/...",
  },
  upload: {
    label: "Upload simulado",
    icon: "PDF",
    placeholder: "Nome do arquivo ou referência simulada",
  },
  audio: {
    label: "Áudio",
    icon: "AUD",
    placeholder: "https://...",
  },
  video: {
    label: "Vídeo",
    icon: "VID",
    placeholder: "https://...",
  },
};

const form = document.querySelector("[data-assignment-form]");
const adminLogoutButton = document.querySelector("[data-admin-logout]");
const adminGreeting = document.querySelector("[data-admin-greeting]");
const materialMenu = document.querySelector("[data-material-menu]");
const materialToggle = document.querySelector("[data-material-toggle]");
const materialOptions = document.querySelector("[data-material-options]");
const materialDraft = document.querySelector("[data-material-draft]");
const draftType = document.querySelector("[data-draft-type]");
const materialTitleInput = document.querySelector("[data-material-title]");
const materialUrlInput = document.querySelector("[data-material-url]");
const addMaterialButton = document.querySelector("[data-add-material]");
const cancelMaterialButton = document.querySelector("[data-cancel-material]");
const materialList = document.querySelector("[data-material-list]");
const emptyMaterials = document.querySelector("[data-empty-materials]");
const successMessage = document.querySelector("[data-success-message]");

const materials = [];
let selectedMaterialKind = "link";

const API_BASE_URL = "http://localhost:3000";
const ADMIN_TOKEN_KEY = "englishStudioAdminToken";
const ADMIN_USER_KEY = "englishStudioAdminUser";

function getAssignmentControls() {
  return form.querySelectorAll("input, textarea, button");
}

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function getAuthHeaders() {
  const token = getAdminToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
}

function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

function getAdminUser() {
  const storedUser = localStorage.getItem(ADMIN_USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch (error) {
    localStorage.removeItem(ADMIN_USER_KEY);
    return null;
  }
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

function setAdminAreaLocked(isLocked) {
  form.classList.toggle("is-locked", isLocked);
  getAssignmentControls().forEach((control) => {
    control.disabled = isLocked;
  });

  if (isLocked) {
    closeMaterialOptions();
    closeMaterialDraft();
  }
}

function hasTeacherSession() {
  const user = getAdminUser();
  const token = getAdminToken();

  return Boolean(token && user?.role === "teacher" && isTeacherTokenValid(token));
}

function requireTeacherSession() {
  if (hasTeacherSession()) {
    const user = getAdminUser();
    adminGreeting.textContent = `Conectada como ${user?.name || "professora"}. Crie atividades e gerencie conteúdos do painel administrativo.`;
    setAdminAreaLocked(false);
    return;
  }

  clearAdminSession();
  window.location.href = "admin-login.html";
}

function closeMaterialOptions() {
  materialOptions.classList.remove("active");
  materialToggle.setAttribute("aria-expanded", "false");
}

function openMaterialOptions() {
  materialOptions.classList.add("active");
  materialToggle.setAttribute("aria-expanded", "true");
}

function toggleMaterialOptions() {
  if (materialOptions.classList.contains("active")) {
    closeMaterialOptions();
    return;
  }

  openMaterialOptions();
}

function openMaterialDraft(kind) {
  selectedMaterialKind = kind;
  const materialType = materialTypes[kind];

  draftType.textContent = materialType.label;
  materialUrlInput.placeholder = materialType.placeholder;
  materialTitleInput.value = "";
  materialUrlInput.value = "";
  materialDraft.hidden = false;
  materialTitleInput.focus();
}

function closeMaterialDraft() {
  materialDraft.hidden = true;
  materialTitleInput.value = "";
  materialUrlInput.value = "";
}

function clearMaterials() {
  materials.splice(0, materials.length);
  renderMaterials();
}

function renderMaterials() {
  emptyMaterials.hidden = materials.length > 0;

  materialList.innerHTML = materials
    .map((material, index) => {
      const materialType = materialTypes[material.kind];

      return `
        <article class="material-item">
          <span class="material-item__icon material-item__icon--${material.kind}">
            ${materialType.icon}
          </span>
          <div class="material-item__content">
            <strong>${material.title}</strong>
            <span>${materialType.label}</span>
          </div>
          <button class="remove-material" type="button" data-remove-material="${index}">
            Remover
          </button>
        </article>
      `;
    })
    .join("");

  materialList.querySelectorAll("[data-remove-material]").forEach((button) => {
    button.addEventListener("click", () => {
      materials.splice(Number(button.dataset.removeMaterial), 1);
      renderMaterials();
    });
  });
}

function addMaterial() {
  const title = materialTitleInput.value.trim();
  const reference = materialUrlInput.value.trim();

  if (!title) {
    materialTitleInput.focus();
    return;
  }

  materials.push({
    title,
    reference,
    kind: selectedMaterialKind,
  });

  closeMaterialDraft();
  renderMaterials();
}

materialToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMaterialOptions();
});

materialOptions.addEventListener("click", (event) => {
  event.stopPropagation();
});

materialOptions.querySelectorAll("[data-material-kind]").forEach((option) => {
  option.addEventListener("click", () => {
    openMaterialDraft(option.dataset.materialKind);
    closeMaterialOptions();
  });
});

addMaterialButton.addEventListener("click", addMaterial);
cancelMaterialButton.addEventListener("click", closeMaterialDraft);

adminLogoutButton.addEventListener("click", () => {
  clearAdminSession();
  window.location.href = "admin-login.html";
});

document.addEventListener("click", (event) => {
  if (!materialOptions.contains(event.target) && !materialToggle.contains(event.target)) {
    closeMaterialOptions();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMaterialOptions();
    closeMaterialDraft();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) {
    return;
  }

  const formData = new FormData(form);
  const payload = {
    title: formData.get("title"),
    description: formData.get("description"),
    deadline: formData.get("dueDate"),
    points: Number(formData.get("points") || 0),
  };
  const token = getAdminToken();

  if (!token) {
    clearAdminSession();
    window.location.href = "admin-login.html";
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/activities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      clearAdminSession();
      alert("Sua sessão expirou. Faça login novamente.");
      window.location.href = "admin-login.html";
      return;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erro ao criar atividade");
    }

    await response.json();

    alert("Atividade criada com sucesso");
    successMessage.hidden = false;
    successMessage.textContent = "Atividade criada com sucesso";
    form.dataset.published = "true";
    form.reset();
    clearMaterials();
    closeMaterialDraft();
    closeMaterialOptions();

    window.setTimeout(() => {
      successMessage.hidden = true;
    }, 3200);
  } catch (error) {
    alert(error.message);
  }
});

requireTeacherSession();
renderMaterials();
