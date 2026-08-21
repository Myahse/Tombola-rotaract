import { check, sleep } from "k6";
import { BASE_URL } from "./lib/config.js";
import { authMe, credentialsForVu, login, requireCredentials, assertApiReady } from "./lib/member.js";
import http from "k6/http";

const VUS = Number(__ENV.VUS || 10);
const DURATION = __ENV.DURATION || "30s";

export function setup() {
  assertApiReady(BASE_URL);
  requireCredentials();
}

export const options = {
  scenarios: {
    member_login: {
      executor: "constant-vus",
      vus: Math.min(VUS, 15),
      duration: DURATION,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.15"],
    http_req_duration: ["p(95)<3000"],
  },
};

let jar;
let authState = "pending";

export default function () {
  if (!jar) {
    jar = http.cookieJar();
  }

  if (authState === "pending") {
    sleep((__VU - 1) * 0.5);
    const creds = credentialsForVu(__VU);
    const res = login(BASE_URL, jar, creds.email, creds.password);
    check(res, {
      "login 200": (r) => r.status === 200,
      "login not rate limited": (r) => r.status !== 429,
    });
    authState = res.status === 200 ? "ok" : "failed";
    if (authState === "failed") {
      sleep(5);
      return;
    }
  }

  if (authState !== "ok") {
    sleep(5);
    return;
  }

  const me = authMe(BASE_URL, jar);
  check(me, {
    "auth/me 200": (r) => r.status === 200,
  });

  sleep(Number(__ENV.SLEEP || 0.5));
}
