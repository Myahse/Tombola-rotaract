export function safeWavePayUrl(value: string | undefined) {
  try {
    const parsed = new URL((value ?? "").trim());
    if (parsed.protocol !== "https:") return "";
    if (parsed.hostname !== "pay.wave.com") return "";
    return parsed.toString();
  } catch {
    return "";
  }
}
