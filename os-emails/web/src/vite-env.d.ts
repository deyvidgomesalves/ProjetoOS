/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL da API quando o site é hospedado separado do servidor. Ex: https://minha-api.onrender.com */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
