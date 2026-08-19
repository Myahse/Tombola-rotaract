export type PreviewPerson = { name: string; email: string };

export const SAMPLE_PERSON: PreviewPerson = { name: "Awa Koné", email: "awa@example.com" };

export function firstName(full: string) {
  const part = full.trim().split(/\s+/)[0] ?? "";
  if (!part) return "ami(e) du club";
  return part
    .split("-")
    .map((piece) => (piece ? piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase() : piece))
    .join("-");
}

