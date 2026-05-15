const studentData = {
  notifications: [
    {
      type: "Atividade pendente",
      message: "Enviar a atividade de listening até 14/05/2026.",
    },
    {
      type: "Novo feedback",
      message: "A Teacher Samilly adicionou comentários sobre sua última aula.",
    },
  ],
  home: [
    {
      label: "Próxima aula",
      title: "Conversação guiada",
      description: "14/05/2026 às 19:00",
    },
    {
      label: "Atividade pendente",
      title: "Listening: daily routine",
      description: "Prazo em 14/05/2026",
    },
    {
      label: "Nível atual",
      title: "A2 em evolução",
      description: "Foco atual: fluência, escuta e segurança ao responder.",
    },
  ],
  materials: [
    {
      type: "PDF",
      title: "Guia de rotina de estudos",
      description: "Um roteiro simples para organizar sua prática semanal de inglês.",
      url: "#",
    },
    {
      type: "Vídeo",
      title: "Como responder perguntas no passado",
      description: "Aula curta para revisar estrutura, pronúncia e exemplos do Past Simple.",
      url: "https://www.youtube.com/results?search_query=past+simple+english+lesson",
    },
    {
      type: "Link",
      title: "Cambridge Dictionary",
      description: "Dicionário com pronúncia, exemplos e definições confiáveis.",
      url: "https://dictionary.cambridge.org/",
    },
  ],
  feedback: {
    teacherComment:
      "Você tem evoluído bem na organização das frases e já demonstra mais confiança ao responder sem traduzir. Ainda há dificuldades com verbos irregulares e compreensão em falas mais rápidas, mas seu comprometimento, pronúncia e naturalidade nas perguntas estão cada vez melhores. Continue praticando com foco em listening, revisão do passado e construção de frases completas para ganhar mais segurança nas próximas conversas.",
    ratings: {
      Speaking: 4,
      Listening: 3,
      Writing: 4,
      Reading: 5,
    },
  },
  schedule: {
    monthLabel: "Maio 2026",
    year: 2026,
    monthIndex: 4,
    selectedDay: 14,
    days: {
      14: [
        {
          time: "19:00",
          title: "Conversação guiada",
          status: "Aula marcada",
          meet: "https://meet.google.com/abc-defg-hij",
          materials: ["PDF: perguntas para conversação", "Vídeo: Past Simple review"],
        },
      ],
      16: [
        {
          time: "18:00",
          title: "Horário disponível",
          status: "Disponível",
        },
        {
          time: "20:00",
          title: "Horário disponível",
          status: "Disponível",
        },
      ],
      18: [
        {
          time: "18:00",
          title: "Horário disponível",
          status: "Disponível",
        },
        {
          time: "20:00",
          title: "Horário disponível",
          status: "Disponível",
        },
      ],
    },
  },
  profile: [
    ["Nome", "Joyce Almeida"],
    ["Email", "joyce@email.com"],
    ["Plano", "Plano personalizado + aula semanal"],
    ["Aulas feitas", "8 aulas"],
    ["Valores", "R$ 320,00 / mês"],
    ["Horário fixo", "Quintas-feiras às 19:00"],
    ["Nível do aluno", "A2 - Elementary"],
  ],
};

const navItems = document.querySelectorAll("[data-view-target]");
const views = document.querySelectorAll("[data-view]");
const API_BASE_URL = "http://localhost:3000";
const STUDENT_TOKEN_KEY = "englishStudioStudentToken";
const STUDENT_USER_KEY = "englishStudioStudentUser";
const studentName = document.querySelector("[data-student-name]");
const homeTitle = document.querySelector("[data-home-title]");
const logoutButton = document.querySelector("[data-student-logout]");
const scheduleState = {
  selectedDay: studentData.schedule.selectedDay,
  selectedSlotIndex: null,
};
const activityState = {
  items: [],
  expandedId: null,
  feedback: "",
};

function getStudentToken() {
  return localStorage.getItem(STUDENT_TOKEN_KEY);
}

function clearStudentSession() {
  localStorage.removeItem(STUDENT_TOKEN_KEY);
  localStorage.removeItem(STUDENT_USER_KEY);
}

function getStoredStudent() {
  try {
    return JSON.parse(localStorage.getItem(STUDENT_USER_KEY));
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

function isStudentTokenValid(token) {
  const payload = getTokenPayload(token);
  const expiresAt = payload?.exp ? payload.exp * 1000 : 0;

  return Boolean(payload?.role === "student" && expiresAt > Date.now());
}

function requireStudentSession() {
  const token = getStudentToken();
  const user = getStoredStudent();

  if (token && user?.role === "student" && isStudentTokenValid(token)) {
    studentName.textContent = user.name;
    homeTitle.textContent = `Bem-vinda/o de volta, ${user.name}.`;
    return true;
  }

  clearStudentSession();
  window.location.href = "login.html";
  return false;
}

function redirectToLogin() {
  clearStudentSession();
  window.location.href = "login.html";
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
    docs: "Google Docs",
    pdf: "PDF",
    audio: "Áudio",
    video: "Vídeo",
    link: "Link externo",
  };

  return labels[type] || "Material";
}

function getMaterialIcon(type) {
  const icons = {
    docs: "DOC",
    pdf: "PDF",
    audio: "AUD",
    video: "VID",
    link: "URL",
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

function renderNotifications() {
  const container = document.querySelector("[data-notifications]");

  container.innerHTML = studentData.notifications
    .map(
      (notification) => `
        <article class="notification-card">
          <span>${notification.type}</span>
          <p>${notification.message}</p>
        </article>
      `
    )
    .join("");
}

function renderHome() {
  const container = document.querySelector("[data-home-cards]");

  container.innerHTML = studentData.home
    .map(
      (card) => `
        <article class="summary-card">
          <span class="summary-card__label">${card.label}</span>
          <h3>${card.title}</h3>
          <p>${card.description}</p>
        </article>
      `
    )
    .join("");
}

function renderMaterials() {
  const container = document.querySelector("[data-materials-list]");

  container.innerHTML = studentData.materials
    .map(
      (material) => `
        <article class="material-card">
          <span class="type-chip">${material.type}</span>
          <h3>${material.title}</h3>
          <p>${material.description}</p>
          <a href="${material.url}" target="_blank" rel="noreferrer">Abrir material</a>
        </article>
      `
    )
    .join("");
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
                <span>${getMaterialLabel(material.type)}</span>
              </div>
              <a class="attachment-item__action" href="${escapeHtml(material.url)}" target="_blank" rel="noreferrer">
                Acessar
              </a>
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
        activity.teacher_summary
          ? `<article><strong>Resumo</strong><p>${escapeHtml(activity.teacher_summary)}</p></article>`
          : ""
      }
      ${
        activity.teacher_feedback
          ? `<article><strong>Feedback / correção</strong><p>${escapeHtml(activity.teacher_feedback)}</p></article>`
          : ""
      }
      ${
        activity.teacher_observations
          ? `<article><strong>Observações</strong><p>${escapeHtml(activity.teacher_observations)}</p></article>`
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
}

async function loadActivities() {
  const container = document.querySelector("[data-tasks-list]");

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
    renderFeedback();
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
  return Array.from({ length: 5 }, (_, index) => (index < score ? "★" : "☆")).join("");
}

function renderFeedback() {
  const ratingsContainer = document.querySelector("[data-skill-ratings]");
  const feedbackContainer = document.querySelector("[data-feedback-list]");
  const { ratings, teacherComment } = studentData.feedback;
  const reviewedActivities = activityState.items.filter((activity) => activity.status === "reviewed");

  ratingsContainer.innerHTML = `
    <span class="panel-label">Sistema de estrelas</span>
    <h3>Habilidades</h3>
    <div class="skill-list">
      ${Object.entries(ratings)
        .map(
          ([skill, score]) => `
            <div class="skill-row">
              <span>${skill}</span>
              <strong aria-label="${score} de 5 estrelas">${renderStars(score)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;

  if (!reviewedActivities.length) {
    feedbackContainer.innerHTML = `
      <article class="feedback-card">
        <span class="panel-label">Comentários da professora</span>
        <h3>Comentários da professora</h3>
        <p>${teacherComment}</p>
      </article>
    `;
    return;
  }

  feedbackContainer.innerHTML = reviewedActivities
    .map(
      (activity) => `
        <article class="feedback-card feedback-card--reviewed">
          <span class="panel-label">Atividade corrigida</span>
          <h3>${escapeHtml(activity.title)}</h3>
          <p><strong>Nota:</strong> ${
            activity.teacher_grade === null || activity.teacher_grade === undefined
              ? "Sem nota"
              : `${activity.teacher_grade} pontos`
          }</p>
          ${activity.teacher_summary ? `<p><strong>Resumo:</strong> ${escapeHtml(activity.teacher_summary)}</p>` : ""}
          ${
            activity.teacher_feedback
              ? `<p><strong>Feedback:</strong> ${escapeHtml(activity.teacher_feedback)}</p>`
              : ""
          }
          ${
            activity.teacher_observations
              ? `<p><strong>Observações:</strong> ${escapeHtml(activity.teacher_observations)}</p>`
              : ""
          }
          <time>${activity.reviewed_at ? `Corrigida em ${formatActivityDate(activity.reviewed_at)}` : "Corrigida"}</time>
        </article>
      `
    )
    .join("");
}

function getDaySlots(day) {
  return studentData.schedule.days[day] ?? [];
}

function getDayStatus(day) {
  const slots = getDaySlots(day);

  if (slots.some((slot) => slot.status === "Aula marcada")) {
    return "class";
  }

  if (slots.some((slot) => slot.status === "Solicitação enviada")) {
    return "requested";
  }

  if (slots.some((slot) => slot.status === "Disponível")) {
    return "available";
  }

  return "empty";
}

function getDayStatusLabel(status) {
  const labels = {
    class: "Aula",
    available: "Disponível",
    requested: "Solicitado",
  };

  return labels[status] ?? "";
}

function renderCalendarDetail(slot, day) {
  const container = document.querySelector("[data-class-detail]");

  if (!slot) {
    container.innerHTML = `
      <span class="panel-label">Dia ${day} de maio</span>
      <h3>Horários do dia</h3>
      <p>Selecione um horário para ver os detalhes ou solicitar uma troca.</p>
    `;
    return;
  }

  if (slot.status === "Aula marcada") {
    container.innerHTML = `
      <span class="panel-label">Aula marcada</span>
      <h3>${slot.title}</h3>
      <p><strong>Horário:</strong> ${day}/05/2026 às ${slot.time}</p>
      <p><strong>Link Meet:</strong> <a href="${slot.meet}" target="_blank" rel="noreferrer">${slot.meet}</a></p>
      <div>
        <span class="panel-label">Materiais</span>
        <ul>
          ${slot.materials.map((material) => `<li>${material}</li>`).join("")}
        </ul>
      </div>
    `;
    return;
  }

  if (slot.status === "Solicitação enviada") {
    container.innerHTML = `
      <span class="panel-label">Solicitação enviada</span>
      <h3>${slot.time}</h3>
      <p>Aguardando confirmação da professora.</p>
    `;
    return;
  }

  container.innerHTML = `
    <span class="panel-label">Horário disponível</span>
    <h3>${slot.time}</h3>
    <p>Deseja solicitar este horário?</p>
    <button class="reschedule-button" type="button" data-request-slot>Solicitar troca</button>
  `;

  container.querySelector("[data-request-slot]")?.addEventListener("click", () => {
    slot.status = "Solicitação enviada";
    slot.title = "Solicitação enviada";
    renderSchedule();
  });
}

function renderScheduleDayPanel() {
  const container = document.querySelector("[data-schedule-list]");
  const day = scheduleState.selectedDay;
  const slots = getDaySlots(day);

  const dayPanel = container.querySelector("[data-day-panel]");

  dayPanel.innerHTML = `
    <span class="panel-label">Dia ${day} de maio</span>
    <h3>Horários do dia</h3>
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
                    <strong>${slot.time}</strong>
                    <span class="status status--${statusClass}">${slot.status}</span>
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
      renderCalendarDetail(slots[scheduleState.selectedSlotIndex], day);
    });
  });

  renderCalendarDetail(slots[scheduleState.selectedSlotIndex], day);
}

function renderSchedule() {
  const container = document.querySelector("[data-schedule-list]");
  const { monthLabel, year, monthIndex } = studentData.schedule;
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];

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
    : studentData.profile;

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
  clearStudentSession();
  window.location.href = "login.html";
});

if (requireStudentSession()) {
  renderNotifications();
  renderHome();
  renderMaterials();
  loadActivities();
  renderFeedback();
  renderSchedule();
  renderProfile();
  setupNavigation();
}
