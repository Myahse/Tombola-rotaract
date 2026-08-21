import http from "k6/http";
import { check, sleep } from "k6";
import { PROD_BASE_URL, publicHeaders, checkJson, requireProdConfirm } from "./lib/config.js";

const BASE_URL = __ENV.BASE_URL || PROD_BASE_URL;

export function setup() {
  requireProdConfirm();
}

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  const health = http.get(`${BASE_URL}/api/health`, { headers: publicHeaders() });
  check(health, { "health ok": (r) => checkJson(r) });

  const event = http.get(`${BASE_URL}/api/event/current`, { headers: publicHeaders() });
  check(event, { "event ok": (r) => checkJson(r) });

  sleep(0.2);
}
