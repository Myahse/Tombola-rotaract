import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, defaultThresholds, publicHeaders, checkJson } from "./lib/config.js";

const VUS = Number(__ENV.VUS || 25);
const DURATION = __ENV.DURATION || "1m";

export const options = {
  scenarios: {
    public_reads: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: defaultThresholds,
};

const paths = ["/api/health", "/api/event/current", "/api/payments", "/api/event/current/results"];

export default function () {
  for (const path of paths) {
    const res = http.get(`${BASE_URL}${path}`, { tags: { name: path }, headers: publicHeaders() });
    check(res, {
      [`${path} status 200`]: (r) => checkJson(r, path),
    });
  }
  sleep(0.3);
}
