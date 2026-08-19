import { participantEmail, type ParticipantEmail } from "../emails/participant.js";
import { purchaseEmail, type PurchaseEmail } from "../emails/purchase.js";
import { welcomeEmail } from "../emails/welcome.js";
import { winnerEmail, type WinnerEmail } from "../emails/winner.js";
import { optionalTemplateId, sendBrevoEmail } from "./brevo.js";

async function send(to: { email: string; name?: string }, message: { subject: string; html: string; text: string; params?: Record<string, string> }, templateEnv?: Parameters<typeof optionalTemplateId>[0]) {
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

export async function notifyTombolaWinners(winners: WinnerEmail[]) {
  for (const winner of winners) {
    if (!winner.email) continue;
    try {
      await send({ email: winner.email, name: winner.name }, winnerEmail(winner), "BREVO_TEMPLATE_WINNER");
    } catch (error) {
      console.error(`Winner email failed for ${winner.email}`, error);
    }
  }
}

export async function notifyTombolaParticipants(participants: ParticipantEmail[]) {
  for (const participant of participants) {
    if (!participant.email) continue;
    try {
      await send(
        { email: participant.email, name: participant.name },
        participantEmail(participant),
        "BREVO_TEMPLATE_PARTICIPANT",
      );
    } catch (error) {
      console.error(`Participant email failed for ${participant.email}`, error);
    }
  }
}
