import type { TFunction } from "i18next";
import { errorCopy } from "./apiError";

export function formatApiError(err: unknown, t: TFunction) {
  const copy = errorCopy(err);
  switch (copy.key) {
    case "retryRegister":
      return t("errors.retryRegister", { seconds: copy.retryAfter ?? 60 });
    case "serviceUnavailable":
      return t("errors.serviceUnavailable");
    case "email_taken":
      return t("errors.emailTaken");
    case "terms_required":
      return t("errors.termsRequired");
    case "invalid_form":
      return t("errors.invalidRegister");
    case "invalid_credentials":
      return t("errors.invalidCredentials");
    case "not_enough_tickets":
      return t("errors.notEnough");
    case "not_on_sale":
      return t("errors.notOnSale");
    case "sales_not_open":
      return t("errors.salesNotOpen");
    case "login_required":
      return t("buy.needAccount");
    default:
      return t("errors.generic");
  }
}

export function isRetryableError(err: unknown) {
  const copy = errorCopy(err);
  return copy.key === "retryRegister" || copy.key === "serviceUnavailable";
}
