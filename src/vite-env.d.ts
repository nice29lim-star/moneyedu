/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GAS_API_URL?: string;
  readonly VITE_TEACHER_DEFAULT_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
