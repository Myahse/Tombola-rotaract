import http from "k6/http";
import { check, sleep } from "k6";
import { BASE_URL, publicHeaders, checkJson } from "./lib/config.js";

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  const health = http.get(`${BASE_URL}/api/health`, { headers: publicHeaders() });
  check(health, { "health ok": (r) => checkJson(r, "health") });

  const event = http.get(`${BASE_URL}/api/event/current`, { headers: publicHeaders() });
  check(event, { "event ok": (r) => checkJson(r, "event") });

  sleep(0.2);
}
