const navItems = document.querySelectorAll("[data-view-target]");
const views = document.querySelectorAll("[data-view]");
const API_BASE_URL = "";
const STUDENT_TOKEN_KEY = "englishStudioStudentToken";
const STUDENT_USER_KEY = "englishStudioStudentUser";
const studentName = document.querySelector("[data-student-name]");
const homeTitle = document.querySelector("[data-home-title]");
const logoutButton = document.querySelector("[data-student-logout]");
const today = new Date();
const scheduleState = {
  year: today.getFullYear(),
  monthIndex: today.getMonth(),
  selectedDay: today.getDate(),
  selectedSlotIndex: null,
  schedules: [],
  changeRequests: [],
  availability: [],
  message: "",
  isLoading: false,
};
const activityState = {
  items: [],
  expandedId: null,
  feedback: "",
  isLoading: false,
};
const materialState = {
  items: [],
  isLoading: false,
  message: "",
};
const feedbackProfileState = {
  profile: null,
  isLoading: false,
  message: "",
};
const skillRatings = [
  { key: "speaking_rating", label: "Speaking" },
  { key: "listening_rating", label: "Listening" },
  { key: "writing_rating", label: "Writing" },
  { key: "reading_rating", label: "Reading" },
];

function getStudentToken() {
  return window.EnglishStudioAuth?.getSession("student")?.token || "";
}

function clearStudentSession() {
  window.EnglishStudioAuth?.clearStudentSession();
}

function getStoredStudent() {
  return window.EnglishStudioAuth?.getSession("student")?.user || null;
}

function getTokenPayload(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (error) {
    return null;
  }
}

function isStudentTokenValid(token) {
  const payload = getTokenPayload(token);
  const expiresAt = payload?.exp ? payload.exp * 1000 : 0;

  return Boolean(payload?.role === "student" && expiresAt > Date.now());
}

function requireStudentSession() {
  const session = window.EnglishStudioAuth?.getSession("student");
  const user = session?.user;

  if (session?.token && user?.role === "student") {
    studentName.textContent = user.name;
    homeTitle.textContent = `Bem-vinda/o de volta, ${user.name}.`;
    return true;
  }

  redirectToLogin();
  return false;
}

function redirectToLogin() {
  window.EnglishStudioAuth?.clearStudentSession();
  window.EnglishStudioAuth?.redirectHome();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function fetchStudentApi(path, options = {}) {
  const token = getStudentToken();

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

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    if (window.EnglishStudioAuth?.handleUnauthorized("student", data)) {
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

function getActivityStatusLabel(status) {
  const labels = {
    pending: "Pendente",
    in_progress: "Em andamento",
    completed: "Concluída",
    reviewed: "Corrigida",
  };

  return labels[status] || "Pendente";
}

function getMaterialLabel(type) {
  const labels = {
    document: "Documento",
    docs: "Google Docs",
    exercise: "Exercício",
    pdf: "PDF",
    audio: "Áudio",
    video: "Vídeo",
    link: "Link externo",
    vocabulary: "Vocabulário",
  };

  return labels[type] || "Material";
}

function getMaterialIcon(type) {
  const icons = {
    document: "DOC",
    docs: "DOC",
    exercise: "EX",
    pdf: "PDF",
    audio: "AUD",
    video: "VID",
    link: "URL",
    vocabulary: "VOC",
  };

  return icons[type] || "MAT";
}

function summarizeText(text, maxLength = 132) {
  if (!text || text.length <= maxLength) {
    return text || "";
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function setActiveView(viewId) {
  views.forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });

  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.viewTarget === viewId);
  });
}

function getStatusClass(status) {
  return status
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

function getUpcomingSchedules() {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  return scheduleState.schedules
    .filter((schedule) => !["canceled", "completed"].includes(schedule.status))
    .filter((schedule) => getScheduleDateKey(schedule.class_date) >= todayKey)
    .sort((first, second) => {
      const firstKey = `${getScheduleDateKey(first.class_date)} ${formatScheduleTime(first.class_time)}`;
      const secondKey = `${getScheduleDateKey(second.class_date)} ${formatScheduleTime(second.class_time)}`;
      return firstKey.localeCompare(secondKey);
    });
}

function getPendingActivities() {
  return activityState.items.filter((activity) => ["pending", "in_progress"].includes(activity.status));
}

function getReviewedActivities() {
  return activityState.items.filter((activity) => activity.status === "reviewed");
}

function buildNotificationItems() {
  if (activityState.isLoading || scheduleState.isLoading || feedbackProfileState.isLoading) {
    return [
      {
        type: "Carregando",
        message: "Atualizando seu acompanhamento com os dados mais recentes.",
      },
    ];
  }

  const nextSchedule = getUpcomingSchedules()[0];
  const pendingActivities = getPendingActivities();
  const reviewedActivities = getReviewedActivities();
  const notifications = [];

  if (nextSchedule) {
    notifications.push({
      type: "Próxima aula",
      message: `${formatScheduleDate(nextSchedule.class_date)} às ${formatScheduleTime(nextSchedule.class_time)}.`,
    });
  }

  if (pendingActivities.length) {
    notifications.push({
      type: "Atividade pendente",
      message: `${pendingActivities.length} atividade(s) aguardando andamento ou conclusão.`,
    });
  }

  if (reviewedActivities.length) {
    notifications.push({
      type: "Correção disponível",
      message: "Você tem feedback da professora em atividades corrigidas.",
    });
  }

  if (!notifications.length) {
    notifications.push({
      type: "Tudo em dia",
      message: "Nenhuma pendência encontrada no momento.",
    });
  }

  return notifications;
}

function buildHomeCards() {
  const nextSchedule = getUpcomingSchedules()[0];
  const pendingActivities = getPendingActivities();
  const materialCount = materialState.items.length;

  return [
    {
      label: "Próxima aula",
      title: nextSchedule ? "Aula marcada" : "Sem aula futura",
      description: nextSchedule
        ? `${formatScheduleDate(nextSchedule.class_date)} às ${formatScheduleTime(nextSchedule.class_time)}`
        : "Quando uma aula for marcada, ela aparecerá aqui.",
    },
    {
      label: "Atividades",
      title: activityState.isLoading ? "Carregando" : `${pendingActivities.length} pendente(s)`,
      description: pendingActivities.length
        ? "Abra Atividades / lições para continuar seu acompanhamento."
        : "Nenhuma atividade pendente no momento.",
    },
    {
      label: "Materiais",
      title: materialState.isLoading ? "Carregando" : `${materialCount} disponível(is)`,
      description: materialCount
        ? "Conteúdos de estudo enviados pela professora estão disponíveis."
        : "Novos materiais aparecerão quando forem enviados.",
    },
  ];
}

function renderNotifications() {
  const container = document.querySelector("[data-notifications]");

  container.innerHTML = buildNotificationItems()
    .map(
      (notification) => `
        <article class="notification-card">
          <span>${escapeHtml(notification.type)}</span>
          <p>${escapeHtml(notification.message)}</p>
        </article>
      `
    )
    .join("");
}

function renderHome() {
  const container = document.querySelector("[data-home-cards]");

  container.innerHTML = buildHomeCards()
    .map(
      (card) => `
        <article class="summary-card">
          <span class="summary-card__label">${escapeHtml(card.label)}</span>
          <h3>${escapeHtml(card.title)}</h3>
          <p>${escapeHtml(card.description)}</p>
        </article>
      `
    )
    .join("");
}

function renderMaterials() {
  const container = document.querySelector("[data-materials-list]");

  if (materialState.isLoading) {
    container.innerHTML = `
      <article class="material-card">
        <span class="type-chip">Carregando</span>
        <h3>Buscando materiais</h3>
        <p>Aguarde enquanto carregamos os conteúdos enviados pela professora.</p>
      </article>
    `;
    return;
  }

  if (materialState.message) {
    container.innerHTML = `
      <article class="material-card">
        <span class="type-chip">Erro</span>
        <h3>Materiais indisponíveis</h3>
        <p>${escapeHtml(materialState.message)}</p>
      </article>
    `;
    return;
  }

  if (!materialState.items.length) {
    container.innerHTML = `
      <article class="material-card">
        <span class="type-chip">Sem materiais</span>
        <h3>Nenhum material enviado</h3>
        <p>Quando a professora compartilhar um conteúdo de estudo, ele aparecerá aqui.</p>
      </article>
    `;
    return;
  }

  container.innerHTML = materialState.items
    .map(
      (material) => `
        <article class="material-card">
          <span class="type-chip">${getMaterialLabel(material.type)}</span>
          <h3>${escapeHtml(material.title)}</h3>
          <p>${escapeHtml(material.description || "Material de apoio enviado pela professora.")}</p>
          <div class="material-card__actions">
            ${
              material.file_id
                ? `<button class="material-card__action" type="button" data-open-file="${material.file_id}">Abrir arquivo</button>`
                : ""
            }
            ${
              material.url
                ? `<a class="material-card__action" href="${escapeHtml(material.url)}" target="_blank" rel="noopener noreferrer">Abrir link</a>`
                : ""
            }
          </div>
        </article>
      `
    )
    .join("");

  setupFileButtons(container);
}

function setupFileButtons(container) {
  container.querySelectorAll("[data-open-file]").forEach((button) => {
    button.addEventListener("click", async () => {
      const originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = "Abrindo...";

      try {
        await window.EnglishStudioFiles.openFile(button.dataset.openFile, getStudentToken());
      } catch (error) {
        console.error("Erro ao abrir arquivo:", error);
        button.textContent = "Tentar novamente";
        button.title = error.message;
        window.setTimeout(() => {
          button.textContent = originalLabel;
          button.title = "";
        }, 2600);
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function loadMaterials() {
  materialState.isLoading = true;
  materialState.message = "";
  renderMaterials();

  try {
    materialState.items = await fetchStudentApi("/my-materials");
  } catch (error) {
    console.error("Erro ao carregar materiais:", error);
    materialState.items = [];
    materialState.message = error.message;
  } finally {
    materialState.isLoading = false;
    renderMaterials();
    renderHome();
    renderNotifications();
  }
}

function formatActivityDate(value) {
  if (!value) {
    return "Sem prazo";
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

function renderActivityDashboard() {
  const container = document.querySelector("[data-activity-dashboard]");

  if (!container) {
    return;
  }

  const totals = activityState.items.reduce(
    (accumulator, activity) => {
      accumulator.total += 1;
      accumulator[activity.status] = (accumulator[activity.status] || 0) + 1;
      return accumulator;
    },
    { total: 0, pending: 0, in_progress: 0, completed: 0, reviewed: 0 }
  );

  container.innerHTML = `
    <article class="activity-metric">
      <span class="panel-label">Pendentes</span>
      <strong>${totals.pending}</strong>
    </article>
    <article class="activity-metric">
      <span class="panel-label">Em andamento</span>
      <strong>${totals.in_progress}</strong>
    </article>
    <article class="activity-metric">
      <span class="panel-label">Concluídas</span>
      <strong>${totals.completed}</strong>
    </article>
    <article class="activity-metric">
      <span class="panel-label">Corrigidas</span>
      <strong>${totals.reviewed}</strong>
    </article>
  `;
}

function renderActivityMaterials(materials = []) {
  if (!materials.length) {
    return `<p class="activity-empty">Nenhum material anexado nesta atividade.</p>`;
  }

  return `
    <div class="activity-materials">
      ${materials
        .map(
          (material) => `
            <article class="attachment-item attachment-item--primary">
              <span class="attachment-item__icon attachment-item__icon--${escapeHtml(material.type)}">
                ${getMaterialIcon(material.type)}
              </span>
              <div class="attachment-item__content">
                <strong>${escapeHtml(material.title)}</strong>
                <span>${
                  material.file_name
                    ? escapeHtml(material.file_name)
                    : material.url
                      ? escapeHtml(material.url)
                      : escapeHtml(getMaterialLabel(material.type))
                }</span>
              </div>
              <div class="attachment-item__actions">
                ${
                  material.file_id
                    ? `<button class="attachment-item__action" type="button" data-open-file="${material.file_id}">Acessar arquivo</button>`
                    : ""
                }
                ${
                  material.url
                    ? `<a class="attachment-item__action" href="${escapeHtml(material.url)}" target="_blank" rel="noopener noreferrer">Abrir link</a>`
                    : ""
                }
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTeacherReview(activity) {
  if (activity.status !== "reviewed") {
    return "";
  }

  return `
    <div class="teacher-review">
      <span class="panel-label">Correção da professora</span>
      <div class="teacher-review__grid">
        <article>
          <strong>Nota</strong>
          <p>${
            activity.teacher_grade === null || activity.teacher_grade === undefined
              ? "Sem nota"
              : `${activity.teacher_grade} pontos`
          }</p>
        </article>
        <article>
          <strong>Status</strong>
          <p>Atividade corrigida</p>
        </article>
      </div>
      ${
        activity.teacher_feedback
          ? `<article><strong>Feedback / correção</strong><p>${escapeHtml(activity.teacher_feedback)}</p></article>`
          : ""
      }
    </div>
  `;
}

function renderActivityDetails(activity) {
  const isFinalized = activity.status === "completed" || activity.status === "reviewed";

  return `
    <div class="activity-details">
      <div>
        <span class="panel-label">Descrição completa</span>
        <p>${escapeHtml(activity.description)}</p>
      </div>
      <div>
        <span class="panel-label">Materiais da atividade</span>
        ${renderActivityMaterials(activity.materials)}
      </div>
      <div class="activity-actions">
        <button
          class="reschedule-button"
          type="button"
          data-complete-activity="${activity.id}"
          ${isFinalized ? "disabled" : ""}
        >
          ${
            activity.status === "reviewed"
              ? "Atividade corrigida"
              : activity.status === "completed"
                ? "Atividade concluída"
                : "Marcar como concluída"
          }
        </button>
      </div>
      ${renderTeacherReview(activity)}
    </div>
  `;
}

function renderTasks() {
  const container = document.querySelector("[data-tasks-list]");

  renderActivityDashboard();

  if (activityState.feedback) {
    window.setTimeout(() => {
      activityState.feedback = "";
      renderTasks();
    }, 2600);
  }

  if (!activityState.items.length) {
    container.innerHTML = `
      <article class="activity-card">
        <div>
          <span class="status status--disponivel">Sem atividades</span>
          <h3>Nenhuma atividade publicada</h3>
          <p>Quando a professora criar uma atividade, ela aparecerá aqui.</p>
        </div>
      </article>
    `;
    return;
  }

  container.innerHTML = `
    ${activityState.feedback ? `<p class="activity-feedback">${escapeHtml(activityState.feedback)}</p>` : ""}
    ${activityState.items
      .map((activity) => {
        const statusLabel = getActivityStatusLabel(activity.status);
        const isExpanded = activityState.expandedId === activity.id;

        return `
          <article class="activity-card activity-card--${getStatusClass(statusLabel)} ${isExpanded ? "is-expanded" : ""}">
            <div>
              <span class="status status--${getStatusClass(statusLabel)}">${statusLabel}</span>
              <h3>${escapeHtml(activity.title)}</h3>
              <p>${escapeHtml(summarizeText(activity.description))}</p>
            </div>
            <div class="activity-card__meta">
              <p><span class="panel-label">Prazo</span><strong>${formatActivityDate(activity.deadline)}</strong></p>
              <p><span class="panel-label">Pontuação</span><strong>${activity.points} pontos</strong></p>
              <p><span class="panel-label">Materiais</span><strong>${activity.materials?.length || 0} anexos</strong></p>
              <button class="reschedule-button" type="button" data-open-activity="${activity.id}">
                ${isExpanded ? "Fechar atividade" : "Ver atividade"}
              </button>
            </div>
            ${isExpanded ? renderActivityDetails(activity) : ""}
          </article>
        `;
      })
      .join("")}
  `;

  container.querySelectorAll("[data-open-activity]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleActivityDetails(button.dataset.openActivity);
    });
  });

  container.querySelectorAll("[data-complete-activity]").forEach((button) => {
    button.addEventListener("click", () => {
      completeActivity(button.dataset.completeActivity);
    });
  });

  setupFileButtons(container);
}

async function loadActivities() {
  const container = document.querySelector("[data-tasks-list]");
  activityState.isLoading = true;
  renderHome();
  renderNotifications();

  container.innerHTML = `
    <article class="activity-card">
      <div>
        <span class="status status--em-andamento">Carregando</span>
        <h3>Buscando atividades</h3>
        <p>Aguarde enquanto carregamos suas atividades.</p>
      </div>
    </article>
  `;

  try {
    activityState.items = await fetchStudentApi("/my-activities");
    renderTasks();
  } catch (error) {
    console.error("Erro ao carregar atividades do aluno:", error);
    container.innerHTML = `
      <article class="activity-card">
        <div>
          <span class="status status--pendente">Erro</span>
          <h3>Atividades indisponíveis</h3>
          <p>${escapeHtml(error.message)}</p>
        </div>
      </article>
    `;
  } finally {
    activityState.isLoading = false;
    renderHome();
    renderNotifications();
  }
}

function replaceActivity(updatedActivity) {
  activityState.items = activityState.items.map((activity) =>
    activity.id === updatedActivity.id ? updatedActivity : activity
  );
}

async function toggleActivityDetails(activityId) {
  if (activityState.expandedId === activityId) {
    activityState.expandedId = null;
    renderTasks();
    return;
  }

  const activity = activityState.items.find((item) => item.id === activityId);

  try {
    if (activity?.status === "pending") {
      const updatedActivity = await fetchStudentApi(`/my-activities/${activityId}/in-progress`, {
        method: "PATCH",
      });
      replaceActivity(updatedActivity);
    } else {
      const fullActivity = await fetchStudentApi(`/my-activities/${activityId}`);
      replaceActivity(fullActivity);
    }

    activityState.expandedId = activityId;
    renderTasks();
  } catch (error) {
    console.error("Erro ao abrir atividade:", error);
    activityState.feedback = error.message;
    renderTasks();
  }
}

async function completeActivity(activityId) {
  try {
    const updatedActivity = await fetchStudentApi(`/my-activities/${activityId}/complete`, {
      method: "PATCH",
    });

    replaceActivity(updatedActivity);
    activityState.expandedId = activityId;
    activityState.feedback = "Atividade marcada como concluída.";
    renderTasks();
  } catch (error) {
    console.error("Erro ao concluir atividade:", error);
    activityState.feedback = error.message;
    renderTasks();
  }
}

function renderStars(score) {
  return Array.from({ length: 5 }, (_, index) => (index < Number(score || 0) ? "★" : "☆")).join("");
}

function getEmptyFeedbackProfile() {
  return {
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

function renderFeedback() {
  const ratingsContainer = document.querySelector("[data-skill-ratings]");
  const feedbackContainer = document.querySelector("[data-feedback-list]");

  if (feedbackProfileState.isLoading) {
    ratingsContainer.innerHTML = `
      <span class="panel-label">Sistema de estrelas</span>
      <h3>Carregando habilidades</h3>
      <p>Buscando seu feedback geral.</p>
    `;
    feedbackContainer.innerHTML = `
      <article class="feedback-card">
        <span class="panel-label">Comentário da professora</span>
        <h3>Carregando acompanhamento</h3>
        <p>Aguarde um instante.</p>
      </article>
    `;
    return;
  }

  const profile = normalizeFeedbackProfile(feedbackProfileState.profile);

  ratingsContainer.innerHTML = `
    <span class="panel-label">Sistema de estrelas</span>
    <h3>Habilidades</h3>
    <div class="skill-list">
      ${skillRatings
        .map(
          (skill) => `
            <div class="skill-row">
              <span>${skill.label}</span>
              <strong aria-label="${profile[skill.key]} de 5 estrelas">${renderStars(profile[skill.key])}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;

  feedbackContainer.innerHTML = `
    <article class="feedback-card feedback-card--general">
      <span class="panel-label">Comentário da professora</span>
      <h3>Feedback geral</h3>
      <p>${
        profile.teacher_comment
          ? escapeHtml(profile.teacher_comment)
          : "A professora ainda não registrou um comentário geral para este acompanhamento."
      }</p>
      ${profile.updated_at ? `<time>Atualizado em ${formatActivityDate(profile.updated_at)}</time>` : ""}
      ${feedbackProfileState.message ? `<p class="feedback-message">${escapeHtml(feedbackProfileState.message)}</p>` : ""}
    </article>
  `;
}

async function loadFeedbackProfile() {
  feedbackProfileState.isLoading = true;
  feedbackProfileState.message = "";
  renderFeedback();

  try {
    feedbackProfileState.profile = await fetchStudentApi("/my-feedback-profile");
  } catch (error) {
    console.error("Erro ao carregar feedback geral:", error);
    feedbackProfileState.message = error.message;
    feedbackProfileState.profile = getEmptyFeedbackProfile();
  } finally {
    feedbackProfileState.isLoading = false;
    renderFeedback();
    renderNotifications();
  }
}

function getScheduleDateKey(value) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function getSelectedDateKey(day = scheduleState.selectedDay) {
  const month = String(scheduleState.monthIndex + 1).padStart(2, "0");
  const selectedDay = String(day).padStart(2, "0");

  return `${scheduleState.year}-${month}-${selectedDay}`;
}

function formatScheduleTime(value) {
  return String(value || "").slice(0, 5);
}

function formatScheduleDate(value) {
  const dateKey = getScheduleDateKey(value);

  if (!dateKey) {
    return "Sem data";
  }

  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

function getScheduleStatusLabel(status) {
  const labels = {
    scheduled: "Aula marcada",
    pending_change: "Solicitação enviada",
    confirmed: "Aprovada",
    canceled: "Cancelada",
    completed: "Concluída",
  };

  return labels[status] || "Aula marcada";
}

function getRequestStatusLabel(status) {
  const labels = {
    pending: "Solicitação enviada",
    approved: "Aprovada",
    rejected: "Rejeitada",
    canceled: "Cancelada",
  };

  return labels[status] || "Solicitação enviada";
}

function getMonthLabel() {
  const date = new Date(scheduleState.year, scheduleState.monthIndex, 1);

  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function getChangeSourceSchedule() {
  return scheduleState.schedules.find((schedule) => schedule.status !== "canceled");
}

function getPendingRequestForSchedule(scheduleId) {
  return scheduleState.changeRequests.find(
    (request) => request.schedule_id === scheduleId && request.status === "pending"
  );
}

function getRequestsForDate(dateKey) {
  return scheduleState.changeRequests.filter(
    (request) => getScheduleDateKey(request.requested_date) === dateKey
  );
}

function getDaySlots(day) {
  const dateKey = getSelectedDateKey(day);
  const schedules = scheduleState.schedules
    .filter((schedule) => getScheduleDateKey(schedule.class_date) === dateKey)
    .map((schedule) => ({
      kind: "class",
      id: schedule.id,
      time: formatScheduleTime(schedule.class_time),
      status: getScheduleStatusLabel(schedule.status),
      statusKey: schedule.status === "confirmed" ? "approved" : schedule.status,
      schedule,
    }));
  const requests = getRequestsForDate(dateKey).map((request) => ({
    kind: "request",
    id: request.id,
    time: formatScheduleTime(request.requested_time),
    status: getRequestStatusLabel(request.status),
    statusKey: request.status === "pending" ? "requested" : request.status,
    request,
  }));
  const occupiedTimes = new Set([
    ...schedules.map((slot) => slot.time),
    ...requests.filter((slot) => slot.request.status === "pending").map((slot) => slot.time),
  ]);
  const hasScheduleToChange = Boolean(getChangeSourceSchedule());
  const availableSlots = scheduleState.availability
    .filter((slot) => getScheduleDateKey(slot.available_date) === dateKey)
    .filter((slot) => !occupiedTimes.has(formatScheduleTime(slot.available_time)))
    .map((slot) => ({
          kind: "available",
          id: slot.id,
          time: formatScheduleTime(slot.available_time),
          status: "Disponível",
          statusKey: "available",
          requestedDate: dateKey,
          availability: slot,
          canRequest: hasScheduleToChange,
        }));

  return [...schedules, ...requests, ...availableSlots].sort((first, second) =>
    first.time.localeCompare(second.time)
  );
}

function getDayStatus(day) {
  const slots = getDaySlots(day);

  if (slots.some((slot) => slot.statusKey === "requested" || slot.statusKey === "pending_change")) {
    return "requested";
  }

  if (slots.some((slot) => slot.statusKey === "rejected")) {
    return "rejected";
  }

  if (slots.some((slot) => slot.statusKey === "canceled")) {
    return "canceled";
  }

  if (slots.some((slot) => slot.statusKey === "approved")) {
    return "approved";
  }

  if (slots.some((slot) => slot.statusKey === "completed")) {
    return "completed";
  }

  if (slots.some((slot) => slot.kind === "class")) {
    return "class";
  }

  if (slots.some((slot) => slot.statusKey === "available")) {
    return "available";
  }

  return "empty";
}

function getDayStatusLabel(status) {
  const labels = {
    class: "Aula",
    available: "Disponível",
    requested: "Solicitado",
    approved: "Aprovado",
    rejected: "Rejeitado",
    canceled: "Cancelada",
    completed: "Concluída",
  };

  return labels[status] ?? "";
}

function renderScheduleMessage() {
  if (!scheduleState.message) {
    return "";
  }

  return `<p class="schedule-feedback">${escapeHtml(scheduleState.message)}</p>`;
}

function renderCalendarDetail(slot, day) {
  const container = document.querySelector("[data-class-detail]");
  const dateKey = getSelectedDateKey(day);
  const formattedDate = formatScheduleDate(dateKey);

  if (!slot) {
    container.innerHTML = `
      <span class="panel-label">Dia ${formattedDate}</span>
      <h3>Horários do dia</h3>
      <p>Selecione um horário para ver os detalhes ou solicitar uma troca.</p>
    `;
    return;
  }

  if (slot.kind === "class") {
    const schedule = slot.schedule;
    const meetLink = schedule.meet_link
      ? `<p><strong>Link da aula:</strong> <a href="${escapeHtml(schedule.meet_link)}" target="_blank" rel="noreferrer">Entrar na aula</a></p>`
      : `<p><strong>Link da aula:</strong> A professora ainda não adicionou o link.</p>`;

    container.innerHTML = `
      <span class="panel-label">${escapeHtml(slot.status)}</span>
      <h3>Aula com ${escapeHtml(schedule.teacher_name || "a professora")}</h3>
      <p><strong>Horário:</strong> ${formattedDate} às ${escapeHtml(slot.time)}</p>
      <p><strong>Status:</strong> ${escapeHtml(slot.status)}</p>
      ${meetLink}
      ${schedule.notes ? `<p><strong>Observações:</strong> ${escapeHtml(schedule.notes)}</p>` : ""}
    `;
    return;
  }

  if (slot.kind === "request") {
    const request = slot.request;
    const canCancel = request.status === "pending";

    container.innerHTML = `
      <span class="panel-label">${escapeHtml(slot.status)}</span>
      <h3>${escapeHtml(slot.time)}</h3>
      <p><strong>Data solicitada:</strong> ${formatScheduleDate(request.requested_date)} às ${escapeHtml(slot.time)}</p>
      <p><strong>Status:</strong> ${escapeHtml(slot.status)}</p>
      ${request.reason ? `<p><strong>Motivo:</strong> ${escapeHtml(request.reason)}</p>` : ""}
      ${
        canCancel
          ? `<button class="reschedule-button" type="button" data-cancel-request="${request.id}">Cancelar solicitação</button>`
          : ""
      }
    `;

    container.querySelector("[data-cancel-request]")?.addEventListener("click", () => {
      cancelScheduleChangeRequest(request.id);
    });
    return;
  }

  const sourceSchedule = getChangeSourceSchedule();

  container.innerHTML = `
    <span class="panel-label">Horário disponível</span>
    <h3>${escapeHtml(slot.time)}</h3>
    ${
      sourceSchedule
        ? `<p>Solicitar troca da sua aula atual para ${formattedDate} às ${escapeHtml(slot.time)}.</p>
           <button class="reschedule-button" type="button" data-request-slot>Solicitar troca</button>`
        : `<p>Horário disponível na agenda da professora.</p>`
    }
  `;

  container.querySelector("[data-request-slot]")?.addEventListener("click", () => {
    createScheduleChangeRequest(sourceSchedule.id, slot.requestedDate, slot.time);
  });
}

function renderCalendarDetailV2(slot, day) {
  const container = document.querySelector("[data-class-detail]");
  const dateKey = getSelectedDateKey(day);
  const formattedDate = formatScheduleDate(dateKey);

  if (!slot) {
    container.innerHTML = `
      <span class="panel-label">Dia ${formattedDate}</span>
      <h3>Horarios do dia</h3>
      <p>Selecione um horario para ver os detalhes ou solicitar uma troca.</p>
    `;
    return;
  }

  if (slot.kind === "class") {
    const schedule = slot.schedule;
    const meetLink = String(schedule.meet_link || "").trim();
    const pendingRequest = schedule.pending_request || getPendingRequestForSchedule(schedule.id);
    const canRequestChange = !pendingRequest && !["canceled", "completed"].includes(schedule.status);

    container.innerHTML = `
      <span class="panel-label">${escapeHtml(slot.status)}</span>
      <h3>Aula com ${escapeHtml(schedule.teacher_name || "a professora")}</h3>
      <p><strong>Horario:</strong> ${formattedDate} as ${escapeHtml(slot.time)}</p>
      <p><strong>Status:</strong> ${escapeHtml(slot.status)}</p>
      ${
        meetLink
          ? `<a class="class-link-button" href="${escapeHtml(meetLink)}" target="_blank" rel="noreferrer">Entrar na aula</a>`
          : ""
      }
      ${schedule.notes ? `<p><strong>Observacoes:</strong> ${escapeHtml(schedule.notes)}</p>` : ""}
      ${
        pendingRequest
          ? `
            <div class="change-request-card change-request-card--pending">
              <span class="panel-label">Troca pendente</span>
              <p>${formatScheduleDate(pendingRequest.requested_date)} as ${formatScheduleTime(
                pendingRequest.requested_time
              )}</p>
              ${pendingRequest.reason ? `<p>${escapeHtml(pendingRequest.reason)}</p>` : ""}
              <button class="reschedule-button" type="button" data-cancel-request="${pendingRequest.id}">
                Cancelar solicitacao
              </button>
            </div>
          `
          : ""
      }
      ${
        canRequestChange
          ? `
            <button class="reschedule-button" type="button" data-open-change-request>
              Solicitar troca
            </button>
            <form class="change-request-card" data-change-request-form hidden>
              <span class="panel-label">Solicitar troca</span>
              <label class="schedule-field">
                <span>Nova data</span>
                <input type="date" name="requested_date" value="${escapeHtml(dateKey)}" required />
              </label>
              <label class="schedule-field">
                <span>Novo horario</span>
                <input type="time" name="requested_time" value="${escapeHtml(slot.time)}" required />
              </label>
              <label class="schedule-field">
                <span>Observacao opcional</span>
                <textarea name="reason" rows="3" placeholder="Explique brevemente o motivo"></textarea>
              </label>
              <div class="schedule-form-actions">
                <button class="reschedule-button" type="submit">Enviar solicitacao</button>
                <button class="reschedule-button reschedule-button--ghost" type="button" data-close-change-request>
                  Cancelar
                </button>
              </div>
            </form>
          `
          : ""
      }
    `;

    container.querySelector("[data-open-change-request]")?.addEventListener("click", () => {
      container.querySelector("[data-change-request-form]").hidden = false;
    });

    container.querySelector("[data-close-change-request]")?.addEventListener("click", () => {
      container.querySelector("[data-change-request-form]").hidden = true;
    });

    container.querySelector("[data-change-request-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      createScheduleChangeRequest(
        schedule.id,
        formData.get("requested_date"),
        formData.get("requested_time"),
        formData.get("reason")
      );
    });

    container.querySelector("[data-cancel-request]")?.addEventListener("click", () => {
      cancelScheduleChangeRequest(pendingRequest.id);
    });
    return;
  }

  if (slot.kind === "request") {
    const request = slot.request;
    const canCancel = request.status === "pending";

    container.innerHTML = `
      <span class="panel-label">${escapeHtml(slot.status)}</span>
      <h3>${escapeHtml(slot.time)}</h3>
      <p><strong>Data solicitada:</strong> ${formatScheduleDate(request.requested_date)} as ${escapeHtml(slot.time)}</p>
      <p><strong>Status:</strong> ${escapeHtml(slot.status)}</p>
      ${request.reason ? `<p><strong>Motivo:</strong> ${escapeHtml(request.reason)}</p>` : ""}
      ${
        canCancel
          ? `<button class="reschedule-button" type="button" data-cancel-request="${request.id}">Cancelar solicitacao</button>`
          : ""
      }
    `;

    container.querySelector("[data-cancel-request]")?.addEventListener("click", () => {
      cancelScheduleChangeRequest(request.id);
    });
    return;
  }

  const sourceSchedule = getChangeSourceSchedule();

  container.innerHTML = `
    <span class="panel-label">Horario disponivel</span>
    <h3>${escapeHtml(slot.time)}</h3>
    ${
      sourceSchedule
        ? `<p>Solicitar troca da sua aula atual para ${formattedDate} as ${escapeHtml(slot.time)}.</p>
           <button class="reschedule-button" type="button" data-request-slot>Solicitar troca</button>`
        : `<p>Horario disponivel na agenda da professora.</p>`
    }
  `;

  container.querySelector("[data-request-slot]")?.addEventListener("click", () => {
    createScheduleChangeRequest(sourceSchedule.id, slot.requestedDate, slot.time);
  });
}

function renderScheduleDayPanel() {
  const container = document.querySelector("[data-schedule-list]");
  const day = scheduleState.selectedDay;
  const slots = getDaySlots(day);
  const dayPanel = container.querySelector("[data-day-panel]");

  dayPanel.innerHTML = `
    <span class="panel-label">Dia ${formatScheduleDate(getSelectedDateKey(day))}</span>
    <h3>Horários do dia</h3>
    ${renderScheduleMessage()}
    ${
      slots.length
        ? `<div class="schedule-time-list">
            ${slots
              .map((slot, index) => {
                const statusClass = getStatusClass(slot.status);
                const isSelected = scheduleState.selectedSlotIndex === index;

                return `
                  <button
                    class="schedule-time ${isSelected ? "active" : ""}"
                    type="button"
                    data-slot-index="${index}"
                  >
                    <strong>${escapeHtml(slot.time)}</strong>
                    <span class="status status--${statusClass}">${escapeHtml(slot.status)}</span>
                  </button>
                `;
              })
              .join("")}
          </div>`
        : `<p>Nenhum horário disponível ou aula marcada neste dia.</p>`
    }
  `;

  dayPanel.querySelectorAll("[data-slot-index]").forEach((slotButton) => {
    slotButton.addEventListener("click", () => {
      scheduleState.selectedSlotIndex = Number(slotButton.dataset.slotIndex);
      renderScheduleDayPanel();
      renderCalendarDetailV2(slots[scheduleState.selectedSlotIndex], day);
    });
  });

  renderCalendarDetailV2(slots[scheduleState.selectedSlotIndex], day);
}

function renderSchedule() {
  const container = document.querySelector("[data-schedule-list]");
  const monthLabel = getMonthLabel();
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const firstWeekday = new Date(scheduleState.year, scheduleState.monthIndex, 1).getDay();
  const totalDays = new Date(scheduleState.year, scheduleState.monthIndex + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];

  if (scheduleState.isLoading) {
    container.innerHTML = `
      <section class="calendar-card">
        <span class="panel-label">Carregando</span>
        <h2>Buscando agenda</h2>
        <p>Aguarde enquanto carregamos suas aulas e solicitações.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="calendar-card">
      <div class="calendar-header">
        <span class="panel-label">Calendário mensal</span>
        <h2>${monthLabel}</h2>
      </div>
      <div class="calendar-grid" aria-label="Calendário de ${monthLabel}">
        ${weekDays.map((dayName) => `<span class="calendar-weekday">${dayName}</span>`).join("")}
        ${cells
          .map((day) => {
            if (!day) {
              return `<span class="calendar-day calendar-day--empty" aria-hidden="true"></span>`;
            }

            const status = getDayStatus(day);
            const label = getDayStatusLabel(status);
            const isSelected = day === scheduleState.selectedDay;

            return `
              <button
                class="calendar-day calendar-day--${status} ${isSelected ? "active" : ""}"
                type="button"
                data-calendar-day="${day}"
              >
                <span class="calendar-day__number">${day}</span>
                ${label ? `<span class="calendar-day__label">${label}</span>` : ""}
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
    <section class="schedule-day-panel" data-day-panel></section>
  `;

  container.querySelectorAll("[data-calendar-day]").forEach((dayButton) => {
    dayButton.addEventListener("click", () => {
      scheduleState.selectedDay = Number(dayButton.dataset.calendarDay);
      scheduleState.selectedSlotIndex = null;
      renderSchedule();
    });
  });

  renderScheduleDayPanel();
}

async function loadSchedule() {
  scheduleState.isLoading = true;
  renderSchedule();

  try {
    const schedule = await fetchStudentApi("/schedule/my");
    scheduleState.schedules = schedule.schedules || [];
    scheduleState.changeRequests = schedule.change_requests || [];
    scheduleState.availability = schedule.availability || [];
    scheduleState.message = "";
  } catch (error) {
    console.error("Erro ao carregar agenda:", error);
    scheduleState.message = error.message;
  } finally {
    scheduleState.isLoading = false;
    renderSchedule();
    renderHome();
    renderNotifications();
  }
}

async function createScheduleChangeRequest(scheduleId, requestedDate, requestedTime, reason = "") {
  try {
    await fetchStudentApi("/schedule/change-request", {
      method: "POST",
      body: JSON.stringify({
        class_schedule_id: scheduleId,
        requested_date: requestedDate,
        requested_time: requestedTime,
        reason: reason || "Solicitacao enviada pelo painel do aluno.",
      }),
    });
    scheduleState.message = "Solicitação enviada para a professora.";
    await loadSchedule();
    scheduleState.message = "Solicitacao enviada para a professora.";
    renderSchedule();
  } catch (error) {
    console.error("Erro ao solicitar troca:", error);
    scheduleState.message = error.message;
    renderSchedule();
  }
}

async function cancelScheduleChangeRequest(requestId) {
  try {
    await fetchStudentApi(`/schedule/change-request/${requestId}/cancel`, {
      method: "PATCH",
    });
    scheduleState.message = "Solicitação cancelada.";
    await loadSchedule();
    scheduleState.message = "Solicitacao cancelada.";
    renderSchedule();
  } catch (error) {
    console.error("Erro ao cancelar solicitação:", error);
    scheduleState.message = error.message;
    renderSchedule();
  }
}

function renderProfile() {
  const container = document.querySelector("[data-profile-info]");
  const user = getStoredStudent();
  const profileItems = user
    ? [
        ["Nome", user.name],
        ["Email", user.email],
        ["Plano", "Em configuração"],
        ["Aulas feitas", "Em acompanhamento"],
        ["Valores", "Sob consulta"],
        ["Horário fixo", "A combinar"],
        ["Nível do aluno", "Em avaliação"],
      ]
    : [
        ["Nome", "Aluno"],
        ["Email", "Em configuração"],
        ["Plano", "Em configuração"],
        ["Aulas feitas", "Em acompanhamento"],
        ["Valores", "Sob consulta"],
        ["Horário fixo", "A combinar"],
        ["Nível do aluno", "Em avaliação"],
      ];

  container.innerHTML = profileItems
    .map(
      ([label, value]) => `
        <article class="profile-card">
          <span class="panel-label">${label}</span>
          <strong>${value}</strong>
        </article>
      `
    )
    .join("");
}

function setupNavigation() {
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      setActiveView(item.dataset.viewTarget);
    });
  });
}

logoutButton.addEventListener("click", () => {
  window.EnglishStudioAuth?.logout("student");
});

if (requireStudentSession()) {
  renderNotifications();
  renderHome();
  loadMaterials();
  loadActivities();
  loadFeedbackProfile();
  loadSchedule();
  renderProfile();
  setupNavigation();
}
