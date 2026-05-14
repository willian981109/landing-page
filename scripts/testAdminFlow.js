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
  const { data: activities } = await request("/activities");
  const persistedActivity = activities.find((activity) => activity.id === createdActivity.id);

  if (!persistedActivity) {
    throw new Error("Created activity was not found in GET /activities");
  }

  if (persistedActivity.materials.length !== 2) {
    throw new Error("Created activity materials were not found in GET /activities");
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

  console.log("7. Patch activity");
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

  console.log("8. Delete activity");
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
}

testAdminFlow().catch((error) => {
  console.error("Admin flow failed");
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
