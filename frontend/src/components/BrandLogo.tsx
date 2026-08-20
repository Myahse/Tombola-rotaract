import { useEffect, useState } from "react";
import { api } from "../api";

export function BrandLogo({ hero = false }: { hero?: boolean }) {
  const className = hero ? "brand-logo hero" : "brand-logo";
  const [name, setName] = useState("Tombola du club");
  const [logo, setLogo] = useState("/logo.png");
  const [logoDark, setLogoDark] = useState("/logo-white.png");
  const [useWhite, setUseWhite] = useState(true);

  useEffect(() => {
    void api
      .club()
      .then(({ club }) => {
        setName(club.name);
        if (club.logoUrl) setLogo(club.logoUrl);
        if (club.logoDarkUrl) setLogoDark(club.logoDarkUrl);
        try {
          sessionStorage.setItem("tombola_club_id", club.id);
          sessionStorage.setItem("tombola_club_slug", club.slug);
        } catch {
          // ignore
        }
        if (club.primaryColor) {
          document.documentElement.style.setProperty("--club-red", club.primaryColor);
        }
        document.title = club.name;
      })
      .catch(() => undefined);
  }, []);

  return (
    <picture>
      {useWhite ? (
        <source srcSet={logoDark} media="(prefers-color-scheme: dark)" />
      ) : null}
      <img
        src={logo}
        alt={name}
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
