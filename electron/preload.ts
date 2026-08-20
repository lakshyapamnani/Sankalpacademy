import { contextBridge, ipcRenderer } from 'electron';

// Expose Electron handlers to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  downloadReceiptPDF: (filename: string) => ipcRenderer.invoke('download-receipt-pdf', filename),
});
