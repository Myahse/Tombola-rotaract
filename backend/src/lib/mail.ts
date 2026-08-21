import { drawResultsEmail, type DrawResultsEmail } from "../emails/results.js";
import { purchaseEmail, type PurchaseEmail } from "../emails/purchase.js";
import { giftTicketsEmail, type GiftTicketsEmail } from "../emails/gift.js";
import { resetPasswordEmail, type ResetPasswordEmail } from "../emails/reset.js";
import { verifyEmailMessage, type VerifyEmail } from "../emails/verify.js";
import { welcomeEmail } from "../emails/welcome.js";
import { siteUrl } from "../emails/layout.js";
import { optionalTemplateId, sendBrevoEmail } from "./brevo.js";
import { buildPurchaseReceiptPdf, purchaseReceiptPdfFilename } from "./purchaseReceiptPdf.js";
import { sendPushToMemberOrEmail, type PushPayload } from "./push.js";

type MemberTarget = {
  memberId?: string | null;
  email?: string | null;
};

async function send(
  to: { email: string; name?: string },
  message: {
    subject: string;
    html: string;
    text: string;
    params?: Record<string, string>;
    attachments?: { name: string; content: string }[];
  },
  templateEnv?: Parameters<typeof optionalTemplateId>[0],
) {
  await sendBrevoEmail({
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    templateId: templateEnv ? optionalTemplateId(templateEnv) : undefined,
    params: message.params,
    attachments: message.attachments,
  });
}

function hasMemberTarget(target: MemberTarget) {
  return Boolean(target.memberId || target.email?.trim());
}

async function deliverMemberPush(target: MemberTarget, payload: PushPayload) {
  if (!hasMemberTarget(target)) return;
  try {
    await sendPushToMemberOrEmail(target, payload);
  } catch (error) {
    console.error("Member push failed", error);
  }
}

async function deliverEmailAndPush(
  target: MemberTarget & { name?: string },
  emailTask: (() => Promise<void>) | null,
  pushPayload: PushPayload,
) {
  const tasks: Promise<void>[] = [deliverMemberPush(target, pushPayload)];
  if (emailTask) tasks.push(emailTask());
  await Promise.allSettled(tasks);
}

export async function notifyMemberRegistered(member: { name: string; email: string; id?: string }) {
  const target = { memberId: member.id, email: member.email };
  await deliverEmailAndPush(
    target,
    async () => {
      try {
        await send({ email: member.email, name: member.name }, welcomeEmail(member), "BREVO_TEMPLATE_WELCOME");
      } catch (error) {
        console.error("Welcome email failed", error);
        throw error;
      }
    },
    {
      title: "Bienvenue",
      body: `${member.name}, votre compte Tombola du club est prêt.`,
      url: siteUrl("/fr/account"),
    },
  );
}

export async function notifyPurchase(order: PurchaseEmail & MemberTarget) {
  if (!hasMemberTarget(order)) return;
  const numbers = order.numbers.join(", ");
  await deliverEmailAndPush(
    order,
    order.email
      ? async () => {
          try {
            const message = purchaseEmail(order);
            let attachments: { name: string; content: string }[] | undefined;
            try {
              const pdf = await buildPurchaseReceiptPdf(order);
              attachments = [
                {
                  name: purchaseReceiptPdfFilename(order),
                  content: pdf.toString("base64"),
                },
              ];
            } catch (error) {
              console.error("Purchase receipt PDF failed", error);
            }
            await send(
              { email: order.email, name: order.name },
              { ...message, attachments },
              "BREVO_TEMPLATE_PURCHASE",
            );
          } catch (error) {
            console.error(`Purchase email failed for ${order.email}`, error);
            throw error;
          }
        }
      : null,
    {
      title: "Paiement confirmé",
      body: numbers
        ? `Reçu confirmé · n° ${numbers}`
        : "Votre reçu est confirmé. Vos tickets sont dans le tirage.",
      url: order.ticketsUrl,
    },
  );
}

export async function notifyGiftTickets(data: GiftTicketsEmail & MemberTarget) {
  await deliverEmailAndPush(
    data,
    async () => {
      try {
        await send({ email: data.email, name: data.name }, giftTicketsEmail(data));
      } catch (error) {
        console.error(`Gift tickets email failed for ${data.email}`, error);
        throw error;
      }
    },
    {
      title: "Tickets offerts",
      body: `${data.giverName} vous a envoyé des tickets.`,
      url: data.ticketsUrl,
    },
  );
}

export async function notifyPasswordReset(data: ResetPasswordEmail) {
  try {
    await send({ email: data.email, name: data.name }, resetPasswordEmail(data));
  } catch (error) {
    console.error(`Password reset email failed for ${data.email}`, error);
  }
}

export async function notifyEmailVerify(data: VerifyEmail) {
  try {
    await send({ email: data.email, name: data.name }, verifyEmailMessage(data));
  } catch (error) {
    console.error(`Verify email failed for ${data.email}`, error);
  }
}

export async function notifyDrawResults(recipients: (DrawResultsEmail & MemberTarget)[]) {
  for (const recipient of recipients) {
    if (!hasMemberTarget(recipient)) continue;
    const won = recipient.wins.length > 0;
    const pushPayload: PushPayload = {
      title:
        recipient.drawMode === "scratch"
          ? "Tombola close"
          : won
            ? "Vous avez gagné"
            : "Résultats du tirage",
      body:
        recipient.drawMode === "scratch"
          ? "Grattez vos tickets pour voir le résultat."
          : won
            ? "Voir vos lots dans l’app."
            : "Le palmarès est en ligne.",
      url:
        recipient.drawMode === "scratch" || won
          ? recipient.ticketsUrl
          : siteUrl("/fr/results"),
    };
    await deliverEmailAndPush(
      recipient,
      recipient.email
        ? async () => {
            try {
              await send(
                { email: recipient.email, name: recipient.name },
                drawResultsEmail(recipient),
                "BREVO_TEMPLATE_WINNER",
              );
            } catch (error) {
              console.error(`Draw results email failed for ${recipient.email}`, error);
              throw error;
            }
          }
        : null,
      pushPayload,
    );
  }
}
