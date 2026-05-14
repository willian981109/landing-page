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
const scheduleState = {
  selectedDay: studentData.schedule.selectedDay,
  selectedSlotIndex: null,
};

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

async function renderTasks() {
  const container = document.querySelector("[data-tasks-list]");

  container.innerHTML = `
    <article class="activity-card">
      <div>
        <span class="status status--em-andamento">Carregando</span>
        <h3>Buscando atividades</h3>
        <p>Aguarde enquanto carregamos as atividades publicadas pela professora.</p>
      </div>
    </article>
  `;

  try {
    const response = await fetch(`${API_BASE_URL}/activities`);

    if (!response.ok) {
      throw new Error("Não foi possível carregar as atividades.");
    }

    const activities = await response.json();

    if (!activities.length) {
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

    container.innerHTML = activities
      .map(
        (activity) => `
          <article class="activity-card">
            <div>
              <span class="status status--em-andamento">Atividade</span>
              <h3>${activity.title}</h3>
              <p>${activity.description}</p>
            </div>
            <div class="activity-card__meta">
              <p><span class="panel-label">Prazo</span><strong>${formatActivityDate(activity.deadline)}</strong></p>
              <p><span class="panel-label">Pontuação</span><strong>${activity.points} pontos</strong></p>
            </div>
          </article>
        `
      )
      .join("");
  } catch (error) {
    container.innerHTML = `
      <article class="activity-card">
        <div>
          <span class="status status--pendente">Erro</span>
          <h3>Atividades indisponíveis</h3>
          <p>${error.message}</p>
        </div>
      </article>
    `;
  }
}

function renderStars(score) {
  return Array.from({ length: 5 }, (_, index) => (index < score ? "★" : "☆")).join("");
}

function renderFeedback() {
  const ratingsContainer = document.querySelector("[data-skill-ratings]");
  const feedbackContainer = document.querySelector("[data-feedback-list]");
  const { ratings, teacherComment } = studentData.feedback;

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

  feedbackContainer.innerHTML = `
    <article class="feedback-card">
      <span class="panel-label">Comentários da professora</span>
      <h3>Comentários da professora</h3>
      <p>${teacherComment}</p>
    </article>
  `;
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

  container.innerHTML = studentData.profile
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

renderNotifications();
renderHome();
renderMaterials();
renderTasks();
renderFeedback();
renderSchedule();
renderProfile();
setupNavigation();
