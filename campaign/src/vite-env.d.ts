/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PUBLIC_SITE?: string;
  readonly VITE_ORGANIZER_SITE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
