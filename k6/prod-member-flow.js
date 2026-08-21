import { check, sleep } from "k6";
import { PROD_BASE_URL, prodThresholds, requireProdConfirm } from "./lib/config.js";
import {
  authMe,
  buyTickets,
  cancelOrder,
  credentialsForVu,
  getOrder,
  login,
  requireCredentials,
} from "./lib/member.js";
import http from "k6/http";

const BASE_URL = __ENV.BASE_URL || PROD_BASE_URL;
const VUS = Number(__ENV.VUS || 3);
const DURATION = __ENV.DURATION || "45s";
const QUANTITY = Number(__ENV.QUANTITY || 1);

export function setup() {
  requireProdConfirm();
  requireCredentials();
}

export const options = {
  scenarios: {
    prod_member_buy: {
      executor: "constant-vus",
      vus: Math.min(VUS, 5),
      duration: DURATION,
    },
  },
  thresholds: prodThresholds,
};

let jar;
let ready = false;

export default function () {
  if (!jar) {
    jar = http.cookieJar();
  }
  if (!ready) {
    const creds = credentialsForVu(__VU);
    const res = login(BASE_URL, jar, creds.email, creds.password);
    check(res, {
      "login 200": (r) => r.status === 200,
    });
    if (res.status !== 200) {
      return;
    }
    ready = true;
  }

  const me = authMe(BASE_URL, jar);
  check(me, { "auth/me 200": (r) => r.status === 200 });
  if (me.status !== 200) {
    return;
  }

  const buy = buyTickets(BASE_URL, jar, QUANTITY);
  if (buy.status !== 201) {
    check(buy, {
      "buy ok or expected error": (r) => r.status === 201 || r.status === 409 || r.status === 429,
    });
    sleep(Number(__ENV.SLEEP || 3));
    return;
  }

  let token;
  try {
    token = buy.json("token");
  } catch {
    return;
  }

  getOrder(BASE_URL, jar, token);
  cancelOrder(BASE_URL, jar, token);

  sleep(Number(__ENV.SLEEP || 3));
}

export function handleSummary(data) {
  const failed = data.metrics.http_req_failed?.values?.rate ?? 0;
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"] ?? 0;

  return {
    stdout: [
      "",
      "Production member flow (login + buy + cancel)",
      "------------------------------------------------",
      `Target: ${BASE_URL}`,
      `Failed requests: ${(failed * 100).toFixed(2)}%`,
      `p95 latency: ${p95.toFixed(0)} ms`,
      "",
      "Uses a real test account — orders are reserved then cancelled.",
      "",
    ].join("\n"),
  };
}
