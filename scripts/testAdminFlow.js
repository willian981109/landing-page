require("dotenv").config();

const bcrypt = require("bcrypt");

const { pool } = require("../src/database/pool");

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) {
    return { response, data: null };
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`${response.status} ${data.error || "Request failed"}`);
  }

  return { response, data };
}

async function testAdminFlow() {
  let tempStudentId = null;
  let tempAvailabilityId = null;

  console.log("1. Login admin");
  const { data: loginData } = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "admin@english.com",
      password: "123456",
    }),
  });

  if (!loginData.token) {
    throw new Error("Login did not return token");
  }

  console.log("Token received");

  const authHeaders = {
    Authorization: `Bearer ${loginData.token}`,
  };

  console.log("2. Create temporary student");
  const passwordHash = await bcrypt.hash("123456", 10);
  const tempStudentEmail = `test.student.${Date.now()}@english.com`;
  const studentResult = await pool.query(
    `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [`Test Student ${Date.now()}`, tempStudentEmail, passwordHash, "student"]
  );

  tempStudentId = studentResult.rows[0].id;
  console.log(`Temporary student created: ${tempStudentId}`);

  console.log("3. Login temporary student");
  const { data: studentLoginData } = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: tempStudentEmail,
      password: "123456",
    }),
  });

  console.log("4. Create activity");
  const { data: createdActivity } = await request("/activities", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      title: "Listening Practice",
      description: "Complete the audio exercise",
      deadline: "2026-05-20",
      points: 10,
      studentId: tempStudentId,
      materials: [
        {
          type: "docs",
          title: "Folha de respostas",
          url: "https://docs.google.com/document/example",
        },
        {
          type: "video",
          title: "Video de apoio",
          url: "https://youtube.com/watch?v=example",
        },
      ],
    }),
  });

  if (createdActivity.materials.length !== 2) {
    throw new Error("POST /activities did not save activity materials");
  }

  console.log(`Activity created: ${createdActivity.id}`);

  console.log("5. Validate persistence with GET /activities");
  const { data: activities } = await request("/activities", {
    headers: authHeaders,
  });
  const persistedActivity = activities.find((activity) => activity.id === createdActivity.id);

  if (!persistedActivity) {
    throw new Error("Created activity was not found in GET /activities");
  }

  if (persistedActivity.materials.length !== 2) {
    throw new Error("Created activity materials were not found in GET /activities");
  }

  const { data: filteredActivities } = await request(`/activities?studentId=${tempStudentId}`, {
    headers: authHeaders,
  });

  if (
    !filteredActivities.some(
      (activity) => activity.activity_id === createdActivity.id && activity.student_id === tempStudentId
    )
  ) {
    throw new Error("GET /activities?studentId did not return the student's activity");
  }

  console.log("Activity found in database result");

  console.log("6. Validate student activity flow");
  const studentAuthHeaders = {
    Authorization: `Bearer ${studentLoginData.token}`,
  };
  const { data: myActivities } = await request("/my-activities", {
    headers: studentAuthHeaders,
  });

  if (!myActivities.some((activity) => activity.id === createdActivity.id)) {
    throw new Error("Created activity was not found in GET /my-activities");
  }

  const { data: inProgressActivity } = await request(
    `/my-activities/${createdActivity.id}/in-progress`,
    {
      method: "PATCH",
      headers: studentAuthHeaders,
    }
  );

  if (inProgressActivity.status !== "in_progress") {
    throw new Error("PATCH /my-activities/:id/in-progress did not update status");
  }

  const { data: completedActivity } = await request(`/my-activities/${createdActivity.id}/complete`, {
    method: "PATCH",
    headers: studentAuthHeaders,
  });

  if (completedActivity.status !== "completed" || !completedActivity.completed_at) {
    throw new Error("PATCH /my-activities/:id/complete did not complete activity");
  }

  console.log("Student activity flow validated");

  console.log("7. Validate shared schedule flow");
  const { data: availability } = await request("/teacher/availability", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      available_date: "2026-05-23",
      available_time: "18:00",
    }),
  });
  tempAvailabilityId = availability.id;

  const { data: teacherAvailability } = await request("/teacher/availability", {
    headers: authHeaders,
  });

  if (!teacherAvailability.some((slot) => slot.id === tempAvailabilityId)) {
    throw new Error("GET /teacher/availability did not return created availability");
  }

  const { data: createdSchedule } = await request("/schedule", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      student_id: tempStudentId,
      class_date: "2026-05-22",
      class_time: "19:00",
      meet_link: "https://meet.google.com/test-class",
      notes: "Initial weekly class",
    }),
  });
  const scheduleId = createdSchedule.id;

  const { data: mySchedule } = await request("/schedule/my", {
    headers: studentAuthHeaders,
  });

  if (!mySchedule.schedules.some((schedule) => schedule.id === scheduleId)) {
    throw new Error("GET /schedule/my did not return the student's class");
  }

  if (!mySchedule.availability.some((slot) => slot.id === tempAvailabilityId)) {
    throw new Error("GET /schedule/my did not return teacher availability");
  }

  const { data: changeRequest } = await request("/schedule/change-request", {
    method: "POST",
    headers: studentAuthHeaders,
    body: JSON.stringify({
      class_schedule_id: scheduleId,
      requested_date: "2026-05-23",
      requested_time: "18:00",
      reason: "Need a different time",
    }),
  });

  if (changeRequest.status !== "pending") {
    throw new Error("POST /schedule/change-request did not create a pending request");
  }

  const { data: canceledRequest } = await request(
    `/schedule/change-request/${changeRequest.id}/cancel`,
    {
      method: "PATCH",
      headers: studentAuthHeaders,
    }
  );

  if (canceledRequest.status !== "canceled") {
    throw new Error("PATCH /schedule/change-request/:id/cancel did not cancel request");
  }

  const { data: approvalRequest } = await request("/schedule/change-request", {
    method: "POST",
    headers: studentAuthHeaders,
    body: JSON.stringify({
      class_schedule_id: scheduleId,
      requested_date: "2026-05-24",
      requested_time: "20:00",
      reason: "Testing approval",
    }),
  });

  const { data: adminRequests } = await request("/admin/change-requests", {
    headers: authHeaders,
  });

  if (!adminRequests.some((request) => request.id === approvalRequest.id)) {
    throw new Error("GET /admin/change-requests did not return pending request");
  }

  const { data: approvedRequest } = await request(
    `/schedule/change-request/${approvalRequest.id}/approve`,
    {
      method: "PATCH",
      headers: authHeaders,
    }
  );

  if (approvedRequest.status !== "approved") {
    throw new Error("PATCH /schedule/change-request/:id/approve did not approve request");
  }

  const { data: updatedScheduleList } = await request("/admin/schedule", {
    headers: authHeaders,
  });
  const updatedSchedule = updatedScheduleList.find((schedule) => schedule.id === scheduleId);

  if (
    !updatedSchedule ||
    String(updatedSchedule.class_date).slice(0, 10) !== "2026-05-24" ||
    String(updatedSchedule.class_time).slice(0, 5) !== "20:00"
  ) {
    throw new Error("Approved request did not update class_schedules");
  }

  const { data: editedSchedule } = await request(`/schedule/${scheduleId}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({
      class_date: "2026-05-24",
      class_time: "20:00",
      status: "confirmed",
      meet_link: "https://zoom.us/j/test-class",
      notes: "Bring workbook",
    }),
  });

  if (editedSchedule.meet_link !== "https://zoom.us/j/test-class") {
    throw new Error("PATCH /schedule/:id did not update meet_link");
  }

  const { data: rejectionRequest } = await request("/schedule/change-request", {
    method: "POST",
    headers: studentAuthHeaders,
    body: JSON.stringify({
      class_schedule_id: scheduleId,
      requested_date: "2026-05-25",
      requested_time: "18:00",
      reason: "Testing rejection",
    }),
  });

  const { data: rejectedRequest } = await request(
    `/schedule/change-request/${rejectionRequest.id}/reject`,
    {
      method: "PATCH",
      headers: authHeaders,
    }
  );

  if (rejectedRequest.status !== "rejected") {
    throw new Error("PATCH /schedule/change-request/:id/reject did not reject request");
  }

  const { data: scheduleAfterRejectList } = await request("/admin/schedule", {
    headers: authHeaders,
  });
  const scheduleAfterReject = scheduleAfterRejectList.find((schedule) => schedule.id === scheduleId);

  if (!scheduleAfterReject || scheduleAfterReject.status !== "confirmed") {
    throw new Error("Rejected request did not restore the previous schedule status");
  }

  const { data: completedSchedule } = await request(`/schedule/${scheduleId}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({
      class_date: "2026-05-24",
      class_time: "20:00",
      status: "completed",
      meet_link: "https://zoom.us/j/test-class",
      notes: "Class completed",
    }),
  });

  if (completedSchedule.status !== "completed") {
    throw new Error("PATCH /schedule/:id did not mark schedule as completed");
  }

  const { data: canceledSchedule } = await request(`/schedule/${scheduleId}`, {
    method: "DELETE",
    headers: authHeaders,
  });

  if (canceledSchedule.status !== "canceled") {
    throw new Error("DELETE /schedule/:id did not cancel schedule");
  }

  const { data: studentScheduleAfterCancel } = await request("/schedule/my", {
    headers: studentAuthHeaders,
  });

  const canceledStudentSchedule = studentScheduleAfterCancel.schedules.find(
    (schedule) => schedule.id === scheduleId
  );

  if (!canceledStudentSchedule || canceledStudentSchedule.status !== "canceled") {
    throw new Error("Canceled schedule was not visible to the student");
  }

  console.log("Shared schedule flow validated");

  console.log("8. Validate teacher review flow");
  const { data: teacherAssignments } = await request("/teacher/activities", {
    headers: authHeaders,
  });
  const teacherAssignment = teacherAssignments.find(
    (assignment) => assignment.activity_id === createdActivity.id
  );

  if (!teacherAssignment || teacherAssignment.material_count !== 2) {
    throw new Error("GET /teacher/activities did not return the created assignment");
  }

  const { data: reviewedAssignment } = await request(
    `/teacher/activities/${teacherAssignment.assignment_id}/review`,
    {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        teacher_summary: "Good completion and clear answers",
        teacher_feedback: "Review pronunciation in the second answer",
        teacher_grade: 9,
        teacher_observations: "Next class: revisit listening speed",
      }),
    }
  );

  if (reviewedAssignment.status !== "reviewed" || reviewedAssignment.teacher_grade !== 9) {
    throw new Error("PATCH /teacher/activities/:assignmentId/review did not review assignment");
  }

  const { data: reviewedStudentActivity } = await request(`/my-activities/${createdActivity.id}`, {
    headers: studentAuthHeaders,
  });

  if (
    reviewedStudentActivity.status !== "reviewed" ||
    reviewedStudentActivity.teacher_feedback !== "Review pronunciation in the second answer"
  ) {
    throw new Error("Reviewed feedback was not visible to the student");
  }

  console.log("Teacher review flow validated");

  console.log("9. Validate general student feedback profile");
  const generalComment = "Excellent progress in speaking this week. Keep practicing listening.";
  const { data: savedFeedbackProfile } = await request(
    `/students/${tempStudentId}/feedback-profile`,
    {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        speaking_rating: 5,
        listening_rating: 3,
        writing_rating: 4,
        reading_rating: 4,
        teacher_comment: generalComment,
      }),
    }
  );

  if (
    savedFeedbackProfile.speaking_rating !== 5 ||
    savedFeedbackProfile.teacher_comment !== generalComment
  ) {
    throw new Error("PATCH /students/:studentId/feedback-profile did not save the general feedback profile");
  }

  const { data: studentFeedbackProfile } = await request("/my-feedback-profile", {
    headers: studentAuthHeaders,
  });

  if (
    studentFeedbackProfile.student_id !== tempStudentId ||
    studentFeedbackProfile.teacher_comment !== generalComment
  ) {
    throw new Error("GET /my-feedback-profile did not return the teacher's general feedback");
  }

  console.log("General student feedback profile validated");

  console.log("10. Patch activity");
  const { data: updatedActivity } = await request(`/activities/${createdActivity.id}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({
      title: "Listening Practice Updated",
      description: "Complete the audio exercise and write five answers",
      deadline: "2026-05-21",
      points: 15,
    }),
  });

  if (updatedActivity.points !== 15) {
    throw new Error("PATCH /activities/:id did not update points");
  }

  console.log("Activity updated");

  console.log("11. Delete activity");
  await request(`/activities/${createdActivity.id}`, {
    method: "DELETE",
    headers: authHeaders,
  });

  console.log("Activity deleted");
  console.log("Admin flow completed successfully");

  if (tempStudentId) {
    await pool.query("DELETE FROM users WHERE id = $1", [tempStudentId]);
    tempStudentId = null;
  }

  if (tempAvailabilityId) {
    await pool.query("DELETE FROM teacher_availability WHERE id = $1", [tempAvailabilityId]);
    tempAvailabilityId = null;
  }
}

testAdminFlow().catch((error) => {
  console.error("Admin flow failed");
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
