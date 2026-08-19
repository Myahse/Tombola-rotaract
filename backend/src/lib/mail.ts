import { drawResultsEmail, type DrawResultsEmail } from "../emails/results.js";
import { purchaseEmail, type PurchaseEmail } from "../emails/purchase.js";
import { giftTicketsEmail, type GiftTicketsEmail } from "../emails/gift.js";
import { resetPasswordEmail, type ResetPasswordEmail } from "../emails/reset.js";
import { welcomeEmail } from "../emails/welcome.js";
import { optionalTemplateId, sendBrevoEmail } from "./brevo.js";

async function send(
  to: { email: string; name?: string },
  message: { subject: string; html: string; text: string; params?: Record<string, string> },
  templateEnv?: Parameters<typeof optionalTemplateId>[0],
) {
  await sendBrevoEmail({
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    templateId: templateEnv ? optionalTemplateId(templateEnv) : undefined,
    params: message.params,
  });
}

export async function notifyMemberRegistered(member: { name: string; email: string }) {
  try {
    await send({ email: member.email, name: member.name }, welcomeEmail(member), "BREVO_TEMPLATE_WELCOME");
  } catch (error) {
    console.error("Welcome email failed", error);
  }
}

export async function notifyPurchase(order: PurchaseEmail) {
  if (!order.email) return;
  try {
    await send({ email: order.email, name: order.name }, purchaseEmail(order), "BREVO_TEMPLATE_PURCHASE");
  } catch (error) {
    console.error(`Purchase email failed for ${order.email}`, error);
  }
}

export async function notifyGiftTickets(data: GiftTicketsEmail) {
  try {
    await send({ email: data.email, name: data.name }, giftTicketsEmail(data));
  } catch (error) {
    console.error(`Gift tickets email failed for ${data.email}`, error);
  }
}

export async function notifyPasswordReset(data: ResetPasswordEmail) {
  try {
    await send({ email: data.email, name: data.name }, resetPasswordEmail(data));
  } catch (error) {
    console.error(`Password reset email failed for ${data.email}`, error);
  }
}

export async function notifyDrawResults(recipients: DrawResultsEmail[]) {
  for (const recipient of recipients) {
    if (!recipient.email) continue;
    try {
      await send(
        { email: recipient.email, name: recipient.name },
        drawResultsEmail(recipient),
        "BREVO_TEMPLATE_WINNER",
      );
    } catch (error) {
      console.error(`Draw results email failed for ${recipient.email}`, error);
    }
  }
}
