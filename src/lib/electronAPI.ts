export interface FeeRecord {
  studentId: string;
  totalFees: number;
  emiMonths: number;
  payments: { id: string; date: string; amount: number }[];
}

export interface ElectronAPI {
  getFeeRecords: () => Promise<FeeRecord[]>;
  getFeeRecord: (studentId: string) => Promise<FeeRecord | null>;
  updateFeeRecord: (feeRecord: FeeRecord) => Promise<boolean>;
  downloadReceiptPDF: (filename: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

