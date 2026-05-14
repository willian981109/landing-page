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
  tasks: [
    {
      title: "Listening: daily routine",
      description: "Ouça o áudio indicado e escreva 5 frases sobre a rotina da personagem.",
      due: "14/05/2026",
      status: "Pendente",
      links: ["Áudio da atividade", "Folha de respostas"],
    },
    {
      title: "Speaking practice",
      description: "Grave um áudio de 1 minuto contando como foi seu último fim de semana.",
      due: "17/05/2026",
      status: "Em andamento",
      links: ["Modelo de roteiro"],
    },
    {
      title: "Vocabulary review",
      description: "Revisar 20 palavras novas e criar frases próprias com 10 delas.",
      due: "Concluída em 10/05/2026",
      status: "Concluída",
      links: ["Lista de vocabulário"],
    },
  ],
  feedback: {
    comments:
      "Você está participando mais das conversas e já consegue sustentar respostas um pouco mais longas.",
    evolution:
      "A evolução principal aparece na organização das frases e na confiança para iniciar respostas sem traduzir tudo antes.",
    difficulties:
      "Ainda há dificuldade com verbos irregulares no passado e com listening quando a fala está mais rápida.",
    positives:
      "Boa pronúncia em palavras novas, ótimo comprometimento com as atividades e mais naturalidade nas perguntas.",
    recommendations:
      "Praticar 10 minutos de escuta ativa por dia e revisar os verbos irregulares antes da próxima aula.",
    ratings: {
      Speaking: 4,
      Listening: 3,
      Writing: 4,
      Reading: 5,
    },
  },
  schedule: [
    {
      date: "14/05/2026",
      time: "19:00",
      title: "Conversação guiada",
      status: "Aula marcada",
      meet: "https://meet.google.com/abc-defg-hij",
      materials: ["PDF: perguntas para conversação", "Vídeo: Past Simple review"],
    },
    {
      date: "16/05/2026",
      time: "10:00",
      title: "Horário disponível",
      status: "Disponível",
    },
    {
      date: "17/05/2026",
      time: "18:00",
      title: "Horário ocupado",
      status: "Ocupado",
    },
    {
      date: "21/05/2026",
      time: "19:00",
      title: "Revisão + speaking",
      status: "Aula marcada",
      meet: "https://meet.google.com/xyz-wxyz-klm",
      materials: ["Lista de verbos irregulares", "Atividade de pronúncia"],
    },
  ],
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

function renderTasks() {
  const container = document.querySelector("[data-tasks-list]");

  container.innerHTML = studentData.tasks
    .map((task) => {
      const statusClass = getStatusClass(task.status);

      return `
        <article class="activity-card">
          <div>
            <span class="status status--${statusClass}">${task.status}</span>
            <h3>${task.title}</h3>
            <p>${task.description}</p>
          </div>
          <div class="activity-card__meta">
            <p><span class="panel-label">Prazo</span><strong>${task.due}</strong></p>
            <div>
              <span class="panel-label">Links</span>
              <div class="inline-links">
                ${task.links.map((link) => `<a href="#">${link}</a>`).join("")}
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderStars(score) {
  return Array.from({ length: 5 }, (_, index) => (index < score ? "★" : "☆")).join("");
}

function renderFeedback() {
  const ratingsContainer = document.querySelector("[data-skill-ratings]");
  const feedbackContainer = document.querySelector("[data-feedback-list]");
  const { ratings, ...notes } = studentData.feedback;

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

  const labels = {
    comments: "Comentários da professora",
    evolution: "Evolução",
    difficulties: "Dificuldades",
    positives: "Pontos positivos",
    recommendations: "Recomendações",
  };

  feedbackContainer.innerHTML = Object.entries(notes)
    .map(
      ([key, value]) => `
        <article class="feedback-card">
          <span class="panel-label">${labels[key]}</span>
          <h3>${labels[key]}</h3>
          <p>${value}</p>
        </article>
      `
    )
    .join("");
}

function renderClassDetail(lesson) {
  const container = document.querySelector("[data-class-detail]");

  if (lesson.status !== "Aula marcada") {
    container.innerHTML = `
      <span class="panel-label">${lesson.status}</span>
      <h3>${lesson.title}</h3>
      <p>${lesson.date} às ${lesson.time}</p>
      <p>Este horário está sinalizado apenas para consulta.</p>
    `;
    return;
  }

  container.innerHTML = `
    <span class="panel-label">Aula marcada</span>
    <h3>${lesson.title}</h3>
    <p><strong>Horário:</strong> ${lesson.date} às ${lesson.time}</p>
    <p><strong>Link Meet:</strong> <a href="${lesson.meet}" target="_blank" rel="noreferrer">${lesson.meet}</a></p>
    <div>
      <span class="panel-label">Materiais</span>
      <ul>
        ${lesson.materials.map((material) => `<li>${material}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderSchedule() {
  const container = document.querySelector("[data-schedule-list]");

  container.innerHTML = studentData.schedule
    .map((lesson, index) => {
      const statusClass = getStatusClass(lesson.status);
      const isClass = lesson.status === "Aula marcada";

      return `
        <button class="schedule-slot ${isClass ? "schedule-slot--button" : ""}" type="button" data-lesson-index="${index}">
          <span class="status status--${statusClass}">${lesson.status}</span>
          <h3>${lesson.title}</h3>
          <p>${lesson.date} às ${lesson.time}</p>
        </button>
      `;
    })
    .join("");

  container.querySelectorAll("[data-lesson-index]").forEach((slot) => {
    slot.addEventListener("click", () => {
      renderClassDetail(studentData.schedule[Number(slot.dataset.lessonIndex)]);
    });
  });
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
