import http from "k6/http";

export function jsonHeaders() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export function credentialsForVu(vu) {
  const template = __ENV.K6_TEST_EMAIL_TEMPLATE;
  const password = __ENV.K6_TEST_PASSWORD;
  if (!password) {
    return null;
  }
  if (template) {
    return {
      email: template.replace("{vu}", String(vu)),
      password,
    };
  }
  const email = __ENV.K6_TEST_EMAIL;
  if (!email) {
    return null;
  }
  return { email, password };
}

export function requireCredentials() {
  const sample = credentialsForVu(1);
  if (!sample) {
    throw new Error(
      "Set K6_TEST_PASSWORD and K6_TEST_EMAIL (or K6_TEST_EMAIL_TEMPLATE with {vu} placeholder).",
    );
  }
}

export function assertApiReady(baseUrl) {
  const health = http.get(`${baseUrl}/api/health`, { timeout: "10s" });
  if (health.status !== 200) {
    throw new Error(`API not reachable at ${baseUrl} (health status ${health.status}).`);
  }
  const event = http.get(`${baseUrl}/api/event/current`, { timeout: "10s" });
  if (event.status !== 200) {
    throw new Error(
      `Database routes not responding at ${baseUrl} (event/current status ${event.status}). Restart the backend: npm run dev --prefix backend`,
    );
  }
}

export function login(baseUrl, jar, email, password) {
  return http.post(`${baseUrl}/api/auth/login`, JSON.stringify({ email, password }), {
    jar,
    headers: jsonHeaders(),
    tags: { name: "auth_login" },
    timeout: "15s",
  });
}

export function registerVu(baseUrl, jar, vu) {
  const email = `k6load.vu${vu}.${Date.now()}@example.invalid`;
  const body = {
    name: `K6 User ${vu}`,
    email,
    phone: "+221701234567",
    password: "K6TestPass1!",
    clubName: "Load Test Club",
    clubRole: "Tester",
    acceptTerms: true,
    acceptEmails: true,
  };
  const res = http.post(`${baseUrl}/api/auth/register`, JSON.stringify(body), {
    jar,
    headers: jsonHeaders(),
    tags: { name: "auth_register" },
    timeout: "15s",
  });
  return { res, email, password: body.password };
}

export function authMe(baseUrl, jar) {
  return http.get(`${baseUrl}/api/auth/me`, {
    jar,
    headers: jsonHeaders(),
    tags: { name: "auth_me" },
  });
}

export function buyTickets(baseUrl, jar, quantity) {
  return http.post(
    `${baseUrl}/api/orders`,
    JSON.stringify({
      quantity,
      paymentMethod: "cash",
    }),
    { jar, headers: jsonHeaders(), tags: { name: "orders_buy" } },
  );
}

export function getOrder(baseUrl, jar, token) {
  return http.get(`${baseUrl}/api/orders/${token}`, {
    jar,
    headers: jsonHeaders(),
    tags: { name: "orders_get" },
  });
}

export function cancelOrder(baseUrl, jar, token) {
  return http.post(`${baseUrl}/api/orders/${token}/cancel`, null, {
    jar,
    headers: jsonHeaders(),
    tags: { name: "orders_cancel" },
  });
}
