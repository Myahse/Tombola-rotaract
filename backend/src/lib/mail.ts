import { drawResultsEmail, type DrawResultsEmail } from "../emails/results.js";
import { purchaseEmail, type PurchaseEmail } from "../emails/purchase.js";
import { giftTicketsEmail, type GiftTicketsEmail } from "../emails/gift.js";
import { resetPasswordEmail, type ResetPasswordEmail } from "../emails/reset.js";
import { welcomeEmail } from "../emails/welcome.js";
import { siteUrl } from "../emails/layout.js";
import { optionalTemplateId, sendBrevoEmail } from "./brevo.js";
import { sendPushToEmail } from "./push.js";

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
  const numbers = order.numbers.join(", ");
  void sendPushToEmail(order.email, {
    title: "Paiement confirmé",
    body: numbers
      ? `Vos tickets sont dans le tirage. Numéros : ${numbers}`
      : "Vos tickets sont dans le tirage.",
    url: order.ticketsUrl,
  });
}

export async function notifyGiftTickets(data: GiftTicketsEmail) {
  try {
    await send({ email: data.email, name: data.name }, giftTicketsEmail(data));
  } catch (error) {
    console.error(`Gift tickets email failed for ${data.email}`, error);
  }
  void sendPushToEmail(data.email, {
    title: "Tickets offerts",
    body: `${data.giverName} vous a envoyé des tickets.`,
    url: data.ticketsUrl,
  });
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
    const won = recipient.wins.length > 0;
    void sendPushToEmail(recipient.email, {
      title:
        recipient.drawMode === "scratch"
          ? "C’est le moment de gratter"
          : won
            ? "Vous avez gagné"
            : "Le tirage est tombé",
      body:
        recipient.drawMode === "scratch"
          ? "La tombola est close. Grattez vos tickets."
          : won
            ? "Le tirage est tombé. Voyez vos lots."
            : "Voyez le palmarès de la tombola.",
      url:
        recipient.drawMode === "scratch" || won
          ? recipient.ticketsUrl
          : siteUrl("/fr/results"),
    });
  }
}
