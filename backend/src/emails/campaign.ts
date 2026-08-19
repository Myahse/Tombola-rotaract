import { escapeHtml, firstName, wrapEmail } from "./layout.js";

export type CampaignMailInput = {
  name: string;
  email: string;
  subject: string;
  preheader: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  inlineImages: { url: string; filename: string }[];
};

export function personalize(template: string, person: { name: string; email: string }) {
  const first = firstName(person.name || person.email);
  return template
    .replaceAll("{{firstName}}", first)
    .replaceAll("{{name}}", person.name.trim() || first)
    .replaceAll("{{email}}", person.email);
}

function bodyToHtml(body: string) {
  const blocks = body.trim() ? body.trim().split(/\n{2,}/) : [];
  if (!blocks.length) return "";
  return blocks
    .map(
      (block) =>
        `<p style="margin:0 0 14px;">${escapeHtml(block).replaceAll("\n", "<br />")}</p>`,
    )
    .join("");
}

export function campaignEmail(data: CampaignMailInput) {
  const person = { name: data.name, email: data.email };
  const heading = personalize(data.heading.trim() || data.subject, person);
  const subject = personalize(data.subject, person);
  const preheader = personalize(data.preheader || heading, person);
  const images = data.inlineImages
    .map(
      (image) =>
        `<p style="margin:16px 0 0;"><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.filename)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:12px;" /></p>`,
    )
    .join("");
  const html = wrapEmail({
    preheader,
    heading,
    bodyHtml: `${bodyToHtml(personalize(data.body, person))}${images}`,
    ctaLabel: data.ctaLabel?.trim() ? personalize(data.ctaLabel, person) : undefined,
    ctaUrl: data.ctaUrl?.trim() || undefined,
  });
  const text = [
    heading,
    "",
    personalize(data.body, person),
    data.ctaLabel?.trim() && data.ctaUrl?.trim() ? `${data.ctaLabel}: ${data.ctaUrl}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
}
