export const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
export const PROD_BASE_URL = "https://api.rotaractiugb.com";

export const defaultThresholds = {
  http_req_failed: ["rate<0.05"],
  http_req_duration: ["p(95)<2000"],
};

export const prodThresholds = {
  http_req_failed: ["rate<0.01"],
  http_req_duration: ["p(95)<5000"],
};

export function publicHeaders() {
  return {
    Accept: "application/json",
  };
}

export function checkJson(res) {
  return res.status === 200 && res.headers["Content-Type"]?.includes("application/json");
}

export function requireProdConfirm() {
  if (__ENV.CONFIRM !== "yes") {
    throw new Error(
      "Blocked: production load test. Re-run with CONFIRM=yes (e.g. npm run load:prod:public).",
    );
  }
}
