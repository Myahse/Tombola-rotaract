import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, publicHeaders, checkJson } from "./lib/config.js";

const MAX_VUS = Number(__ENV.MAX_VUS || 100);
const STEP = Number(__ENV.STEP || 10);
const STEP_DURATION = __ENV.STEP_DURATION || "30s";

const stages = [{ duration: "15s", target: STEP }];
for (let vus = STEP * 2; vus <= MAX_VUS; vus += STEP) {
  stages.push({ duration: STEP_DURATION, target: vus });
}
stages.push({ duration: "15s", target: 0 });

export const options = {
  scenarios: {
    ramp_public_api: {
      executor: "ramping-vus",
      startVUs: 0,
      stages,
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.10", abortOnFail: false }],
    http_req_duration: [{ threshold: "p(95)<3000", abortOnFail: false }],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/event/current`, {
    tags: { name: "event_current" },
    headers: publicHeaders(),
  });
  check(res, {
    "event/current 200": (r) => checkJson(r, "event"),
  });
  sleep(0.2);
}

export function handleSummary(data) {
  const failed = data.metrics.http_req_failed?.values?.rate ?? 0;
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"] ?? 0;
  const maxVus = data.metrics.vus_max?.values?.max ?? 0;
  const rps = data.metrics.http_reqs?.values?.rate ?? 0;

  const lines = [
    "",
    "Concurrency ramp summary",
    "------------------------",
    `Peak virtual users (concurrent): ${maxVus}`,
    `Request rate: ${rps.toFixed(1)} req/s`,
    `Failed requests: ${(failed * 100).toFixed(2)}%`,
    `p95 latency: ${p95.toFixed(0)} ms`,
    "",
    "Tip: raise MAX_VUS or lower STEP if the run finished without errors.",
    "Watch for the step where failures or p95 jump — that is near your limit.",
    "",
  ];

  return {
    stdout: lines.join("\n"),
  };
}
