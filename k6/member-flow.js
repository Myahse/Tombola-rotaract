import { check, sleep } from "k6";
import { BASE_URL } from "./lib/config.js";
import {
  authMe,
  buyTickets,
  cancelOrder,
  credentialsForVu,
  getOrder,
  login,
  registerVu,
  requireCredentials,
  assertApiReady,
} from "./lib/member.js";
import http from "k6/http";

const VUS = Number(__ENV.VUS || 5);
const DURATION = __ENV.DURATION || "1m";
const QUANTITY = Number(__ENV.QUANTITY || 1);
const AUTO_REGISTER = __ENV.K6_AUTO_REGISTER === "yes";

export function setup() {
  assertApiReady(BASE_URL);
  if (!AUTO_REGISTER) {
    requireCredentials();
  }
}

export const options = {
  scenarios: {
    member_buy_flow: {
      executor: "constant-vus",
      vus: AUTO_REGISTER ? Math.min(VUS, 8) : VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.10"],
    http_req_duration: ["p(95)<5000"],
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
    if (AUTO_REGISTER) {
      const { res } = registerVu(BASE_URL, jar, __VU);
      check(res, {
        "register 201": (r) => r.status === 201,
        "register not rate limited": (r) => r.status !== 429,
      });
      authState = res.status === 201 ? "ok" : "failed";
    } else {
      const creds = credentialsForVu(__VU);
      const res = login(BASE_URL, jar, creds.email, creds.password);
      check(res, {
        "login 200": (r) => r.status === 200,
        "login not rate limited": (r) => r.status !== 429,
      });
      if (res.status === 429) {
        console.warn("Login rate limited (15 per 15 min per IP). Wait or clear rate_limits in DB.");
      }
      authState = res.status === 200 ? "ok" : "failed";
    }
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
  if (me.status !== 200) {
    return;
  }

  const buy = buyTickets(BASE_URL, jar, QUANTITY);
  const buyOk = check(buy, {
    "buy 201": (r) => r.status === 201,
    "buy not rate limited": (r) => r.status !== 429,
  });
  if (!buyOk || buy.status !== 201) {
    sleep(Number(__ENV.SLEEP || 2));
    return;
  }

  let token;
  try {
    token = buy.json("token");
  } catch {
    sleep(Number(__ENV.SLEEP || 2));
    return;
  }

  const order = getOrder(BASE_URL, jar, token);
  check(order, {
    "order get 200": (r) => r.status === 200,
  });

  const cancelled = cancelOrder(BASE_URL, jar, token);
  check(cancelled, {
    "cancel 200": (r) => r.status === 200,
  });

  sleep(Number(__ENV.SLEEP || 2));
}
