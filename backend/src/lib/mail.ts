import { welcomeEmail } from "../emails/welcome.js";
import { winnerEmail, type WinnerEmail } from "../emails/winner.js";
import { optionalTemplateId, sendBrevoEmail } from "./brevo.js";

export async function notifyMemberRegistered(member: { name: string; email: string }) {
  const message = welcomeEmail(member);
  try {
    await sendBrevoEmail({
      to: { email: member.email, name: member.name },
      subject: message.subject,
      html: message.html,
      text: message.text,
      templateId: optionalTemplateId("BREVO_TEMPLATE_WELCOME"),
      params: message.params,
    });
  } catch (error) {
    console.error("Welcome email failed", error);
  }
}

export async function notifyTombolaWinners(winners: WinnerEmail[]) {
  for (const winner of winners) {
    if (!winner.email) continue;
    const message = winnerEmail(winner);
    try {
      await sendBrevoEmail({
        to: { email: winner.email, name: winner.name },
        subject: message.subject,
        html: message.html,
        text: message.text,
        templateId: optionalTemplateId("BREVO_TEMPLATE_WINNER"),
        params: message.params,
      });
    } catch (error) {
      console.error(`Winner email failed for ${winner.email}`, error);
    }
  }
}
