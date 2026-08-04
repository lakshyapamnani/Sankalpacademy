export interface FeePayment {
  id: string;
  date: string;
  amount: number;
  receiptNo?: string;
}

export interface FeeRecord {
  studentId: string;
  totalFees: number;
  emiMonths: number;
  payments: FeePayment[];
}

export interface FeeSearchResult {
  studentId: string;
  totalFees: number;
  emiMonths: number;
  payments: FeePayment[];
  matchedPayment: FeePayment;
}

export interface ElectronAPI {
  getFeeRecords: () => Promise<FeeRecord[]>;
  getFeeRecord: (studentId: string) => Promise<FeeRecord | null>;
  updateFeeRecord: (feeRecord: FeeRecord) => Promise<boolean>;
  searchFeeByReceipt: (receiptNo: string) => Promise<FeeSearchResult[] | null>;
  downloadReceiptPDF: (filename: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
