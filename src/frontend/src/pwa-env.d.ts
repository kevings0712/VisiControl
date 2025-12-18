// frontend/src/pwa-env.d.ts
/// <reference types="vite-plugin-pwa/client" />

// (opcional pero ayuda a TS a autocompletar)
declare module "virtual:pwa-register" {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisterError?: (error: any) => void;
  }
  export function registerSW(options?: RegisterSWOptions): () => void;
}
