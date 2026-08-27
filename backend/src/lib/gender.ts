export const GENDERS = ["female", "male", "other"] as const;
export type Gender = (typeof GENDERS)[number];

export function isGender(value: unknown): value is Gender {
  return value === "female" || value === "male" || value === "other";
}

export function admitCopy(passed: boolean, gender?: string | null) {
  if (passed) {
    if (gender === "female") return { resultFr: "Admise", youAre: "vous êtes admise" };
    if (gender === "male") return { resultFr: "Admis", youAre: "vous êtes admis" };
    return { resultFr: "Admis(e)", youAre: "vous êtes admis(e)" };
  }
  if (gender === "female") return { resultFr: "Non admise", youAre: "vous n’êtes pas admise" };
  if (gender === "male") return { resultFr: "Non admis", youAre: "vous n’êtes pas admis" };
  return { resultFr: "Non admis(e)", youAre: "vous n’êtes pas admis(e)" };
}

export function convenedWord(gender?: string | null) {
  if (gender === "female") return "convoquée";
  if (gender === "male") return "convoqué";
  return "convoqué(e)";
}
