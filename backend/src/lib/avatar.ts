export function parseAvatar(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("data:image/jpeg;base64,")) return null;
  if (trimmed.length > 120_000) return null;
  return trimmed;
}
