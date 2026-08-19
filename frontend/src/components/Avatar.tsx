export function Avatar({
  name,
  src,
  size = 44,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (src?.startsWith("data:image/")) {
    return (
      <img
        src={src}
        alt=""
        className="person-avatar"
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span className="person-avatar fallback" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials || "?"}
    </span>
  );
}
