export class ApiError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function isRetryableApiError(err: unknown): err is ApiError {
  return isApiError(err) && (err.status === 429 || err.status === 503);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isRetryableApiError(err) || attempt >= maxAttempts - 1) {
        throw err;
      }
      const waitMs = (err.retryAfter ?? 2 + attempt) * 1000;
      await sleep(waitMs);
    }
  }
  throw last;
}

export type ErrorCopy = {
  key: string;
  retryAfter?: number;
};

export function errorCopy(err: unknown): ErrorCopy {
  if (!isApiError(err)) {
    if (err instanceof TypeError) {
      return { key: "serviceUnavailable" };
    }
    return { key: "generic" };
  }
  if (err.status === 429 || err.message === "too_many_requests") {
    return { key: "retryRegister", retryAfter: err.retryAfter };
  }
  if (err.status === 503 || err.message === "server_error") {
    return { key: "serviceUnavailable", retryAfter: err.retryAfter };
  }
  const known = [
    "email_taken",
    "terms_required",
    "invalid_form",
    "invalid_credentials",
    "not_enough_tickets",
    "not_on_sale",
    "sales_not_open",
    "login_required",
  ];
  if (known.includes(err.message)) {
    return { key: err.message };
  }
  return { key: "generic" };
}
