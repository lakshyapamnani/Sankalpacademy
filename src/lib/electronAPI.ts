export interface ElectronAPI {
  downloadReceiptPDF: (filename: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
