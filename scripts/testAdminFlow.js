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

  console.log("2. Create activity");
  const { data: createdActivity } = await request("/activities", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      title: "Listening Practice",
      description: "Complete the audio exercise",
      deadline: "2026-05-20",
      points: 10,
    }),
  });

  console.log(`Activity created: ${createdActivity.id}`);

  console.log("3. Validate persistence with GET /activities");
  const { data: activities } = await request("/activities");
  const persistedActivity = activities.find((activity) => activity.id === createdActivity.id);

  if (!persistedActivity) {
    throw new Error("Created activity was not found in GET /activities");
  }

  console.log("Activity found in database result");

  console.log("4. Patch activity");
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

  console.log("5. Delete activity");
  await request(`/activities/${createdActivity.id}`, {
    method: "DELETE",
    headers: authHeaders,
  });

  console.log("Activity deleted");
  console.log("Admin flow completed successfully");
}

testAdminFlow().catch((error) => {
  console.error("Admin flow failed");
  console.error(error.message);
  process.exitCode = 1;
});
