const API_BASE_URL = "http://localhost:3000";
const ADMIN_TOKEN_KEY = "englishStudioAdminToken";
const ADMIN_USER_KEY = "englishStudioAdminUser";

const adminGreeting = document.querySelector("[data-admin-greeting]");
const adminLogoutButton = document.querySelector("[data-admin-logout]");
const metricsContainer = document.querySelector("[data-metrics]");
const assignmentList = document.querySelector("[data-assignment-list]");
const detailPanel = document.querySelector("[data-detail-panel]");
const statusFilter = document.querySelector("[data-status-filter]");

const materialTypes = {
  link: { label: "Link externo", icon: "URL" },
  docs: { label: "Google Docs", icon: "DOC" },
  pdf: { label: "PDF", icon: "PDF" },
  audio: { label: "Áudio", icon: "AUD" },
  video: { label: "Vídeo", icon: "VID" },
};

const activityState = {
  items: [],
  selectedId: null,
  message: "",
};

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
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

  clearAdminSession();
  window.location.href = "admin-login.html";
  return false;
}

function redirectToLogin() {
  clearAdminSession();
  window.location.href = "admin-login.html";
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

function getFilteredAssignments() {
  const status = statusFilter.value;

  if (status === "all") {
    return activityState.items;
  }

  return activityState.items.filter((item) => item.status === status);
}

function replaceAssignment(updatedAssignment) {
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

function renderAssignments() {
  const assignments = getFilteredAssignments();

  renderMetrics();

  if (!assignments.length) {
    assignmentList.innerHTML = `
      <article class="empty-state">
        <span class="status status--pending">Sem registros</span>
        <h3>Nenhuma atividade encontrada</h3>
        <p>Quando uma atividade for enviada a um aluno, ela aparecerá nesta fila.</p>
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
      openAssignment(button.dataset.assignmentId);
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
  activityState.selectedId = assignmentId;
  renderAssignments();

  detailPanel.innerHTML = `
    <span class="panel-label">Carregando</span>
    <h2>Buscando detalhes</h2>
    <p>Estamos abrindo a atividade selecionada.</p>
  `;

  try {
    const assignment = await fetchAdminApi(`/teacher/activities/${assignmentId}`);
    replaceAssignment(assignment);
    renderAssignments();
    renderDetail(assignment);
  } catch (error) {
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

  if (!activityState.selectedId) {
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

async function loadAssignments() {
  assignmentList.innerHTML = `
    <article class="empty-state">
      <span class="status status--in-progress">Carregando</span>
      <h3>Buscando atividades</h3>
      <p>Aguarde enquanto carregamos a fila de acompanhamento.</p>
    </article>
  `;

  try {
    activityState.items = await fetchAdminApi("/teacher/activities");
    renderAssignments();

    if (activityState.items.length) {
      openAssignment(activityState.items[0].assignment_id);
    }
  } catch (error) {
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

statusFilter.addEventListener("change", renderAssignments);

adminLogoutButton.addEventListener("click", () => {
  clearAdminSession();
  window.location.href = "admin-login.html";
});

if (requireTeacherSession()) {
  loadAssignments();
}
