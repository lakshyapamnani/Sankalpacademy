import { contextBridge, ipcRenderer } from 'electron';

// Expose SQLite handlers to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  getFeeRecords: () => ipcRenderer.invoke('get-fee-records'),
  getFeeRecord: (studentId: string) => ipcRenderer.invoke('get-fee-record', studentId),
  updateFeeRecord: (feeRecord: any) => ipcRenderer.invoke('update-fee-record', feeRecord),
  searchFeeByReceipt: (receiptNo: string) => ipcRenderer.invoke('search-fee-by-receipt', receiptNo),
});
