const cache = new Map<string, string>();

type MemoryResponse = {
  responseStatus?: number;
  responseData?: { translatedText?: string };
  quotaFinished?: boolean;
};

function looksLikeQuota(text: string) {
  const lower = text.toLowerCase();
  return lower.includes("query limit") || lower.includes("quota") || lower.includes("invalid query");
}

export async function translateFrToEn(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const cached = cache.get(trimmed);
  if (cached) return cached;
  if (!/[a-zàâäéèêëïîôùûüç]/i.test(trimmed)) {
    cache.set(trimmed, trimmed);
    return trimmed;
  }
  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", trimmed.slice(0, 500));
    url.searchParams.set("langpair", "fr|en");
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      cache.set(trimmed, trimmed);
      return trimmed;
    }
    const data = (await response.json()) as MemoryResponse;
    const out = data.responseData?.translatedText?.trim() ?? "";
    if (!out || looksLikeQuota(out) || data.quotaFinished) {
      cache.set(trimmed, trimmed);
      return trimmed;
    }
    cache.set(trimmed, out);
    return out;
  } catch {
    cache.set(trimmed, trimmed);
    return trimmed;
  }
}

export async function translateFrToEnMany(texts: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(texts.map((value) => value.trim()).filter(Boolean))];
  const map = new Map<string, string>();
  const chunk = 4;
  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk);
    const translated = await Promise.all(slice.map((value) => translateFrToEn(value)));
    slice.forEach((value, index) => map.set(value, translated[index] ?? value));
  }
  return map;
}
