const API_BASE_URL = "http://localhost:3000";
const ADMIN_TOKEN_KEY = "englishStudioAdminToken";
const ADMIN_USER_KEY = "englishStudioAdminUser";

const adminGreeting = document.querySelector("[data-admin-greeting]");
const adminLogoutButton = document.querySelector("[data-admin-logout]");
const prevMonthButton = document.querySelector("[data-prev-month]");
const nextMonthButton = document.querySelector("[data-next-month]");
const metricsContainer = document.querySelector("[data-schedule-metrics]");
const scheduleList = document.querySelector("[data-schedule-list]");
const requestList = document.querySelector("[data-request-list]");
const detailPanel = document.querySelector("[data-detail-panel]");

const today = new Date();
const scheduleState = {
  year: today.getFullYear(),
  monthIndex: today.getMonth(),
  selectedDay: today.getDate(),
  selectedSlotIndex: null,
  schedules: [],
  requests: [],
  availability: [],
  students: [],
  selectedScheduleId: null,
  message: "",
  isLoading: false,
};

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
    adminGreeting.textContent = `Conectada como ${user.name}. Gerencie aulas, disponibilidades e trocas.`;
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

function getDateKey(value) {
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

function formatDate(value) {
  const dateKey = getDateKey(value);

  if (!dateKey) {
    return "Sem data";
  }

  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

function formatTime(value) {
  return String(value || "").slice(0, 5);
}

function getMonthLabel() {
  return new Date(scheduleState.year, scheduleState.monthIndex, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function getScheduleStatusLabel(status) {
  const labels = {
    scheduled: "Marcada",
    confirmed: "Confirmada",
    pending_change: "Troca solicitada",
    canceled: "Cancelada",
    completed: "Concluída",
  };

  return labels[status] || "Marcada";
}

function getRequestStatusLabel(status) {
  const labels = {
    pending: "Pendente",
    approved: "Aprovada",
    rejected: "Rejeitada",
    canceled: "Cancelada",
  };

  return labels[status] || "Pendente";
}

function getStatusClass(status) {
  return String(status || "scheduled").replaceAll("_", "-");
}

function getStudentOptions(selectedId = "") {
  if (!scheduleState.students.length) {
    return `<option value="">Nenhum aluno cadastrado</option>`;
  }

  return [
    `<option value="">Selecione um aluno</option>`,
    ...scheduleState.students.map(
      (student) =>
        `<option value="${student.id}" ${student.id === selectedId ? "selected" : ""}>${escapeHtml(student.name)}</option>`
    ),
  ].join("");
}

function renderMetrics() {
  const pendingRequests = scheduleState.requests.filter((request) => request.status === "pending").length;
  const activeSchedules = scheduleState.schedules.filter((schedule) => schedule.status !== "canceled").length;
  const availableSlots = scheduleState.availability.length;
  const completedSchedules = scheduleState.schedules.filter((schedule) => schedule.status === "completed").length;

  metricsContainer.innerHTML = `
    <article class="metric-card">
      <span class="panel-label">Aulas</span>
      <strong>${activeSchedules}</strong>
    </article>
    <article class="metric-card">
      <span class="panel-label">Disponíveis</span>
      <strong>${availableSlots}</strong>
    </article>
    <article class="metric-card">
      <span class="panel-label">Trocas</span>
      <strong>${pendingRequests}</strong>
    </article>
    <article class="metric-card">
      <span class="panel-label">Concluídas</span>
      <strong>${completedSchedules}</strong>
    </article>
  `;
}

function getRequestsForDate(dateKey) {
  return scheduleState.requests.filter((request) => getDateKey(request.requested_date) === dateKey);
}

function getDaySlots(day) {
  const dateKey = getSelectedDateKey(day);
  const classSlots = scheduleState.schedules
    .filter((schedule) => getDateKey(schedule.class_date) === dateKey)
    .map((schedule) => ({
      kind: "class",
      id: schedule.id,
      time: formatTime(schedule.class_time),
      status: getScheduleStatusLabel(schedule.status),
      statusKey: schedule.status,
      schedule,
    }));
  const pendingRequestSlots = getRequestsForDate(dateKey)
    .filter((request) => request.status === "pending")
    .map((request) => ({
      kind: "request",
      id: request.id,
      time: formatTime(request.requested_time),
      status: "Troca pendente",
      statusKey: "pending",
      request,
    }));
  const occupiedTimes = new Set(
    classSlots.filter((slot) => slot.schedule.status !== "canceled").map((slot) => slot.time)
  );
  const availableSlots = scheduleState.availability
    .filter((slot) => getDateKey(slot.available_date) === dateKey)
    .filter((slot) => !occupiedTimes.has(formatTime(slot.available_time)))
    .map((slot) => ({
      kind: "availability",
      id: slot.id,
      time: formatTime(slot.available_time),
      status: "Disponível",
      statusKey: "available",
      availability: slot,
    }));

  return [...classSlots, ...pendingRequestSlots, ...availableSlots].sort((first, second) =>
    first.time.localeCompare(second.time)
  );
}

function getDayStatus(day) {
  const slots = getDaySlots(day);

  if (slots.some((slot) => slot.statusKey === "pending" || slot.statusKey === "pending_change")) {
    return "pending";
  }

  if (slots.some((slot) => slot.statusKey === "canceled")) {
    return "canceled";
  }

  if (slots.some((slot) => slot.statusKey === "scheduled" || slot.statusKey === "confirmed")) {
    return "class";
  }

  if (slots.some((slot) => slot.statusKey === "completed")) {
    return "completed";
  }

  if (slots.some((slot) => slot.statusKey === "available")) {
    return "available";
  }

  return "empty";
}

function getDayStatusLabel(status) {
  const labels = {
    pending: "Pendente",
    canceled: "Cancelada",
    class: "Aula",
    completed: "Concluída",
    available: "Livre",
  };

  return labels[status] || "";
}

function renderMessage() {
  return scheduleState.message ? `<p class="dashboard-message">${escapeHtml(scheduleState.message)}</p>` : "";
}

function renderScheduleCalendar() {
  renderMetrics();

  if (scheduleState.isLoading) {
    scheduleList.innerHTML = `
      <article class="empty-state">
        <span class="status status--pending">Carregando</span>
        <h3>Buscando agenda</h3>
        <p>Aguarde enquanto carregamos aulas, disponibilidades e solicitações.</p>
      </article>
    `;
    return;
  }

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const firstWeekday = new Date(scheduleState.year, scheduleState.monthIndex, 1).getDay();
  const totalDays = new Date(scheduleState.year, scheduleState.monthIndex + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];

  scheduleList.innerHTML = `
    ${renderMessage()}
    <section class="calendar-card">
      <div class="calendar-header">
        <span class="panel-label">Mês</span>
        <h2>${getMonthLabel()}</h2>
      </div>
      <div class="calendar-grid" aria-label="Calendário de ${getMonthLabel()}">
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
    <section class="day-panel" data-day-panel></section>
  `;

  scheduleList.querySelectorAll("[data-calendar-day]").forEach((button) => {
    button.addEventListener("click", () => {
      scheduleState.selectedDay = Number(button.dataset.calendarDay);
      scheduleState.selectedSlotIndex = null;
      scheduleState.selectedScheduleId = null;
      renderScheduleCalendar();
      renderDefaultDetail();
    });
  });

  renderDayPanel();
}

function renderDayPanel() {
  const dayPanel = scheduleList.querySelector("[data-day-panel]");
  const slots = getDaySlots(scheduleState.selectedDay);

  dayPanel.innerHTML = `
    <div class="day-panel__header">
      <div>
        <span class="panel-label">Dia ${formatDate(getSelectedDateKey())}</span>
        <h3>Horários do dia</h3>
      </div>
      <div class="action-row">
        <button class="secondary-button" type="button" data-new-availability>Disponibilidade</button>
        <button class="primary-button" type="button" data-new-class>Aula</button>
      </div>
    </div>
    ${
      slots.length
        ? `<div class="slot-list">
            ${slots
              .map((slot, index) => {
                const isSelected = scheduleState.selectedSlotIndex === index;

                return `
                  <button class="slot-row ${isSelected ? "active" : ""}" type="button" data-slot-index="${index}">
                    <strong>${escapeHtml(slot.time)}</strong>
                    <span>${getSlotTitle(slot)}</span>
                    <span class="status status--${getStatusClass(slot.statusKey)}">${escapeHtml(slot.status)}</span>
                  </button>
                `;
              })
              .join("")}
          </div>`
        : `<p class="muted-text">Nenhuma aula ou disponibilidade neste dia.</p>`
    }
  `;

  dayPanel.querySelector("[data-new-availability]").addEventListener("click", () => {
    renderAvailabilityForm(getSelectedDateKey());
  });

  dayPanel.querySelector("[data-new-class]").addEventListener("click", () => {
    renderClassForm({ class_date: getSelectedDateKey(), class_time: "19:00" });
  });

  dayPanel.querySelectorAll("[data-slot-index]").forEach((button) => {
    button.addEventListener("click", () => {
      scheduleState.selectedSlotIndex = Number(button.dataset.slotIndex);
      const slot = slots[scheduleState.selectedSlotIndex];
      renderDayPanel();
      renderSlotDetail(slot);
    });
  });
}

function getSlotTitle(slot) {
  if (slot.kind === "class") {
    return slot.schedule.student_name;
  }

  if (slot.kind === "request") {
    return `${slot.request.student_name} pediu ${formatDate(slot.request.requested_date)}`;
  }

  return "Horário disponível";
}

function renderRequests() {
  const pendingRequests = scheduleState.requests.filter((request) => request.status === "pending");

  if (!pendingRequests.length) {
    requestList.innerHTML = `
      <article class="empty-state">
        <span class="status status--approved">Sem pendências</span>
        <h3>Nenhuma troca pendente</h3>
        <p>As novas solicitações dos alunos aparecerão aqui.</p>
      </article>
    `;
    return;
  }

  requestList.innerHTML = pendingRequests
    .map(
      (request) => `
        <article class="request-card">
          <span class="status status--pending">${getRequestStatusLabel(request.status)}</span>
          <h3>${escapeHtml(request.student_name)}</h3>
          <p>${formatDate(request.current_date)} às ${formatTime(request.current_time)} → ${formatDate(
            request.requested_date
          )} às ${formatTime(request.requested_time)}</p>
          ${request.reason ? `<p>${escapeHtml(request.reason)}</p>` : ""}
          <div class="action-row">
            <button class="primary-button" type="button" data-approve-request="${request.id}">Aprovar</button>
            <button class="danger-button" type="button" data-reject-request="${request.id}">Rejeitar</button>
          </div>
        </article>
      `
    )
    .join("");

  requestList.querySelectorAll("[data-approve-request]").forEach((button) => {
    button.addEventListener("click", () => approveRequest(button.dataset.approveRequest));
  });

  requestList.querySelectorAll("[data-reject-request]").forEach((button) => {
    button.addEventListener("click", () => rejectRequest(button.dataset.rejectRequest));
  });
}

function renderSlotDetail(slot) {
  if (slot.kind === "class") {
    renderScheduleDetail(slot.schedule);
    return;
  }

  if (slot.kind === "request") {
    renderRequestDetail(slot.request);
    return;
  }

  renderClassForm({
    class_date: getSelectedDateKey(),
    class_time: slot.time,
  });
}

function renderDefaultDetail() {
  detailPanel.innerHTML = `
    <span class="panel-label">Detalhes</span>
    <h2>${formatDate(getSelectedDateKey())}</h2>
    <p>Crie disponibilidade, marque uma aula ou selecione um horário do calendário.</p>
    <div class="action-row">
      <button class="secondary-button" type="button" data-new-availability>Nova disponibilidade</button>
      <button class="primary-button" type="button" data-new-class>Nova aula</button>
    </div>
  `;

  detailPanel.querySelector("[data-new-availability]").addEventListener("click", () => {
    renderAvailabilityForm(getSelectedDateKey());
  });

  detailPanel.querySelector("[data-new-class]").addEventListener("click", () => {
    renderClassForm({ class_date: getSelectedDateKey(), class_time: "19:00" });
  });
}

function renderAvailabilityForm(dateKey) {
  detailPanel.innerHTML = `
    <span class="panel-label">Disponibilidade</span>
    <h2>Novo horário disponível</h2>
    <form class="detail-form" data-availability-form>
      <label class="field">
        <span>Data</span>
        <input type="date" name="available_date" value="${dateKey}" required />
      </label>
      <label class="field">
        <span>Horário</span>
        <input type="time" name="available_time" value="19:00" required />
      </label>
      <button class="primary-button" type="submit">Salvar disponibilidade</button>
    </form>
  `;

  detailPanel.querySelector("[data-availability-form]").addEventListener("submit", createAvailability);
}

function renderClassForm(defaults = {}) {
  detailPanel.innerHTML = `
    <span class="panel-label">Aula</span>
    <h2>Marcar aula</h2>
    <form class="detail-form" data-create-schedule-form>
      <label class="field">
        <span>Aluno</span>
        <select name="student_id" required>${getStudentOptions(defaults.student_id)}</select>
      </label>
      <label class="field">
        <span>Data</span>
        <input type="date" name="class_date" value="${defaults.class_date || getSelectedDateKey()}" required />
      </label>
      <label class="field">
        <span>Horário</span>
        <input type="time" name="class_time" value="${defaults.class_time || "19:00"}" required />
      </label>
      <label class="field">
        <span>Link da aula</span>
        <input type="url" name="meet_link" value="${escapeHtml(defaults.meet_link)}" placeholder="Google Meet, Zoom ou Teams" />
      </label>
      <label class="field">
        <span>Observações</span>
        <textarea name="notes" rows="4" placeholder="Observações para a aula">${escapeHtml(defaults.notes)}</textarea>
      </label>
      <button class="primary-button" type="submit">Criar aula</button>
    </form>
  `;

  detailPanel.querySelector("[data-create-schedule-form]").addEventListener("submit", createSchedule);
}

function renderScheduleDetail(schedule) {
  scheduleState.selectedScheduleId = schedule.id;
  detailPanel.innerHTML = `
    <span class="panel-label">Detalhes da aula</span>
    <h2>${escapeHtml(schedule.student_name)}</h2>
    <p>${formatDate(schedule.class_date)} às ${formatTime(schedule.class_time)}</p>
    <form class="detail-form" data-schedule-form>
      <label class="field">
        <span>Data</span>
        <input type="date" name="class_date" value="${getDateKey(schedule.class_date)}" required />
      </label>
      <label class="field">
        <span>Horário</span>
        <input type="time" name="class_time" value="${formatTime(schedule.class_time)}" required />
      </label>
      <label class="field">
        <span>Status</span>
        <select name="status">
          <option value="scheduled" ${schedule.status === "scheduled" ? "selected" : ""}>Marcada</option>
          <option value="confirmed" ${schedule.status === "confirmed" ? "selected" : ""}>Confirmada</option>
          <option value="pending_change" ${schedule.status === "pending_change" ? "selected" : ""}>Troca solicitada</option>
          <option value="completed" ${schedule.status === "completed" ? "selected" : ""}>Concluída</option>
          <option value="canceled" ${schedule.status === "canceled" ? "selected" : ""}>Cancelada</option>
        </select>
      </label>
      <label class="field">
        <span>Link da aula</span>
        <input type="url" name="meet_link" value="${escapeHtml(schedule.meet_link)}" placeholder="Google Meet, Zoom ou Teams" />
      </label>
      <label class="field">
        <span>Observações</span>
        <textarea name="notes" rows="4" placeholder="Observações para a aula">${escapeHtml(schedule.notes)}</textarea>
      </label>
      <div class="action-row">
        <button class="primary-button" type="submit">Salvar aula</button>
        <button class="danger-button" type="button" data-cancel-schedule="${schedule.id}">Cancelar aula</button>
      </div>
    </form>
  `;

  detailPanel.querySelector("[data-schedule-form]").addEventListener("submit", saveSchedule);
  detailPanel.querySelector("[data-cancel-schedule]").addEventListener("click", () => cancelSchedule(schedule.id));
}

function renderRequestDetail(request) {
  detailPanel.innerHTML = `
    <span class="panel-label">Troca solicitada</span>
    <h2>${escapeHtml(request.student_name)}</h2>
    <p>${formatDate(request.current_date)} às ${formatTime(request.current_time)} → ${formatDate(
      request.requested_date
    )} às ${formatTime(request.requested_time)}</p>
    ${request.reason ? `<p>${escapeHtml(request.reason)}</p>` : ""}
    <div class="action-row">
      <button class="primary-button" type="button" data-approve-request="${request.id}">Aprovar troca</button>
      <button class="danger-button" type="button" data-reject-request="${request.id}">Rejeitar troca</button>
    </div>
  `;

  detailPanel.querySelector("[data-approve-request]").addEventListener("click", () => approveRequest(request.id));
  detailPanel.querySelector("[data-reject-request]").addEventListener("click", () => rejectRequest(request.id));
}

async function createAvailability(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);

  try {
    await fetchAdminApi("/teacher/availability", {
      method: "POST",
      body: JSON.stringify({
        available_date: formData.get("available_date"),
        available_time: formData.get("available_time"),
      }),
    });
    scheduleState.message = "Disponibilidade criada.";
    await loadSchedule();
  } catch (error) {
    scheduleState.message = error.message;
    renderScheduleCalendar();
  }
}

async function createSchedule(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);

  try {
    const schedule = await fetchAdminApi("/schedule", {
      method: "POST",
      body: JSON.stringify({
        student_id: formData.get("student_id"),
        class_date: formData.get("class_date"),
        class_time: formData.get("class_time"),
        meet_link: formData.get("meet_link"),
        notes: formData.get("notes"),
        status: "scheduled",
      }),
    });
    scheduleState.selectedScheduleId = schedule.id;
    scheduleState.message = "Aula criada e sincronizada com o aluno.";
    await loadSchedule();
  } catch (error) {
    scheduleState.message = error.message;
    renderScheduleCalendar();
  }
}

async function saveSchedule(event) {
  event.preventDefault();

  if (!scheduleState.selectedScheduleId) {
    return;
  }

  const formData = new FormData(event.currentTarget);

  try {
    await fetchAdminApi(`/schedule/${scheduleState.selectedScheduleId}`, {
      method: "PATCH",
      body: JSON.stringify({
        class_date: formData.get("class_date"),
        class_time: formData.get("class_time"),
        status: formData.get("status"),
        meet_link: formData.get("meet_link"),
        notes: formData.get("notes"),
      }),
    });
    scheduleState.message = "Aula atualizada.";
    await loadSchedule();
  } catch (error) {
    scheduleState.message = error.message;
    renderScheduleCalendar();
  }
}

async function cancelSchedule(scheduleId) {
  try {
    await fetchAdminApi(`/schedule/${scheduleId}`, {
      method: "DELETE",
    });
    scheduleState.message = "Aula cancelada.";
    await loadSchedule();
  } catch (error) {
    scheduleState.message = error.message;
    renderScheduleCalendar();
  }
}

async function approveRequest(requestId) {
  try {
    await fetchAdminApi(`/schedule/change-request/${requestId}/approve`, {
      method: "PATCH",
    });
    scheduleState.message = "Troca aprovada e agenda atualizada.";
    await loadSchedule();
  } catch (error) {
    scheduleState.message = error.message;
    renderScheduleCalendar();
  }
}

async function rejectRequest(requestId) {
  try {
    await fetchAdminApi(`/schedule/change-request/${requestId}/reject`, {
      method: "PATCH",
    });
    scheduleState.message = "Troca rejeitada.";
    await loadSchedule();
  } catch (error) {
    scheduleState.message = error.message;
    renderScheduleCalendar();
  }
}

async function loadSchedule() {
  scheduleState.isLoading = true;
  renderScheduleCalendar();

  try {
    const [schedules, requests, availability, students] = await Promise.all([
      fetchAdminApi("/admin/schedule"),
      fetchAdminApi("/admin/change-requests"),
      fetchAdminApi("/teacher/availability"),
      fetchAdminApi("/students"),
    ]);

    scheduleState.schedules = schedules || [];
    scheduleState.requests = requests || [];
    scheduleState.availability = availability || [];
    scheduleState.students = students || [];
    scheduleState.isLoading = false;
    renderScheduleCalendar();
    renderRequests();

    const selectedSchedule = scheduleState.schedules.find(
      (schedule) => schedule.id === scheduleState.selectedScheduleId
    );

    if (selectedSchedule) {
      renderScheduleDetail(selectedSchedule);
      return;
    }

    renderDefaultDetail();
  } catch (error) {
    scheduleState.isLoading = false;
    scheduleState.message = error.message;
    renderScheduleCalendar();
  }
}

async function refreshScheduleData() {
  if (document.hidden || detailPanel.contains(document.activeElement)) {
    return;
  }

  try {
    const [schedules, requests, availability, students] = await Promise.all([
      fetchAdminApi("/admin/schedule"),
      fetchAdminApi("/admin/change-requests"),
      fetchAdminApi("/teacher/availability"),
      fetchAdminApi("/students"),
    ]);

    scheduleState.schedules = schedules || [];
    scheduleState.requests = requests || [];
    scheduleState.availability = availability || [];
    scheduleState.students = students || [];
    renderScheduleCalendar();
    renderRequests();
  } catch (error) {
    console.error("Erro ao atualizar agenda:", error);
  }
}

prevMonthButton.addEventListener("click", () => {
  const date = new Date(scheduleState.year, scheduleState.monthIndex - 1, 1);
  scheduleState.year = date.getFullYear();
  scheduleState.monthIndex = date.getMonth();
  scheduleState.selectedDay = 1;
  scheduleState.selectedSlotIndex = null;
  renderScheduleCalendar();
  renderDefaultDetail();
});

nextMonthButton.addEventListener("click", () => {
  const date = new Date(scheduleState.year, scheduleState.monthIndex + 1, 1);
  scheduleState.year = date.getFullYear();
  scheduleState.monthIndex = date.getMonth();
  scheduleState.selectedDay = 1;
  scheduleState.selectedSlotIndex = null;
  renderScheduleCalendar();
  renderDefaultDetail();
});

adminLogoutButton.addEventListener("click", () => {
  window.EnglishStudioAuth?.logout();
});

if (requireTeacherSession()) {
  loadSchedule();
  window.setInterval(refreshScheduleData, 20000);
}
