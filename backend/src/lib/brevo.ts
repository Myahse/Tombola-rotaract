import { currentClub } from "./club.js";

export type EmailAttachment = {
  name: string;
  content: string;
  contentId?: string;
};

type SendArgs = {
  to: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
  templateId?: number;
  params?: Record<string, string>;
  attachments?: EmailAttachment[];
};

export function isBrevoConfigured() {
  return Boolean(configured());
}

function configured() {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  if (!apiKey || !senderEmail) return null;
  return {
    apiKey,
    senderEmail,
    senderName: currentClub()?.senderName?.trim() || process.env.BREVO_SENDER_NAME?.trim() || currentClub()?.name || "Tombola du club",
  };
}

export async function sendBrevoEmail(args: SendArgs) {
  const config = configured();
  if (!config) {
    console.warn("Brevo skipped: set BREVO_API_KEY and BREVO_SENDER_EMAIL");
    return { skipped: true as const };
  }

  const body: Record<string, unknown> = {
    sender: { email: config.senderEmail, name: config.senderName },
    to: [{ email: args.to.email, name: args.to.name || undefined }],
    subject: args.subject,
  };

  if (args.templateId) {
    body.templateId = args.templateId;
    body.params = args.params ?? {};
  } else {
    body.htmlContent = args.html;
    body.textContent = args.text;
  }

  if (args.attachments?.length) {
    body.attachment = args.attachments.map((file) => ({
      name: file.name,
      content: file.content,
      ...(file.contentId ? { contentId: file.contentId } : {}),
    }));
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": config.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Brevo ${response.status}: ${detail || response.statusText}`);
  }

  return { skipped: false as const };
}

export function optionalTemplateId(
  name: "BREVO_TEMPLATE_WELCOME" | "BREVO_TEMPLATE_WINNER" | "BREVO_TEMPLATE_PURCHASE",
) {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}
