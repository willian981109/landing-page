require("dotenv").config();

const bcrypt = require("bcrypt");

const { pool } = require("../src/database/pool");

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const TEST_PREFIX = `security.${Date.now()}`;
const TEST_PASSWORD = "Test#1234";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin#2026";
const TEST_CLIENT_ID = process.env.TEST_CLIENT_ID || `security-flow-${process.pid}-${Date.now()}`;

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Test-Client-Id": TEST_CLIENT_ID,
      ...(options.headers || {}),
    },
  });

  const data = response.status === 204 ? null : await response.json().catch(() => ({}));

  return { response, data };
}

async function expectStatus(path, expectedStatus, options = {}) {
  const { response, data } = await request(path, options);

  if (response.status !== expectedStatus) {
    throw new Error(
      `${path} expected ${expectedStatus}, got ${response.status}: ${data?.error || "no error body"}`
    );
  }

  return data;
}

async function requestOk(path, options = {}) {
  const { response, data } = await request(path, options);

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${data?.error || "Request failed"}`);
  }

  return data;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createUser({ name, email, role }) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const result = await pool.query(
    `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email
    `,
    [name, email, passwordHash, role]
  );

  return result.rows[0];
}

async function login(email, password = TEST_PASSWORD) {
  const data = await requestOk("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!data.token) {
    throw new Error(`Login for ${email} did not return token`);
  }

  return data;
}

async function cleanup(createdActivityIds = []) {
  for (const activityId of createdActivityIds) {
    await pool.query("DELETE FROM activities WHERE id = $1", [activityId]);
  }

  await pool.query("DELETE FROM users WHERE email LIKE $1", [`${TEST_PREFIX}.%@english.test`]);
}

async function testSecurityFlow() {
  const createdActivityIds = [];
  const createdMaterialIds = [];

  try {
    console.log("1. Login baseline teacher");
    const adminLogin = await login("admin@english.com", ADMIN_PASSWORD);
    const adminToken = adminLogin.token;

    console.log("2. Create temporary users");
    const studentOne = await createUser({
      name: "Security Student One",
      email: `${TEST_PREFIX}.student1@english.test`,
      role: "student",
    });
    const studentTwo = await createUser({
      name: "Security Student Two",
      email: `${TEST_PREFIX}.student2@english.test`,
      role: "student",
    });
    const otherTeacher = await createUser({
      name: "Security Teacher Two",
      email: `${TEST_PREFIX}.teacher2@english.test`,
      role: "teacher",
    });

    const studentOneLogin = await login(studentOne.email);
    const studentTwoLogin = await login(studentTwo.email);
    const otherTeacherLogin = await login(otherTeacher.email);

    console.log("3. Validate unauthenticated and role-based blocks");
    await expectStatus("/activities", 401);
    await expectStatus("/students", 401);
    await expectStatus("/schedule/my", 401);
    await expectStatus("/activities", 403, {
      headers: authHeaders(studentOneLogin.token),
    });
    await expectStatus("/students", 403, {
      headers: authHeaders(studentOneLogin.token),
    });
    await expectStatus("/admin/schedule", 403, {
      headers: authHeaders(studentOneLogin.token),
    });
    await expectStatus("/my-activities", 403, {
      headers: authHeaders(adminToken),
    });
    await expectStatus("/teacher/materials", 401);
    await expectStatus("/teacher/materials", 403, {
      headers: authHeaders(studentOneLogin.token),
    });
    await expectStatus("/my-materials", 403, {
      headers: authHeaders(adminToken),
    });
    await expectStatus("/uploads/sign", 401, {
      method: "POST",
      body: JSON.stringify({}),
    });
    await expectStatus("/uploads/sign", 403, {
      method: "POST",
      headers: authHeaders(studentOneLogin.token),
      body: JSON.stringify({}),
    });
    await expectStatus("/uploads/sign", 400, {
      method: "POST",
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        material_type: "pdf",
        file_name: "malicious.exe",
        mime_type: "application/octet-stream",
        size_bytes: 100,
      }),
    });
    await expectStatus("/files/00000000-0000-4000-8000-000000000000/access", 404, {
      headers: authHeaders(studentOneLogin.token),
    });
    await expectStatus("/activities?studentId=not-a-uuid", 400, {
      headers: authHeaders(adminToken),
    });

    console.log("4. Create protected activity fixture");
    const createdActivity = await requestOk("/activities", {
      method: "POST",
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        title: "Security Ownership Activity",
        description: "Activity used to verify authorization boundaries",
        deadline: "2026-06-01",
        points: 10,
        studentId: studentOne.id,
        materials: [
          {
            type: "link",
            title: "Reference",
            url: "https://example.com/security-test",
          },
        ],
      }),
    });
    createdActivityIds.push(createdActivity.id);

    const teacherAssignments = await requestOk(`/activities?studentId=${studentOne.id}`, {
      headers: authHeaders(adminToken),
    });
    const assignment = teacherAssignments.find((item) => item.activity_id === createdActivity.id);

    if (!assignment?.assignment_id) {
      throw new Error("Filtered teacher activity did not include assignment_id");
    }

    console.log("5. Validate student isolation");
    await expectStatus(`/my-activities/${createdActivity.id}`, 404, {
      headers: authHeaders(studentTwoLogin.token),
    });
    await expectStatus(`/my-activities/${createdActivity.id}/complete`, 404, {
      method: "PATCH",
      headers: authHeaders(studentTwoLogin.token),
    });

    const ownActivity = await requestOk(`/my-activities/${createdActivity.id}`, {
      headers: authHeaders(studentOneLogin.token),
    });

    if (ownActivity.id !== createdActivity.id) {
      throw new Error("Assigned student could not access own activity");
    }

    console.log("6. Validate teacher ownership");
    await expectStatus(`/teacher/activities/${assignment.assignment_id}`, 404, {
      headers: authHeaders(otherTeacherLogin.token),
    });
    await expectStatus(`/teacher/activities/${assignment.assignment_id}/review`, 404, {
      method: "PATCH",
      headers: authHeaders(otherTeacherLogin.token),
      body: JSON.stringify({ teacher_feedback: "Should not save" }),
    });
    await expectStatus(`/activities/${createdActivity.id}`, 404, {
      method: "PATCH",
      headers: authHeaders(otherTeacherLogin.token),
      body: JSON.stringify({
        title: "Unauthorized update",
        description: "This should not update",
        deadline: "2026-06-02",
        points: 20,
      }),
    });
    await expectStatus(`/activities/${createdActivity.id}`, 404, {
      method: "DELETE",
      headers: authHeaders(otherTeacherLogin.token),
    });

    const otherTeacherFiltered = await requestOk(`/activities?studentId=${studentOne.id}`, {
      headers: authHeaders(otherTeacherLogin.token),
    });

    if (otherTeacherFiltered.length !== 0) {
      throw new Error("Other teacher received activities owned by the baseline teacher");
    }

    console.log("7. Validate study material isolation");
    const createdMaterial = await requestOk("/teacher/materials", {
      method: "POST",
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        student_id: studentOne.id,
        title: "Security material",
        description: "Only student one should see this",
        type: "pdf",
        url: "https://example.com/security-material.pdf",
      }),
    });
    createdMaterialIds.push(createdMaterial.id);

    const studentOneMaterials = await requestOk("/my-materials", {
      headers: authHeaders(studentOneLogin.token),
    });

    if (!studentOneMaterials.some((material) => material.id === createdMaterial.id)) {
      throw new Error("Assigned student could not access own material");
    }

    const studentTwoMaterials = await requestOk("/my-materials", {
      headers: authHeaders(studentTwoLogin.token),
    });

    if (studentTwoMaterials.some((material) => material.id === createdMaterial.id)) {
      throw new Error("Study material leaked to another student");
    }

    await expectStatus(`/teacher/materials/${createdMaterial.id}`, 404, {
      method: "PATCH",
      headers: authHeaders(otherTeacherLogin.token),
      body: JSON.stringify({
        student_id: studentOne.id,
        title: "Unauthorized material update",
        description: "Should not update",
        type: "link",
        url: "https://example.com/unauthorized",
      }),
    });

    await expectStatus(`/teacher/materials/${createdMaterial.id}`, 404, {
      method: "DELETE",
      headers: authHeaders(otherTeacherLogin.token),
    });

    console.log("8. Validate auth failures");
    await expectStatus("/auth/login", 401, {
      method: "POST",
      body: JSON.stringify({ email: "admin@english.com", password: "wrong-password" }),
    });
    await expectStatus("/auth/login", 400, {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", password: "whatever" }),
    });
    await expectStatus("/auth/register", 400, {
      method: "POST",
      body: JSON.stringify({
        name: "Weak Password",
        email: `${TEST_PREFIX}.weak@english.test`,
        password: "weak",
      }),
    });

    const registered = await requestOk("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Security Registered Student",
        email: `${TEST_PREFIX}.registered@english.test`,
        password: TEST_PASSWORD,
        role: "teacher",
      }),
    });

    if (registered.user?.role !== "student") {
      throw new Error("Public registration must only create student accounts");
    }

    console.log("Security flow completed successfully");
  } finally {
    for (const materialId of createdMaterialIds) {
      await pool.query("DELETE FROM study_materials WHERE id = $1", [materialId]);
    }
    await cleanup(createdActivityIds);
  }
}

testSecurityFlow()
  .catch((error) => {
    console.error("Security flow failed");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
