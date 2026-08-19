import type { CampaignDraft, CampaignPerson } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmails(raw: string) {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of raw.split(/[,;\n\r\t ]+/)) {
    const email = part.trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

export function selectedFromDraft(draft: CampaignDraft, people: CampaignPerson[]) {
  const selected = new Set(parseEmails(draft.extraEmails));
  for (const person of people) {
    if (draft.includeMembers && person.member && (!draft.optedInOnly || person.optedIn)) {
      selected.add(person.email);
    }
    if (draft.includeBuyers && person.buyer) selected.add(person.email);
  }
  return selected;
}

export function customEmailsFromDraft(draft: CampaignDraft, people: CampaignPerson[]) {
  const directory = new Set(people.map((person) => person.email));
  const fromLines = draft.extraEmails
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !directory.has(line.toLowerCase()));
  if (fromLines.length) return fromLines;
  return parseEmails(draft.extraEmails).filter((email) => !directory.has(email));
}

export function draftFromSelection(
  selected: Set<string>,
  people: CampaignPerson[],
  customText: string,
): Pick<CampaignDraft, "includeMembers" | "includeBuyers" | "optedInOnly" | "extraEmails"> {
  const members = people.filter((person) => person.member);
  const optedIn = members.filter((person) => person.optedIn);
  const buyers = people.filter((person) => person.buyer);
  const directory = new Set(people.map((person) => person.email));
  const custom = customText
    .split(/[,;\n\r\t]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const allMembers = members.length > 0 && members.every((person) => selected.has(person.email));
  const allOptedIn =
    optedIn.length > 0 &&
    optedIn.every((person) => selected.has(person.email)) &&
    members.filter((person) => !person.optedIn).every((person) => !selected.has(person.email));
  const allBuyers = buyers.length > 0 && buyers.every((person) => selected.has(person.email));

  const includeMembers = allMembers || allOptedIn;
  const optedInOnly = includeMembers ? !allMembers : true;
  const includeBuyers = allBuyers;

  const covered = new Set<string>();
  if (includeMembers) {
    for (const person of optedInOnly ? optedIn : members) covered.add(person.email);
  }
  if (includeBuyers) {
    for (const person of buyers) covered.add(person.email);
  }

  const extra: string[] = [];
  const seen = new Set<string>();
  for (const email of selected) {
    if (covered.has(email) || seen.has(email)) continue;
    seen.add(email);
    extra.push(email);
  }
  for (const part of custom) {
    const email = part.toLowerCase();
    if (directory.has(email) || seen.has(email) || covered.has(email)) continue;
    seen.add(email);
    extra.push(part);
  }

  return {
    includeMembers,
    includeBuyers,
    optedInOnly,
    extraEmails: extra.join("\n"),
  };
}
