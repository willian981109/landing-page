const API_BASE_URL = "";

const adminGreeting = document.querySelector("[data-admin-greeting]");
const adminLogoutButton = document.querySelector("[data-admin-logout]");
const materialForm = document.querySelector("[data-material-form]");
const materialMessage = document.querySelector("[data-material-message]");
const materialList = document.querySelector("[data-material-list]");
const studentSelect = document.querySelector("[data-student-select]");
const filterStudent = document.querySelector("[data-filter-student]");
const formTitle = document.querySelector("[data-form-title]");
const submitButton = document.querySelector("[data-submit-material]");
const cancelEditButton = document.querySelector("[data-cancel-edit]");
const materialTypeSelect = document.querySelector("[data-material-type]");
const materialUrlField = document.querySelector("[data-material-url-field]");
const materialUrlInput = materialForm.elements.url;
const materialFileField = document.querySelector("[data-material-file-field]");
const materialFileInput = document.querySelector("[data-material-file]");
const materialFileHelp = document.querySelector("[data-material-file-help]");
const materialSourceToggle = document.querySelector("[data-material-source-toggle]");
const materialSourceButtons = document.querySelectorAll("[data-material-source]");
const selectedFilePanel = document.querySelector("[data-selected-file]");
const selectedFileName = document.querySelector("[data-selected-file-name]");
const selectedFileSize = document.querySelector("[data-selected-file-size]");
const removeSelectedFileButton = document.querySelector("[data-remove-selected-file]");

const materialTypes = {
  pdf: "PDF",
  video: "Vídeo",
  link: "Link",
  exercise: "Exercício",
  audio: "Áudio",
  document: "Documento",
  vocabulary: "Vocabulário",
};

const state = {
  students: [],
  materials: [],
  editingId: null,
  sourceMode: "file",
  selectedFile: null,
  existingFile: null,
};

function getAdminToken() {
  return window.EnglishStudioAuth?.getSession("teacher")?.token || "";
}

function getAdminUser() {
  return window.EnglishStudioAuth?.getSession("teacher")?.user || null;
}

function requireTeacherSession() {
  const session = window.EnglishStudioAuth?.getSession("teacher");
  const user = session?.user;

  if (session?.token && user?.role === "teacher") {
    adminGreeting.textContent = `Conectada como ${user.name}. Envie conteúdos personalizados para cada aluno.`;
    return true;
  }

  redirectToLogin();
  return false;
}

function redirectToLogin() {
  window.EnglishStudioAuth?.clearTeacherSession();
  window.EnglishStudioAuth?.redirectHome();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function fetchTeacherApi(path, options = {}) {
  const token = getAdminToken();

  if (!token) {
    redirectToLogin();
    return null;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    if (window.EnglishStudioAuth?.handleUnauthorized("teacher", data)) {
      return null;
    }

    throw new Error(data.error || "Não foi possível validar sua sessão. Tente novamente.");
  }

  if (response.status === 403) {
    throw new Error("Sua conta não tem permissão para acessar este recurso.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Não foi possível concluir a ação.");
  }

  return data;
}

function setMaterialMessage(message, type = "") {
  materialMessage.classList.remove("is-error", "is-success");

  if (type) {
    materialMessage.classList.add(`is-${type}`);
  }

  materialMessage.textContent = message;
}

function formatDate(value) {
  if (!value) {
    return "Sem data";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("pt-BR");
}

function getAllowedSources(type) {
  if (type === "document") {
    return ["link", "file"];
  }

  if (["pdf", "video", "audio"].includes(type)) {
    return ["file"];
  }

  return ["link"];
}

function renderSelectedFile() {
  const fileInfo = state.selectedFile
    ? {
        name: state.selectedFile.name,
        size: state.selectedFile.size,
      }
    : state.existingFile;

  selectedFilePanel.hidden = !fileInfo;

  if (!fileInfo) {
    selectedFileName.textContent = "";
    selectedFileSize.textContent = "";
    materialFileInput.value = "";
    return;
  }

  selectedFileName.textContent = fileInfo.name;
  selectedFileSize.textContent = window.EnglishStudioFiles.formatFileSize(fileInfo.size);
}

function setSourceMode(source, { preserveFile = false } = {}) {
  const type = materialTypeSelect.value;
  const allowedSources = getAllowedSources(type);
  state.sourceMode = allowedSources.includes(source) ? source : allowedSources[0];
  const usesFile = state.sourceMode === "file";

  materialSourceToggle.hidden = allowedSources.length < 2;
  materialSourceButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.materialSource === state.sourceMode);
  });

  materialUrlField.hidden = usesFile;
  materialFileField.hidden = !usesFile;
  materialUrlInput.required = !usesFile;

  if (usesFile) {
    const rule = window.EnglishStudioFiles.getRule(type);
    materialFileInput.accept = rule?.accept || "";
    materialFileHelp.textContent = rule?.help || "";
    materialUrlInput.value = "";
  } else if (!preserveFile) {
    state.selectedFile = null;
    state.existingFile = null;
  }

  renderSelectedFile();
}

function syncMaterialType({ preserveExisting = false } = {}) {
  const allowedSources = getAllowedSources(materialTypeSelect.value);
  const existingTypeMatches = state.existingFile
    && (
      state.existingFile.materialType === materialTypeSelect.value
      || ["docs", "document"].includes(state.existingFile.materialType)
        && materialTypeSelect.value === "document"
    );

  if (!preserveExisting || !existingTypeMatches) {
    state.selectedFile = null;
    state.existingFile = null;
  }

  setSourceMode(
    preserveExisting && existingTypeMatches ? "file" : allowedSources[0],
    { preserveFile: preserveExisting && existingTypeMatches }
  );
  setMaterialMessage("");
}

function renderStudentOptions() {
  if (!state.students.length) {
    studentSelect.innerHTML = '<option value="">Nenhum aluno cadastrado</option>';
    filterStudent.innerHTML = '<option value="">Todos os alunos</option>';
    return;
  }

  const options = state.students
    .map((student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`)
    .join("");

  studentSelect.innerHTML = `<option value="">Selecione um aluno</option>${options}`;
  filterStudent.innerHTML = `<option value="">Todos os alunos</option>${options}`;
}

function getVisibleMaterials() {
  return filterStudent.value
    ? state.materials.filter((material) => material.student_id === filterStudent.value)
    : state.materials;
}

function renderMaterials() {
  const materials = getVisibleMaterials();

  if (!materials.length) {
    materialList.innerHTML = '<p class="materials-empty">Nenhum material enviado para este filtro.</p>';
    return;
  }

  materialList.innerHTML = materials
    .map(
      (material) => `
        <article class="teacher-material-card">
          <div class="teacher-material-card__top">
            <span class="material-type-badge">${materialTypes[material.type] || "Material"}</span>
            <span class="teacher-material-card__meta">Enviado em ${formatDate(material.created_at)}</span>
          </div>
          <div>
            <h3>${escapeHtml(material.title)}</h3>
            <p>${escapeHtml(material.description || "Sem descrição.")}</p>
          </div>
          <div class="teacher-material-card__meta">
            <span>Aluno: <strong>${escapeHtml(material.student_name)}</strong></span>
            <span>${
              material.file_id
                ? `Arquivo: <strong>${escapeHtml(material.file_name)}</strong>`
                : `Tipo: <strong>${materialTypes[material.type] || "Material"}</strong>`
            }</span>
          </div>
          <div class="teacher-material-card__actions">
            ${
              material.file_id
                ? `<button class="material-link" type="button" data-open-file="${material.file_id}">Abrir arquivo</button>`
                : `<a class="material-link" href="${escapeHtml(material.url)}" target="_blank" rel="noreferrer">Abrir material</a>`
            }
            <button class="secondary-button" type="button" data-edit-material="${material.id}">Editar</button>
            <button class="danger-button" type="button" data-delete-material="${material.id}">Excluir</button>
          </div>
        </article>
      `
    )
    .join("");

  materialList.querySelectorAll("[data-open-file]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await window.EnglishStudioFiles.openFile(button.dataset.openFile, getAdminToken());
      } catch (error) {
        setMaterialMessage(error.message, "error");
      }
    });
  });

  materialList.querySelectorAll("[data-edit-material]").forEach((button) => {
    button.addEventListener("click", () => startEditingMaterial(button.dataset.editMaterial));
  });

  materialList.querySelectorAll("[data-delete-material]").forEach((button) => {
    button.addEventListener("click", () => deleteMaterial(button.dataset.deleteMaterial));
  });
}

function resetForm() {
  state.editingId = null;
  state.selectedFile = null;
  state.existingFile = null;
  materialForm.reset();
  formTitle.textContent = "Enviar material";
  submitButton.textContent = "Enviar material";
  submitButton.disabled = false;
  cancelEditButton.hidden = true;
  syncMaterialType();
}

function startEditingMaterial(materialId) {
  const material = state.materials.find((item) => item.id === materialId);

  if (!material) {
    return;
  }

  state.editingId = material.id;
  state.selectedFile = null;
  state.existingFile = material.file_id
    ? {
        id: material.file_id,
        name: material.file_name,
        size: Number(material.size_bytes) || 0,
        materialType: material.type,
      }
    : null;
  materialForm.elements.student_id.value = material.student_id;
  materialForm.elements.title.value = material.title;
  materialForm.elements.description.value = material.description || "";
  materialForm.elements.type.value = material.type;
  materialForm.elements.url.value = material.url || "";
  syncMaterialType({ preserveExisting: true });

  if (!material.file_id) {
    setSourceMode("link");
    materialForm.elements.url.value = material.url || "";
  }

  formTitle.textContent = "Editar material";
  submitButton.textContent = "Salvar alterações";
  cancelEditButton.hidden = false;
  setMaterialMessage("");
  materialForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getBasePayload() {
  const formData = new FormData(materialForm);

  return {
    student_id: formData.get("student_id"),
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    type: formData.get("type"),
  };
}

async function saveMaterial(event) {
  event.preventDefault();

  if (!materialForm.reportValidity()) {
    return;
  }

  const payload = getBasePayload();
  const token = getAdminToken();
  let newUploadId = null;

  if (!payload.title) {
    materialForm.elements.title.focus();
    setMaterialMessage("Informe o título do material.", "error");
    return;
  }

  try {
    submitButton.disabled = true;

    if (state.sourceMode === "file") {
      if (state.selectedFile) {
        submitButton.textContent = "Enviando arquivo...";
        const uploadedFile = await window.EnglishStudioFiles.uploadFile(
          state.selectedFile,
          payload.type,
          token
        );
        newUploadId = uploadedFile.file_id;
        payload.uploaded_file_id = newUploadId;
      } else if (state.existingFile) {
        payload.uploaded_file_id = state.existingFile.id;
      } else {
        throw new Error("Selecione um arquivo para enviar.");
      }
    } else {
      const url = materialUrlInput.value.trim();

      try {
        const parsedUrl = new URL(url);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          throw new Error();
        }
      } catch (error) {
        materialUrlInput.focus();
        throw new Error("Informe uma URL válida iniciada por http:// ou https://.");
      }

      payload.url = url;
    }

    submitButton.textContent = state.editingId ? "Salvando..." : "Enviando...";
    const path = state.editingId ? `/teacher/materials/${state.editingId}` : "/teacher/materials";
    const method = state.editingId ? "PATCH" : "POST";
    const material = await fetchTeacherApi(path, {
      method,
      body: JSON.stringify(payload),
    });

    if (state.editingId) {
      state.materials = state.materials.map((item) => (item.id === material.id ? material : item));
      resetForm();
      setMaterialMessage("Material atualizado com sucesso.", "success");
    } else {
      state.materials = [material, ...state.materials];
      resetForm();
      setMaterialMessage("Arquivo anexado e material enviado com sucesso.", "success");
    }

    renderMaterials();
  } catch (error) {
    if (newUploadId) {
      await window.EnglishStudioFiles.cancelUpload(newUploadId, token).catch(() => {});
    }

    console.error("Erro ao salvar material:", error);
    setMaterialMessage(error.message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = state.editingId ? "Salvar alterações" : "Enviar material";
  }
}

async function deleteMaterial(materialId) {
  try {
    await fetchTeacherApi(`/teacher/materials/${materialId}`, {
      method: "DELETE",
    });

    state.materials = state.materials.filter((material) => material.id !== materialId);
    setMaterialMessage("Material excluído.", "success");

    if (state.editingId === materialId) {
      resetForm();
    }

    renderMaterials();
  } catch (error) {
    console.error("Erro ao excluir material:", error);
    setMaterialMessage(error.message, "error");
  }
}

async function loadStudents() {
  state.students = await fetchTeacherApi("/students");
  renderStudentOptions();
}

async function loadMaterials() {
  state.materials = await fetchTeacherApi("/teacher/materials");
  renderMaterials();
}

async function init() {
  materialList.innerHTML = '<p class="materials-empty">Carregando materiais...</p>';
  syncMaterialType();

  try {
    await Promise.all([loadStudents(), loadMaterials()]);
  } catch (error) {
    console.error("Erro ao iniciar materiais:", error);
    setMaterialMessage(error.message, "error");
    materialList.innerHTML = '<p class="materials-empty">Não foi possível carregar os materiais.</p>';
  }
}

materialForm.addEventListener("submit", saveMaterial);
materialTypeSelect.addEventListener("change", () => syncMaterialType());
materialSourceButtons.forEach((button) => {
  button.addEventListener("click", () => setSourceMode(button.dataset.materialSource));
});

materialFileInput.addEventListener("change", () => {
  const [file] = materialFileInput.files;

  try {
    state.selectedFile = window.EnglishStudioFiles.validateFile(file, materialTypeSelect.value);
    state.existingFile = null;
    renderSelectedFile();
    setMaterialMessage("Arquivo selecionado e pronto para envio.", "success");
  } catch (error) {
    state.selectedFile = null;
    renderSelectedFile();
    setMaterialMessage(error.message, "error");
  }
});

removeSelectedFileButton.addEventListener("click", () => {
  state.selectedFile = null;
  state.existingFile = null;
  renderSelectedFile();
  setMaterialMessage("Arquivo removido.");
});

cancelEditButton.addEventListener("click", () => {
  resetForm();
  setMaterialMessage("");
});

filterStudent.addEventListener("change", renderMaterials);
adminLogoutButton.addEventListener("click", () => {
  window.EnglishStudioAuth?.logout("teacher");
});

if (requireTeacherSession()) {
  init();
}
