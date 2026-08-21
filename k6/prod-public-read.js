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
const VUS = Number(__ENV.VUS || 10);
const DURATION = __ENV.DURATION || "1m";

export function setup() {
  requireProdConfirm();
}

export const options = {
  scenarios: {
    prod_public_reads: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: prodThresholds,
};

const paths = ["/api/health", "/api/event/current", "/api/payments", "/api/event/current/results"];

export default function () {
  for (const path of paths) {
    const res = http.get(`${BASE_URL}${path}`, { tags: { name: path }, headers: publicHeaders() });
    check(res, {
      [`${path} status 200`]: (r) => checkJson(r),
    });
  }
  sleep(Number(__ENV.SLEEP || 0.5));
}

export function handleSummary(data) {
  const failed = data.metrics.http_req_failed?.values?.rate ?? 0;
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"] ?? 0;
  const rps = data.metrics.http_reqs?.values?.rate ?? 0;
  const maxVus = data.metrics.vus_max?.values?.max ?? 0;

  return {
    stdout: [
      "",
      "Production load test summary",
      "----------------------------",
      `Target: ${BASE_URL}`,
      `Peak concurrent users: ${maxVus}`,
      `Request rate: ${rps.toFixed(1)} req/s`,
      `Failed requests: ${(failed * 100).toFixed(2)}%`,
      `p95 latency: ${p95.toFixed(0)} ms`,
      "",
    ].join("\n"),
  };
}
