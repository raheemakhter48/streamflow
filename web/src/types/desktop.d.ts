export {};

declare global {
  interface Window {
    streamVaultDesktop?: {
      openExternal: (url: string) => Promise<boolean>;
    };
  }
}
