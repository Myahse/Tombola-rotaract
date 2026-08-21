import http from "k6/http";
import { check, sleep } from "k6";
import {
  PROD_BASE_URL,
  prodThresholds,
  publicHeaders,
  checkJson,
  requireProdConfirm,
} from "./lib/config.js";

const BASE_URL = __ENV.BASE_URL || PROD_BASE_URL;
const MAX_VUS = Number(__ENV.MAX_VUS || 30);
const STEP = Number(__ENV.STEP || 5);
const STEP_DURATION = __ENV.STEP_DURATION || "45s";

const stages = [{ duration: "20s", target: STEP }];
for (let vus = STEP * 2; vus <= MAX_VUS; vus += STEP) {
  stages.push({ duration: STEP_DURATION, target: vus });
}
stages.push({ duration: "20s", target: 0 });

export function setup() {
  requireProdConfirm();
}

export const options = {
  scenarios: {
    prod_ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages,
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.05", abortOnFail: false }],
    http_req_duration: [{ threshold: "p(95)<8000", abortOnFail: false }],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/event/current`, {
    tags: { name: "event_current" },
    headers: publicHeaders(),
  });
  check(res, {
    "event/current 200": (r) => checkJson(r),
  });
  sleep(Number(__ENV.SLEEP || 0.4));
}

export function handleSummary(data) {
  const failed = data.metrics.http_req_failed?.values?.rate ?? 0;
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"] ?? 0;
  const maxVus = data.metrics.vus_max?.values?.max ?? 0;
  const rps = data.metrics.http_reqs?.values?.rate ?? 0;

  return {
    stdout: [
      "",
      "Production concurrency ramp",
      "---------------------------",
      `Target: ${BASE_URL}`,
      `Peak concurrent users: ${maxVus}`,
      `Request rate: ${rps.toFixed(1)} req/s`,
      `Failed requests: ${(failed * 100).toFixed(2)}%`,
      `p95 latency: ${p95.toFixed(0)} ms`,
      "",
      "If failures climb before max VUs, that step is near prod capacity.",
      "",
    ].join("\n"),
  };
}
