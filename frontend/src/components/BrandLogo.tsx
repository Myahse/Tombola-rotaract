export function BrandLogo({ hero = false }: { hero?: boolean }) {
  return (
    <img
      src="/logo.png"
      alt="Rotaract IUGB Club"
      className={hero ? "brand-logo hero" : "brand-logo"}
      width={480}
      height={307}
      decoding="async"
      fetchPriority="high"
    />
  );
}
