/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_PUBLIC_SITE?: string;
  readonly VITE_EXAM_SITE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
