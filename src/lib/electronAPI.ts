export interface FeePayment {
  id: string;
  date: string;
  amount: number;
  receiptNo?: string;
  paymentMode?: 'cash' | 'upi' | 'card' | 'cheque';
  transactionId?: string;
  chequeNo?: string;
  chequeDate?: string;
}

export interface FeeRecord {
  studentId: string;
  totalFees: number;
  emiMonths: number;
  payments: FeePayment[];
  downPayment?: number;
  firstEmiDate?: string;
  paymentFrequency?: 'monthly' | 'custom';
}

export interface FeeSearchResult {
  studentId: string;
  totalFees: number;
  emiMonths: number;
  payments: FeePayment[];
  matchedPayment: FeePayment;
}

export interface ElectronAPI {
  downloadReceiptPDF: (filename: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
