const API_BASE_URL = "";
const ADMIN_TOKEN_KEY = "englishStudioAdminToken";
const ADMIN_USER_KEY = "englishStudioAdminUser";

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
};

function getAdminToken() {
  return window.EnglishStudioAuth?.getSession("teacher")?.token || "";
}

function getAdminUser() {
  return window.EnglishStudioAuth?.getSession("teacher")?.user || null;
}

function getTokenPayload(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (error) {
    return null;
  }
}

function isTeacherTokenValid(token) {
  const payload = getTokenPayload(token);
  const expiresAt = payload?.exp ? payload.exp * 1000 : 0;

  return Boolean(payload?.role === "teacher" && expiresAt > Date.now());
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

    throw new Error(data.error || "Nao foi possivel validar sua sessao. Tente novamente.");
  }

  if (response.status === 403) {
    throw new Error("Sua conta nao tem permissao para acessar este recurso.");
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

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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
  const selectedStudentId = filterStudent.value;

  if (!selectedStudentId) {
    return state.materials;
  }

  return state.materials.filter((material) => material.student_id === selectedStudentId);
}

function renderMaterials() {
  const materials = getVisibleMaterials();

  if (!materials.length) {
    materialList.innerHTML = `
      <p class="materials-empty">Nenhum material enviado para este filtro.</p>
    `;
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
            <span>Tipo: <strong>${materialTypes[material.type] || "Material"}</strong></span>
          </div>
          <div class="teacher-material-card__actions">
            <a class="material-link" href="${escapeHtml(material.url)}" target="_blank" rel="noreferrer">
              Abrir material
            </a>
            <button class="secondary-button" type="button" data-edit-material="${material.id}">Editar</button>
            <button class="danger-button" type="button" data-delete-material="${material.id}">Excluir</button>
          </div>
        </article>
      `
    )
    .join("");

  materialList.querySelectorAll("[data-edit-material]").forEach((button) => {
    button.addEventListener("click", () => startEditingMaterial(button.dataset.editMaterial));
  });

  materialList.querySelectorAll("[data-delete-material]").forEach((button) => {
    button.addEventListener("click", () => deleteMaterial(button.dataset.deleteMaterial));
  });
}

function resetForm() {
  state.editingId = null;
  materialForm.reset();
  formTitle.textContent = "Enviar material";
  submitButton.textContent = "Enviar material";
  cancelEditButton.hidden = true;
}

function startEditingMaterial(materialId) {
  const material = state.materials.find((item) => item.id === materialId);

  if (!material) {
    return;
  }

  state.editingId = material.id;
  materialForm.elements.student_id.value = material.student_id;
  materialForm.elements.title.value = material.title;
  materialForm.elements.description.value = material.description || "";
  materialForm.elements.type.value = material.type;
  materialForm.elements.url.value = material.url;
  formTitle.textContent = "Editar material";
  submitButton.textContent = "Salvar alterações";
  cancelEditButton.hidden = false;
  setMaterialMessage("");
  materialForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getFormPayload() {
  const formData = new FormData(materialForm);

  return {
    student_id: formData.get("student_id"),
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    url: formData.get("url"),
  };
}

async function saveMaterial(event) {
  event.preventDefault();

  if (!materialForm.reportValidity()) {
    return;
  }

  const payload = getFormPayload();
  const path = state.editingId ? `/teacher/materials/${state.editingId}` : "/teacher/materials";
  const method = state.editingId ? "PATCH" : "POST";

  try {
    const material = await fetchTeacherApi(path, {
      method,
      body: JSON.stringify(payload),
    });

    if (state.editingId) {
      state.materials = state.materials.map((item) => (item.id === material.id ? material : item));
      setMaterialMessage("Material atualizado com sucesso.", "success");
    } else {
      state.materials = [material, ...state.materials];
      setMaterialMessage("Material enviado com sucesso.", "success");
    }

    resetForm();
    renderMaterials();
  } catch (error) {
    console.error("Erro ao salvar material:", error);
    setMaterialMessage(error.message, "error");
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

  try {
    await Promise.all([loadStudents(), loadMaterials()]);
  } catch (error) {
    console.error("Erro ao iniciar materiais:", error);
    setMaterialMessage(error.message, "error");
    materialList.innerHTML = '<p class="materials-empty">Não foi possível carregar os materiais.</p>';
  }
}

materialForm.addEventListener("submit", saveMaterial);

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
