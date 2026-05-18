const API_BASE_URL = "http://localhost:3000";
const ADMIN_TOKEN_KEY = "englishStudioAdminToken";
const ADMIN_USER_KEY = "englishStudioAdminUser";
const SELECTED_STUDENT_KEY = "englishStudioSelectedStudentId";

const adminGreeting = document.querySelector("[data-admin-greeting]");
const adminLogoutButton = document.querySelector("[data-admin-logout]");
const metricsContainer = document.querySelector("[data-metrics]");
const assignmentList = document.querySelector("[data-assignment-list]");
const detailPanel = document.querySelector("[data-detail-panel]");
const statusFilter = document.querySelector("[data-status-filter]");
const studentFilter = document.querySelector("[data-student-filter]");
const studentFilterStatus = document.querySelector("[data-student-filter-status]");
const pedagogicalProfilePanel = document.querySelector("[data-pedagogical-profile]");

const materialTypes = {
  link: { label: "Link externo", icon: "URL" },
  docs: { label: "Google Docs", icon: "DOC" },
  pdf: { label: "PDF", icon: "PDF" },
  audio: { label: "Áudio", icon: "AUD" },
  video: { label: "Vídeo", icon: "VID" },
};

const activityState = {
  items: [],
  students: [],
  selectedId: null,
  selectedStudentId: localStorage.getItem(SELECTED_STUDENT_KEY) || "",
  message: "",
  loadVersion: 0,
  detailVersion: 0,
  profileVersion: 0,
};

const skillRatings = [
  { key: "speaking_rating", label: "Speaking" },
  { key: "listening_rating", label: "Listening" },
  { key: "writing_rating", label: "Writing" },
  { key: "reading_rating", label: "Reading" },
];

const feedbackProfileState = {
  profile: null,
  isLoading: false,
  message: "",
};

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function clearAdminSession() {
  window.EnglishStudioAuth?.clearSession();
}

function getAdminUser() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_USER_KEY));
  } catch (error) {
    return null;
  }
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
  const token = getAdminToken();
  const user = getAdminUser();

  if (token && user?.role === "teacher" && isTeacherTokenValid(token)) {
    adminGreeting.textContent = `Conectada como ${user.name}. Acompanhe entregas e registre feedbacks dos alunos.`;
    return true;
  }

  window.EnglishStudioAuth?.logout();
  return false;
}

function redirectToLogin() {
  window.EnglishStudioAuth?.logout();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function fetchAdminApi(path, options = {}) {
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

  if (response.status === 401 || response.status === 403) {
    redirectToLogin();
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Não foi possível concluir a ação.");
  }

  return data;
}

function getStatusLabel(status) {
  const labels = {
    pending: "Pendente",
    in_progress: "Em andamento",
    completed: "Concluída",
    reviewed: "Corrigida",
  };

  return labels[status] || "Pendente";
}

function getStatusClass(status) {
  return String(status || "pending").replaceAll("_", "-");
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

function summarizeText(text, maxLength = 118) {
  if (!text || text.length <= maxLength) {
    return text || "";
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function getSelectedStudent() {
  return activityState.students.find((student) => student.id === activityState.selectedStudentId);
}

function getEmptyFeedbackProfile() {
  return {
    student_id: activityState.selectedStudentId,
    speaking_rating: 0,
    listening_rating: 0,
    writing_rating: 0,
    reading_rating: 0,
    teacher_comment: "",
    updated_at: null,
  };
}

function normalizeFeedbackProfile(profile) {
  return {
    ...getEmptyFeedbackProfile(),
    ...(profile || {}),
  };
}

function normalizeAssignments(assignments) {
  if (!Array.isArray(assignments)) {
    return [];
  }

  return assignments.filter((assignment) => {
    if (!assignment || !isUuid(assignment.assignment_id) || !isUuid(assignment.student_id)) {
      return false;
    }

    return assignment.student_id === activityState.selectedStudentId;
  });
}

function setDetailPlaceholder(title = "Selecione uma atividade", text = "Ao abrir uma atividade, os materiais, status do aluno e campos de correção aparecem aqui.") {
  detailPanel.innerHTML = `
    <span class="panel-label">Detalhes</span>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(text)}</p>
  `;
}

function renderStudentFilter() {
  if (!activityState.students.length) {
    studentFilter.disabled = true;
    studentFilter.innerHTML = '<option value="">Nenhum aluno cadastrado</option>';
    studentFilterStatus.textContent = "Cadastre um aluno para iniciar o acompanhamento pedagógico.";
    return;
  }

  studentFilter.disabled = false;
  studentFilter.innerHTML = activityState.students
    .map((student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`)
    .join("");
  studentFilter.value = activityState.selectedStudentId;

  const selectedStudent = getSelectedStudent();
  studentFilterStatus.textContent = selectedStudent
    ? `Mostrando atividades de ${selectedStudent.name}.`
    : "Selecione um aluno para visualizar as atividades.";
}

function getFilteredAssignments() {
  const status = statusFilter.value;

  if (status === "all") {
    return activityState.items;
  }

  return activityState.items.filter((item) => item.status === status);
}

function replaceAssignment(updatedAssignment) {
  if (!updatedAssignment || !isUuid(updatedAssignment.assignment_id)) {
    return;
  }

  activityState.items = activityState.items.map((assignment) =>
    assignment.assignment_id === updatedAssignment.assignment_id ? updatedAssignment : assignment
  );
}

function renderMetrics() {
  const totals = activityState.items.reduce(
    (accumulator, assignment) => {
      accumulator.total += 1;
      accumulator[assignment.status] = (accumulator[assignment.status] || 0) + 1;
      return accumulator;
    },
    { total: 0, pending: 0, in_progress: 0, completed: 0, reviewed: 0 }
  );

  metricsContainer.innerHTML = `
    <article class="metric-card">
      <span class="panel-label">Total</span>
      <strong>${totals.total}</strong>
    </article>
    <article class="metric-card">
      <span class="panel-label">Em andamento</span>
      <strong>${totals.in_progress}</strong>
    </article>
    <article class="metric-card">
      <span class="panel-label">Concluídas</span>
      <strong>${totals.completed}</strong>
    </article>
    <article class="metric-card metric-card--reviewed">
      <span class="panel-label">Corrigidas</span>
      <strong>${totals.reviewed}</strong>
    </article>
  `;
}

function renderRatingButtons(field, currentValue, label) {
  return Array.from({ length: 5 }, (_, index) => {
    const value = index + 1;
    const isActive = value <= Number(currentValue || 0);

    return `
      <button
        class="profile-star ${isActive ? "is-active" : ""}"
        type="button"
        data-profile-rating="${field}"
        data-rating-value="${value}"
        aria-label="${escapeHtml(label)} ${value} de 5 estrelas"
      >
        ${isActive ? "★" : "☆"}
      </button>
    `;
  }).join("");
}

function renderPedagogicalProfile() {
  if (!pedagogicalProfilePanel) {
    return;
  }

  const selectedStudent = getSelectedStudent();

  if (!activityState.selectedStudentId) {
    pedagogicalProfilePanel.innerHTML = `
      <span class="panel-label">Perfil pedagÃ³gico do aluno</span>
      <h2>Feedback geral</h2>
      <p>Selecione um aluno para editar estrelas, evoluÃ§Ã£o semanal e observaÃ§Ãµes gerais.</p>
    `;
    return;
  }

  if (feedbackProfileState.isLoading) {
    pedagogicalProfilePanel.innerHTML = `
      <span class="panel-label">Perfil pedagÃ³gico do aluno</span>
      <h2>Carregando feedback geral</h2>
      <p>Buscando o perfil pedagÃ³gico de ${escapeHtml(selectedStudent?.name || "este aluno")}.</p>
    `;
    return;
  }

  const profile = normalizeFeedbackProfile(feedbackProfileState.profile);

  pedagogicalProfilePanel.innerHTML = `
    <form class="pedagogical-profile-form" data-pedagogical-profile-form>
      <div class="pedagogical-profile-heading">
        <div>
          <span class="panel-label">Perfil pedagÃ³gico do aluno</span>
          <h2>Feedback geral de ${escapeHtml(selectedStudent?.name || "aluno")}</h2>
          <p>EvoluÃ§Ã£o semanal, habilidades e comentÃ¡rios gerais separados das atividades especÃ­ficas.</p>
        </div>
        ${
          profile.updated_at
            ? `<small>Atualizado em ${formatDate(profile.updated_at)}</small>`
            : "<small>Ainda nÃ£o salvo</small>"
        }
      </div>

      <div class="profile-rating-grid" aria-label="Habilidades do aluno">
        ${skillRatings
          .map(
            (skill) => `
              <div class="profile-rating-row">
                <span>${skill.label}</span>
                <div class="profile-stars">
                  ${renderRatingButtons(skill.key, profile[skill.key], skill.label)}
                </div>
              </div>
            `
          )
          .join("")}
      </div>

      <label class="field profile-comment-field">
        <span>ComentÃ¡rio geral da professora</span>
        <textarea
          name="teacher_comment"
          data-profile-comment
          rows="5"
          placeholder="Ex: Aluno evoluiu bastante em conversaÃ§Ã£o esta semana. Demonstrou dificuldade em interpretaÃ§Ã£o de textos longos."
        >${escapeHtml(profile.teacher_comment)}</textarea>
      </label>

      ${feedbackProfileState.message ? `<p class="dashboard-message">${escapeHtml(feedbackProfileState.message)}</p>` : ""}
      <button class="publish-button" type="submit">Salvar feedback geral</button>
    </form>
  `;

  pedagogicalProfilePanel.querySelectorAll("[data-profile-rating]").forEach((button) => {
    button.addEventListener("click", () => {
      const comment = pedagogicalProfilePanel.querySelector("[data-profile-comment]")?.value || "";
      feedbackProfileState.profile = normalizeFeedbackProfile(feedbackProfileState.profile);
      feedbackProfileState.profile.teacher_comment = comment;
      feedbackProfileState.profile[button.dataset.profileRating] = Number(button.dataset.ratingValue);
      renderPedagogicalProfile();
    });
  });

  pedagogicalProfilePanel
    .querySelector("[data-pedagogical-profile-form]")
    ?.addEventListener("submit", savePedagogicalProfile);
}

function renderAssignments() {
  const assignments = getFilteredAssignments();
  const selectedStudent = getSelectedStudent();

  renderMetrics();

  if (!activityState.selectedStudentId) {
    assignmentList.innerHTML = `
      <article class="empty-state">
        <span class="status status--pending">Seleção</span>
        <h3>Selecione um aluno</h3>
        <p>Escolha um aluno no topo da página para visualizar atividades, progresso e correções.</p>
      </article>
    `;
    return;
  }

  if (!assignments.length) {
    assignmentList.innerHTML = `
      <article class="empty-state">
        <span class="status status--pending">Sem registros</span>
        <h3>Nenhuma atividade encontrada para este aluno.</h3>
        <p>Quando uma atividade for enviada para ${escapeHtml(selectedStudent?.name || "este aluno")}, ela aparecerá nesta fila.</p>
      </article>
    `;
    return;
  }

  assignmentList.innerHTML = `
    ${activityState.message ? `<p class="dashboard-message">${escapeHtml(activityState.message)}</p>` : ""}
    ${assignments
      .map((assignment) => {
        const isSelected = assignment.assignment_id === activityState.selectedId;
        const statusLabel = getStatusLabel(assignment.status);

        return `
          <button
            class="assignment-row ${isSelected ? "active" : ""}"
            type="button"
            data-assignment-id="${assignment.assignment_id}"
          >
            <span class="status status--${getStatusClass(assignment.status)}">${statusLabel}</span>
            <span class="assignment-row__main">
              <strong>${escapeHtml(assignment.title)}</strong>
              <small>${escapeHtml(assignment.student_name)} · ${escapeHtml(summarizeText(assignment.description))}</small>
            </span>
            <span class="assignment-row__meta">
              <span>Prazo <strong>${formatDate(assignment.deadline)}</strong></span>
              <span>Materiais <strong>${assignment.material_count || assignment.materials?.length || 0}</strong></span>
              <span>Conclusão <strong>${assignment.completed_at ? formatDate(assignment.completed_at) : "Não concluída"}</strong></span>
            </span>
          </button>
        `;
      })
      .join("")}
  `;

  assignmentList.querySelectorAll("[data-assignment-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const assignmentId = button.dataset.assignmentId;

      if (isUuid(assignmentId)) {
        openAssignment(assignmentId);
      }
    });
  });
}

function renderMaterials(materials = []) {
  if (!materials.length) {
    return `<p class="muted-text">Nenhum material foi anexado a esta atividade.</p>`;
  }

  return `
    <div class="material-list">
      ${materials
        .map((material) => {
          const type = materialTypes[material.type] || { label: "Material", icon: "MAT" };

          return `
            <article class="material-item">
              <span class="material-item__icon material-item__icon--${escapeHtml(material.type)}">${type.icon}</span>
              <span class="material-item__content">
                <strong>${escapeHtml(material.title)}</strong>
                <small>${type.label}</small>
              </span>
              <a href="${escapeHtml(material.url)}" target="_blank" rel="noreferrer">Abrir</a>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderDetail(assignment) {
  const statusLabel = getStatusLabel(assignment.status);

  detailPanel.innerHTML = `
    <form class="review-form" data-review-form>
      <div class="detail-heading">
        <span class="status status--${getStatusClass(assignment.status)}">${statusLabel}</span>
        <h2>${escapeHtml(assignment.title)}</h2>
        <p>${escapeHtml(assignment.student_name)} · prazo em ${formatDate(assignment.deadline)}</p>
      </div>

      <section class="detail-section">
        <span class="panel-label">Descrição</span>
        <p>${escapeHtml(assignment.description)}</p>
      </section>

      <section class="detail-grid">
        <article>
          <span class="panel-label">Status do aluno</span>
          <strong>${statusLabel}</strong>
          <small>${assignment.completed_at ? `Concluída em ${formatDate(assignment.completed_at)}` : "Ainda não concluída"}</small>
        </article>
        <article>
          <span class="panel-label">Pontuação</span>
          <strong>${assignment.points} pontos</strong>
          <small>${assignment.teacher_grade === null || assignment.teacher_grade === undefined ? "Sem nota" : `Nota ${assignment.teacher_grade}`}</small>
        </article>
      </section>

      <section class="detail-section">
        <span class="panel-label">Materiais externos</span>
        ${renderMaterials(assignment.materials)}
      </section>

      <section class="correction-box">
        <span class="panel-label">Correção</span>
        <label class="field">
          <span>Resumo da professora</span>
          <textarea name="teacher_summary" rows="4" placeholder="Resumo pedagógico da entrega">${escapeHtml(
            assignment.teacher_summary
          )}</textarea>
        </label>

        <label class="field">
          <span>Feedback / correção</span>
          <textarea name="teacher_feedback" rows="6" placeholder="Correções, pontos fortes e próximos passos">${escapeHtml(
            assignment.teacher_feedback
          )}</textarea>
        </label>

        <label class="field">
          <span>Nota</span>
          <input
            type="number"
            name="teacher_grade"
            min="0"
            step="1"
            value="${assignment.teacher_grade ?? ""}"
            placeholder="Ex: 85"
          />
        </label>

        <label class="field">
          <span>Observações</span>
          <textarea name="teacher_observations" rows="3" placeholder="Observações internas ou combinados">${escapeHtml(
            assignment.teacher_observations
          )}</textarea>
        </label>

        <button class="publish-button" type="submit">Salvar correção e marcar como corrigida</button>
      </section>
    </form>
  `;

  detailPanel.querySelector("[data-review-form]").addEventListener("submit", saveReview);
}

async function openAssignment(assignmentId) {
  if (!isUuid(assignmentId)) {
    setDetailPlaceholder("Atividade indisponível", "Não foi possível abrir os detalhes desta atividade.");
    return;
  }

  const localDetailVersion = ++activityState.detailVersion;
  const studentIdAtRequestStart = activityState.selectedStudentId;

  activityState.selectedId = assignmentId;
  renderAssignments();

  detailPanel.innerHTML = `
    <span class="panel-label">Carregando</span>
    <h2>Buscando detalhes</h2>
    <p>Estamos abrindo a atividade selecionada.</p>
  `;

  try {
    const assignment = await fetchAdminApi(`/teacher/activities/${assignmentId}`);

    if (
      localDetailVersion !== activityState.detailVersion ||
      studentIdAtRequestStart !== activityState.selectedStudentId
    ) {
      return;
    }

    if (!assignment || assignment.student_id !== activityState.selectedStudentId) {
      setDetailPlaceholder("Atividade indisponível", "A atividade selecionada não pertence ao aluno em acompanhamento.");
      return;
    }

    replaceAssignment(assignment);
    renderAssignments();
    renderDetail(assignment);
  } catch (error) {
    if (
      localDetailVersion !== activityState.detailVersion ||
      studentIdAtRequestStart !== activityState.selectedStudentId
    ) {
      return;
    }

    console.error("Erro ao abrir atividade:", error);
    detailPanel.innerHTML = `
      <span class="panel-label">Erro</span>
      <h2>Detalhes indisponíveis</h2>
      <p>${escapeHtml(error.message)}</p>
    `;
  }
}

async function saveReview(event) {
  event.preventDefault();

  if (!isUuid(activityState.selectedId)) {
    return;
  }

  const formData = new FormData(event.currentTarget);
  const payload = {
    teacher_summary: formData.get("teacher_summary"),
    teacher_feedback: formData.get("teacher_feedback"),
    teacher_grade: formData.get("teacher_grade"),
    teacher_observations: formData.get("teacher_observations"),
  };

  try {
    const updatedAssignment = await fetchAdminApi(`/teacher/activities/${activityState.selectedId}/review`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    replaceAssignment(updatedAssignment);
    activityState.message = "Correção salva e atividade marcada como corrigida.";
    renderAssignments();
    renderDetail(updatedAssignment);

    window.setTimeout(() => {
      activityState.message = "";
      renderAssignments();
    }, 2800);
  } catch (error) {
    console.error("Erro ao salvar correção:", error);
    activityState.message = error.message;
    renderAssignments();
  }
}

async function savePedagogicalProfile(event) {
  event.preventDefault();

  if (!isUuid(activityState.selectedStudentId)) {
    return;
  }

  const profile = normalizeFeedbackProfile(feedbackProfileState.profile);
  const formData = new FormData(event.currentTarget);
  const payload = {
    speaking_rating: profile.speaking_rating,
    listening_rating: profile.listening_rating,
    writing_rating: profile.writing_rating,
    reading_rating: profile.reading_rating,
    teacher_comment: formData.get("teacher_comment"),
  };

  try {
    const updatedProfile = await fetchAdminApi(
      `/students/${activityState.selectedStudentId}/feedback-profile`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );

    feedbackProfileState.profile = normalizeFeedbackProfile(updatedProfile);
    feedbackProfileState.message = "Feedback geral salvo com sucesso.";
    renderPedagogicalProfile();

    window.setTimeout(() => {
      feedbackProfileState.message = "";
      renderPedagogicalProfile();
    }, 2800);
  } catch (error) {
    console.error("Erro ao salvar feedback geral:", error);
    feedbackProfileState.message = error.message;
    renderPedagogicalProfile();
  }
}

async function loadPedagogicalProfile() {
  const localProfileVersion = ++activityState.profileVersion;
  feedbackProfileState.profile = null;
  feedbackProfileState.message = "";
  feedbackProfileState.isLoading = Boolean(activityState.selectedStudentId);
  renderPedagogicalProfile();

  if (!activityState.selectedStudentId) {
    feedbackProfileState.isLoading = false;
    renderPedagogicalProfile();
    return;
  }

  try {
    const profile = await fetchAdminApi(
      `/students/${activityState.selectedStudentId}/feedback-profile`
    );

    if (localProfileVersion !== activityState.profileVersion) {
      return;
    }

    feedbackProfileState.profile = normalizeFeedbackProfile(profile);
  } catch (error) {
    if (localProfileVersion !== activityState.profileVersion) {
      return;
    }

    console.error("Erro ao carregar feedback geral:", error);
    feedbackProfileState.message = error.message;
  } finally {
    if (localProfileVersion === activityState.profileVersion) {
      feedbackProfileState.isLoading = false;
      renderPedagogicalProfile();
    }
  }
}

async function loadAssignments() {
  const localLoadVersion = ++activityState.loadVersion;
  activityState.detailVersion += 1;
  activityState.items = [];
  activityState.selectedId = null;
  activityState.message = "";
  renderMetrics();

  if (!activityState.selectedStudentId) {
    renderAssignments();
    setDetailPlaceholder();
    return;
  }

  const selectedStudent = getSelectedStudent();

  assignmentList.innerHTML = `
    <article class="empty-state">
      <span class="status status--in-progress">Carregando</span>
      <h3>Buscando atividades</h3>
      <p>Aguarde enquanto carregamos a fila de ${escapeHtml(selectedStudent?.name || "este aluno")}.</p>
    </article>
  `;
  setDetailPlaceholder("Carregando acompanhamento", "As atividades do aluno selecionado estão sendo carregadas.");

  try {
    const assignments = await fetchAdminApi(`/activities?studentId=${encodeURIComponent(activityState.selectedStudentId)}`);

    if (localLoadVersion !== activityState.loadVersion) {
      return;
    }

    activityState.items = normalizeAssignments(assignments);
    renderAssignments();

    if (activityState.items.length) {
      openAssignment(activityState.items[0].assignment_id);
    } else {
      setDetailPlaceholder();
    }
  } catch (error) {
    if (localLoadVersion !== activityState.loadVersion) {
      return;
    }

    console.error("Erro ao carregar atividades:", error);
    assignmentList.innerHTML = `
      <article class="empty-state">
        <span class="status status--pending">Erro</span>
        <h3>Atividades indisponíveis</h3>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

async function loadStudents() {
  studentFilter.disabled = true;
  studentFilter.innerHTML = '<option value="">Carregando alunos...</option>';
  studentFilterStatus.textContent = "Carregando alunos cadastrados...";
  renderMetrics();

  try {
    activityState.students = await fetchAdminApi("/students");

    if (!activityState.students.length) {
      activityState.selectedStudentId = "";
      localStorage.removeItem(SELECTED_STUDENT_KEY);
      renderStudentFilter();
      await loadPedagogicalProfile();
      renderAssignments();
      setDetailPlaceholder("Nenhum aluno cadastrado", "Cadastre alunos para acompanhar atividades e feedbacks.");
      return;
    }

    const storedStudentIsValid = activityState.students.some(
      (student) => student.id === activityState.selectedStudentId
    );

    if (!storedStudentIsValid) {
      activityState.selectedStudentId = activityState.students[0].id;
      localStorage.setItem(SELECTED_STUDENT_KEY, activityState.selectedStudentId);
    }

    renderStudentFilter();
    await Promise.all([loadPedagogicalProfile(), loadAssignments()]);
  } catch (error) {
    console.error("Erro ao carregar alunos:", error);
    activityState.students = [];
    activityState.selectedStudentId = "";
    feedbackProfileState.profile = null;
    feedbackProfileState.message = "";
    feedbackProfileState.isLoading = false;
    studentFilter.disabled = true;
    studentFilter.innerHTML = '<option value="">Erro ao carregar alunos</option>';
    studentFilterStatus.textContent = error.message;
    renderPedagogicalProfile();
    renderAssignments();
    setDetailPlaceholder("Alunos indisponíveis", error.message);
  }
}

statusFilter.addEventListener("change", renderAssignments);

studentFilter.addEventListener("change", async () => {
  activityState.selectedStudentId = studentFilter.value;
  activityState.message = "";
  activityState.selectedId = null;
  activityState.items = [];
  localStorage.setItem(SELECTED_STUDENT_KEY, activityState.selectedStudentId);
  statusFilter.value = "all";
  renderStudentFilter();
  await Promise.all([loadPedagogicalProfile(), loadAssignments()]);
});

adminLogoutButton.addEventListener("click", () => {
  window.EnglishStudioAuth?.logout();
});

if (requireTeacherSession()) {
  loadStudents();
}
