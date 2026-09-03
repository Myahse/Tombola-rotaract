type IconName = "home" | "tombola" | "buy" | "donate" | "results" | "account" | "login";

const PATHS: Record<IconName, string> = {
  home: "M4.2 10.6 12 4.2l7.8 6.4V20a1 1 0 0 1-1 1h-4.4v-6.2H9.6V21H5.2a1 1 0 0 1-1-1Z",
  tombola:
    "M5.2 8.2h13.6l-1.3 10.1a1.4 1.4 0 0 1-1.4 1.2H8a1.4 1.4 0 0 1-1.4-1.2Zm2.1 0V6.6A2.6 2.6 0 0 1 9.9 4h4.2a2.6 2.6 0 0 1 2.6 2.6v1.6M10 12h4M10 15.2h2.6",
  buy: "M6.2 7.2h13.1l-1.2 8.4H8.1Zm0 0L5 4H3.2M9.2 20.2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8.2 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  donate:
    "M12 20.2s-7.2-4.4-7.2-9.1A3.7 3.7 0 0 1 12 8.2a3.7 3.7 0 0 1 7.2 2.9c0 4.7-7.2 9.1-7.2 9.1Z",
  results:
    "M7.4 20.2V13M12 20.2V8.2M16.6 20.2v-4.4M5.6 20.2h12.8M8.6 8.2h6.8l-1.2-4.4h-4.4Z",
  account: "M12 12.1A3.6 3.6 0 1 0 12 5a3.6 3.6 0 0 0 0 7.1ZM5.4 19.8c.7-3.2 3.3-5 6.6-5s5.9 1.8 6.6 5",
  login: "M10 12h9.2M16.4 8.6 20 12l-3.6 3.4M13.2 20.2H6.4A1.6 1.6 0 0 1 4.8 18.6V5.4A1.6 1.6 0 0 1 6.4 3.8h6.8",
};

export function NavIcon({ name }: { name: IconName }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={PATHS[name]}
      />
    </svg>
  );
}

export type { IconName };
