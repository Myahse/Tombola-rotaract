export type PhoneCountry = {
  iso: string;
  dial: string;
  flag: string;
  nameFr: string;
  nameEn: string;
  min: number;
  max: number;
  keepLeadingZero: boolean;
};

export const DEFAULT_PHONE_ISO = "CI";

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: "CI", dial: "225", flag: "🇨🇮", nameFr: "Côte d’Ivoire", nameEn: "Côte d’Ivoire", min: 10, max: 10, keepLeadingZero: true },
  { iso: "SN", dial: "221", flag: "🇸🇳", nameFr: "Sénégal", nameEn: "Senegal", min: 9, max: 9, keepLeadingZero: false },
  { iso: "ML", dial: "223", flag: "🇲🇱", nameFr: "Mali", nameEn: "Mali", min: 8, max: 8, keepLeadingZero: false },
  { iso: "BF", dial: "226", flag: "🇧🇫", nameFr: "Burkina Faso", nameEn: "Burkina Faso", min: 8, max: 8, keepLeadingZero: false },
  { iso: "GN", dial: "224", flag: "🇬🇳", nameFr: "Guinée", nameEn: "Guinea", min: 8, max: 9, keepLeadingZero: false },
  { iso: "GH", dial: "233", flag: "🇬🇭", nameFr: "Ghana", nameEn: "Ghana", min: 9, max: 9, keepLeadingZero: false },
  { iso: "NG", dial: "234", flag: "🇳🇬", nameFr: "Nigeria", nameEn: "Nigeria", min: 10, max: 10, keepLeadingZero: false },
  { iso: "BJ", dial: "229", flag: "🇧🇯", nameFr: "Bénin", nameEn: "Benin", min: 8, max: 8, keepLeadingZero: false },
  { iso: "TG", dial: "228", flag: "🇹🇬", nameFr: "Togo", nameEn: "Togo", min: 8, max: 8, keepLeadingZero: false },
  { iso: "LR", dial: "231", flag: "🇱🇷", nameFr: "Liberia", nameEn: "Liberia", min: 7, max: 9, keepLeadingZero: false },
  { iso: "SL", dial: "232", flag: "🇸🇱", nameFr: "Sierra Leone", nameEn: "Sierra Leone", min: 8, max: 8, keepLeadingZero: false },
  { iso: "GM", dial: "220", flag: "🇬🇲", nameFr: "Gambie", nameEn: "Gambia", min: 7, max: 7, keepLeadingZero: false },
  { iso: "NE", dial: "227", flag: "🇳🇪", nameFr: "Niger", nameEn: "Niger", min: 8, max: 8, keepLeadingZero: false },
  { iso: "MR", dial: "222", flag: "🇲🇷", nameFr: "Mauritanie", nameEn: "Mauritania", min: 8, max: 8, keepLeadingZero: false },
  { iso: "CM", dial: "237", flag: "🇨🇲", nameFr: "Cameroun", nameEn: "Cameroon", min: 9, max: 9, keepLeadingZero: false },
  { iso: "MA", dial: "212", flag: "🇲🇦", nameFr: "Maroc", nameEn: "Morocco", min: 9, max: 9, keepLeadingZero: false },
  { iso: "TN", dial: "216", flag: "🇹🇳", nameFr: "Tunisie", nameEn: "Tunisia", min: 8, max: 8, keepLeadingZero: false },
  { iso: "DZ", dial: "213", flag: "🇩🇿", nameFr: "Algérie", nameEn: "Algeria", min: 9, max: 9, keepLeadingZero: false },
  { iso: "FR", dial: "33", flag: "🇫🇷", nameFr: "France", nameEn: "France", min: 9, max: 9, keepLeadingZero: false },
  { iso: "BE", dial: "32", flag: "🇧🇪", nameFr: "Belgique", nameEn: "Belgium", min: 8, max: 9, keepLeadingZero: false },
  { iso: "CH", dial: "41", flag: "🇨🇭", nameFr: "Suisse", nameEn: "Switzerland", min: 9, max: 9, keepLeadingZero: false },
  { iso: "GB", dial: "44", flag: "🇬🇧", nameFr: "Royaume-Uni", nameEn: "United Kingdom", min: 10, max: 10, keepLeadingZero: false },
  { iso: "DE", dial: "49", flag: "🇩🇪", nameFr: "Allemagne", nameEn: "Germany", min: 10, max: 11, keepLeadingZero: false },
  { iso: "ES", dial: "34", flag: "🇪🇸", nameFr: "Espagne", nameEn: "Spain", min: 9, max: 9, keepLeadingZero: false },
  { iso: "IT", dial: "39", flag: "🇮🇹", nameFr: "Italie", nameEn: "Italy", min: 9, max: 10, keepLeadingZero: false },
  { iso: "PT", dial: "351", flag: "🇵🇹", nameFr: "Portugal", nameEn: "Portugal", min: 9, max: 9, keepLeadingZero: false },
  { iso: "NL", dial: "31", flag: "🇳🇱", nameFr: "Pays-Bas", nameEn: "Netherlands", min: 9, max: 9, keepLeadingZero: false },
  { iso: "US", dial: "1", flag: "🇺🇸", nameFr: "États-Unis / Canada", nameEn: "United States / Canada", min: 10, max: 10, keepLeadingZero: false },
  { iso: "KE", dial: "254", flag: "🇰🇪", nameFr: "Kenya", nameEn: "Kenya", min: 9, max: 9, keepLeadingZero: false },
  { iso: "ZA", dial: "27", flag: "🇿🇦", nameFr: "Afrique du Sud", nameEn: "South Africa", min: 9, max: 9, keepLeadingZero: false },
];

const E164_RE = /^\+[1-9]\d{7,14}$/;

const DIAL_ORDER = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function countryByIso(iso: string): PhoneCountry {
  return PHONE_COUNTRIES.find((country) => country.iso === iso) ?? countryByIso(DEFAULT_PHONE_ISO);
}

function nationalDigits(country: PhoneCountry, raw: string): string {
  let digits = digitsOnly(raw);
  if (!country.keepLeadingZero) digits = digits.replace(/^0+/, "");
  return digits;
}

export function serializePhone(iso: string, national: string): string {
  const country = countryByIso(iso);
  const digits = nationalDigits(country, national);
  return digits ? `+${country.dial}${digits}` : "";
}

export function parsePhone(value: string): { iso: string; national: string } {
  const trimmed = value.trim();
  if (!trimmed) return { iso: DEFAULT_PHONE_ISO, national: "" };

  const hasCountryPrefix = trimmed.startsWith("+") || trimmed.startsWith("00");
  const haystack = hasCountryPrefix
    ? digitsOnly(trimmed.startsWith("00") ? trimmed.slice(2) : trimmed)
    : digitsOnly(trimmed);

  if (hasCountryPrefix) {
    for (const country of DIAL_ORDER) {
      if (haystack.startsWith(country.dial)) {
        return { iso: country.iso, national: haystack.slice(country.dial.length) };
      }
    }
  }

  return { iso: DEFAULT_PHONE_ISO, national: haystack };
}

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parsed = parsePhone(trimmed);
  return serializePhone(parsed.iso, parsed.national);
}

export function isValidPhone(value: string): boolean {
  const e164 = normalizePhone(value);
  if (!E164_RE.test(e164)) return false;
  const parsed = parsePhone(e164);
  const country = countryByIso(parsed.iso);
  const national = nationalDigits(country, parsed.national);
  return national.length >= country.min && national.length <= country.max;
}

export function countryAriaLabel(country: PhoneCountry, lang: string): string {
  const name = lang.startsWith("en") ? country.nameEn : country.nameFr;
  return `${name} (+${country.dial})`;
}
