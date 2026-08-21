import { check, sleep } from "k6";
import { PROD_BASE_URL, requireProdConfirm } from "./lib/config.js";
import { authMe, credentialsForVu, login, requireCredentials } from "./lib/member.js";
import http from "k6/http";

const BASE_URL = __ENV.BASE_URL || PROD_BASE_URL;
const VUS = Number(__ENV.VUS || 3);
const DURATION = __ENV.DURATION || "30s";

export function setup() {
  requireProdConfirm();
  requireCredentials();
}

export const options = {
  vus: Math.min(VUS, 5),
  duration: DURATION,
  thresholds: {
    http_req_failed: ["rate<0.10"],
    http_req_duration: ["p(95)<8000"],
  },
};

let jar;
let loggedIn = false;

export default function () {
  if (!jar) {
    jar = http.cookieJar();
  }
  if (!loggedIn) {
    const creds = credentialsForVu(__VU);
    const res = login(BASE_URL, jar, creds.email, creds.password);
    check(res, { "login 200": (r) => r.status === 200 });
    loggedIn = res.status === 200;
    if (!loggedIn) return;
  }

  const me = authMe(BASE_URL, jar);
  check(me, { "auth/me 200": (r) => r.status === 200 });

  sleep(0.5);
}
