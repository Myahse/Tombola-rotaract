import { useEffect, useState } from "react";
import { apiUrl } from "../config";
import { inferredClubSlug } from "../clubSlug";

export function BrandLogo({ hero = false }: { hero?: boolean }) {
  const className = hero ? "brand-logo hero" : "brand-logo";
  const [name, setName] = useState("Tombola du club");
  const [logo, setLogo] = useState("/logo.png");
  const [logoDark, setLogoDark] = useState("/logo-white.png");
  const [useWhite, setUseWhite] = useState(true);

  useEffect(() => {
    void fetch(apiUrl("/api/club"), {
      credentials: "include",
      headers: { "X-Club-Slug": inferredClubSlug() },
    })
      .then((response) => response.json())
      .then((data: { club?: { id: string; slug: string; name: string; logoUrl: string | null; logoDarkUrl: string | null } }) => {
        if (!data.club) return;
        setName(data.club.name);
        if (data.club.logoUrl) setLogo(data.club.logoUrl);
        if (data.club.logoDarkUrl) setLogoDark(data.club.logoDarkUrl);
        try {
          sessionStorage.setItem("tombola_club_id", data.club.id);
          sessionStorage.setItem("tombola_club_slug", data.club.slug);
        } catch {
          // ignore
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <picture>
      {useWhite ? <source srcSet={logoDark} media="(prefers-color-scheme: dark)" /> : null}
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
