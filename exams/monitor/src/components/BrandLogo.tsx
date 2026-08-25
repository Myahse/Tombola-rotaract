import { useState } from "react";

export function BrandLogo({ hero = false }: { hero?: boolean }) {
  const className = hero ? "brand-logo hero" : "brand-logo";
  const [useWhite, setUseWhite] = useState(true);
  return (
    <picture>
      {useWhite ? (
        <source srcSet="/logo-white.png" media="(prefers-color-scheme: dark)" />
      ) : null}
      <img
        src="/logo.png"
        alt="Rotaract IUGB Club"
        className={className}
        width={751}
        height={284}
        decoding="async"
        fetchPriority="high"
        onError={() => setUseWhite(false)}
      />
    </picture>
  );
}
