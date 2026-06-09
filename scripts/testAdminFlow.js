require("dotenv").config();

const bcrypt = require("bcrypt");

const { pool } = require("../src/database/pool");

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const TEST_PASSWORD = "Test#1234";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin#2026";
const TEST_CLIENT_ID = process.env.TEST_CLIENT_ID || `admin-flow-${process.pid}-${Date.now()}`;

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Test-Client-Id": TEST_CLIENT_ID,
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
      password: ADMIN_PASSWORD,
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
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
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
      password: TEST_PASSWORD,
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
          type: "pdf",
          title: "PDF por link",
          url: "https://example.com/listening-practice.pdf",
        },
        {
          type: "link",
          title: "Site de apoio",
          url: "https://example.com/listening-practice",
        },
      ],
    }),
  });

  if (createdActivity.materials.length !== 2) {
    throw new Error("POST /activities did not save activity materials");
  }

  if (
    !createdActivity.materials.some(
      (material) =>
        material.type === "pdf" &&
        material.url === "https://example.com/listening-practice.pdf"
    )
  ) {
    throw new Error("POST /activities did not save the PDF link material");
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

  const studentActivity = myActivities.find((activity) => activity.id === createdActivity.id);

  if (!studentActivity) {
    throw new Error("Created activity was not found in GET /my-activities");
  }

  const studentLinkMaterial = studentActivity.materials?.find(
    (material) => material.type === "link" && material.title === "Site de apoio"
  );

  if (
    !studentLinkMaterial ||
    studentLinkMaterial.url !== "https://example.com/listening-practice" ||
    studentLinkMaterial.file_id
  ) {
    throw new Error("GET /my-activities did not expose the clickable link material");
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

  console.log("7. Validate study materials flow");
  const { data: createdMaterial } = await request("/teacher/materials", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      student_id: tempStudentId,
      title: "Travel vocabulary",
      description: "Study before the next class",
      type: "vocabulary",
      url: "https://docs.google.com/document/example-material",
    }),
  });

  if (createdMaterial.student_id !== tempStudentId || createdMaterial.type !== "vocabulary") {
    throw new Error("POST /teacher/materials did not create a student material");
  }

  const { data: teacherMaterials } = await request(`/teacher/materials?studentId=${tempStudentId}`, {
    headers: authHeaders,
  });

  if (!teacherMaterials.some((material) => material.id === createdMaterial.id)) {
    throw new Error("GET /teacher/materials?studentId did not return the created material");
  }

  const { data: myMaterials } = await request("/my-materials", {
    headers: studentAuthHeaders,
  });

  if (!myMaterials.some((material) => material.id === createdMaterial.id)) {
    throw new Error("GET /my-materials did not return the student's material");
  }

  const { data: updatedMaterial } = await request(`/teacher/materials/${createdMaterial.id}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({
      student_id: tempStudentId,
      title: "Travel vocabulary updated",
      description: "Updated study note",
      type: "document",
      url: "https://docs.google.com/document/updated-material",
    }),
  });

  if (updatedMaterial.title !== "Travel vocabulary updated" || updatedMaterial.type !== "document") {
    throw new Error("PATCH /teacher/materials/:materialId did not update the material");
  }

  await request(`/teacher/materials/${createdMaterial.id}`, {
    method: "DELETE",
    headers: authHeaders,
  });

  const { data: myMaterialsAfterDelete } = await request("/my-materials", {
    headers: studentAuthHeaders,
  });

  if (myMaterialsAfterDelete.some((material) => material.id === createdMaterial.id)) {
    throw new Error("DELETE /teacher/materials/:materialId did not remove the material from the student");
  }

  console.log("Study materials flow validated");

  console.log("8. Validate shared schedule flow");
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

  console.log("9. Validate teacher review flow");
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
        teacher_feedback: "Review pronunciation in the second answer",
        teacher_grade: 9,
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

  console.log("10. Validate general student feedback profile");
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

  console.log("11. Patch activity");
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

  console.log("12. Delete activity");
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
