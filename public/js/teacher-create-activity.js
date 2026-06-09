const materialTypes = {
  link: {
    label: "Link externo",
    icon: "URL",
    placeholder: "https://...",
    sources: ["link"],
  },
  docs: {
    label: "Google Docs",
    icon: "DOC",
    placeholder: "https://docs.google.com/document/...",
    sources: ["link", "file"],
  },
  pdf: {
    label: "PDF",
    icon: "PDF",
    sources: ["file"],
  },
  audio: {
    label: "Áudio",
    icon: "AUD",
    sources: ["file"],
  },
  video: {
    label: "Vídeo",
    icon: "VID",
    sources: ["file"],
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
const materialUrlField = document.querySelector("[data-material-url-field]");
const materialUrlLabel = document.querySelector("[data-material-url-label]");
const materialFileField = document.querySelector("[data-material-file-field]");
const materialFileInput = document.querySelector("[data-material-file]");
const materialFileHelp = document.querySelector("[data-material-file-help]");
const materialSourceToggle = document.querySelector("[data-material-source-toggle]");
const materialSourceButtons = document.querySelectorAll("[data-material-source]");
const selectedFilePanel = document.querySelector("[data-selected-file]");
const selectedFileName = document.querySelector("[data-selected-file-name]");
const selectedFileSize = document.querySelector("[data-selected-file-size]");
const removeSelectedFileButton = document.querySelector("[data-remove-selected-file]");
const materialDraftMessage = document.querySelector("[data-material-draft-message]");
const addMaterialButton = document.querySelector("[data-add-material]");
const cancelMaterialButton = document.querySelector("[data-cancel-material]");
const materialList = document.querySelector("[data-material-list]");
const emptyMaterials = document.querySelector("[data-empty-materials]");
const successMessage = document.querySelector("[data-success-message]");
const studentSelect = document.querySelector("[data-student-select]");
const studentStatus = document.querySelector("[data-student-status]");
const publishActivityButton = form.querySelector('button[type="submit"]');

const materials = [];
let selectedMaterialKind = "link";
let selectedMaterialSource = "link";
let selectedFile = null;

const API_BASE_URL = "";
const ADMIN_TOKEN_KEY = "englishStudioAdminToken";
const ADMIN_USER_KEY = "englishStudioAdminUser";

function getAssignmentControls() {
  return form.querySelectorAll("input, textarea, select, button");
}

function getAdminToken() {
  return window.EnglishStudioAuth?.getSession("teacher")?.token || "";
}

function getAuthHeaders() {
  const token = getAdminToken();

  return token ? { Authorization: `Bearer ${token}` } : {};
}

function clearAdminSession() {
  window.EnglishStudioAuth?.clearTeacherSession();
}

function getAdminUser() {
  return window.EnglishStudioAuth?.getSession("teacher")?.user || null;
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
  return Boolean(window.EnglishStudioAuth?.getSession("teacher"));
}

function requireTeacherSession() {
  if (hasTeacherSession()) {
    const user = getAdminUser();
    adminGreeting.textContent = `Conectada como ${user?.name || "professora"}. Crie atividades e gerencie conteúdos do painel administrativo.`;
    setAdminAreaLocked(false);
    return true;
  }

  redirectToLogin();
  return false;
}

function redirectToLogin(message) {
  if (message) {
    setStudentStatus(message, "error");
  }

  window.EnglishStudioAuth?.clearTeacherSession();
  window.EnglishStudioAuth?.redirectHome();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStudentStatus(message, type = "") {
  studentStatus.classList.remove("is-error");

  if (type) {
    studentStatus.classList.add(`is-${type}`);
  }

  studentStatus.textContent = message;
}

function setAssignmentMessage(message, type = "") {
  successMessage.classList.remove("is-error", "is-success");
  successMessage.hidden = !message;

  if (type) {
    successMessage.classList.add(`is-${type}`);
  }

  successMessage.textContent = message;
}

function renderStudentOptions(students) {
  if (students.length === 0) {
    studentSelect.innerHTML = '<option value="">Nenhum aluno cadastrado</option>';
    setStudentStatus("Nenhum aluno cadastrado ainda.");
    return;
  }

  studentSelect.innerHTML = [
    '<option value="">Selecione um aluno</option>',
    ...students.map(
      (student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`
    ),
  ].join("");
  setStudentStatus(`${students.length} aluno(s) encontrado(s).`);
}

async function loadStudents() {
  const token = getAdminToken();

  if (!token) {
    studentSelect.innerHTML = '<option value="">Faça login novamente</option>';
    setStudentStatus("Sessão inválida. Redirecionando para login...", "error");
    redirectToLogin();
    return;
  }

  studentSelect.innerHTML = '<option value="">Carregando alunos...</option>';
  setStudentStatus("Buscando alunos cadastrados...");

  try {
    const response = await fetch(`${API_BASE_URL}/students`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      studentSelect.innerHTML = '<option value="">Faça login novamente</option>';

      if (window.EnglishStudioAuth?.handleUnauthorized("teacher", data)) {
        return;
      }

      throw new Error(data.error || "Nao foi possivel validar sua sessao. Tente novamente.");
    }

    if (response.status === 403) {
      studentSelect.innerHTML = '<option value="">Acesso negado</option>';
      setStudentStatus("Sua conta nao tem permissao para carregar alunos.", "error");
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || "Erro ao buscar alunos");
    }

    renderStudentOptions(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("Erro ao carregar alunos:", error);
    studentSelect.innerHTML = '<option value="">Erro ao carregar alunos</option>';
    setStudentStatus("Não foi possível carregar os alunos. Verifique se o backend está rodando e atualizado.", "error");
  }
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

function setMaterialDraftMessage(message, type = "") {
  materialDraftMessage.classList.remove("is-error", "is-success");

  if (type) {
    materialDraftMessage.classList.add(`is-${type}`);
  }

  materialDraftMessage.textContent = message;
}

function renderSelectedFile() {
  selectedFilePanel.hidden = !selectedFile;

  if (!selectedFile) {
    selectedFileName.textContent = "";
    selectedFileSize.textContent = "";
    materialFileInput.value = "";
    return;
  }

  selectedFileName.textContent = selectedFile.name;
  selectedFileSize.textContent = window.EnglishStudioFiles.formatFileSize(selectedFile.size);
}

function setMaterialSource(source) {
  const materialType = materialTypes[selectedMaterialKind];
  selectedMaterialSource = materialType.sources.includes(source)
    ? source
    : materialType.sources[0];
  const usesFile = selectedMaterialSource === "file";

  materialSourceButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.materialSource === selectedMaterialSource);
  });

  materialUrlField.hidden = usesFile;
  materialFileField.hidden = !usesFile;

  if (usesFile) {
    const rule = window.EnglishStudioFiles.getRule(selectedMaterialKind);
    materialFileInput.accept = rule?.accept || "";
    materialFileHelp.textContent = rule?.help || "";
    materialUrlInput.value = "";
  } else {
    selectedFile = null;
    renderSelectedFile();
  }

  setMaterialDraftMessage("");
}

function openMaterialDraft(kind) {
  if (hasPendingMaterialDraft() && !addMaterial()) {
    return false;
  }

  selectedMaterialKind = kind;
  const materialType = materialTypes[kind];

  draftType.textContent = materialType.label;
  materialUrlLabel.textContent = kind === "docs" ? "Link do Google Docs" : "URL do material";
  materialUrlInput.placeholder = materialType.placeholder || "https://...";
  materialTitleInput.value = "";
  materialUrlInput.value = "";
  selectedFile = null;
  renderSelectedFile();
  materialSourceToggle.hidden = materialType.sources.length < 2;
  setMaterialSource(materialType.sources[0]);
  materialDraft.hidden = false;
  materialTitleInput.focus();
  return true;
}

function closeMaterialDraft() {
  materialDraft.hidden = true;
  materialTitleInput.value = "";
  materialUrlInput.value = "";
  selectedFile = null;
  renderSelectedFile();
  setMaterialDraftMessage("");
}

function clearMaterials() {
  materials.splice(0, materials.length);
  renderMaterials();
}

function renderMaterials() {
  emptyMaterials.hidden = materials.length > 0;

  materialList.innerHTML = materials
    .map((material, index) => {
      const materialType = materialTypes[material.type];

      return `
        <article class="material-item">
          <span class="material-item__icon material-item__icon--${material.type}">
            ${materialType.icon}
          </span>
          <div class="material-item__content">
            <strong>${escapeHtml(material.title)}</strong>
            <span>${materialType.label}</span>
            <small>${
              material.source === "file"
                ? `${escapeHtml(material.file.name)} · ${window.EnglishStudioFiles.formatFileSize(material.file.size)}`
                : escapeHtml(material.url)
            }</small>
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
  const url = materialUrlInput.value.trim();

  if (!title) {
    setMaterialDraftMessage("Informe o título do material.", "error");
    materialTitleInput.focus();
    return false;
  }

  if (selectedMaterialSource === "link" && !url) {
    setMaterialDraftMessage("Informe uma URL válida.", "error");
    materialUrlInput.focus();
    return false;
  }

  if (selectedMaterialSource === "link") {
    try {
      const parsedUrl = new URL(url);

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error();
      }
    } catch (error) {
      setMaterialDraftMessage("Informe uma URL válida iniciada por http:// ou https://.", "error");
      materialUrlInput.focus();
      return false;
    }
  }

  if (selectedMaterialSource === "file" && !selectedFile) {
    setMaterialDraftMessage("Selecione um arquivo antes de adicionar.", "error");
    materialFileInput.click();
    return false;
  }

  materials.push(
    selectedMaterialSource === "file"
      ? {
          type: selectedMaterialKind,
          title,
          source: "file",
          file: selectedFile,
        }
      : {
          type: selectedMaterialKind,
          title,
          source: "link",
          url,
        }
  );

  setAssignmentMessage("Material anexado à atividade.", "success");
  closeMaterialDraft();
  renderMaterials();
  return true;
}

function hasPendingMaterialDraft() {
  if (materialDraft.hidden) {
    return false;
  }

  return Boolean(
    materialTitleInput.value.trim() ||
      materialUrlInput.value.trim() ||
      selectedFile
  );
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
    if (openMaterialDraft(option.dataset.materialKind)) {
      closeMaterialOptions();
    }
  });
});

materialSourceButtons.forEach((button) => {
  button.addEventListener("click", () => setMaterialSource(button.dataset.materialSource));
});

materialFileInput.addEventListener("change", () => {
  const [file] = materialFileInput.files;

  try {
    selectedFile = window.EnglishStudioFiles.validateFile(file, selectedMaterialKind);
    renderSelectedFile();
    setMaterialDraftMessage("Arquivo selecionado e pronto para anexar.", "success");
  } catch (error) {
    selectedFile = null;
    renderSelectedFile();
    setMaterialDraftMessage(error.message, "error");
  }
});

removeSelectedFileButton.addEventListener("click", () => {
  selectedFile = null;
  renderSelectedFile();
  setMaterialDraftMessage("Arquivo removido.");
});

addMaterialButton.addEventListener("click", addMaterial);
cancelMaterialButton.addEventListener("click", closeMaterialDraft);

adminLogoutButton.addEventListener("click", () => {
  window.EnglishStudioAuth?.logout("teacher");
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

  if (hasPendingMaterialDraft() && !addMaterial()) {
    return;
  }

  const formData = new FormData(form);
  const payload = {
    title: formData.get("title"),
    description: formData.get("description"),
    deadline: formData.get("dueDate"),
    points: Number(formData.get("points") || 0),
    materials: [],
  };
  const selectedStudentId = formData.get("studentId");
  const token = getAdminToken();

  if (!token) {
    redirectToLogin();
    return;
  }

  if (!selectedStudentId) {
    studentSelect.focus();
    setAssignmentMessage("Selecione um aluno para enviar a atividade.", "error");
    return;
  }

  payload.studentId = selectedStudentId;
  const uploadedFileIds = [];

  try {
    publishActivityButton.disabled = true;
    publishActivityButton.textContent = "Enviando materiais...";
    setAssignmentMessage(
      materials.some((material) => material.source === "file")
        ? "Enviando arquivos com segurança..."
        : "Publicando atividade..."
    );

    for (const material of materials) {
      if (material.source === "file") {
        const uploadedFile = await window.EnglishStudioFiles.uploadFile(
          material.file,
          material.type,
          token
        );
        uploadedFileIds.push(uploadedFile.file_id);
        payload.materials.push({
          type: material.type,
          title: material.title,
          uploaded_file_id: uploadedFile.file_id,
        });
      } else {
        payload.materials.push({
          type: material.type,
          title: material.title,
          url: material.url,
        });
      }
    }

    publishActivityButton.textContent = "Publicando atividade...";
    const response = await fetch(`${API_BASE_URL}/activities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      if (window.EnglishStudioAuth?.handleUnauthorized("teacher", data)) {
        return;
      }

      throw new Error(data.error || "Nao foi possivel validar sua sessao. Tente novamente.");
    }

    if (response.status === 403) {
      throw new Error("Sua conta nao tem permissao para criar atividades.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Erro ao criar atividade");
    }

    setAssignmentMessage("Atividade criada com sucesso.", "success");
    form.dataset.published = "true";
    form.reset();
    clearMaterials();
    closeMaterialDraft();
    closeMaterialOptions();

    window.setTimeout(() => {
      successMessage.hidden = true;
    }, 3200);
  } catch (error) {
    await Promise.all(
      uploadedFileIds.map((fileId) =>
        window.EnglishStudioFiles.cancelUpload(fileId, token).catch(() => {})
      )
    );
    setAssignmentMessage(error.message, "error");
  } finally {
    publishActivityButton.disabled = false;
    publishActivityButton.textContent = "Publicar atividade";
  }
});

if (requireTeacherSession()) {
  loadStudents();
  renderMaterials();
}
