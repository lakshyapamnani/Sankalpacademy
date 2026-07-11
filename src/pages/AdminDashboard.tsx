import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, BookOpen, Calendar, BarChart3, Plus, UserPlus, IndianRupee, Printer, CheckSquare, ClipboardCheck, Cake, Edit, ArrowLeft, Search, Download, MessageSquare, Eye, TrendingUp, FileText, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import DashboardLayout, { SidebarItem } from "@/components/DashboardLayout";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import {
  getStudents,
  getClasses,
  getBatches,
  addStudent,
  updateStudent,
  addClass,
  addBatch,
  deleteStudent,
  deleteClass,
  deleteBatch,
  getStudentAttendance,
  getFeeRecordByStudent,
  getFeeRecords,
  updateFeeRecord,
  addFeePayment,
  getTests,
  addTest,
  deleteTest,
  updateTest,
  getTestResultsByTest,
  getTestResultsByStudent,
  saveTestResult,
  subscribeToRealtimeUpdates,
  markAttendance,
  getStaff,
  addStaff,
  deleteStaff,
  getSubjects,
  addSubject,
  deleteSubject,
  getNotes,
  addNote,
  updateNote,
  deleteNote,
  Student,
  Class,
  Batch,
  Subject,
  FeeRecord,
  FeePayment,
  Test,
  TestResult,
  Staff,
  MCQQuestion,
  InstituteSettings,
  getInstituteSettings,
  Note,
} from "@/lib/localStorage";

type StudentTestResult = TestResult & { test: Test };

interface MonthlyAvg {
  rawKey: string;
  label: string;
  avg: number;
  count: number;
}

const getStudentTestsForReport = (
  studentId: string,
  allTests: Test[],
  subjectFilter: string
): StudentTestResult[] => {
  const studentResults = getTestResultsByStudent(studentId);
  const studentTests = studentResults
    .map(r => {
      const test = allTests.find(t => t.id === r.testId);
      return test ? { ...r, test } : null;
    })
    .filter(Boolean) as StudentTestResult[];

  return subjectFilter === 'all'
    ? studentTests
    : studentTests.filter(t => (t.test.subject || 'General') === subjectFilter);
};

const computeMonthlyAvgs = (sortedTests: StudentTestResult[]): MonthlyAvg[] => {
  const monthlyData: Record<string, { total: number; count: number }> = {};
  sortedTests.forEach(t => {
    if (t.isAbsent) return;
    const d = new Date(t.test.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyData[key]) monthlyData[key] = { total: 0, count: 0 };
    monthlyData[key].total += (t.marksObtained / t.test.totalMarks) * 100;
    monthlyData[key].count += 1;
  });
  return Object.keys(monthlyData).sort().map(k => ({
    rawKey: k,
    label: new Date(k + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    avg: Math.round(monthlyData[k].total / monthlyData[k].count),
    count: monthlyData[k].count,
  }));
};

const getPreviousMonthKey = (monthKey: string): string => {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getNextMonthKey = (monthKey: string): string => {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatFirebaseError = (message: string): string => {
  const normalized = message.split("_").join(" ");
  const upper = message.toUpperCase();

  if (upper.includes("EMAIL EXISTS")) {
    return "That email is already registered.";
  }

  if (upper.includes("WEAK PASSWORD")) {
    return "Password must be at least 6 characters.";
  }

  return normalized;
};

const AdminDashboard = () => {
  const navigate = useNavigate();

  // Returns YYYY-MM-DD in the local timezone (not UTC)
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [activeTab, setActiveTab] = useState<'batches' | 'students' | 'staff' | 'classes' | 'fees' | 'tests' | 'attendance' | 'birthdays' | 'notes'>('students');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  useEffect(() => {
    setCurrentDateStr(getLocalDateString());
    const interval = setInterval(() => {
      setCurrentDateStr(getLocalDateString());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  // Notes state
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDescription, setNoteDescription] = useState('');
  const [noteLink, setNoteLink] = useState('');
  const [noteBatchId, setNoteBatchId] = useState('');
  const [noteSubject, setNoteSubject] = useState('');
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [selectedReportBatch, setSelectedReportBatch] = useState<string | null>(null);

  // Fees State
  const [selectedStudentForFees, setSelectedStudentForFees] = useState<Student | null>(null);
  const [feeRecord, setFeeRecord] = useState<FeeRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [selectedBatchForFees, setSelectedBatchForFees] = useState<string | null>(null);
  const [feesStudentSearch, setFeesStudentSearch] = useState<string>("");
  const [feesBatchSearch, setFeesBatchSearch] = useState<string>("");

  // Tests State
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const selectedTestIdRef = useRef<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [absentMessage, setAbsentMessage] = useState<string>("Hello parent, your child {name} was absent today {date}.");
  const [birthdayMessage, setBirthdayMessage] = useState<string>("Happy Birthday {name}! 🎂 Wishing you a fantastic day ahead! 🎉");
  const [testMarksMessage, setTestMarksMessage] = useState<string>(
    () => localStorage.getItem('smartclass_test_wa_template') ||
      "Hello Parent, your child {name} has scored {marks}/{total} in the test '{testName}' conducted on {date}."
  );
  const [testAbsentMessage, setTestAbsentMessage] = useState<string>(
    () => localStorage.getItem('smartclass_test_absent_wa_template') ||
      "Hello Parent, your child {name} was absent for the test '{testName}' conducted on {date}."
  );

  useEffect(() => {
    localStorage.setItem('smartclass_test_wa_template', testMarksMessage);
  }, [testMarksMessage]);

  useEffect(() => {
    localStorage.setItem('smartclass_test_absent_wa_template', testAbsentMessage);
  }, [testAbsentMessage]);

  // MCQ Creation State
  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [testType, setTestType] = useState<'subjective' | 'mcq'>('subjective');

  // Print state
  const [receiptData, setReceiptData] = useState<{
    student: Student;
    payment: FeePayment;
    record: FeeRecord;
  } | null>(null);

  // WhatsApp Fees State
  const [waRecipientPhone, setWaRecipientPhone] = useState<string>("");
  const [waCustomMessage, setWaCustomMessage] = useState<string>("");

  // Institute Settings State
  const [instituteSettings, setInstituteSettingsState] = useState<InstituteSettings>(getInstituteSettings());

  // Absent Today State
  const [absentDate, setAbsentDate] = useState<string>(getLocalDateString());
  const [waMessageTemplate, setWaMessageTemplate] = useState<string>(
    () => localStorage.getItem('smartclass_wa_template') ||
      'Hello Parent, your child {name} was absent today {date}. Kindly look into this. - {institute}'
  );

  // MCQ Test Builder State (unused legacy – kept for potential future use)
  const [testForm, setTestForm] = useState<{ name: string; date: string; batchIds: string[]; questions: MCQQuestion[] }>({
    name: '',
    date: getLocalDateString(),
    batchIds: [],
    questions: [{ id: 'q1', question: '', options: ['', '', '', ''], correctOptionIndex: 0 }],
  });

  const [studentSearch, setStudentSearch] = useState('');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [editTestSubject, setEditTestSubject] = useState<string>('');
  const [testSearch, setTestSearch] = useState('');

  // Student Report State
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);
  const [selectedAbsentStudent, setSelectedAbsentStudent] = useState<Student | null>(null);
  const [reportSubjectFilter, setReportSubjectFilter] = useState<string>('all');
  const [reportCompareMonth1, setReportCompareMonth1] = useState<string>('');
  const [reportCompareMonth2, setReportCompareMonth2] = useState<string>('');
  const [reportMonthlyMonth1, setReportMonthlyMonth1] = useState<string>('');
  const [reportMonthlyMonth2, setReportMonthlyMonth2] = useState<string>('');
  const [reportMonthlyMode, setReportMonthlyMode] = useState<'single' | 'compare_1v1' | 'compare_2v2'>('compare_1v1');
  const [printingReport, setPrintingReport] = useState<boolean>(false);
  const [reportPrintMode, setReportPrintMode] = useState<'full' | 'monthly'>('full');
  const [testSubject, setTestSubject] = useState<string>('');
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    loadData();
    // Subscribe to realtime updates
    const unsubscribe = subscribeToRealtimeUpdates(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const isClassPassed = (classItem: Class) => {
    if (!classItem.date || !classItem.endTime) return false;
    const classEndTime = new Date(`${classItem.date}T${classItem.endTime}`);
    return classEndTime < new Date();
  };

  const loadData = useCallback(async () => {
    const loadedStudents = getStudents();
    setStudents(loadedStudents);
    setClasses(getClasses());
    setBatches(getBatches());
    setTests(getTests());
    setStaff(getStaff());
    setSubjects(getSubjects());
    setNotes(getNotes());

    if (selectedStudentForFees) {
      // Reload fee record if editing
      const freshRecord = await getFeeRecordByStudent(selectedStudentForFees.id);
      setFeeRecord(freshRecord || null);
    }
    
    // Always refresh test results for the currently selected test
    const currentTestId = selectedTestIdRef.current;
    if (currentTestId) {
      const results = getTestResultsByTest(currentTestId);
      setTestResults(results);
    }
  }, [selectedStudentForFees]);

  const handleSelectStudentForFees = async (student: Student) => {
    setSelectedStudentForFees(student);
    const record = await getFeeRecordByStudent(student.id);
    setFeeRecord(record || null);
    setPaymentAmount("");
    
    const phone = student.parentWhatsApp || student.whatsappNo || student.phoneNo || "";
    setWaRecipientPhone(phone);

    if (record) {
      const totalPaid = record.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const remaining = record.totalFees - totalPaid;
      const msg = `Dear Parent, fee payment received for ${student.name}.
Total Paid: ₹${totalPaid}
Remaining Balance: ₹${remaining}
Thank you! - ${instituteSettings.name || 'RC Tutorials'}`;
      setWaCustomMessage(msg);
    } else {
      setWaCustomMessage("");
    }
  };

  const handleSelectTest = (test: Test) => {
    setSelectedTest(test);
    selectedTestIdRef.current = test.id;
    const results = getTestResultsByTest(test.id);
    setTestResults(results);
  };

  const handleSaveFeeStructure = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedStudentForFees) return;
    const formData = new FormData(e.currentTarget);
    const totalFees = Number(formData.get("totalFees"));
    const emiMonths = Number(formData.get("emiMonths"));

    const newRecord: FeeRecord = {
      studentId: selectedStudentForFees.id,
      totalFees,
      emiMonths,
      payments: feeRecord?.payments || [],
    };
    await updateFeeRecord(newRecord);
    setFeeRecord(newRecord);
    toast.success("Fee structure saved successfully");
  };

  const handleAddPayment = async () => {
    if (!selectedStudentForFees || !feeRecord || !paymentAmount) return;
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    const updatedRecord = await addFeePayment(selectedStudentForFees.id, amount);
    if (updatedRecord) {
      setFeeRecord(updatedRecord);
      setPaymentAmount("");
      toast.success("Payment recorded successfully");
      
      // Prepare receipt data
      if (updatedRecord.payments && updatedRecord.payments.length > 0) {
        const lastPayment = updatedRecord.payments[updatedRecord.payments.length - 1];
        setReceiptData({
          student: selectedStudentForFees,
          payment: lastPayment,
          record: updatedRecord
        });

        // Update customizable WhatsApp message for this new payment
        const totalPaid = updatedRecord.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
        const remaining = updatedRecord.totalFees - totalPaid;
        const msg = `Dear Parent, we have received a fee payment of ₹${amount} for ${selectedStudentForFees.name}.
Total Paid: ₹${totalPaid}
Remaining Balance: ₹${remaining}
Thank you! - ${instituteSettings.name || 'RC Tutorials'}`;
        setWaCustomMessage(msg);
      }
    }
  };

  const handlePrint = () => {
    if (receiptData) {
      window.print();
    }
  };

  const handleDownloadLatestPDF = async () => {
    if (!receiptData) return;
    const filename = `Receipt_${receiptData.student.name.replace(/\s+/g, '_')}_RCPT-${receiptData.payment.id.slice(-6).toUpperCase()}.pdf`;
    try {
      if (window.electronAPI && typeof window.electronAPI.downloadReceiptPDF === 'function') {
        const success = await window.electronAPI.downloadReceiptPDF(filename);
        if (success) {
          toast.success("Receipt PDF downloaded successfully!");
        }
      } else {
        window.print();
      }
    } catch (err) {
      console.error("Failed to download PDF:", err);
      toast.error("Failed to download PDF");
    }
  };

  const handleExportFeesCSV = async (batchStudents: Student[], batchName: string) => {
    try {
      const allFeeRecords = await getFeeRecords();
      
      // Filter fee records for students in this batch
      const batchRecords = allFeeRecords.filter(r => 
        batchStudents.some(s => s.id === r.studentId)
      );

      // Find max payments count to build dynamic columns
      let maxPayments = 0;
      batchRecords.forEach(r => {
        if (r.payments && r.payments.length > maxPayments) {
          maxPayments = r.payments.length;
        }
      });

      // Build CSV headers
      const headers = [
        "Student Name",
        "Email",
        "Phone Number",
        "Total Fees (₹)",
        "EMI Months",
        "Total Paid (₹)",
        "Remaining Balance (₹)"
      ];

      // Add dynamic installment headers
      for (let i = 1; i <= maxPayments; i++) {
        headers.push(`Instalment ${i} Date`, `Instalment ${i} Amount (₹)`);
      }

      // Build CSV rows
      const rows = batchStudents.map(student => {
        const record = batchRecords.find(r => r.studentId === student.id);
        const totalPaid = record?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
        const remaining = record ? record.totalFees - totalPaid : 0;
        
        const row = [
          `"${student.name.replace(/"/g, '""')}"`,
          `"${student.email.replace(/"/g, '""')}"`,
          `"${(student.phoneNo || "").replace(/"/g, '""')}"`,
          record ? record.totalFees : 0,
          record ? record.emiMonths : 0,
          totalPaid,
          remaining
        ];

        // Add payment data
        for (let i = 0; i < maxPayments; i++) {
          if (record?.payments && record.payments[i]) {
            const p = record.payments[i];
            const pDate = new Date(p.date).toLocaleDateString();
            row.push(`"${pDate}"`, p.amount);
          } else {
            row.push('""', '""');
          }
        }

        return row.join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");
      
      // Download trigger
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Fees_Report_${batchName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV report downloaded successfully");
    } catch (error) {
      console.error("Export CSV failed", error);
      toast.error("Failed to export CSV report");
    }
  };

  const handlePrintReceipt = (payment: FeePayment) => {
    if (!selectedStudentForFees || !feeRecord) return;
    setReceiptData({
      student: selectedStudentForFees,
      payment: payment,
      record: feeRecord
    });
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleDownloadReceiptPDF = (payment: FeePayment) => {
    if (!selectedStudentForFees || !feeRecord) return;
    setReceiptData({
      student: selectedStudentForFees,
      payment: payment,
      record: feeRecord
    });
    setTimeout(async () => {
      const filename = `Receipt_${selectedStudentForFees.name.replace(/\s+/g, '_')}_RCPT-${payment.id.slice(-6).toUpperCase()}.pdf`;
      try {
        if (window.electronAPI && typeof window.electronAPI.downloadReceiptPDF === 'function') {
          const success = await window.electronAPI.downloadReceiptPDF(filename);
          if (success) {
            toast.success("Receipt PDF downloaded successfully!");
          }
        } else {
          window.print();
        }
      } catch (err) {
        console.error("Failed to download PDF:", err);
        toast.error("Failed to download PDF");
      }
    }, 100);
  };

  useEffect(() => {
    if (!printingReport) return;

    const handleAfterPrint = () => {
      setPrintingReport(false);
      setReportPrintMode('full');
    };

    window.addEventListener('afterprint', handleAfterPrint);
    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      cancelAnimationFrame(timer);
    };
  }, [printingReport]);

  const generateMonthlyReportHTML = (
    student: Student,
    batch: Batch | undefined,
    mode: 'single' | 'compare_1v1' | 'compare_2v2',
    label1: string,
    label2: string,
    avg1: number,
    avg2: number,
    monthTests1: StudentTestResult[],
    monthTests2: StudentTestResult[],
    monthDiff: number | null,
    settings: InstituteSettings
  ): string => {
    const diffText = monthDiff !== null
      ? `${monthDiff > 0 ? '+' : ''}${monthDiff}% ${monthDiff > 0 ? 'Improvement' : monthDiff < 0 ? 'Decline' : 'Unchanged'}`
      : 'N/A';
    const diffColor = monthDiff !== null && monthDiff > 0 ? '#15803d' : monthDiff !== null && monthDiff < 0 ? '#dc2626' : '#374151';

    const generateTestRows = (tests: StudentTestResult[]) => {
      return tests.map((t, idx) => {
        const pct = Math.round((t.marksObtained / t.test.totalMarks) * 100);
        const marksText = t.isAbsent ? '<span style="color:#dc2626;font-weight:700">AB</span>' : `${t.marksObtained}/${t.test.totalMarks}`;
        const pctText = t.isAbsent ? '<span style="color:#dc2626;font-weight:700">AB</span>' : `${pct}%`;
        return `<tr>
          <td style="border:1px solid #d1d5db;padding:6px;text-align:center">${idx + 1}</td>
          <td style="border:1px solid #d1d5db;padding:6px">${new Date(t.test.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
          <td style="border:1px solid #d1d5db;padding:6px;font-weight:600">${t.test.name}</td>
          <td style="border:1px solid #d1d5db;padding:6px;text-align:center;font-weight:700">${marksText}</td>
          <td style="border:1px solid #d1d5db;padding:6px;text-align:center;font-weight:700">${pctText}</td>
        </tr>`;
      }).join('');
    };

    const testRows1 = generateTestRows(monthTests1);
    const testRows2 = mode !== 'single' ? generateTestRows(monthTests2) : '';

    const title = mode === 'single'
      ? `Monthly Report Card - ${student.name} - ${label1}`
      : `Monthly Comparison Report - ${student.name} - ${label1} vs ${label2}`;

    const reportHeader = mode === 'single'
      ? `Monthly Report Card — ${label1}`
      : `Monthly Comparison Report`;

    const comparisonTitle = mode === 'single'
      ? `vs Previous Month`
      : `Month Performance Comparison`;

    // Extract test counts correctly
    const month1Count = monthTests1.length;
    const month2Count = mode === 'single' ? (monthTests2 ? monthTests2.length : 0) : monthTests2.length;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #111; max-width: 900px; margin: 0 auto; padding: 32px; }
    h1 { text-transform: uppercase; letter-spacing: 0.1em; margin: 0; }
    .header { border-bottom: 3px solid #1f2937; padding-bottom: 16px; margin-bottom: 24px; text-align: center; }
    .badge { display: inline-block; background: #1f2937; color: white; padding: 4px 16px; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; font-size: 14px; }
    .label { font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: 700; letter-spacing: 0.05em; }
    .comparison { border: 2px solid #c7d2fe; background: #eef2ff; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .comparison-grid { display: flex; justify-content: space-around; align-items: center; text-align: center; }
    .score { font-size: 36px; font-weight: 900; color: #312e81; }
    .delta { font-size: 14px; font-weight: 700; padding: 6px 14px; border-radius: 999px; display: inline-block; margin-top: 8px; }
    .results-container { display: ${mode === 'single' ? 'block' : 'grid'}; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 32px; }
    th { background: #f3f4f6; border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
    .signatures { display: flex; justify-content: space-between; margin-top: 64px; }
    .sig-line { width: 180px; border-bottom: 2px solid #374151; margin-bottom: 6px; }
    .footer { text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 32px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${settings.name || 'RC Tutorials'}</h1>
    ${settings.address ? `<p style="color:#4b5563;margin:4px 0">${settings.address}</p>` : ''}
    <div style="font-size:11px;color:#6b7280">${settings.phone ? `Phone: ${settings.phone}` : ''} ${settings.email ? `&nbsp; Email: ${settings.email}` : ''}</div>
    <div class="badge">${reportHeader}</div>
  </div>

  <div class="info-grid">
    <div>
      <div class="label">Student Name</div>
      <div style="font-size:18px;font-weight:700">${student.name}</div>
      <div style="margin-top:8px"><span class="label">Batch</span> ${batch?.name || 'N/A'}</div>
      ${student.studentClass ? `<div><span class="label">Class</span> ${student.studentClass}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div class="label">Report Generated</div>
      <div>${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
      <div style="margin-top:8px"><span class="label">${mode === 'single' ? 'Selected Month' : 'Comparison Period'}</span> ${mode === 'single' ? label1 : `${label1} vs ${label2}`}</div>
    </div>
  </div>

  <div class="comparison">
    <div style="font-size:12px;font-weight:800;text-transform:uppercase;color:#312e81;margin-bottom:16px;letter-spacing:0.05em">${comparisonTitle}</div>
    <div class="comparison-grid">
      <div>
        <div class="label">${mode === 'single' ? label2 : label1}</div>
        <div class="score">${mode === 'single' ? (avg2 ? `${avg2}%` : '—') : (avg1 ? `${avg1}%` : '—')}</div>
        <div style="font-size:10px;color:#6b7280;margin-top:4px">${mode === 'single' ? month2Count : month1Count} test${(mode === 'single' ? month2Count : month1Count) !== 1 ? 's' : ''}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:800;color:#6366f1;margin-bottom:8px">VS</div>
        <div class="delta" style="background:${monthDiff !== null && monthDiff > 0 ? '#dcfce7' : monthDiff !== null && monthDiff < 0 ? '#fee2e2' : '#f3f4f6'};color:${diffColor}">${diffText}</div>
      </div>
      <div>
        <div class="label">${mode === 'single' ? label1 : label2}</div>
        <div class="score">${mode === 'single' ? (avg1 ? `${avg1}%` : '—') : (avg2 ? `${avg2}%` : '—')}</div>
        <div style="font-size:10px;color:#6b7280;margin-top:4px">${mode === 'single' ? month1Count : month2Count} test${(mode === 'single' ? month1Count : month2Count) !== 1 ? 's' : ''}</div>
      </div>
    </div>
  </div>

  <div class="results-container">
    <div>
      <div class="label" style="margin-bottom:8px;font-weight:800;color:#1f2937">Test Results — ${label1}</div>
      ${monthTests1.length > 0 ? `<table>
        <thead><tr>
          <th>#</th><th>Date</th><th>Test Name</th><th style="text-align:center">Marks</th><th style="text-align:center">%</th>
        </tr></thead>
        <tbody>${testRows1}</tbody>
      </table>` : '<p style="text-align:center;color:#6b7280;padding:16px;border:1px dashed #d1d5db;font-size:12px">No tests found for this month.</p>'}
    </div>
    
    ${mode !== 'single' ? `
    <div>
      <div class="label" style="margin-bottom:8px;font-weight:800;color:#1f2937">Test Results — ${label2}</div>
      ${monthTests2.length > 0 ? `<table>
        <thead><tr>
          <th>#</th><th>Date</th><th>Test Name</th><th style="text-align:center">Marks</th><th style="text-align:center">%</th>
        </tr></thead>
        <tbody>${testRows2}</tbody>
      </table>` : '<p style="text-align:center;color:#6b7280;padding:16px;border:1px dashed #d1d5db;font-size:12px">No tests found for this month.</p>'}
    </div>` : ''}
  </div>

  <div class="signatures">
    <div style="text-align:center"><div class="sig-line"></div><div style="font-size:11px;color:#6b7280">Parent / Guardian</div></div>
    <div style="text-align:center"><div class="sig-line"></div><div style="font-size:11px;color:#6b7280">Authorized Signatory</div></div>
  </div>
  <div class="footer">This report is electronically generated by ${settings.name || 'RC Tutorials'} Management System</div>
</body>
</html>`;
  };

  const handleDownloadMonthlyReport = (
    student: Student,
    batch: Batch | undefined,
    mode: 'single' | 'compare_1v1' | 'compare_2v2',
    label1: string,
    label2: string,
    avg1: number,
    avg2: number,
    monthTests1: StudentTestResult[],
    monthTests2: StudentTestResult[],
    monthDiff: number | null,
    monthKey1: string,
    monthKey2: string
  ) => {
    if (mode === 'single' && !monthKey1) {
      toast.error('Please select a month');
      return;
    }
    if (mode !== 'single' && (!monthKey1 || !monthKey2)) {
      toast.error('Please select both months for comparison');
      return;
    }

    const html = generateMonthlyReportHTML(
      student, batch, mode, label1, label2, avg1, avg2, monthTests1, monthTests2, monthDiff, instituteSettings
    );
    const m1Label = label1.replace(/\s+/g, '_');
    const m2Label = label2.replace(/\s+/g, '_');
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    if (mode === 'single') {
      link.download = `Monthly_Report_${student.name.replace(/\s+/g, '_')}_${m1Label}.html`;
    } else {
      link.download = `Monthly_Comparison_${student.name.replace(/\s+/g, '_')}_${m1Label}_vs_${m2Label}.html`;
    }
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Monthly report downloaded');
  };

  // Staff Attendance State
  const [selectedAttendanceBatch, setSelectedAttendanceBatch] = useState<string | null>(null);
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, 'present' | 'absent'>>({});

  const handleSaveDailyAttendance = () => {
    if (!selectedAttendanceBatch) return;
    const today = currentDateStr || getLocalDateString();
    
    Object.entries(dailyAttendance).forEach(([studentId, status]) => {
      markAttendance({
        id: `${studentId}_${today}`,
        studentId,
        classId: 'daily',
        date: today,
        status
      });
    });
    
    toast.success(`Attendance for ${batches.find(b => b.id === selectedAttendanceBatch)?.name} saved!`);
    setSelectedAttendanceBatch(null);
    setDailyAttendance({});
    loadData();
  };

  const handleDeleteStudent = (studentId: string) => {
    if (deleteStudent(studentId)) {
      toast.success("Student deleted successfully");
      loadData();
    } else {
      toast.error("Failed to delete student");
    }
  };

  const handleDeleteClass = (classId: string) => {
    if (deleteClass(classId)) {
      toast.success("Class deleted successfully");
      loadData();
    } else {
      toast.error("Failed to delete class");
    }
  };

  const handleDeleteBatch = (batchId: string) => {
    // Check if there are any students in this batch first
    const batchStudents = students.filter(s => s.batchId === batchId);
    if (batchStudents.length > 0) {
      toast.error(`Cannot delete batch: ${batchStudents.length} students are currently assigned to it.`);
      return;
    }
    if (window.confirm("Are you sure you want to delete this batch? This action cannot be undone.")) {
      if (deleteBatch(batchId)) {
        toast.success("Batch deleted successfully");
        loadData();
      } else {
        toast.error("Failed to delete batch");
      }
    }
  };

  const handleDeleteTest = (testId: string) => {
    if (deleteTest(testId)) {
      toast.success("Test deleted successfully");
      if (selectedTest?.id === testId) {
        setSelectedTest(null);
        selectedTestIdRef.current = null;
      }
      loadData();
    } else {
      toast.error("Failed to delete test");
    }
  };

  const handleAddStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const student: Student = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      batchId: formData.get("batchId") as string,
      password: formData.get("password") as string,
      collegeName: formData.get("collegeName") as string,
      phoneNo: formData.get("phoneNo") as string,
      whatsappNo: formData.get("whatsappNo") as string,
      studentClass: formData.get("studentClass") as string,
      parentWhatsApp: formData.get("parentWhatsApp") as string,
      dob: formData.get("dob") as string,
    };
    const form = e.currentTarget;
    try {
      await addStudent(student);
      form.reset();
      toast.success("Student added successfully");
      setOpenDialog(null);
      loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add student";
      toast.error(formatFirebaseError(message));
    }
  };

  const handleEditStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingStudent) return;
    const formData = new FormData(e.currentTarget);
    const updates = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      batchId: formData.get("batchId") as string,
      collegeName: formData.get("collegeName") as string,
      phoneNo: formData.get("phoneNo") as string,
      whatsappNo: formData.get("whatsappNo") as string,
      studentClass: formData.get("studentClass") as string,
      parentWhatsApp: formData.get("parentWhatsApp") as string,
    };
    
    updateStudent(editingStudent.id, updates);
    toast.success("Student updated successfully");
    setEditingStudent(null);
    loadData();
  };

  const handleAddClass = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const scheduleVal = (formData.get("schedule") as string) || '';
    const endDateVal = (formData.get("endDate") as string) || '';
    const classData: Class = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      subject: formData.get("subject") as string,
      batchId: formData.get("batchId") as string,
      date: formData.get("date") as string,
      time: formData.get("time") as string,
      endTime: formData.get("endTime") as string,
    };
    if (scheduleVal) classData.schedule = scheduleVal;
    if (endDateVal) classData.endDate = endDateVal;
    try {
      await addClass(classData);
      toast.success("Class created and notifications enqueued");
      setOpenDialog(null);
      loadData();
    } catch (error) {
      console.error('Failed to add class:', error);
      toast.error("Failed to create class");
    }
  };

  const handleAddBatch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const batch: Batch = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      year: formData.get("year") as string,
    };
    addBatch(batch);
    toast.success("Batch created successfully");
    setOpenDialog(null);
    loadData();
  };

  const handleAddTest = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const subjectVal = testSubject === '__other__' ? (formData.get("customSubject") as string || '') : testSubject;
    const test: Test = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      batchId: selectedBatches[0] || "",
      batchIds: selectedBatches,
      date: formData.get("date") as string,
      totalMarks: testType === 'mcq' ? mcqQuestions.length : Number(formData.get("totalMarks")),
      subject: subjectVal || undefined,
      type: testType,
      questions: testType === 'mcq' ? mcqQuestions : undefined,
    };

    if (testType === 'mcq') {
       if (!test.name.trim()) { toast.error("Test name is required"); return; }
       if (selectedBatches.length === 0) { toast.error("Select at least one batch"); return; }
       if (mcqQuestions.length === 0) { toast.error("Add at least one question"); return; }
       for (const q of mcqQuestions) {
         if (!q.question.trim()) { toast.error("Every question needs text"); return; }
         if (q.options.some(o => !o.trim())) { toast.error("All options need text"); return; }
         if (q.correctOptionIndex < 0 || q.correctOptionIndex >= q.options.length) {
           toast.error("Select a correct answer for every question");
           return;
         }
       }
    }

    if (selectedBatches.length === 0) {
      toast.error("Please select at least one batch");
      return;
    }

    addTest(test);
    toast.success(`${testType.toUpperCase()} Test added successfully`);
    setOpenDialog(null);
    setMcqQuestions([]);
    setSelectedBatches([]);
    setTestType('subjective');
    setTestSubject('');
    loadData();
  };

  const handleStartEditTest = (test: Test) => {
    setEditingTest(test);
    const hasSubject = subjects.some(s => s.name === test.subject);
    if (test.subject) {
      if (hasSubject) {
        setEditTestSubject(test.subject);
      } else {
        setEditTestSubject('__other__');
      }
    } else {
      setEditTestSubject('');
    }
  };

  const handleUpdateTest = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTest) return;

    const formData = new FormData(e.currentTarget);
    const subjectVal = editTestSubject === '__other__' ? (formData.get("customSubject") as string || '') : editTestSubject;
    const nameVal = formData.get("name") as string;
    const dateVal = formData.get("date") as string;

    if (!nameVal.trim()) {
      toast.error("Test name is required");
      return;
    }

    const updates: Partial<Test> = {
      name: nameVal,
      subject: subjectVal || undefined,
      date: dateVal,
    };

    updateTest(editingTest.id, updates);
    toast.success("Test updated successfully");
    setEditingTest(null);
    setEditTestSubject('');
    loadData();

    if (selectedTest && selectedTest.id === editingTest.id) {
      setSelectedTest(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleAddMcqQuestion = () => {
    const newQuestion: MCQQuestion = {
      id: Date.now().toString(),
      question: "",
      options: ["", ""],
      correctOptionIndex: 0
    };
    setMcqQuestions([...mcqQuestions, newQuestion]);
  };

  const updateMcqQuestion = (id: string, field: keyof MCQQuestion, value: any) => {
    setMcqQuestions(mcqQuestions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const addOption = (qId: string) => {
    setMcqQuestions(mcqQuestions.map(q => {
      if (q.id === qId) {
        return { ...q, options: [...q.options, ""] };
      }
      return q;
    }));
  };

  const updateOption = (qId: string, optIdx: number, value: string) => {
    setMcqQuestions(mcqQuestions.map(q => {
      if (q.id === qId) {
        const newOptions = [...q.options];
        newOptions[optIdx] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const removeMcqQuestion = (id: string) => {
    setMcqQuestions(mcqQuestions.filter(q => q.id !== id));
  };

  const handleSaveMarks = (studentId: string, marksRaw: string) => {
    if (!selectedTest) return;
    let marks = Number(marksRaw);
    if (isNaN(marks)) return;
    if (marks > selectedTest.totalMarks) marks = selectedTest.totalMarks;
    if (marks < 0) marks = 0;

    const resultId = `${studentId}_${selectedTest.id}`;
    saveTestResult({
      id: resultId,
      testId: selectedTest.id,
      studentId: studentId,
      marksObtained: marks,
      isAbsent: false
    });
    
    // update local state instantly for UI
    setTestResults(prev => {
      const idx = prev.findIndex(r => r.id === resultId);
      const newR = { id: resultId, testId: selectedTest.id, studentId, marksObtained: marks, isAbsent: false };
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newR;
        return copy;
      }
      return [...prev, newR];
    });
    toast.success("Marks saved");
  };

  const toggleAbsent = (studentId: string) => {
    if (!selectedTest) return;
    const resultId = `${studentId}_${selectedTest.id}`;
    const existing = testResults.find(r => r.id === resultId);
    const isAbsent = !existing?.isAbsent;
    
    const updatedResult = {
      id: resultId,
      testId: selectedTest.id,
      studentId: studentId,
      marksObtained: 0,
      isAbsent: isAbsent
    };

    saveTestResult(updatedResult);

    setTestResults(prev => {
      const idx = prev.findIndex(r => r.id === resultId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedResult;
        return copy;
      }
      return [...prev, updatedResult];
    });

    toast.success(isAbsent ? "Marked student as absent" : "Marked student as present");
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteBatchId || !noteSubject) {
      toast.error("Please fill in Batch, Subject, and Title fields");
      return;
    }

    if (editingNote) {
      const updated: Note = {
        ...editingNote,
        title: noteTitle,
        content: noteDescription,
        fileUrl: noteLink,
        batchId: noteBatchId,
        subject: noteSubject,
      };
      updateNote(editingNote.id, updated);
      setNotes(prev => prev.map(n => n.id === editingNote.id ? updated : n));
      toast.success("Note updated successfully");
    } else {
      const newNote: Note = {
        id: Date.now().toString(),
        title: noteTitle,
        content: noteDescription,
        fileUrl: noteLink,
        batchId: noteBatchId,
        subject: noteSubject,
        createdAt: new Date().toISOString(),
      };
      addNote(newNote);
      setNotes(prev => [...prev, newNote]);
      toast.success("Note added successfully");
    }

    // reset fields
    setEditingNote(null);
    setNoteTitle('');
    setNoteDescription('');
    setNoteLink('');
    setNoteBatchId('');
    setNoteSubject('');
    setOpenDialog(null);
  };

  const handleDeleteNote = (noteId: string) => {
    if (deleteNote(noteId)) {
      setNotes(prev => prev.filter(n => n.id !== noteId));
      toast.success("Note deleted successfully");
    } else {
      toast.error("Failed to delete note");
    }
  };

  const handleSaveStaff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!name || !email || !password) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      const newStaff: Staff = {
        id: Date.now().toString(),
        name,
        email,
        password,
        role: 'staff'
      };
      await addStaff(newStaff);
      setStaff(prev => [...prev, newStaff]);
      setOpenDialog(null);
      toast.success("Staff account created successfully");
    } catch (error: any) {
      toast.error(formatFirebaseError(error.message));
    }
  };

  const handleDeleteStaff = (staffId: string) => {
    if (deleteStaff(staffId)) {
      setStaff(staff.filter(s => s.id !== staffId));
      toast.success("Staff member deleted");
    }
  };

  const sidebarItems: SidebarItem[] = [
    { id: 'students', label: 'Students', icon: Users, action: () => setActiveTab('students') },
    { id: 'staff', label: 'Staff', icon: ClipboardCheck, action: () => setActiveTab('staff') },
    { id: 'classes', label: 'Classes', icon: Calendar, action: () => setActiveTab('classes') },
    { id: 'batches', label: 'Batches', icon: BookOpen, action: () => setActiveTab('batches') },
    { id: 'fees', label: 'Fees Mgmt', icon: IndianRupee, action: () => setActiveTab('fees') },
    { id: 'attendance', label: 'Reports', icon: BarChart3, action: () => setActiveTab('attendance') },
    { id: 'tests', label: 'Tests', icon: CheckSquare, action: () => setActiveTab('tests') },
    { id: 'notes', label: 'Notes', icon: FileText, action: () => setActiveTab('notes') },
    { id: 'birthdays', label: 'Birthdays', icon: Cake, action: () => setActiveTab('birthdays') },
  ];

  return (
    <>
      <div className="print:hidden">
        <DashboardLayout 
          role="admin" 
          title="Administrator Dashboard"
          sidebarItems={sidebarItems}
          activeSidebarItem={activeTab}
        >
          <div className="space-y-6">
            
            
            {activeTab === 'students' && (
              <div>
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Students</h3>
                    <p className="text-sm text-muted-foreground mr-4">Manage your {students.length} students</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <Input 
                      placeholder="Search students..." 
                      className="max-w-xs" 
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                    <Dialog open={openDialog === "student"} onOpenChange={(open) => setOpenDialog(open ? "student" : null)}>
                      <DialogTrigger asChild>
                        <Button className="flex items-center gap-2">
                          <UserPlus className="h-4 w-4" />
                          <span>Add Student</span>
                        </Button>
                      </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Student</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddStudent} className="space-y-4">
                        <div>
                          <Label htmlFor="student-name">Full Name</Label>
                          <Input id="student-name" name="name" required />
                        </div>
                        <div>
                          <Label htmlFor="student-email">Email</Label>
                          <Input id="student-email" name="email" type="email" required />
                        </div>
                        <div>
                          <Label htmlFor="student-phoneNo">Phone Number</Label>
                          <Input id="student-phoneNo" name="phoneNo" />
                        </div>
                        <div>
                          <Label htmlFor="student-parentWhatsApp">Parent WhatsApp Number</Label>
                          <Input id="student-parentWhatsApp" name="parentWhatsApp" placeholder="Include country code e.g. 91..." />
                        </div>
                        <div>
                          <Label htmlFor="student-collegeName">College Name</Label>
                          <Input id="student-collegeName" name="collegeName" />
                        </div>
                        <div>
                          <Label htmlFor="student-class">Class/Grade</Label>
                          <Input id="student-class" name="studentClass" />
                        </div>
                        <div>
                          <Label htmlFor="student-batch">Batch</Label>
                          <Select name="batchId" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select batch" />
                            </SelectTrigger>
                            <SelectContent>
                              {batches.map((batch) => (
                                <SelectItem key={batch.id} value={batch.id}>
                                  {batch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="student-dob">Date of Birth</Label>
                          <Input id="student-dob" name="dob" type="date" />
                        </div>
                        <div>
                          <Label htmlFor="student-password">Password</Label>
                          <Input id="student-password" name="password" type="password" required />
                        </div>
                        <Button type="submit" className="w-full">Add Student</Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {/* Edit Student Dialog */}
                  <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Edit Student</DialogTitle>
                      </DialogHeader>
                      {editingStudent && (
                        <form onSubmit={handleEditStudent} className="space-y-4">
                          <div>
                            <Label htmlFor="edit-student-name">Full Name</Label>
                            <Input id="edit-student-name" name="name" defaultValue={editingStudent.name} required />
                          </div>
                          <div>
                            <Label htmlFor="edit-student-email">Email</Label>
                            <Input id="edit-student-email" name="email" type="email" defaultValue={editingStudent.email} required disabled title="Email cannot be changed" />
                          </div>
                          <div>
                            <Label htmlFor="edit-student-phoneNo">Phone Number</Label>
                            <Input id="edit-student-phoneNo" name="phoneNo" defaultValue={editingStudent.phoneNo} />
                          </div>
                          <div>
                            <Label htmlFor="edit-student-parentWhatsApp">Parent WhatsApp Number</Label>
                            <Input id="edit-student-parentWhatsApp" name="parentWhatsApp" defaultValue={editingStudent.parentWhatsApp} />
                          </div>
                          <div>
                            <Label htmlFor="edit-student-collegeName">College Name</Label>
                            <Input id="edit-student-collegeName" name="collegeName" defaultValue={editingStudent.collegeName} />
                          </div>
                          <div>
                            <Label htmlFor="edit-student-class">Class/Grade</Label>
                            <Input id="edit-student-class" name="studentClass" defaultValue={editingStudent.studentClass} />
                          </div>
                          <div>
                            <Label htmlFor="edit-student-batch">Batch</Label>
                            <Select name="batchId" defaultValue={editingStudent.batchId} required>
                              <SelectTrigger>
                                <SelectValue placeholder="Select batch" />
                              </SelectTrigger>
                              <SelectContent>
                                {batches.map((batch) => (
                                  <SelectItem key={batch.id} value={batch.id}>
                                    {batch.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button type="submit" className="w-full">Save Changes</Button>
                        </form>
                      )}
                    </DialogContent>
                  </Dialog>

                </div>
              </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(() => {
                    const filteredStudents = students.filter(student => {
                      const batch = batches.find(b => b.id === student.batchId);
                      const searchLower = studentSearch.toLowerCase();
                      return (
                        (student.name || '').toLowerCase().includes(searchLower) ||
                        (student.email || '').toLowerCase().includes(searchLower) ||
                        (student.phoneNo && student.phoneNo.includes(studentSearch)) ||
                        (student.parentWhatsApp && student.parentWhatsApp.includes(studentSearch)) ||
                        (student.collegeName && student.collegeName.toLowerCase().includes(searchLower)) ||
                        (student.studentClass && student.studentClass.toLowerCase().includes(searchLower)) ||
                        (batch && batch.name.toLowerCase().includes(searchLower))
                      );
                    });

                    if (filteredStudents.length === 0) {
                      return (
                        <div className="col-span-full py-8 text-center text-muted-foreground bg-accent rounded-lg border-2 border-dashed">
                          {students.length === 0 
                            ? "No students found. Add your first student to get started." 
                            : `No students match the search query "${studentSearch}".`}
                        </div>
                      );
                    }

                    return filteredStudents.map((student) => {
                      const batch = batches.find(b => b.id === student.batchId);
                      const attendance = getStudentAttendance(student.id);
                      const total = attendance.length;
                      const present = attendance.filter(a => String(a.status).toLowerCase() === 'present').length;
                      const percent = total > 0 ? Math.round((present / total) * 100) : 0;

                      return (
                        <div key={student.id} className="p-4 rounded-lg border bg-card text-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-semibold text-base">{student.name}</p>
                                <p className="text-xs text-muted-foreground">{student.email}</p>
                               {student.phoneNo && <p className="text-xs text-muted-foreground">📞 {student.phoneNo}</p>}
                               {student.whatsappNo && <p className="text-xs text-emerald-600">💬 {student.whatsappNo}</p>}
                              </div>
                              <div className="flex gap-1 items-center">
                                <button onClick={() => { setSelectedStudentForReport(student); setReportSubjectFilter('all'); }} className="p-2 text-violet-600 hover:bg-violet-50 rounded-md transition-colors" title="View Report">
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button onClick={() => setEditingStudent(student)} className="p-2 text-primary hover:bg-primary/10 rounded-md transition-colors" title="Edit Student">
                                  <Edit className="h-4 w-4" />
                                </button>
                                <DeleteDialog
                                  title="Delete Student"
                                  description={`Are you sure you want to delete ${student.name}? This will also delete all their attendance records. This action cannot be undone.`}
                                  onDelete={() => handleDeleteStudent(student.id)}
                                />
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              {student.collegeName && (
                                <p className="col-span-2"><span className="font-medium">College:</span> {student.collegeName}</p>
                              )}
                              {student.parentWhatsApp && (
                                <p className="col-span-2"><span className="font-medium">Parent WA:</span> {student.parentWhatsApp}</p>
                              )}
                              {student.studentClass && (
                                <p><span className="font-medium">Class:</span> {student.studentClass}</p>
                              )}
                              <p>
                                <span className="font-medium">Batch:</span> {batch?.name || 'Unknown'}
                              </p>
                              <p className="col-span-2 mt-1">
                                <span className="font-medium">Attendance:</span> {percent}% ({present}/{total})
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={() => { setSelectedStudentForReport(student); setReportSubjectFilter('all'); }}
                            className="mt-3 w-full py-2 text-xs font-bold rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            View Report Card
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </Card>

              {/* Student Report Dialog */}
              <Dialog open={!!selectedStudentForReport} onOpenChange={(open) => {
                if (!open) {
                  setSelectedStudentForReport(null);
                  setReportMonthlyMonth1('');
                  setReportMonthlyMonth2('');
                  setReportMonthlyMode('compare_1v1');
                  setReportCompareMonth1('');
                  setReportCompareMonth2('');
                  setReportSubjectFilter('all');
                }
              }}>
                <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
                  {selectedStudentForReport && (() => {
                    const student = selectedStudentForReport;
                    const batch = batches.find(b => b.id === student.batchId);
                    const studentTests = getStudentTestsForReport(student.id, tests, reportSubjectFilter);
                    const sortedTests = [...studentTests].sort((a, b) => new Date(a.test.date).getTime() - new Date(b.test.date).getTime());

                    const allSubjects = [...new Set(getStudentTestsForReport(student.id, tests, 'all').map(t => t.test.subject || 'General').filter(Boolean))];
                    const monthlyAvgs = computeMonthlyAvgs(sortedTests);
                    const monthKeys = monthlyAvgs.map(m => m.rawKey);
                    const maxBarValue = monthlyAvgs.length > 0 ? Math.max(...monthlyAvgs.map(m => m.avg), 100) : 100;

                    // Auto-select latest two months for monthly report card
                    if (monthKeys.length > 0) {
                      if (!reportMonthlyMonth1 || !reportMonthlyMonth2) {
                        const m2 = monthKeys[monthKeys.length - 1];
                        const m1 = monthKeys.length > 1 ? monthKeys[monthKeys.length - 2] : m2;
                        setTimeout(() => {
                          if (!reportMonthlyMonth1) setReportMonthlyMonth1(m1);
                          if (!reportMonthlyMonth2) setReportMonthlyMonth2(m2);
                        }, 0);
                      }
                    }

                    const presentTests = sortedTests.filter(t => !t.isAbsent);
                    const totalTests = presentTests.length;
                    const avgPercent = totalTests > 0 ? Math.round(presentTests.reduce((sum, t) => sum + (t.marksObtained / t.test.totalMarks) * 100, 0) / totalTests) : 0;
                    const highest = totalTests > 0 ? Math.max(...presentTests.map(t => Math.round((t.marksObtained / t.test.totalMarks) * 100))) : 0;
                    const lowest = totalTests > 0 ? Math.min(...presentTests.map(t => Math.round((t.marksObtained / t.test.totalMarks) * 100))) : 0;

                    const subjectAvgs: Record<string, { total: number; count: number }> = {};
                    studentTests.forEach(t => {
                      if (t.isAbsent) return;
                      const subj = t.test.subject || 'General';
                      if (!subjectAvgs[subj]) subjectAvgs[subj] = { total: 0, count: 0 };
                      subjectAvgs[subj].total += (t.marksObtained / t.test.totalMarks) * 100;
                      subjectAvgs[subj].count += 1;
                    });
                    
                    const m1Data = reportCompareMonth1 && reportCompareMonth1 !== 'none' ? monthlyAvgs.find(m => m.rawKey === reportCompareMonth1) : null;
                    const m2Data = reportCompareMonth2 && reportCompareMonth2 !== 'none' ? monthlyAvgs.find(m => m.rawKey === reportCompareMonth2) : null;
                    const diff = m1Data && m2Data ? m2Data.avg - m1Data.avg : null;

                    // Dynamic Monthly report card variables depending on mode
                    let monthlyReportTests1: StudentTestResult[] = [];
                    let monthlyReportTests2: StudentTestResult[] = [];
                    let month1Avg = 0;
                    let month2Avg = 0;
                    let month1Count = 0;
                    let month2Count = 0;
                    let label1 = '';
                    let label2 = '';
                    let monthDiff: number | null = null;

                    if (reportMonthlyMode === 'single') {
                      monthlyReportTests1 = reportMonthlyMonth1
                        ? sortedTests.filter(t => {
                            const d = new Date(t.test.date);
                            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            return key === reportMonthlyMonth1;
                          })
                        : [];
                      const m1Data = reportMonthlyMonth1 ? monthlyAvgs.find(m => m.rawKey === reportMonthlyMonth1) : null;
                      month1Avg = m1Data?.avg ?? 0;
                      month1Count = m1Data?.count ?? 0;
                      label1 = m1Data?.label || '';

                      const prevMonthKey = reportMonthlyMonth1 ? getPreviousMonthKey(reportMonthlyMonth1) : '';
                      const prevMonthData = prevMonthKey ? monthlyAvgs.find(m => m.rawKey === prevMonthKey) : null;
                      
                      // For single month, we show vs Previous Month
                      // monthDiff is current (m1Data) - previous (prevMonthData)
                      monthlyReportTests2 = prevMonthKey
                        ? sortedTests.filter(t => {
                            const d = new Date(t.test.date);
                            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            return key === prevMonthKey;
                          })
                        : [];
                      month2Avg = prevMonthData?.avg ?? 0;
                      month2Count = prevMonthData?.count ?? 0;
                      label2 = prevMonthData?.label || 'Previous Month';

                      monthDiff = m1Data && prevMonthData ? m1Data.avg - prevMonthData.avg : null;
                    } else if (reportMonthlyMode === 'compare_1v1') {
                      monthlyReportTests1 = reportMonthlyMonth1
                        ? sortedTests.filter(t => {
                            const d = new Date(t.test.date);
                            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            return key === reportMonthlyMonth1;
                          })
                        : [];
                      monthlyReportTests2 = reportMonthlyMonth2
                        ? sortedTests.filter(t => {
                            const d = new Date(t.test.date);
                            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            return key === reportMonthlyMonth2;
                          })
                        : [];
                      const m1Data = reportMonthlyMonth1 ? monthlyAvgs.find(m => m.rawKey === reportMonthlyMonth1) : null;
                      const m2Data = reportMonthlyMonth2 ? monthlyAvgs.find(m => m.rawKey === reportMonthlyMonth2) : null;
                      month1Avg = m1Data?.avg ?? 0;
                      month1Count = m1Data?.count ?? 0;
                      label1 = m1Data?.label || '';
                      
                      month2Avg = m2Data?.avg ?? 0;
                      month2Count = m2Data?.count ?? 0;
                      label2 = m2Data?.label || '';

                      monthDiff = m1Data && m2Data ? m2Data.avg - m1Data.avg : null;
                    } else if (reportMonthlyMode === 'compare_2v2') {
                      const nextMonthKey1 = reportMonthlyMonth1 ? getNextMonthKey(reportMonthlyMonth1) : '';
                      const nextMonthKey2 = reportMonthlyMonth2 ? getNextMonthKey(reportMonthlyMonth2) : '';

                      monthlyReportTests1 = reportMonthlyMonth1
                        ? sortedTests.filter(t => {
                            const d = new Date(t.test.date);
                            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            return key === reportMonthlyMonth1 || key === nextMonthKey1;
                          })
                        : [];
                      monthlyReportTests2 = reportMonthlyMonth2
                        ? sortedTests.filter(t => {
                            const d = new Date(t.test.date);
                            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            return key === reportMonthlyMonth2 || key === nextMonthKey2;
                          })
                        : [];

                      const m1AData = reportMonthlyMonth1 ? monthlyAvgs.find(m => m.rawKey === reportMonthlyMonth1) : null;
                      const m1BData = nextMonthKey1 ? monthlyAvgs.find(m => m.rawKey === nextMonthKey1) : null;
                      const m2AData = reportMonthlyMonth2 ? monthlyAvgs.find(m => m.rawKey === reportMonthlyMonth2) : null;
                      const m2BData = nextMonthKey2 ? monthlyAvgs.find(m => m.rawKey === nextMonthKey2) : null;

                      // Combined average calculation for Period 1
                      const presentM1 = monthlyReportTests1.filter(t => !t.isAbsent);
                      const totalM1Marks = presentM1.reduce((sum, t) => sum + (t.marksObtained / t.test.totalMarks) * 100, 0);
                      month1Avg = presentM1.length > 0 ? Math.round(totalM1Marks / presentM1.length) : 0;
                      month1Count = presentM1.length;
                      
                      const label1A = m1AData?.label || '';
                      const label1B = m1BData?.label || (nextMonthKey1 ? new Date(nextMonthKey1 + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '');
                      label1 = label1A && label1B ? `${label1A} & ${label1B}` : label1A || 'Period 1';

                      // Combined average calculation for Period 2
                      const presentM2 = monthlyReportTests2.filter(t => !t.isAbsent);
                      const totalM2Marks = presentM2.reduce((sum, t) => sum + (t.marksObtained / t.test.totalMarks) * 100, 0);
                      month2Avg = presentM2.length > 0 ? Math.round(totalM2Marks / presentM2.length) : 0;
                      month2Count = presentM2.length;
                      
                      const label2A = m2AData?.label || '';
                      const label2B = m2BData?.label || (nextMonthKey2 ? new Date(nextMonthKey2 + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '');
                      label2 = label2A && label2B ? `${label2A} & ${label2B}` : label2A || 'Period 2';

                      monthDiff = monthlyReportTests1.length > 0 && monthlyReportTests2.length > 0 ? month2Avg - month1Avg : null;
                    }

                    const handlePrintReport = () => {
                      setReportPrintMode('full');
                      setPrintingReport(true);
                    };

                    const handlePrintMonthlyReport = () => {
                      if (reportMonthlyMode === 'single' && !reportMonthlyMonth1) {
                        toast.error('Please select a month for the report card');
                        return;
                      }
                      if (reportMonthlyMode !== 'single' && (!reportMonthlyMonth1 || !reportMonthlyMonth2)) {
                        toast.error('Please select both months for the report card');
                        return;
                      }
                      setReportPrintMode('monthly');
                      setPrintingReport(true);
                    };

                    return (
                      <>
                        <div className="space-y-6">
                          <DialogHeader>
                            <DialogTitle className="text-xl flex items-center gap-2">
                              <FileText className="h-5 w-5 text-violet-600" />
                              Student Report Card
                            </DialogTitle>
                          </DialogHeader>

                          {/* Student Header */}
                          <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl p-4 border">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-lg font-bold">{student.name}</h3>
                                <p className="text-sm text-muted-foreground">{student.email}</p>
                                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                  {student.studentClass && <span>Class: <strong className="text-foreground">{student.studentClass}</strong></span>}
                                  <span>Batch: <strong className="text-foreground">{batch?.name || 'Unknown'}</strong></span>
                                  {student.collegeName && <span>College: <strong className="text-foreground">{student.collegeName}</strong></span>}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handlePrintReport} className="flex items-center gap-1.5">
                                  <Printer className="h-3.5 w-3.5" />
                                  Print Full Report
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Subject Filter & Comparison Controls */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-xl border">
                            <div>
                              <Label className="text-xs font-bold mb-1.5 block">Filter by Subject:</Label>
                              <Select value={reportSubjectFilter} onValueChange={setReportSubjectFilter}>
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Subjects</SelectItem>
                                  {allSubjects.map(sub => (
                                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs font-bold mb-1.5 block">Compare Month 1:</Label>
                              <Select value={reportCompareMonth1} onValueChange={setReportCompareMonth1}>
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue placeholder="Select Month" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {monthKeys.map(k => (
                                    <SelectItem key={k} value={k}>{new Date(k + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs font-bold mb-1.5 block">Compare Month 2:</Label>
                              <Select value={reportCompareMonth2} onValueChange={setReportCompareMonth2}>
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue placeholder="Select Month" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  {monthKeys.map(k => (
                                    <SelectItem key={k} value={k}>{new Date(k + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Monthly Report Card */}
                          {monthKeys.length > 0 && (
                            <div className="p-4 rounded-xl border-2 border-violet-200 bg-violet-50/40 space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-violet-100 pb-3">
                                <h4 className="text-sm font-bold flex items-center gap-2 text-violet-900">
                                  <FileText className="h-4 w-4" />
                                  Monthly Report Card
                                </h4>
                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Mode Selector */}
                                  <Select value={reportMonthlyMode} onValueChange={(val: 'single' | 'compare_1v1' | 'compare_2v2') => setReportMonthlyMode(val)}>
                                    <SelectTrigger className="h-9 text-xs w-48 bg-white border-violet-200">
                                      <SelectValue placeholder="Report Mode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="single">Single Month</SelectItem>
                                      <SelectItem value="compare_1v1">Compare Month vs Month</SelectItem>
                                      <SelectItem value="compare_2v2">Compare 2 Months vs 2 Months</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  {/* Month 1 Dropdown */}
                                  <Select value={reportMonthlyMonth1} onValueChange={setReportMonthlyMonth1}>
                                    <SelectTrigger className="h-9 text-xs w-40 bg-white border-violet-200">
                                      <SelectValue placeholder={reportMonthlyMode === 'compare_2v2' ? "Period 1 Start" : "Select Month"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {monthKeys.map(k => {
                                        const label = reportMonthlyMode === 'compare_2v2'
                                          ? `${new Date(k + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} & ${new Date(getNextMonthKey(k) + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                                          : new Date(k + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                                        return (
                                          <SelectItem key={k} value={k}>
                                            {label}
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>

                                  {/* VS Separator & Month 2 Dropdown (Conditional) */}
                                  {reportMonthlyMode !== 'single' && (
                                    <>
                                      <span className="text-xs font-bold text-violet-700">vs</span>
                                      <Select value={reportMonthlyMonth2} onValueChange={setReportMonthlyMonth2}>
                                        <SelectTrigger className="h-9 text-xs w-40 bg-white border-violet-200">
                                          <SelectValue placeholder={reportMonthlyMode === 'compare_2v2' ? "Period 2 Start" : "Select Month"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {monthKeys.map(k => {
                                            const label = reportMonthlyMode === 'compare_2v2'
                                              ? `${new Date(k + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} & ${new Date(getNextMonthKey(k) + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                                              : new Date(k + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                                            return (
                                              <SelectItem key={k} value={k}>
                                                {label}
                                              </SelectItem>
                                            );
                                          })}
                                        </SelectContent>
                                      </Select>
                                    </>
                                  )}

                                  <Button variant="outline" size="sm" onClick={() => handleDownloadMonthlyReport(student, batch, reportMonthlyMode, label1, label2, month1Avg, month2Avg, monthlyReportTests1, monthlyReportTests2, monthDiff, reportMonthlyMonth1, reportMonthlyMonth2)} className="flex items-center gap-1.5 text-xs h-9 bg-white border-violet-200">
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                  </Button>
                                  <Button variant="default" size="sm" onClick={handlePrintMonthlyReport} className="flex items-center gap-1.5 text-xs h-9 bg-violet-600 hover:bg-violet-700">
                                    <Printer className="h-3.5 w-3.5" />
                                    Print
                                  </Button>
                                </div>
                              </div>

                              {(reportMonthlyMonth1 || (reportMonthlyMode !== 'single' && reportMonthlyMonth2)) && (
                                <>
                                  {/* Performance comparison */}
                                  <div className="p-4 rounded-xl border border-violet-200 bg-white">
                                    <h5 className="text-xs font-bold uppercase text-violet-700 mb-3 tracking-wider">
                                      {reportMonthlyMode === 'single' ? 'vs Previous Month' : 'Month Comparison'}
                                    </h5>
                                    <div className="flex items-center justify-around">
                                      <div className="text-center">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                                          {reportMonthlyMode === 'single' ? label2 : label1}
                                        </p>
                                        <p className="text-2xl font-black text-gray-600">
                                          {reportMonthlyMode === 'single' ? (month2Avg ? `${month2Avg}%` : '—') : (month1Avg ? `${month1Avg}%` : '—')}
                                        </p>
                                        <p className="text-[9px] text-muted-foreground">
                                          {reportMonthlyMode === 'single' ? month2Count : month1Count} test{(reportMonthlyMode === 'single' ? month2Count : month1Count) !== 1 ? 's' : ''}
                                        </p>
                                      </div>
                                      <div className="flex flex-col items-center px-4">
                                        {monthDiff !== null ? (
                                          <span className={`text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1 ${monthDiff > 0 ? 'bg-emerald-100 text-emerald-700' : monthDiff < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {monthDiff > 0 ? '↑' : monthDiff < 0 ? '↓' : '→'} {monthDiff > 0 ? '+' : ''}{monthDiff}%
                                            <span className="text-[10px] font-semibold ml-1">
                                              {monthDiff > 0 ? 'Improved' : monthDiff < 0 ? 'Declined' : 'Same'}
                                            </span>
                                          </span>
                                        ) : (
                                          <span className="text-xs text-muted-foreground italic">Select values to compare</span>
                                        )}
                                      </div>
                                      <div className="text-center">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                                          {reportMonthlyMode === 'single' ? label1 : label2}
                                        </p>
                                        <p className="text-2xl font-black text-violet-700">
                                          {reportMonthlyMode === 'single' ? (month1Avg ? `${month1Avg}%` : '—') : (month2Avg ? `${month2Avg}%` : '—')}
                                        </p>
                                        <p className="text-[9px] text-muted-foreground">
                                          {reportMonthlyMode === 'single' ? month1Count : month2Count} test{(reportMonthlyMode === 'single' ? month1Count : month2Count) !== 1 ? 's' : ''}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Test Results list grid */}
                                  <div className={reportMonthlyMode === 'single' ? 'space-y-2' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
                                    {/* Month 1 / Period 1 Tests Table */}
                                    <div className="space-y-2">
                                      <h6 className="text-xs font-bold text-violet-800 uppercase tracking-wide">
                                        {label1 || 'Month 1'} Tests
                                      </h6>
                                      {monthlyReportTests1.length > 0 ? (
                                        <div className="rounded-lg border overflow-hidden bg-white">
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="bg-violet-50 text-[10px]">
                                                <th className="text-left px-2 py-1.5 font-bold">Date</th>
                                                <th className="text-left px-2 py-1.5 font-bold">Test</th>
                                                <th className="text-center px-2 py-1.5 font-bold">Marks</th>
                                                <th className="text-center px-2 py-1.5 font-bold">%</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {monthlyReportTests1.map(t => {
                                                const pct = Math.round((t.marksObtained / t.test.totalMarks) * 100);
                                                return (
                                                  <tr key={t.id} className="border-t">
                                                    <td className="px-2 py-1.5 whitespace-nowrap">{new Date(t.test.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</td>
                                                    <td className="px-2 py-1.5 font-medium truncate max-w-[120px]" title={t.test.name}>{t.test.name}</td>
                                                    <td className="px-2 py-1.5 text-center">{t.isAbsent ? <span className="text-red-600 font-bold">AB</span> : `${t.marksObtained}/${t.test.totalMarks}`}</td>
                                                    <td className="px-2 py-1.5 text-center font-bold">{t.isAbsent ? <span className="text-red-600 font-bold">AB</span> : `${pct}%`}</td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground italic p-3 text-center border rounded-lg bg-white">No tests this month</p>
                                      )}
                                    </div>

                                    {/* Month 2 / Period 2 Tests Table (Conditional) */}
                                    {reportMonthlyMode !== 'single' && (
                                      <div className="space-y-2">
                                        <h6 className="text-xs font-bold text-violet-800 uppercase tracking-wide">
                                          {label2 || 'Month 2'} Tests
                                        </h6>
                                        {monthlyReportTests2.length > 0 ? (
                                          <div className="rounded-lg border overflow-hidden bg-white">
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="bg-violet-50 text-[10px]">
                                                  <th className="text-left px-2 py-1.5 font-bold">Date</th>
                                                  <th className="text-left px-2 py-1.5 font-bold">Test</th>
                                                  <th className="text-center px-2 py-1.5 font-bold">Marks</th>
                                                  <th className="text-center px-2 py-1.5 font-bold">%</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {monthlyReportTests2.map(t => {
                                                  const pct = Math.round((t.marksObtained / t.test.totalMarks) * 100);
                                                  return (
                                                    <tr key={t.id} className="border-t">
                                                      <td className="px-2 py-1.5 whitespace-nowrap">{new Date(t.test.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</td>
                                                      <td className="px-2 py-1.5 font-medium truncate max-w-[120px]" title={t.test.name}>{t.test.name}</td>
                                                      <td className="px-2 py-1.5 text-center">{t.isAbsent ? <span className="text-red-600 font-bold">AB</span> : `${t.marksObtained}/${t.test.totalMarks}`}</td>
                                                      <td className="px-2 py-1.5 text-center font-bold">{t.isAbsent ? <span className="text-red-600 font-bold">AB</span> : `${pct}%`}</td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        ) : (
                                          <p className="text-xs text-muted-foreground italic p-3 text-center border rounded-lg bg-white">No tests this month</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {/* Comparison Visualization */}
                          {reportCompareMonth1 && reportCompareMonth1 !== 'none' && reportCompareMonth2 && reportCompareMonth2 !== 'none' && (
                            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50">
                              <h4 className="text-sm font-bold mb-4 text-indigo-900 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" />
                                Performance Comparison: {reportSubjectFilter === 'all' ? 'Overall' : reportSubjectFilter}
                              </h4>
                              <div className="flex items-center justify-around">
                                <div className="text-center">
                                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">{m1Data?.label || '-'}</p>
                                  <p className="text-3xl font-black text-indigo-700">{m1Data?.avg || 0}%</p>
                                </div>
                                <div className="flex flex-col items-center justify-center px-8">
                                  <div className="h-0.5 w-16 bg-indigo-200 relative mb-4">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-200">
                                      VS
                                    </div>
                                  </div>
                                  {diff !== null && (
                                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${diff > 0 ? 'bg-emerald-100 text-emerald-700' : diff < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                      {diff > 0 ? '+' : ''}{diff}% {diff > 0 ? 'Improvement' : diff < 0 ? 'Decline' : 'Unchanged'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-center">
                                  <p className="text-xs font-bold text-muted-foreground uppercase mb-1">{m2Data?.label || '-'}</p>
                                  <p className="text-3xl font-black text-indigo-700">{m2Data?.avg || 0}%</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Performance Summary */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-center">
                              <p className="text-2xl font-black text-blue-700">{totalTests}</p>
                              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Tests Taken</p>
                            </div>
                            <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 text-center">
                              <p className="text-2xl font-black text-violet-700">{avgPercent}%</p>
                              <p className="text-[10px] text-violet-600 font-bold uppercase tracking-wider">Average</p>
                            </div>
                            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                              <p className="text-2xl font-black text-emerald-700">{highest}%</p>
                              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Highest</p>
                            </div>
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                              <p className="text-2xl font-black text-amber-700">{lowest}%</p>
                              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Lowest</p>
                            </div>
                          </div>

                          {/* Subject-wise Breakdown */}
                          {Object.keys(subjectAvgs).length > 1 && (
                            <div>
                              <h4 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                                <BarChart3 className="h-4 w-4 text-violet-600" />
                                Subject-wise Average
                              </h4>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {Object.entries(subjectAvgs).map(([subj, data]) => {
                                  const avg = Math.round(data.total / data.count);
                                  return (
                                    <div key={subj} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-black ${avg >= 75 ? 'bg-emerald-100 text-emerald-700' : avg >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                        {avg}%
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold">{subj}</p>
                                        <p className="text-[10px] text-muted-foreground">{data.count} test{data.count > 1 ? 's' : ''}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Month-on-Month Chart */}
                          {monthlyAvgs.length > 0 && (
                            <div>
                              <h4 className="text-sm font-bold mb-3 flex items-center gap-1.5">
                                <TrendingUp className="h-4 w-4 text-violet-600" />
                                Month-on-Month Trend
                              </h4>
                              <div className="p-4 rounded-xl border bg-card">
                                <div className="flex items-end gap-2 h-40">
                                  {monthlyAvgs.map((m, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                      <span className="text-[10px] font-black">{m.avg}%</span>
                                      <div className="w-full relative flex-1 flex items-end">
                                        <div 
                                          className={`w-full rounded-t-md transition-all ${m.avg >= 75 ? 'bg-emerald-500' : m.avg >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                          style={{ height: `${(m.avg / maxBarValue) * 100}%`, minHeight: '4px' }}
                                        />
                                      </div>
                                      <div className="text-center">
                                        <p className="text-[9px] font-bold text-muted-foreground whitespace-nowrap">{m.label}</p>
                                        <p className="text-[8px] text-muted-foreground">{m.count} test{m.count > 1 ? 's' : ''}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Test Results Table */}
                          <div>
                            <h4 className="text-sm font-bold mb-2">Detailed Test Results</h4>
                            {sortedTests.length > 0 ? (
                              <div className="rounded-xl border overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-muted/50 text-xs">
                                      <th className="text-left px-3 py-2.5 font-bold">#</th>
                                      <th className="text-left px-3 py-2.5 font-bold">Date</th>
                                      <th className="text-left px-3 py-2.5 font-bold">Test Name</th>
                                      <th className="text-left px-3 py-2.5 font-bold">Subject</th>
                                      <th className="text-center px-3 py-2.5 font-bold">Marks</th>
                                      <th className="text-center px-3 py-2.5 font-bold">Total</th>
                                      <th className="text-center px-3 py-2.5 font-bold">%</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortedTests.map((t, idx) => {
                                      const pct = Math.round((t.marksObtained / t.test.totalMarks) * 100);
                                      return (
                                        <tr key={t.id} className="border-t hover:bg-muted/20 transition-colors">
                                          <td className="px-3 py-2 text-muted-foreground text-xs">{idx + 1}</td>
                                          <td className="px-3 py-2 text-xs">{new Date(t.test.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                          <td className="px-3 py-2 font-medium">{t.test.name}</td>
                                          <td className="px-3 py-2">
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">{t.test.subject || 'General'}</span>
                                          </td>
                                          <td className="px-3 py-2 text-center font-bold">{t.isAbsent ? <span className="text-red-600">AB</span> : t.marksObtained}</td>
                                          <td className="px-3 py-2 text-center text-muted-foreground">{t.test.totalMarks}</td>
                                          <td className="px-3 py-2 text-center">
                                            {t.isAbsent ? (
                                              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                                AB
                                              </span>
                                            ) : (
                                              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${pct >= 75 ? 'bg-emerald-100 text-emerald-700' : pct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                {pct}%
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg bg-accent/50">
                                No test results found{reportSubjectFilter !== 'all' ? ` for ${reportSubjectFilter}` : ''}.
                              </p>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                </DialogContent>
              </Dialog>
              </div>
            )}

            
            {activeTab === 'fees' && (
              <div className="space-y-6">
                <Card className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-2xl font-black text-primary">Fees Management</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedBatchForFees 
                          ? "Select a student to view and record payments"
                          : "Select a batch to manage student fee structures and payments"
                        }
                      </p>
                    </div>
                  </div>

                  {selectedBatchForFees === null ? (
                    // Batch Grid Selection View (State A)
                    <div className="space-y-6">
                      <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search batches by name or year..."
                          className="pl-9 h-11 bg-accent/30 border-accent focus:bg-background transition-all rounded-xl"
                          value={feesBatchSearch}
                          onChange={(e) => setFeesBatchSearch(e.target.value)}
                        />
                      </div>

                      {(() => {
                        const filteredBatches = batches.filter(batch => 
                          batch.name.toLowerCase().includes(feesBatchSearch.toLowerCase()) ||
                          batch.year.toLowerCase().includes(feesBatchSearch.toLowerCase())
                        );

                        const unassignedStudents = students.filter(s => !s.batchId || !batches.some(b => b.id === s.batchId));
                        const matchesUnassigned = "unassigned students".includes(feesBatchSearch.toLowerCase()) || "no batch".includes(feesBatchSearch.toLowerCase());

                        return (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {filteredBatches.map((batch) => {
                                const batchStudents = students.filter(s => s.batchId === batch.id);
                                return (
                                  <div
                                    key={batch.id}
                                    onClick={() => setSelectedBatchForFees(batch.id)}
                                    className="group relative overflow-hidden p-6 rounded-2xl border bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between h-44"
                                  >
                                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/15 transition-all duration-300" />
                                    
                                    <div>
                                      <div className="flex justify-between items-start">
                                        <div className="p-3 bg-primary/10 text-primary rounded-xl w-fit group-hover:scale-110 transition-transform">
                                          <Users className="h-5 w-5" />
                                        </div>
                                        <span className="text-xs font-semibold px-2.5 py-1 bg-accent text-accent-foreground rounded-full">
                                          {batch.year}
                                        </span>
                                      </div>
                                      
                                      <h4 className="font-bold text-lg mt-3 group-hover:text-primary transition-colors line-clamp-1">
                                        {batch.name}
                                      </h4>
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-4">
                                      <span className="text-xs text-muted-foreground font-medium">
                                        {batchStudents.length} {batchStudents.length === 1 ? 'Student' : 'Students'}
                                      </span>
                                      <span className="text-xs font-bold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                        View Batch &rarr;
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {unassignedStudents.length > 0 && (feesBatchSearch === "" || matchesUnassigned) && (
                                <div
                                  onClick={() => setSelectedBatchForFees('unassigned')}
                                  className="group relative overflow-hidden p-6 rounded-2xl border border-dashed border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500 hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between h-44"
                                >
                                  <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/15 transition-all duration-300" />
                                  
                                  <div>
                                    <div className="flex justify-between items-start">
                                      <div className="p-3 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl w-fit group-hover:scale-110 transition-transform">
                                        <Users className="h-5 w-5" />
                                      </div>
                                      <span className="text-xs font-semibold px-2.5 py-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full">
                                        No Batch
                                      </span>
                                    </div>
                                    
                                    <h4 className="font-bold text-lg mt-3 text-amber-800 dark:text-amber-200 transition-colors line-clamp-1">
                                      Unassigned Students
                                    </h4>
                                  </div>
                                  
                                  <div className="flex items-center justify-between mt-4">
                                    <span className="text-xs text-amber-700/80 dark:text-amber-300/80 font-medium">
                                      {unassignedStudents.length} {unassignedStudents.length === 1 ? 'Student' : 'Students'}
                                    </span>
                                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                      View Batch &rarr;
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {filteredBatches.length === 0 && (unassignedStudents.length === 0 || !matchesUnassigned) && (
                              <div className="py-12 text-center text-muted-foreground border-2 border-dashed rounded-2xl bg-accent/20">
                                <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                <p className="text-sm font-semibold">No batches found matching "{feesBatchSearch}"</p>
                                <p className="text-xs text-muted-foreground mt-1">Try searching another batch name, year, or view active batches.</p>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    // Split-pane layout for selected batch (State B)
                    (() => {
                      const activeBatch = batches.find(b => b.id === selectedBatchForFees);
                      const batchName = selectedBatchForFees === 'unassigned' ? "Unassigned Students" : (activeBatch?.name || "Unknown Batch");
                      const batchYear = selectedBatchForFees === 'unassigned' ? "No Batch" : (activeBatch?.year || "");

                      const batchStudents = selectedBatchForFees === 'unassigned'
                        ? students.filter(s => !s.batchId || !batches.some(b => b.id === s.batchId))
                        : students.filter(s => s.batchId === selectedBatchForFees);

                      const filteredBatchStudents = batchStudents.filter(s => 
                        (s.name || '').toLowerCase().includes(feesStudentSearch.toLowerCase()) ||
                        (s.phoneNo && s.phoneNo.includes(feesStudentSearch)) ||
                        (s.email || '').toLowerCase().includes(feesStudentSearch.toLowerCase())
                      );

                      return (
                        <div className="space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                            <div className="flex items-center gap-3">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  setSelectedBatchForFees(null);
                                  setSelectedStudentForFees(null);
                                  setFeesStudentSearch("");
                                }} 
                                className="h-10 w-10 rounded-xl hover:bg-accent border border-border"
                                title="Back to Batches"
                              >
                                <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                              </Button>
                              <div>
                                <h4 className="font-bold text-lg flex items-center gap-2">
                                  {batchName}
                                  {batchYear && <span className="text-xs font-normal px-2.5 py-0.5 bg-accent text-accent-foreground rounded-full">{batchYear}</span>}
                                </h4>
                                <p className="text-xs text-muted-foreground">Select a student from the batch list to view and manage their fees</p>
                              </div>
                            </div>
                            <Button 
                              onClick={() => handleExportFeesCSV(batchStudents, batchName)} 
                              variant="outline" 
                              className="gap-2 shrink-0 self-start sm:self-center rounded-xl h-10 hover:bg-accent border border-border"
                              disabled={batchStudents.length === 0}
                            >
                              <Download className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold text-xs text-foreground">Export Batch Report</span>
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Desktop Student List Sidebar */}
                            <div className="col-span-1 border-r pr-6 border-border hidden md:block max-h-[60vh] overflow-y-auto space-y-4">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="text"
                                  placeholder="Search student..."
                                  className="pl-8 h-9 text-xs rounded-lg"
                                  value={feesStudentSearch}
                                  onChange={(e) => setFeesStudentSearch(e.target.value)}
                                />
                              </div>

                              <div className="space-y-2">
                                <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                                  Students ({filteredBatchStudents.length})
                                </h4>
                                <div className="space-y-1 max-h-[48vh] overflow-y-auto pr-1">
                                  {filteredBatchStudents.map(s => (
                                    <div 
                                      key={s.id} 
                                      onClick={() => handleSelectStudentForFees(s)}
                                      className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border border-transparent ${selectedStudentForFees?.id === s.id ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'hover:bg-accent hover:border-accent border-transparent'}`}
                                    >
                                      <p className="font-semibold text-sm">{s.name}</p>
                                      <p className={`text-xs ${selectedStudentForFees?.id === s.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                        {s.phoneNo || s.email}
                                      </p>
                                    </div>
                                  ))}
                                  {filteredBatchStudents.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-6">No students found.</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Mobile Student List Dropdown */}
                            <div className="md:hidden block mb-4 space-y-4">
                               <div className="relative">
                                 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                 <Input
                                   type="text"
                                   placeholder="Filter student list..."
                                   className="pl-8 h-9 text-xs rounded-lg"
                                   value={feesStudentSearch}
                                   onChange={(e) => setFeesStudentSearch(e.target.value)}
                                 />
                               </div>
                               
                               <div>
                                 <h4 className="font-medium text-xs text-muted-foreground mb-2">Select Student</h4>
                                 <Select 
                                   value={selectedStudentForFees?.id || ""} 
                                   onValueChange={(val) => {
                                     const student = filteredBatchStudents.find(st => st.id === val);
                                     if(student) handleSelectStudentForFees(student);
                                   }}
                                 >
                                  <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Choose a student" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    {filteredBatchStudents.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {s.name} ({s.phoneNo || s.email})
                                      </SelectItem>
                                    ))}
                                    {filteredBatchStudents.length === 0 && (
                                      <div className="p-3 text-xs text-muted-foreground text-center">No students found</div>
                                    )}
                                  </SelectContent>
                                </Select>
                               </div>
                            </div>

                            {/* Right Pane: Student Fees details */}
                            <div className="col-span-1 md:col-span-2">
                              {!selectedStudentForFees ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12 text-sm border-2 border-dashed rounded-2xl bg-accent/10">
                                  <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
                                  <p className="font-medium">No student selected</p>
                                  <p className="text-xs text-muted-foreground/80 mt-0.5">Choose a student from the sidebar list to manage fees.</p>
                                </div>
                              ) : (
                                <div className="space-y-6">
                                  <div className="flex justify-between items-start border-b pb-4">
                                    <div>
                                      <h3 className="text-2xl font-bold">{selectedStudentForFees.name}</h3>
                                      <p className="text-sm text-muted-foreground">{selectedStudentForFees.collegeName || "No College specified"} • {selectedStudentForFees.studentClass || "No Class specified"}</p>
                                    </div>
                                    
                                    {receiptData && receiptData.student.id === selectedStudentForFees.id && (
                                      <div className="flex gap-2">
                                        <Button onClick={handlePrint} variant="outline" className="gap-2 shrink-0">
                                          <Printer className="h-4 w-4" /> Print Latest Receipt
                                        </Button>
                                        <Button onClick={handleDownloadLatestPDF} variant="default" className="gap-2 shrink-0">
                                          <Download className="h-4 w-4" /> Download Latest Receipt
                                        </Button>
                                      </div>
                                    )}
                                  </div>

                                  {!feeRecord ? (
                                    <div className="bg-accent/40 p-6 rounded-2xl border">
                                      <h4 className="font-semibold mb-2">Create Fee Structure</h4>
                                      <form onSubmit={handleSaveFeeStructure} className="space-y-4 max-w-sm">
                                        <div>
                                          <Label htmlFor="totalFees">Total Fees</Label>
                                          <Input id="totalFees" name="totalFees" type="number" placeholder="e.g. 24000" required />
                                        </div>
                                        <div>
                                          <Label htmlFor="emiMonths">EMI Months</Label>
                                          <Input id="emiMonths" name="emiMonths" type="number" placeholder="e.g. 3" required />
                                        </div>
                                        <Button type="submit">Save Structure</Button>
                                      </form>
                                    </div>
                                  ) : (
                                    <div className="space-y-6">
                                      
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {(() => {
                                          const totalPaid = feeRecord.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                                          const remainingBalance = feeRecord.totalFees - totalPaid;
                                          const emiMonthsRemaining = Math.max(1, feeRecord.emiMonths - (feeRecord.payments?.length || 0));
                                          // Re-calculate the EMI structure based on remaining balance
                                          const dynamicEmi = (remainingBalance / emiMonthsRemaining).toFixed(0);

                                          return (
                                            <>
                                              <div className="bg-card border rounded-lg p-3">
                                                <p className="text-xs text-muted-foreground">Total Fees</p>
                                                <p className="text-lg font-semibold">₹{feeRecord.totalFees}</p>
                                              </div>
                                              <div className="bg-card border rounded-lg p-3">
                                                <p className="text-xs text-muted-foreground">Total Paid</p>
                                                <p className="text-lg font-semibold text-green-600">₹{totalPaid}</p>
                                              </div>
                                              <div className="bg-card border rounded-lg p-3">
                                                <p className="text-xs text-muted-foreground">Remaining</p>
                                                <p className="text-lg font-semibold text-red-500">₹{remainingBalance}</p>
                                              </div>
                                              <div className="bg-card border rounded-lg p-3">
                                                <p className="text-xs text-muted-foreground">Adjusted EMI</p>
                                                <p className="text-lg font-semibold text-blue-600">₹{dynamicEmi}</p>
                                              </div>
                                            </>
                                          );
                                        })()}
                                      </div>

                                      
                                      <div className="bg-accent/40 p-4 rounded-xl flex items-end gap-4 max-w-lg">
                                        <div className="flex-1">
                                          <Label htmlFor="paymentAmount">Add Payment Amount</Label>
                                          <div className="relative">
                                            <IndianRupee className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                              id="paymentAmount" 
                                              type="number" 
                                              className="pl-8" 
                                              placeholder="Amount" 
                                              value={paymentAmount}
                                              onChange={(e) => setPaymentAmount(e.target.value)}
                                            />
                                          </div>
                                        </div>
                                        <Button onClick={handleAddPayment}>Record Payment</Button>
                                      </div>

                                      
                                      <div>
                                        <h4 className="font-semibold mb-3">Payment History</h4>
                                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                          {feeRecord.payments?.length > 0 ? (
                                            feeRecord.payments.map((p, index) => (
                                              <div key={p.id} className="flex justify-between items-center bg-card border p-3 rounded-xl text-sm hover:shadow-sm transition-shadow">
                                                <div className="flex-1">
                                                  <p className="font-semibold">Payment #{index + 1}</p>
                                                  <p className="text-xs text-muted-foreground">{new Date(p.date).toLocaleString()}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <div className="font-bold text-green-600 mr-1">+₹{p.amount}</div>
                                                  <Button 
                                                    onClick={() => handlePrintReceipt(p)} 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl"
                                                    title="Print Receipt"
                                                  >
                                                    <Printer className="h-4 w-4" />
                                                  </Button>
                                                  <Button 
                                                    onClick={() => handleDownloadReceiptPDF(p)} 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl"
                                                    title="Download Receipt PDF"
                                                  >
                                                    <Download className="h-4 w-4" />
                                                  </Button>
                                                </div>
                                              </div>
                                            ))
                                          ) : (
                                            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                                          )}
                                        </div>
                                      </div>
                                      
                                      <div className="border-t pt-5 mt-5 space-y-4">
                                        <div className="flex items-center gap-2">
                                          <div className="h-2 w-2 rounded-full bg-[#25D366] animate-pulse" />
                                          <h4 className="font-semibold text-sm">Send WhatsApp Fees Status</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-accent/10 p-4 rounded-2xl border">
                                          <div className="md:col-span-1 space-y-1.5">
                                            <Label htmlFor="waPhone" className="text-xs font-semibold">WhatsApp Number</Label>
                                            <Input
                                              id="waPhone"
                                              type="text"
                                              placeholder="e.g. 919876543210"
                                              value={waRecipientPhone}
                                              onChange={(e) => setWaRecipientPhone(e.target.value)}
                                              className="text-xs rounded-xl"
                                            />
                                            <p className="text-[10px] text-muted-foreground leading-tight">Prefilled from Parents WhatsApp &gt; Student WhatsApp &gt; Student Phone</p>
                                          </div>
                                          <div className="md:col-span-2 space-y-1.5">
                                            <Label htmlFor="waMsg" className="text-xs font-semibold">Customizable Message Template</Label>
                                            <div className="flex gap-2">
                                              <textarea
                                                id="waMsg"
                                                rows={3}
                                                className="flex min-h-[80px] w-full rounded-xl border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                                                value={waCustomMessage}
                                                onChange={(e) => setWaCustomMessage(e.target.value)}
                                              />
                                              <Button
                                                onClick={() => {
                                                  if (!waRecipientPhone) {
                                                    toast.error("Please enter a WhatsApp contact number.");
                                                    return;
                                                  }
                                                  const cleanedPhone = waRecipientPhone.split('+').join('').split(' ').join('');
                                                  const waUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(waCustomMessage)}`;
                                                  window.open(waUrl, '_blank');
                                                  toast.success("Opening WhatsApp...");
                                                }}
                                                className="bg-[#25D366] hover:bg-[#128C7E] text-white self-end gap-2 h-10 rounded-xl font-semibold shrink-0"
                                              >
                                                Send
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </Card>
              </div>
            )}

            
            {activeTab === 'tests' && (
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b pb-6">
                  <div>
                    <h3 className="text-2xl font-black text-primary">Tests Management</h3>
                    <p className="text-sm text-muted-foreground mt-1">Create exams and track student performance</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Dialog open={openDialog === "subjects"} onOpenChange={(open) => setOpenDialog(open ? "subjects" : null)}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="flex items-center gap-2 h-12 px-6 rounded-xl border-accent focus:ring-primary hover:scale-[1.02] transition-all">
                          <BookOpen className="h-5 w-5 text-primary" />
                          <span className="font-bold">Manage Subjects</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Manage Subjects</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <form onSubmit={async (e) => {
                            e.preventDefault();
                            const form = e.currentTarget;
                            const fd = new FormData(form);
                            const name = fd.get('subjectName') as string;
                            if (!name.trim()) return;
                            try {
                              await addSubject({ id: Date.now().toString(), name: name.trim() });
                              toast.success("Subject added successfully");
                              form.reset();
                              loadData();
                            } catch (err: any) {
                              toast.error(err.message || "Failed to add subject");
                            }
                          }} className="flex gap-2">
                            <Input name="subjectName" placeholder="New Subject Name (e.g., Physics)" required />
                            <Button type="submit">Add</Button>
                          </form>
                          
                          <div className="border rounded-lg max-h-60 overflow-y-auto divide-y">
                            {subjects.map(sub => (
                              <div key={sub.id} className="flex items-center justify-between p-3">
                                <span className="font-medium text-sm">{sub.name}</span>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={async () => {
                                  if (window.confirm(`Are you sure you want to delete ${sub.name}?`)) {
                                    if (await deleteSubject(sub.id)) {
                                      toast.success("Subject deleted");
                                      loadData();
                                    } else {
                                      toast.error("Failed to delete subject");
                                    }
                                  }
                                }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            {subjects.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-6">No subjects created yet. Add one above.</p>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={openDialog === "test"} onOpenChange={(open) => setOpenDialog(open ? "test" : null)}>
                      <DialogTrigger asChild>
                        <Button className="flex items-center gap-2 h-12 px-6 rounded-xl shadow-lg shadow-primary hover:scale-[1.02] transition-all">
                          <Plus className="h-5 w-5" />
                          <span className="font-bold">Create New Test</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Create New Test</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddTest} className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="test-name">Test Name</Label>
                              <Input id="test-name" name="name" placeholder="e.g. Midterm exam" required />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="test-date">Date</Label>
                              <Input id="test-date" name="date" type="date" required />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Subject</Label>
                            <Select value={testSubject} onValueChange={setTestSubject}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select subject (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                {subjects.map(sub => (
                                  <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                                ))}
                                <SelectItem value="__other__">Other (Custom)</SelectItem>
                              </SelectContent>
                            </Select>
                            {testSubject === '__other__' && (
                              <Input name="customSubject" placeholder="Enter custom subject name" className="mt-2" />
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label>Select Batches (Multiple)</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border rounded-md bg-accent">
                              {batches.map(batch => (
                                <div key={batch.id} className="flex items-center gap-2">
                                  <Checkbox 
                                    id={`batch-${batch.id}`} 
                                    checked={selectedBatches.includes(batch.id)}
                                    onCheckedChange={(checked) => {
                                      if (checked) setSelectedBatches([...selectedBatches, batch.id]);
                                      else setSelectedBatches(selectedBatches.filter(id => id !== batch.id));
                                    }}
                                  />
                                  <label htmlFor={`batch-${batch.id}`} className="text-xs font-medium cursor-pointer">{batch.name}</label>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Test Type</Label>
                            <div className="flex gap-4">
                              <div className="flex items-center gap-2">
                                <input 
                                  type="radio" 
                                  id="type-subjective" 
                                  checked={testType === 'subjective'} 
                                  onChange={() => setTestType('subjective')} 
                                />
                                <Label htmlFor="type-subjective" className="font-normal">Subjective</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <input 
                                  type="radio" 
                                  id="type-mcq" 
                                  checked={testType === 'mcq'} 
                                  onChange={() => setTestType('mcq')} 
                                />
                                <Label htmlFor="type-mcq" className="font-normal">MCQ</Label>
                              </div>
                            </div>
                          </div>

                          {testType === 'subjective' ? (
                            <div className="space-y-2">
                              <Label htmlFor="test-marks">Total Marks</Label>
                              <Input id="test-marks" name="totalMarks" type="number" required />
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="text-lg font-bold">MCQ Questions ({mcqQuestions.length})</Label>
                                <Button type="button" variant="outline" size="sm" onClick={handleAddMcqQuestion}>
                                  <Plus className="h-4 w-4 mr-2" /> Add Question
                                </Button>
                              </div>
                              
                              <div className="space-y-6">
                                {mcqQuestions.map((q, qIdx) => (
                                  <Card key={q.id} className="p-4 bg-accent space-y-4 relative">
                                    <Button 
                                      type="button" 
                                      variant="ghost" 
                                      size="icon" 
                                      className="absolute top-2 right-2 text-destructive"
                                      onClick={() => removeMcqQuestion(q.id)}
                                    >
                                      <Plus className="h-4 w-4 rotate-45" />
                                    </Button>
                                    <div className="space-y-2">
                                      <Label>Question {qIdx + 1}</Label>
                                      <Input 
                                        value={q.question} 
                                        onChange={(e) => updateMcqQuestion(q.id, 'question', e.target.value)}
                                        placeholder="Type question here..."
                                        required
                                      />
                                    </div>
                                    <div className="space-y-3">
                                      <Label className="text-xs uppercase font-black text-muted-foreground">Options (Select the correct one)</Label>
                                      {q.options.map((opt, optIdx) => (
                                        <div key={optIdx} className="flex items-center gap-3">
                                          <Checkbox 
                                            checked={q.correctOptionIndex === optIdx}
                                            onCheckedChange={() => updateMcqQuestion(q.id, 'correctOptionIndex', optIdx)}
                                          />
                                          <Input 
                                            value={opt} 
                                            onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                                            placeholder={`Option ${optIdx + 1}`}
                                            required
                                          />
                                        </div>
                                      ))}
                                      <Button type="button" variant="link" size="sm" onClick={() => addOption(q.id)} className="p-0 h-auto">
                                        + Add Option
                                      </Button>
                                    </div>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          )}

                          <Button type="submit" className="w-full h-12 font-bold text-lg">Create Test</Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="flex items-center gap-2 h-12 px-6 rounded-xl border border-border bg-background shadow-sm hover:bg-accent font-bold">
                          Edit Message Template
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Test Message Templates</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 pt-4">
                          {/* Marks Template */}
                          <div className="space-y-2">
                            <Label className="font-bold text-xs">Test Marks Template</Label>
                            <p className="text-[10px] text-muted-foreground">
                              Use <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">{'{name}'}</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">{'{marks}'}</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">{'{total}'}</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">{'{testName}'}</code>, and <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">{'{date}'}</code>.
                            </p>
                            <textarea 
                              className="w-full min-h-[80px] p-3 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-primary outline-none resize-y"
                              value={testMarksMessage}
                              onChange={(e) => setTestMarksMessage(e.target.value)}
                              placeholder="Type your WhatsApp message template here..."
                            />
                            <div className="bg-accent/40 p-3 rounded-xl border text-[11px] leading-relaxed">
                              <strong className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-1">Preview:</strong>
                              <p className="whitespace-pre-wrap">
                                {testMarksMessage
                                  .replace('{name}', 'John Doe')
                                  .replace('{marks}', '18')
                                  .replace('{total}', '20')
                                  .replace('{testName}', 'Maths Quiz')
                                  .replace('{date}', new Date().toLocaleDateString())}
                              </p>
                            </div>
                          </div>

                          {/* Absent Template */}
                          <div className="space-y-2 border-t pt-4">
                            <Label className="font-bold text-xs">Test Absent Template</Label>
                            <p className="text-[10px] text-muted-foreground">
                              Use <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">{'{name}'}</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">{'{testName}'}</code>, and <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">{'{date}'}</code>.
                            </p>
                            <textarea 
                              className="w-full min-h-[80px] p-3 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-primary outline-none resize-y"
                              value={testAbsentMessage}
                              onChange={(e) => setTestAbsentMessage(e.target.value)}
                              placeholder="Type your WhatsApp absent message template here..."
                            />
                            <div className="bg-accent/40 p-3 rounded-xl border text-[11px] leading-relaxed">
                              <strong className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-1">Preview:</strong>
                              <p className="whitespace-pre-wrap">
                                {testAbsentMessage
                                  .replace('{name}', 'John Doe')
                                  .replace('{testName}', 'Maths Quiz')
                                  .replace('{date}', new Date().toLocaleDateString())}
                              </p>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>




                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Test List */}
                    <div className="lg:col-span-1 flex flex-col max-h-[65vh] space-y-3">
                      <div className="relative mb-1 shrink-0">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search tests..."
                          className="pl-9 h-10 rounded-xl bg-accent border-accent focus-visible:ring-primary"
                          value={testSearch}
                          onChange={(e) => setTestSearch(e.target.value)}
                        />
                      </div>
                      <div className="space-y-3 overflow-y-auto pr-2 flex-1">
                        {(() => {
                          const filteredTests = tests.filter(test => {
                            const searchLower = testSearch.toLowerCase();
                            const matchesName = test.name.toLowerCase().includes(searchLower);
                            const matchesSubject = test.subject ? test.subject.toLowerCase().includes(searchLower) : false;
                            const batchNames = (test.batchIds && test.batchIds.length > 0)
                              ? test.batchIds.map(bid => batches.find(b => b.id === bid)?.name || '').filter(Boolean).join(' ')
                              : (batches.find(b => b.id === test.batchId)?.name || '');
                            const matchesBatch = batchNames.toLowerCase().includes(searchLower);
                            return matchesName || matchesSubject || matchesBatch;
                          });

                          if (tests.length === 0) {
                            return (
                              <p className="text-sm text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl bg-accent/30">
                                No tests created yet.
                              </p>
                            );
                          }

                          if (filteredTests.length === 0) {
                            return (
                              <p className="text-sm text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl bg-accent/30">
                                No matching tests found.
                              </p>
                            );
                          }

                          return filteredTests.map(test => {
                            const batchNames = (test.batchIds && test.batchIds.length > 0)
                              ? test.batchIds.map(bid => batches.find(b => b.id === bid)?.name).filter(Boolean).join(', ')
                              : (batches.find(b => b.id === test.batchId)?.name || 'Unknown');
                            const isSelected = selectedTest?.id === test.id;
                            const results = getTestResultsByTest(test.id);
                            const presentResults = results.filter(r => !r.isAbsent);
                            const avgScore = presentResults.length > 0 ? Math.round((presentResults.reduce((s, r) => s + r.marksObtained, 0) / presentResults.length / test.totalMarks) * 100) : null;
                            
                            return (
                              <div 
                                key={test.id} 
                                className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'bg-card'}`}
                                onClick={() => handleSelectTest(test)}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <h4 className="font-semibold">{test.name}</h4>
                                    {test.subject && (
                                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 mt-1">{test.subject}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                      onClick={() => handleStartEditTest(test)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <DeleteDialog
                                      title="Delete Test"
                                      description="Are you sure? This will remove all student marks for this test."
                                      onDelete={() => handleDeleteTest(test.id)}
                                      trigger={
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      }
                                    />
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground space-y-1">
                                  <p>Batches: <span className="font-medium text-foreground">{batchNames}</span></p>
                                  <p>{new Date(test.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                  <div className="flex items-center justify-between mt-2">
                                    <span>{test.questions ? `${test.questions.length} MCQ` : `Total: ${test.totalMarks} marks`}</span>
                                    {avgScore !== null && (
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${avgScore >= 75 ? 'bg-emerald-100 text-emerald-700' : avgScore >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                        Avg: {avgScore}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Student Marks Entry */}
                    <div className="lg:col-span-2">
                      {selectedTest ? (
                        <div className="bg-card border rounded-lg overflow-hidden">
                          <div className="bg-gradient-to-r from-primary/10 to-accent/10 border-b p-4">
                            <h4 className="text-lg font-semibold">{selectedTest.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {new Date(selectedTest.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })} • Max: {selectedTest.totalMarks} marks
                            </p>
                          </div>
                          <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
                            {(() => {
                              const allowedBatchIds = (selectedTest.batchIds && selectedTest.batchIds.length > 0) ? selectedTest.batchIds : (selectedTest.batchId ? [selectedTest.batchId] : []);
                              const allBatchStudents = students.filter(s => allowedBatchIds.includes(s.batchId));
                              if (allBatchStudents.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">No students in the selected batches.</p>;

                              // Group students by batch
                              const batchGroups = allowedBatchIds.map(bid => {
                                const batch = batches.find(b => b.id === bid);
                                const batchStudentsList = students.filter(s => s.batchId === bid);
                                const batchResults = testResults.filter(r => batchStudentsList.some(s => s.id === r.studentId));
                                const presentBatchResults = batchResults.filter(r => !r.isAbsent);
                                const avgScore = presentBatchResults.length > 0 ? Math.round((presentBatchResults.reduce((s, r) => s + r.marksObtained, 0) / presentBatchResults.length / selectedTest.totalMarks) * 100) : null;
                                return { batchId: bid, batchName: batch?.name || 'Unknown', students: batchStudentsList, avgScore, markedCount: batchResults.length };
                              }).filter(g => g.students.length > 0);

                              // If only one batch, show students directly without batch cards
                              if (batchGroups.length === 1) {
                                return batchGroups[0].students.map(student => {
                                  const existingResult = testResults.find(r => r.studentId === student.id);
                                  const percent = existingResult ? Math.round((existingResult.marksObtained / selectedTest.totalMarks) * 100) : null;
                                  return (
                                    <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-accent/30 transition-colors">
                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                          existingResult?.isAbsent ? 'bg-red-100 text-red-700'
                                          : percent === null ? 'bg-muted text-muted-foreground'
                                          : percent >= 75 ? 'bg-emerald-100 text-emerald-700'
                                          : percent >= 40 ? 'bg-amber-100 text-amber-700'
                                          : 'bg-red-100 text-red-700'
                                        }`}>
                                          {existingResult?.isAbsent ? 'AB' : percent !== null ? `${percent}%` : '—'}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">

                                            <p className="font-medium text-sm truncate">{student.name}</p>

                                            {(() => {

                                              const phone = student.parentWhatsApp || student.whatsappNo || student.phoneNo || "";

                                              if (!phone) return null;

                                              const cleanedPhone = phone.split('+').join('').split(' ').join('');

                                              return (

                                                <div className="flex items-center gap-1">

                                                  <button

                                                    type="button"

                                                    className="inline-flex items-center justify-center h-5 w-5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full shrink-0 transition-colors"

                                                    title={`WhatsApp Parent: ${phone}`}

                                                    onClick={() => {

                                                      const marks = existingResult !== undefined ? String(existingResult.marksObtained) : "—";

                                                      const total = selectedTest ? String(selectedTest.totalMarks) : "";

                                                      const testName = selectedTest ? selectedTest.name : "";

                                                      const date = selectedTest ? new Date(selectedTest.date).toLocaleDateString() : "";

                                                      

                                                      const msg = testMarksMessage

                                                        .replace('{name}', student.name)

                                                        .replace('{marks}', marks)

                                                        .replace('{total}', total)

                                                        .replace('{testName}', testName)

                                                        .replace('{date}', date);

                                                      

                                                      const waUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(msg)}`;

                                                      window.open(waUrl, '_blank');

                                                    }}

                                                  >

                                                    <MessageSquare className="h-3.5 w-3.5" />

                                                  </button>

                                                  <button

                                                    type="button"

                                                    className="inline-flex items-center justify-center h-5 w-5 bg-red-50 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-full shrink-0 text-[9px] font-black transition-colors"

                                                    title={`Send Test Absent Message: ${phone}`}

                                                    onClick={() => {

                                                      const testName = selectedTest ? selectedTest.name : "";

                                                      const date = selectedTest ? new Date(selectedTest.date).toLocaleDateString() : "";

                                                      

                                                      const msg = testAbsentMessage

                                                        .replace('{name}', student.name)

                                                        .replace('{testName}', testName)

                                                        .replace('{date}', date);

                                                      

                                                      const waUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(msg)}`;

                                                      window.open(waUrl, '_blank');

                                                    }}

                                                  >

                                                    AB

                                                  </button>

                                                </div>

                                              );

                                            })()}

                                          </div>
                                          <p className="text-xs text-muted-foreground truncate">{student.phoneNo || student.email}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0 ml-3">
                                        {existingResult?.isAbsent ? (
                                          <span className="text-xs font-black px-3 py-1.5 rounded-lg bg-red-100 text-red-700">ABSENT</span>
                                        ) : (
                                          <Input 
                                            type="number" 
                                            className="w-20 text-right text-sm" 
                                            placeholder="—"
                                            key={existingResult ? String(existingResult.marksObtained) : 'empty'}
                                            defaultValue={existingResult?.marksObtained}
                                            onBlur={(e) => handleSaveMarks(student.id, e.target.value)}
                                          />
                                        )}
                                        <span className="text-xs text-muted-foreground whitespace-nowrap mr-1">/ {selectedTest.totalMarks}</span>
                                        <Button
                                          type="button"
                                          variant={existingResult?.isAbsent ? "destructive" : "outline"}
                                          className="h-8 px-2 text-xs font-bold shrink-0"
                                          onClick={() => toggleAbsent(student.id)}
                                        >
                                          {existingResult?.isAbsent ? "Mark Present" : "Mark Absent"}
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                });
                              }

                              // Multiple batches: show batch cards
                              return batchGroups.map(group => (
                                <details key={group.batchId} className="group border rounded-xl overflow-hidden">
                                  <summary className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-accent/30 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2.5 bg-primary/10 text-primary rounded-xl group-open:bg-primary group-open:text-primary-foreground transition-colors">
                                        <Users className="h-4 w-4" />
                                      </div>
                                      <div>
                                        <p className="font-semibold text-sm">{group.batchName}</p>
                                        <p className="text-xs text-muted-foreground">{group.students.length} students • {group.markedCount} marked</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {group.avgScore !== null && (
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${group.avgScore >= 75 ? 'bg-emerald-100 text-emerald-700' : group.avgScore >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                          Avg: {group.avgScore}%
                                        </span>
                                      )}
                                      <svg className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                    </div>
                                  </summary>
                                  <div className="border-t p-3 space-y-2 bg-accent/5">
                                    {group.students.map(student => {
                                      const existingResult = testResults.find(r => r.studentId === student.id);
                                      const percent = existingResult ? Math.round((existingResult.marksObtained / selectedTest.totalMarks) * 100) : null;
                                      return (
                                        <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-accent/30 transition-colors">
                                          <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                              existingResult?.isAbsent ? 'bg-red-100 text-red-700'
                                              : percent === null ? 'bg-muted text-muted-foreground'
                                              : percent >= 75 ? 'bg-emerald-100 text-emerald-700'
                                              : percent >= 40 ? 'bg-amber-100 text-amber-700'
                                              : 'bg-red-100 text-red-700'
                                            }`}>
                                              {existingResult?.isAbsent ? 'AB' : percent !== null ? `${percent}%` : '—'}
                                            </div>
                                            <div className="min-w-0">
                                              <div className="flex items-center gap-1.5">

                                                <p className="font-medium text-sm truncate">{student.name}</p>

                                                {(() => {

                                                  const phone = student.parentWhatsApp || student.whatsappNo || student.phoneNo || "";

                                                  if (!phone) return null;

                                                  const cleanedPhone = phone.split('+').join('').split(' ').join('');

                                                  return (

                                                    <div className="flex items-center gap-1">

                                                      <button

                                                        type="button"

                                                        className="inline-flex items-center justify-center h-5 w-5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full shrink-0 transition-colors"

                                                        title={`WhatsApp Parent: ${phone}`}

                                                        onClick={() => {

                                                          const marks = existingResult !== undefined ? String(existingResult.marksObtained) : "—";

                                                          const total = selectedTest ? String(selectedTest.totalMarks) : "";

                                                          const testName = selectedTest ? selectedTest.name : "";

                                                          const date = selectedTest ? new Date(selectedTest.date).toLocaleDateString() : "";

                                                          

                                                          const msg = testMarksMessage

                                                            .replace('{name}', student.name)

                                                            .replace('{marks}', marks)

                                                            .replace('{total}', total)

                                                            .replace('{testName}', testName)

                                                            .replace('{date}', date);

                                                          

                                                          const waUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(msg)}`;

                                                          window.open(waUrl, '_blank');

                                                        }}

                                                      >

                                                        <MessageSquare className="h-3.5 w-3.5" />

                                                      </button>

                                                      <button

                                                        type="button"

                                                        className="inline-flex items-center justify-center h-5 w-5 bg-red-50 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-full shrink-0 text-[9px] font-black transition-colors"

                                                        title={`Send Test Absent Message: ${phone}`}

                                                        onClick={() => {

                                                          const testName = selectedTest ? selectedTest.name : "";

                                                          const date = selectedTest ? new Date(selectedTest.date).toLocaleDateString() : "";

                                                          

                                                          const msg = testAbsentMessage

                                                            .replace('{name}', student.name)

                                                            .replace('{testName}', testName)

                                                            .replace('{date}', date);

                                                          

                                                          const waUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(msg)}`;

                                                          window.open(waUrl, '_blank');

                                                        }}

                                                      >

                                                        AB

                                                      </button>

                                                    </div>

                                                  );

                                                })()}

                                              </div>
                                              <p className="text-xs text-muted-foreground truncate">{student.phoneNo || student.email}</p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0 ml-3">
                                            {existingResult?.isAbsent ? (
                                              <span className="text-xs font-black px-3 py-1.5 rounded-lg bg-red-100 text-red-700">ABSENT</span>
                                            ) : (
                                              <Input 
                                                type="number" 
                                                className="w-20 text-right text-sm" 
                                                placeholder="—"
                                                key={existingResult ? String(existingResult.marksObtained) : 'empty'}
                                                defaultValue={existingResult?.marksObtained}
                                                onBlur={(e) => handleSaveMarks(student.id, e.target.value)}
                                              />
                                            )}
                                            <span className="text-xs text-muted-foreground whitespace-nowrap mr-1">/ {selectedTest.totalMarks}</span>
                                            <Button
                                              type="button"
                                              variant={existingResult?.isAbsent ? "destructive" : "outline"}
                                              className="h-8 px-2 text-xs font-bold shrink-0"
                                              onClick={() => toggleAbsent(student.id)}
                                            >
                                              {existingResult?.isAbsent ? "Mark Present" : "Mark Absent"}
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </details>
                              ));
                            })()}
                          </div>
                          {/* Score Distribution */}
                          {testResults.length > 0 && (
                            <div className="border-t p-4 bg-muted/30">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Score Distribution</p>
                              <div className="flex gap-3">
                                {[
                                  { label: '≥75%', count: testResults.filter(r => (r.marksObtained / selectedTest.totalMarks) * 100 >= 75).length, color: 'bg-emerald-500' },
                                  { label: '40-74%', count: testResults.filter(r => { const p = (r.marksObtained / selectedTest.totalMarks) * 100; return p >= 40 && p < 75; }).length, color: 'bg-amber-500' },
                                  { label: '<40%', count: testResults.filter(r => (r.marksObtained / selectedTest.totalMarks) * 100 < 40).length, color: 'bg-red-500' },
                                ].map(seg => (
                                  <div key={seg.label} className="flex items-center gap-1.5 text-xs">
                                    <div className={`h-2.5 w-2.5 rounded-full ${seg.color}`} />
                                    <span className="text-muted-foreground">{seg.label}: <strong className="text-foreground">{seg.count}</strong></span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg bg-accent/50 py-12">
                          <CheckSquare className="h-12 w-12 mb-3 opacity-20" />
                          <p className="font-medium">Select a test</p>
                          <p className="text-sm">Choose a test from the list to enter marks</p>
                        </div>
                      )}
                    </div>
                  </div>

                </Card>
            )}

            {/* Edit Test Dialog */}
            <Dialog open={!!editingTest} onOpenChange={(open) => !open && setEditingTest(null)}>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Test Details</DialogTitle>
                </DialogHeader>
                {editingTest && (
                  <form onSubmit={handleUpdateTest} className="space-y-6 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-test-name">Test Name</Label>
                      <Input 
                        id="edit-test-name" 
                        name="name" 
                        defaultValue={editingTest.name} 
                        placeholder="e.g. Midterm exam" 
                        required 
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="edit-test-date">Date</Label>
                      <Input 
                        id="edit-test-date" 
                        name="date" 
                        type="date" 
                        defaultValue={editingTest.date} 
                        required 
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Select value={editTestSubject} onValueChange={setEditTestSubject}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map(sub => (
                            <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                          ))}
                          <SelectItem value="__other__">Other (Custom)</SelectItem>
                        </SelectContent>
                      </Select>
                      {editTestSubject === '__other__' && (
                        <Input 
                          name="customSubject" 
                          placeholder="Enter custom subject name" 
                          defaultValue={subjects.some(s => s.name === editingTest.subject) ? "" : editingTest.subject} 
                          className="mt-2" 
                        />
                      )}
                    </div>

                    <div className="flex gap-2 justify-end pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setEditingTest(null)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit">
                        Save Changes
                      </Button>
                    </div>
                  </form>
                )}
              </DialogContent>
            </Dialog>

            
            {activeTab === 'staff' && (
              <div className="space-y-6">
                <Card className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b pb-6">
                    <div>
                      <h3 className="text-2xl font-black text-primary flex items-center gap-2">
                        <ClipboardCheck className="h-6 w-6" /> Staff & Attendance
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">Manage staff accounts and take student attendance</p>
                    </div>
                    <Dialog open={openDialog === "addStaff"} onOpenChange={(open) => setOpenDialog(open ? "addStaff" : null)}>
                      <DialogTrigger asChild>
                        <Button className="font-black gap-2 h-12 px-6 rounded-2xl shadow-lg shadow-primary/20">
                          <UserPlus className="h-4 w-4" /> Add Staff Member
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md rounded-[32px]">
                        <DialogHeader>
                          <DialogTitle className="text-2xl font-black">Register New Staff</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSaveStaff} className="space-y-4 pt-4">
                          <div className="space-y-2">
                            <Label htmlFor="name" className="font-bold">Full Name</Label>
                            <Input id="name" name="name" placeholder="Enter staff name" required className="h-12 rounded-xl" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email" className="font-bold">Email Address (Login ID)</Label>
                            <Input id="email" name="email" type="email" placeholder="staff@example.com" required className="h-12 rounded-xl" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="password" className="font-bold">Password</Label>
                            <Input id="password" name="password" type="password" placeholder="••••••••" required className="h-12 rounded-xl" />
                          </div>
                          <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 mt-4">
                            Create Account
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {staff.length > 0 && (
                    <div className="mb-10">
                      <h4 className="text-lg font-black mb-4 flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" /> Active Staff Accounts
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {staff.map(s => (
                          <div key={s.id} className="p-4 bg-accent/5 rounded-2xl border border-primary/10 flex items-center justify-between group hover:border-primary/30 transition-all">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black">
                                {s.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold">{s.name}</p>
                                <p className="text-[10px] text-muted-foreground font-medium">{s.email}</p>
                              </div>
                            </div>
                            <DeleteDialog 
                              title="Delete Staff Account?" 
                              onDelete={() => handleDeleteStaff(s.id)}
                              trigger={
                                <Button variant="ghost" size="icon" className="text-destructive/40 hover:text-destructive hover:bg-destructive/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all">
                                  <Plus className="h-4 w-4 rotate-45" />
                                </Button>
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-8 mb-6">
                    <h4 className="text-lg font-black mb-1 flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" /> Daily Batch Attendance
                    </h4>
                    <p className="text-sm text-muted-foreground mb-6">Take student attendance batch-wise for today: {new Date().toLocaleDateString()}</p>
                  </div>

                  {!selectedAttendanceBatch ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {batches.map(batch => {
                        const batchStudents = students.filter(s => s.batchId === batch.id);
                        return (
                          <div 
                            key={batch.id} 
                            onClick={() => setSelectedAttendanceBatch(batch.id)}
                            className="group p-6 rounded-[32px] border-2 border-primary bg-card hover:border-primary hover:shadow-xl transition-all cursor-pointer relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 p-4 bg-primary rounded-bl-[32px] group-hover:bg-primary transition-colors">
                              <ClipboardCheck className="h-6 w-6 text-primary" />
                            </div>
                            <h4 className="text-2xl font-black mb-1">{batch.name}</h4>
                            <p className="text-sm text-muted-foreground mb-4 font-medium">Academic Year {batch.year}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold bg-primary text-primary px-3 py-1 rounded-full">
                                {batchStudents.length} Students
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <div className="flex items-center justify-between mb-6">
                        <Button variant="ghost" onClick={() => setSelectedAttendanceBatch(null)} className="gap-2 font-bold">
                          <Plus className="h-4 w-4 rotate-45" /> Back to Batches
                        </Button>
                        <div className="text-right">
                          <h4 className="text-2xl font-black">
                            {batches.find(b => b.id === selectedAttendanceBatch)?.name} Attendance
                          </h4>
                          <p className="text-sm text-muted-foreground">Today: {new Date().toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div className="space-y-3 mb-8">
                        {students.filter(s => s.batchId === selectedAttendanceBatch).map(student => (
                          <div key={student.id} className="flex items-center justify-between p-4 bg-accent rounded-2xl border border-primary">
                            <div className="flex items-center gap-4">
                              <div className={`h-12 w-12 rounded-full flex items-center justify-center font-black text-lg ${dailyAttendance[student.id] === 'absent' ? 'bg-destructive text-destructive' : 'bg-primary text-primary'}`}>
                                {student.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-lg">{student.name}</p>
                                <p className="text-xs text-muted-foreground font-medium">{student.phoneNo || 'No phone'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 bg-background p-1.5 rounded-xl border">
                              <Button 
                                variant={dailyAttendance[student.id] === 'present' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setDailyAttendance({...dailyAttendance, [student.id]: 'present'})}
                                className={`rounded-lg font-bold px-4 ${dailyAttendance[student.id] === 'present' ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200' : ''}`}
                              >
                                Present
                              </Button>
                              <Button 
                                variant={dailyAttendance[student.id] === 'absent' ? 'destructive' : 'ghost'}
                                size="sm"
                                onClick={() => setDailyAttendance({...dailyAttendance, [student.id]: 'absent'})}
                                className="rounded-lg font-bold px-4"
                              >
                                Absent
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end gap-4">
                        <Button variant="outline" onClick={() => setSelectedAttendanceBatch(null)} className="h-14 px-10 rounded-2xl font-bold">Cancel</Button>
                                      <Button onClick={handleSaveDailyAttendance} className="h-14 px-12 rounded-2xl font-black text-lg bg-primary shadow-xl shadow-primary">
                          Save Batch Attendance
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            )}

            
            {activeTab === 'classes' && (
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Classes</h3>
                    <p className="text-sm text-muted-foreground">Manage your {classes.length} classes</p>
                  </div>
                  <Dialog open={openDialog === "class"} onOpenChange={(open) => setOpenDialog(open ? "class" : null)}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        <span>Create Class</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Class</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddClass} className="space-y-6 pt-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="class-name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Class Name</Label>
                            <Input id="class-name" name="name" placeholder="e.g., Advanced Mathematics" className="h-12 rounded-xl border-accent focus:ring-primary" required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="class-subject" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Subject</Label>
                            <Input id="class-subject" name="subject" placeholder="e.g., Calculus" className="h-12 rounded-xl border-accent focus:ring-primary" required />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2 col-span-2">
                            <Label htmlFor="class-batch" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Assign Batch</Label>
                            <Select name="batchId" required>
                              <SelectTrigger className="h-12 rounded-xl border-accent">
                                <SelectValue placeholder="Select batch" />
                              </SelectTrigger>
                              <SelectContent>
                                {batches.map((batch) => (
                                  <SelectItem key={batch.id} value={batch.id}>
                                    {batch.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="bg-primary p-5 rounded-[24px] border border-primary space-y-4">
                           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 text-center">Schedule Configuration</p>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5 sm:col-span-2">
                              <Label htmlFor="class-date" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Date
                              </Label>
                              <Input id="class-date" name="date" type="date" className="h-10 rounded-lg shadow-inner bg-white dark:bg-card" required />
                            </div>
                            
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Plus className="h-3 w-3 rotate-45" /> Start Time
                              </Label>
                              <div className="flex gap-2">
                                <Input name="time" type="time" className="h-10 rounded-lg flex-1" required />
                                <Select name="timePeriod" defaultValue="AM">
                                  <SelectTrigger className="w-20 h-10 rounded-lg">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="AM">AM</SelectItem>
                                    <SelectItem value="PM">PM</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Plus className="h-3 w-3" /> End Time
                              </Label>
                              <div className="flex gap-2">
                                <Input name="endTime" type="time" className="h-10 rounded-lg flex-1" required />
                                <Select name="endTimePeriod" defaultValue="AM">
                                  <SelectTrigger className="w-20 h-10 rounded-lg">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="AM">AM</SelectItem>
                                    <SelectItem value="PM">PM</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg bg-primary hover:scale-[1.01] transition-transform shadow-xl shadow-primary">
                          CREATE CLASS SESSION
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map((classItem) => {
                    const batch = batches.find(b => b.id === classItem.batchId);
                    const isPast = isClassPassed(classItem);
                    return (
                      <div key={classItem.id} className={`p-4 rounded-lg border text-sm flex flex-col justify-between transition-shadow ${isPast ? 'bg-muted/50 opacity-60' : 'bg-card hover:shadow-md'}`}>
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-base">{classItem.name}</p>
                                {isPast && (
                                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-muted-foreground/20 text-muted-foreground px-1.5 py-0.5 rounded">Completed</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{classItem.subject}</p>
                            </div>
                            <DeleteDialog
                              title="Delete Class"
                              description={`Are you sure you want to delete ${classItem.name}? This action cannot be undone.`}
                              onDelete={() => handleDeleteClass(classItem.id)}
                            />
                          </div>
                          <div className="mt-3 space-y-2">
                             <div className="flex flex-wrap gap-1.5">
                                <span className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-bold">Batch: {batch?.name || 'Unknown'}</span>
                             </div>
                             <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                               <Calendar className="h-3 w-3" />
                               <span>
                                 {classItem.date} • {(() => {
                                   const format12h = (t24: string) => {
                                     const [h, m] = t24.split(':').map(Number);
                                     const period = h >= 12 ? 'PM' : 'AM';
                                     const displayH = h % 12 || 12;
                                     return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
                                   };
                                   return `${format12h(classItem.time)} - ${format12h(classItem.endTime)}`;
                                 })()}
                               </span>
                             </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {classes.length === 0 && (
                    <div className="col-span-full py-8 text-center text-muted-foreground bg-accent rounded-lg border-2 border-dashed">
                      No classes found. Create your first class to get started.
                    </div>
                  )}
                </div>
              </Card>
            )}

            
            {activeTab === 'batches' && (
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Batches</h3>
                    <p className="text-sm text-muted-foreground">Manage your {batches.length} active batches</p>
                  </div>
                  <Dialog open={openDialog === "batch"} onOpenChange={(open) => setOpenDialog(open ? "batch" : null)}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        <span>Create Batch</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Batch</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddBatch} className="space-y-4">
                        <div>
                          <Label htmlFor="batch-name">Batch Name</Label>
                          <Input id="batch-name" name="name" placeholder="e.g., Batch D" required />
                        </div>
                        <div>
                          <Label htmlFor="batch-year">Academic Year</Label>
                          <Input id="batch-year" name="year" placeholder="e.g., 2024" required />
                        </div>
                        <Button type="submit" className="w-full">Create Batch</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {batches.map((batch) => {
                    const batchStudents = students.filter(s => s.batchId === batch.id);
                    const batchClasses = classes.filter(c => c.batchId === batch.id);
                    return (
                      <div key={batch.id} className="p-5 rounded-lg border bg-card hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-semibold text-lg">{batch.name}</h4>
                            <span className="text-sm text-muted-foreground">Academic Year {batch.year}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => navigate(`/admin-dashboard/batches/${batch.id}`)}>
                              View Details
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteBatch(batch.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-md text-sm font-medium">
                            {batchStudents.length} Students
                          </div>
                          <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-md text-sm font-medium">
                            {batchClasses.length} Classes
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {batches.length === 0 && (
                    <div className="col-span-full py-8 text-center text-muted-foreground bg-accent rounded-lg border-2 border-dashed">
                      No batches found. Create your first batch to get started.
                    </div>
                  )}
                </div>
              </Card>
            )}
            
            {activeTab === 'attendance' && (
              <div className="space-y-6">
                {!selectedReportBatch ? (
                  <Card className="p-6">
                    <>
                      <div className="mb-6 border-b pb-6">
                        <h3 className="text-2xl font-black text-primary">Attendance Reports</h3>
                        <p className="text-sm text-muted-foreground mt-1">Select a batch to view detailed attendance reports</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {batches.map(batch => {
                          const batchStudents = students.filter(s => s.batchId === batch.id);
                          return (
                            <div 
                              key={batch.id} 
                              onClick={() => setSelectedReportBatch(batch.id)}
                              className="group p-6 rounded-[32px] border-2 border-primary/20 bg-card hover:border-primary hover:shadow-xl transition-all cursor-pointer relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 p-4 bg-primary/10 rounded-bl-[32px] group-hover:bg-primary transition-colors">
                                <BarChart3 className="h-6 w-6 text-primary group-hover:text-primary-foreground" />
                              </div>
                              <h4 className="text-2xl font-black mb-1">{batch.name}</h4>
                              <p className="text-sm text-muted-foreground mb-4 font-medium">Academic Year {batch.year}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
                                  {batchStudents.length} Students
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  </Card>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
                    <Card className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                        <div className="flex items-center gap-4">
                          <Button variant="ghost" onClick={() => setSelectedReportBatch(null)} className="gap-2 font-bold p-0 hover:bg-transparent">
                            <Plus className="h-5 w-5 rotate-45" />
                          </Button>
                          <div>
                            <h3 className="text-xl font-black">{batches.find(b => b.id === selectedReportBatch)?.name} Overview</h3>
                            <p className="text-sm text-muted-foreground">View and manage student attendance records</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Card className="p-4 bg-primary/10 border-primary/20 shadow-none text-center">
                            <p className="text-sm text-primary/70 font-bold uppercase tracking-wider mb-1">Today's Present</p>
                            <p className="text-4xl font-black text-primary">
                              {(() => {
                                const today = currentDateStr || getLocalDateString();
                                const batchStudents = students.filter(s => s.batchId === selectedReportBatch);
                                const records = batchStudents.map(s => getStudentAttendance(s.id)).flat();
                                return records.filter(r => r.date === today && r.status === 'present').length;
                              })()}
                            </p>
                          </Card>
                          <Card className="p-4 bg-destructive/10 border-destructive/20 shadow-none text-center">
                            <p className="text-sm text-destructive/70 font-bold uppercase tracking-wider mb-1">Today's Absent</p>
                            <p className="text-4xl font-black text-destructive">
                              {(() => {
                                const today = currentDateStr || getLocalDateString();
                                const batchStudents = students.filter(s => s.batchId === selectedReportBatch);
                                const records = batchStudents.map(s => getStudentAttendance(s.id)).flat();
                                return records.filter(r => r.date === today && r.status === 'absent').length;
                              })()}
                            </p>
                          </Card>
                          <Card className="p-4 bg-accent/50 border-accent shadow-none text-center">
                            <p className="text-sm text-accent-foreground/70 font-bold uppercase tracking-wider mb-1">Avg. Attendance</p>
                            <p className="text-4xl font-black text-accent-foreground">
                              {(() => {
                                const batchStudents = students.filter(s => s.batchId === selectedReportBatch);
                                const records = batchStudents.map(s => getStudentAttendance(s.id)).flat();
                                if (records.length === 0) return "0%";
                                const present = records.filter(r => r.status === 'present').length;
                                const ratio = present / records.length;
                                return `${Math.round(ratio * 100)}%`;
                              })()}
                            </p>
                          </Card>
                        </div>

                        <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-3 text-left font-semibold">Student Name</th>
                            <th className="p-3 text-left font-semibold">Batch</th>
                            <th className="p-3 text-center font-semibold">Total Days</th>
                            <th className="p-3 text-center font-semibold">Present</th>
                            <th className="p-3 text-center font-semibold">Absent</th>
                            <th className="p-3 text-right font-semibold">Percentage</th>
                            <th className="p-3 text-right font-semibold">Last Marked</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {students.filter(s => s.batchId === selectedReportBatch).map(student => {
                            const records = getStudentAttendance(student.id);
                            const total = records.length;
                            const present = records.filter(r => r.status === 'present').length;
                            const absent = records.filter(r => r.status === 'absent').length;
                            const ratio = total > 0 ? present / total : 0;
                            const percent = Math.round(ratio * 100);
                            const batch = batches.find(b => b.id === student.batchId);

                            return (
                              <tr key={student.id} className="hover:bg-accent transition-colors text-black dark:text-white">
                                <td className="p-3 font-medium cursor-pointer text-primary hover:underline" onClick={() => setSelectedAbsentStudent(student)}>{student.name}</td>
                                <td className="p-3 text-muted-foreground">{batch?.name || 'N/A'}</td>
                                <td className="p-3 text-center font-bold">{total}</td>
                                <td className="p-3 text-center text-green-600 font-bold">{present}</td>
                                <td className="p-3 text-center text-destructive font-bold">{absent}</td>
                                <td className="p-3 text-right">
                                  <span className={`px-2 py-1 rounded-full text-xs font-black ${percent >= 75 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {percent}%
                                  </span>
                                </td>
                                <td className="p-3 text-right text-[10px] text-muted-foreground font-medium">
                                  {(() => {
                                    if (records.length === 0) return 'Never';
                                    const markedBy = records[records.length-1].markedBy;
                                    if (!markedBy) return 'Unknown';
                                    
                                    // Handle legacy raw timestamp
                                    if (!isNaN(Number(markedBy))) {
                                      const date = new Date(Number(markedBy));
                                      return (
                                        <span>
                                          Administrator <br/>
                                          <span className="opacity-70">{date.toLocaleTimeString()}</span>
                                        </span>
                                      );
                                    }
                                    
                                    // Handle new format "Name at Time"
                                    return (
                                      <span>
                                        {markedBy.split(' at ')[0]} <br/>
                                        <span className="opacity-70">{markedBy.split(' at ')[1] || ''}</span>
                                      </span>
                                    );
                                  })()}
                                </td>
                              </tr>
                            );
                          })}
                          {students.filter(s => s.batchId === selectedReportBatch).length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-muted-foreground">No student records found in this batch</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>

                
                <Card className="p-6 border-destructive/20 bg-destructive/5">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-destructive flex items-center gap-2">
                        <Users className="h-5 w-5" /> Absent Students Today
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">Send immediate updates to parents via WhatsApp</p>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">Edit Message Template</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>WhatsApp Message Template</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <p className="text-xs text-muted-foreground">Use <code className="bg-muted px-1 rounded">{'{name}'}</code> and <code className="bg-muted px-1 rounded">{'{date}'}</code> as placeholders.</p>
                          <textarea 
                            className="w-full min-h-[100px] p-3 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                            value={absentMessage}
                            onChange={(e) => setAbsentMessage(e.target.value)}
                            placeholder="Type your message here..."
                          />
                          <div className="bg-accent p-3 rounded-md text-xs">
                            <strong>Preview:</strong><br />
                            {absentMessage.replace('{name}', 'John Doe').replace('{date}', new Date().toLocaleDateString())}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="grid gap-4">
                    {(() => {
                      const today = currentDateStr || getLocalDateString();
                      const absentToday = students.filter(student => {
                        if (student.batchId !== selectedReportBatch) return false;
                        const records = getStudentAttendance(student.id);
                        return records.some(r => r.date === today && r.status === 'absent');
                      });

                      if (absentToday.length === 0) {
                        return <p className="text-sm text-center py-8 text-muted-foreground">All students were present or unmarked today.</p>;
                      }

                      return absentToday.map(student => (
                        <div key={student.id} className="flex items-center justify-between p-4 bg-background rounded-xl border border-destructive shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center font-bold">
                              {student.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold">{student.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {batches.find(b => b.id === student.batchId)?.name} • Parent: {student.parentWhatsApp || 'Not set'}
                              </p>
                            </div>
                          </div>
                          <Button 
                            disabled={!student.parentWhatsApp}
                            onClick={() => {
                              const cleanedPhone = (student.parentWhatsApp || '').split('+').join('').split(' ').join('');
                              const msg = absentMessage
                                .replace('{name}', student.name)
                                .replace('{date}', new Date().toLocaleDateString());
                              const waUrl = "https://wa.me/" + cleanedPhone + "?text=" + encodeURIComponent(msg);
                              window.open(waUrl, '_blank');
                            }}
                            className="bg-[#25D366] hover:bg-[#128C7E] text-white font-bold gap-2"
                          >
                            WhatsApp Parent
                          </Button>
                        </div>
                      ));
                    })()}
                </div>
              </Card>
            </div>
          )}

          {/* Absent Dates Dialog */}
          <Dialog open={!!selectedAbsentStudent} onOpenChange={(open) => {
            if (!open) setSelectedAbsentStudent(null);
          }}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-destructive" />
                  <span>Absence Records</span>
                </DialogTitle>
              </DialogHeader>
              
              {selectedAbsentStudent && (() => {
                const student = selectedAbsentStudent;
                const records = getStudentAttendance(student.id);
                const absentRecords = records.filter(r => r.status === 'absent');
                
                // Sort absent dates descending (most recent first)
                const sortedAbsences = [...absentRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                
                const total = records.length;
                const present = records.filter(r => r.status === 'present').length;
                const absent = absentRecords.length;
                const pct = total > 0 ? Math.round((present / total) * 100) : 0;
                
                return (
                  <div className="space-y-4 pt-2">
                    <div className="bg-accent/40 p-4 rounded-2xl border">
                      <h4 className="font-bold text-lg mb-1">{student.name}</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Batch: {batches.find(b => b.id === student.batchId)?.name || 'N/A'}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-background p-2 rounded-xl border">
                          <p className="text-muted-foreground font-medium mb-0.5">Present</p>
                          <p className="text-base font-black text-green-600">{present}</p>
                        </div>
                        <div className="bg-background p-2 rounded-xl border">
                          <p className="text-muted-foreground font-medium mb-0.5">Absent</p>
                          <p className="text-base font-black text-destructive">{absent}</p>
                        </div>
                        <div className="bg-background p-2 rounded-xl border col-span-1">
                          <p className="text-muted-foreground font-medium mb-0.5">Ratio</p>
                          <p className={`text-base font-black ${pct >= 75 ? 'text-green-600' : 'text-destructive'}`}>
                            {pct}%
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-bold mb-2 flex items-center justify-between">
                        <span>Absent Dates ({absent})</span>
                      </h5>
                      
                      {sortedAbsences.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground bg-accent/20 rounded-xl border border-dashed">
                          <span className="text-2xl mb-1 block">🌟</span>
                          No recorded absences for this student!
                        </div>
                      ) : (
                        <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1">
                          {sortedAbsences.map((record) => {
                            const dateObj = new Date(record.date);
                            const formattedDate = isNaN(dateObj.getTime()) 
                              ? record.date 
                              : dateObj.toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                });
                            
                            return (
                              <div key={record.id} className="flex justify-between items-center p-3 rounded-xl border bg-background hover:bg-accent/20 transition-colors">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-destructive" />
                                  <span className="font-semibold text-sm">{formattedDate}</span>
                                </div>
                                {record.markedBy && (
                                  <span className="text-[10px] text-muted-foreground bg-accent px-2 py-0.5 rounded-full font-medium">
                                    By {record.markedBy.split(' at ')[0]}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        </div>
      )}

            
            {activeTab === 'birthdays' && (
              <div className="space-y-6">
                <Card className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b pb-6">
                    <div>
                      <h3 className="text-2xl font-black text-primary flex items-center gap-2">
                        <Cake className="h-6 w-6" /> Student Birthdays
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">Celebrate and wish your students on their special day</p>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="font-bold">Edit Wish Template</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Birthday Wish Template</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <p className="text-xs text-muted-foreground">Use <code className="bg-muted px-1 rounded">{'{name}'}</code> as a placeholder.</p>
                          <textarea 
                            className="w-full min-h-[100px] p-3 rounded-md border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                            value={birthdayMessage}
                            onChange={(e) => setBirthdayMessage(e.target.value)}
                            placeholder="Type your birthday wish here..."
                          />
                          <div className="bg-accent p-3 rounded-md text-xs">
                            <strong>Preview:</strong><br />
                            {birthdayMessage.replace('{name}', 'John Doe')}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(() => {
                      const today = new Date();
                      const tMonth = today.getMonth();
                      const tDay = today.getDate();

                      const sortedStudents = [...students].filter(s => s.dob).sort((a, b) => {
                        const dateA = new Date(a.dob!);
                        const dateB = new Date(b.dob!);
                        // Compare by month then day
                        if (dateA.getMonth() !== dateB.getMonth()) return dateA.getMonth() - dateB.getMonth();
                        return dateA.getDate() - dateB.getDate();
                      });

                      // Find today's birthdays and upcoming ones
                      const todaysBirthdays = sortedStudents.filter(s => {
                        const d = new Date(s.dob!);
                        return d.getMonth() === tMonth && d.getDate() === tDay;
                      });

                      const upcomingBirthdays = sortedStudents.filter(s => {
                        const d = new Date(s.dob!);
                        if (d.getMonth() > tMonth) return true;
                        if (d.getMonth() === tMonth && d.getDate() > tDay) return true;
                        return false;
                      }).slice(0, 10);

                      if (todaysBirthdays.length === 0 && upcomingBirthdays.length === 0) {
                        return <div className="col-span-full py-12 text-center text-muted-foreground italic">No birthdays found. Add Date of Birth to student profiles.</div>;
                      }

                      return (
                        <>
                          {todaysBirthdays.map(student => (
                            <div key={student.id} className="relative group p-6 rounded-[32px] border-4 border-primary bg-primary shadow-xl animate-bounce-subtle overflow-hidden">
                              <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary rounded-full blur-2xl group-hover:bg-primary transition-all" />
                              <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="h-12 w-12 rounded-full bg-primary text-white flex items-center justify-center font-black text-xl">
                                    {student.name.charAt(0)}
                                  </div>
                                  <div>
                                    <h4 className="font-black text-xl leading-none">{student.name}</h4>
                                    <span className="text-[10px] font-black text-primary uppercase tracking-tighter">It's Birthday Today! 🎉</span>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground mb-6 font-medium">
                                  Batch: {batches.find(b => b.id === student.batchId)?.name || 'N/A'}<br/>
                                  Born: {new Date(student.dob!).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
                                </p>
                                <Button 
                                  onClick={() => {
                                    const cleanedPhone = (student.phoneNo || student.parentWhatsApp || '').split('+').join('').split(' ').join('');
                                    const msg = birthdayMessage.replace('{name}', student.name);
                                    const waUrl = "https://wa.me/" + cleanedPhone + "?text=" + encodeURIComponent(msg);
                                    window.open(waUrl, '_blank');
                                  }}
                                  className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-black h-12 rounded-2xl gap-2 shadow-lg shadow-green-200"
                                >
                                  Wish on WhatsApp
                                </Button>
                              </div>
                            </div>
                          ))}
                          {upcomingBirthdays.map(student => (
                            <div key={student.id} className="p-6 rounded-[32px] border-2 border-accent bg-card hover:border-primary transition-all group">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-accent text-accent flex items-center justify-center font-bold">
                                    {student.name.charAt(0)}
                                  </div>
                                  <div>
                                    <h4 className="font-bold">{student.name}</h4>
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                                      {new Date(student.dob!).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
                                    </p>
                                  </div>
                                </div>
                                <Cake className="h-5 w-5 text-accent/40 group-hover:text-primary transition-colors" />
                              </div>
                              <p className="text-xs text-muted-foreground mb-4">
                                {batches.find(b => b.id === student.batchId)?.name}
                              </p>
                              <Button 
                                variant="outline"
                                onClick={() => {
                                  const cleanedPhone = (student.phoneNo || student.parentWhatsApp || '').split('+').join('').split(' ').join('');
                                  const msg = birthdayMessage.replace('{name}', student.name);
                                  const waUrl = "https://wa.me/" + cleanedPhone + "?text=" + encodeURIComponent(msg);
                                  window.open(waUrl, '_blank');
                                }}
                                className="w-full text-xs font-bold border-2 hover:bg-primary h-10 rounded-xl"
                              >
                                Pre-send Wish
                              </Button>
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'notes' && (
              <div>
                <Card className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <div>
                      <h3 className="text-xl font-semibold">Notes Management</h3>
                      <p className="text-sm text-muted-foreground mr-4">Assign and manage study notes for your batches</p>
                    </div>
                    <Dialog open={openDialog === 'add_note'} onOpenChange={(open) => {
                      setOpenDialog(open ? 'add_note' : null);
                      if (!open) {
                        setEditingNote(null);
                        setNoteTitle('');
                        setNoteDescription('');
                        setNoteLink('');
                        setNoteBatchId('');
                        setNoteSubject('');
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button className="rounded-xl font-bold bg-primary hover:bg-primary/90 flex items-center gap-1.5 self-start">
                          <Plus className="h-4 w-4" /> Add Note
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>{editingNote ? 'Edit Note' : 'Add New Note'}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSaveNote} className="space-y-4">
                          <div>
                            <Label htmlFor="noteBatch">Batch</Label>
                            <Select value={noteBatchId} onValueChange={setNoteBatchId}>
                              <SelectTrigger id="noteBatch" className="w-full">
                                <SelectValue placeholder="Select Batch" />
                              </SelectTrigger>
                              <SelectContent>
                                {batches.map(b => (
                                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="noteSubject">Subject</Label>
                            <Select value={noteSubject} onValueChange={setNoteSubject}>
                              <SelectTrigger id="noteSubject" className="w-full">
                                <SelectValue placeholder="Select Subject" />
                              </SelectTrigger>
                              <SelectContent>
                                {subjects.map(s => (
                                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                ))}
                                <SelectItem value="General">General</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="noteTitle">Note Title</Label>
                            <Input 
                              id="noteTitle" 
                              value={noteTitle} 
                              onChange={(e) => setNoteTitle(e.target.value)} 
                              placeholder="e.g. Chapter 1: Introduction to Mechanics"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="noteDescription">Description</Label>
                            <textarea 
                              id="noteDescription"
                              rows={3}
                              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              value={noteDescription} 
                              onChange={(e) => setNoteDescription(e.target.value)} 
                              placeholder="Describe the content of the notes..."
                            />
                          </div>
                          <div>
                            <Label htmlFor="noteLink">Notes URL / Link</Label>
                            <Input 
                              id="noteLink" 
                              value={noteLink} 
                              onChange={(e) => setNoteLink(e.target.value)} 
                              placeholder="e.g. Google Drive link or PDF URL"
                            />
                          </div>
                          <Button type="submit" className="w-full font-bold rounded-xl mt-4">
                            {editingNote ? 'Save Changes' : 'Create Note'}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {notes.map(note => {
                      const batch = batches.find(b => b.id === note.batchId);
                      return (
                        <div key={note.id} className="p-6 rounded-[32px] border-2 border-accent bg-card hover:border-primary transition-all flex flex-col justify-between group">
                          <div>
                            <div className="flex items-center justify-between mb-3 gap-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                                {note.subject}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                {batch?.name || 'Unknown Batch'}
                              </span>
                            </div>
                            <h4 className="font-bold text-lg mb-2 text-card-foreground group-hover:text-primary transition-colors truncate" title={note.title}>{note.title}</h4>
                            <p className="text-xs text-muted-foreground line-clamp-3 mb-4">{note.content || 'No description provided.'}</p>
                          </div>
                          
                          <div className="space-y-2 mt-4 pt-4 border-t border-accent">
                            {note.fileUrl && (
                              <Button
                                variant="outline"
                                className="w-full text-xs font-bold border-2 h-10 rounded-xl flex items-center justify-center gap-1.5"
                                onClick={() => {
                                  if (note.fileUrl) {
                                    window.open(note.fileUrl.startsWith('http') ? note.fileUrl : `https://${note.fileUrl}`, '_blank');
                                  }
                                }}
                              >
                                <Eye className="h-4 w-4" /> Open Note
                              </Button>
                            )}
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                className="flex-1 text-xs font-bold h-9 rounded-xl flex items-center justify-center gap-1 text-primary hover:bg-primary/10"
                                onClick={() => {
                                  setEditingNote(note);
                                  setNoteTitle(note.title);
                                  setNoteDescription(note.content || '');
                                  setNoteLink(note.fileUrl || '');
                                  setNoteBatchId(note.batchId);
                                  setNoteSubject(note.subject);
                                  setOpenDialog('add_note');
                                }}
                              >
                                <Edit className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <DeleteDialog
                                title="Delete Note"
                                description={`Are you sure you want to delete the note "${note.title}"?`}
                                onDelete={() => handleDeleteNote(note.id)}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {notes.length === 0 && (
                      <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-accent/30">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="font-medium text-sm">No notes assigned yet. Click "Add Note" to create one.</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </DashboardLayout>
      </div>

      
      {receiptData && !printingReport && (
        <div className="hidden print:block absolute top-0 left-0 w-full bg-white text-black min-h-screen" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
          <div className="max-w-[210mm] mx-auto px-10 py-8">
            
            {/* Invoice Header */}
            <div className="border-b-2 border-gray-800 pb-5 mb-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold uppercase tracking-widest text-gray-900">{instituteSettings.name || 'RC Tutorials ERP'}</h1>
                {instituteSettings.address && (
                  <p className="text-sm text-gray-600 mt-1">{instituteSettings.address}</p>
                )}
                <div className="flex items-center justify-center gap-6 mt-1 text-xs text-gray-500">
                  {instituteSettings.phone && <span>Phone: {instituteSettings.phone}</span>}
                  {instituteSettings.email && <span>Email: {instituteSettings.email}</span>}
                </div>
              </div>
              <div className="mt-4 text-center">
                <span className="inline-block bg-gray-900 text-white text-xs font-bold uppercase tracking-widest px-4 py-1 rounded-sm">
                  Fee Receipt
                </span>
              </div>
            </div>

            {/* Receipt Meta & Student Details */}
            <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Student Details</h3>
                <table className="text-sm">
                  <tbody>
                    <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Name:</td><td className="font-semibold">{receiptData.student.name}</td></tr>
                    <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Phone:</td><td>{receiptData.student.phoneNo || 'N/A'}</td></tr>
                    <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">College:</td><td>{receiptData.student.collegeName || 'N/A'}</td></tr>
                    <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Class:</td><td>{receiptData.student.studentClass || 'N/A'}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="text-right">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Receipt Info</h3>
                <table className="text-sm ml-auto">
                  <tbody>
                    <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Receipt No:</td><td className="font-mono font-semibold">RCPT-{receiptData.payment.id.slice(-6).toUpperCase()}</td></tr>
                    <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Date:</td><td>{new Date(receiptData.payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>
                    <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Time:</td><td>{new Date(receiptData.payment.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="mb-6">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2.5 text-left font-semibold text-gray-700">#</th>
                    <th className="border border-gray-300 px-4 py-2.5 text-left font-semibold text-gray-700">Description</th>
                    <th className="border border-gray-300 px-4 py-2.5 text-right font-semibold text-gray-700">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-3 text-gray-600">1</td>
                    <td className="border border-gray-300 px-4 py-3">
                      <p className="font-medium">Fee Payment — Installment #{receiptData.record.payments?.findIndex(p => p.id === receiptData.payment.id)! + 1}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Course Fee Installment</p>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-right text-lg font-bold">₹{receiptData.payment.amount.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={2} className="border border-gray-300 px-4 py-2.5 text-right font-bold text-gray-700 uppercase text-xs tracking-wider">Total Paid (This Receipt)</td>
                    <td className="border border-gray-300 px-4 py-2.5 text-right font-bold text-lg text-gray-900">₹{receiptData.payment.amount.toLocaleString('en-IN')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Fee Summary Box */}
            <div className="flex justify-end mb-10">
              <div className="w-72 border border-gray-300 rounded text-sm">
                <div className="flex justify-between px-4 py-2 border-b border-gray-200">
                  <span className="text-gray-500">Total Course Fees</span>
                  <span className="font-semibold">₹{receiptData.record.totalFees.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between px-4 py-2 border-b border-gray-200">
                  <span className="text-gray-500">Total Paid (All)</span>
                  <span className="font-semibold text-green-700">₹{receiptData.record.payments.reduce((a, b) => a + b.amount, 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5 bg-gray-50">
                  <span className="font-bold text-gray-800">Outstanding Balance</span>
                  <span className="font-bold text-red-600">₹{(receiptData.record.totalFees - receiptData.record.payments.reduce((a, b) => a + b.amount, 0)).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="mb-12 text-xs text-gray-400 border-t border-gray-200 pt-4">
              <p className="font-semibold text-gray-500 mb-1">Terms & Conditions:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Fees once paid are non-refundable.</li>
                <li>This is a computer-generated receipt and does not require a physical signature.</li>
                <li>Please retain this receipt for your records.</li>
              </ol>
            </div>

            {/* Signatures */}
            <div className="flex justify-between items-end">
              <div className="text-center">
                <div className="w-40 border-b-2 border-gray-400 mb-1"></div>
                <p className="text-xs text-gray-500">Student / Guardian Signature</p>
              </div>
              <div className="text-center">
                <div className="w-40 border-b-2 border-gray-400 mb-1"></div>
                <p className="text-xs text-gray-500">Authorized Signatory</p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-[10px] text-gray-300 border-t pt-3">
              Generated by {instituteSettings.name || 'RC Tutorials ERP'} Management System • {new Date().toLocaleDateString()}
            </div>

          </div>
        </div>
      )}

      {/* Printable Student Report */}
      {printingReport && selectedStudentForReport && (() => {
        const student = selectedStudentForReport;
        const batch = batches.find(b => b.id === student.batchId);
        const studentResults = getTestResultsByStudent(student.id);
        const studentTests = studentResults.map(r => {
          const test = tests.find(t => t.id === r.testId);
          return test ? { ...r, test } : null;
        }).filter(Boolean) as (TestResult & { test: Test })[];

        const filteredTests = reportSubjectFilter === 'all' 
          ? studentTests 
          : studentTests.filter(t => (t.test.subject || 'General') === reportSubjectFilter);
        const sortedTests = [...filteredTests].sort((a, b) => new Date(a.test.date).getTime() - new Date(b.test.date).getTime());

        const presentTests = sortedTests.filter(t => !t.isAbsent);
        const totalTests = presentTests.length;
        const avgPercent = totalTests > 0 ? Math.round(presentTests.reduce((sum, t) => sum + (t.marksObtained / t.test.totalMarks) * 100, 0) / totalTests) : 0;
        const highest = totalTests > 0 ? Math.max(...presentTests.map(t => Math.round((t.marksObtained / t.test.totalMarks) * 100))) : 0;
        const lowest = totalTests > 0 ? Math.min(...presentTests.map(t => Math.round((t.marksObtained / t.test.totalMarks) * 100))) : 0;

        // Month-on-month data for print
        const monthlyData: Record<string, { total: number; count: number }> = {};
        sortedTests.forEach(t => {
          if (t.isAbsent) return;
          const d = new Date(t.test.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyData[key]) monthlyData[key] = { total: 0, count: 0 };
          monthlyData[key].total += (t.marksObtained / t.test.totalMarks) * 100;
          monthlyData[key].count += 1;
        });
        const monthKeys = Object.keys(monthlyData).sort();
        const monthlyAvgs = monthKeys.map(k => ({
          label: new Date(k + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          avg: Math.round(monthlyData[k].total / monthlyData[k].count),
          count: monthlyData[k].count,
          rawKey: k,
        }));
        const maxBarValue = monthlyAvgs.length > 0 ? Math.max(...monthlyAvgs.map(m => m.avg), 100) : 100;

        // Subject-wise averages for print
        const subjectAvgs: Record<string, { total: number; count: number }> = {};
        studentTests.forEach(t => {
          if (t.isAbsent) return;
          const subj = t.test.subject || 'General';
          if (!subjectAvgs[subj]) subjectAvgs[subj] = { total: 0, count: 0 };
          subjectAvgs[subj].total += (t.marksObtained / t.test.totalMarks) * 100;
          subjectAvgs[subj].count += 1;
        });

        // Compute Month 1 and Month 2 details for printing dynamically based on mode
        let monthlyReportTests1: StudentTestResult[] = [];
        let monthlyReportTests2: StudentTestResult[] = [];
        let month1Avg = 0;
        let month2Avg = 0;
        let month1Count = 0;
        let month2Count = 0;
        let label1 = '';
        let label2 = '';
        let monthDiff: number | null = null;

        if (reportMonthlyMode === 'single') {
          monthlyReportTests1 = reportMonthlyMonth1
            ? sortedTests.filter(t => {
                const d = new Date(t.test.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return key === reportMonthlyMonth1;
              })
            : [];
          const m1Data = reportMonthlyMonth1 ? monthlyAvgs.find(m => m.rawKey === reportMonthlyMonth1) : null;
          month1Avg = m1Data?.avg ?? 0;
          month1Count = m1Data?.count ?? 0;
          label1 = m1Data?.label || '';

          const prevMonthKey = reportMonthlyMonth1 ? getPreviousMonthKey(reportMonthlyMonth1) : '';
          const prevMonthData = prevMonthKey ? monthlyAvgs.find(m => m.rawKey === prevMonthKey) : null;
          
          monthlyReportTests2 = prevMonthKey
            ? sortedTests.filter(t => {
                const d = new Date(t.test.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return key === prevMonthKey;
              })
            : [];
          month2Avg = prevMonthData?.avg ?? 0;
          month2Count = prevMonthData?.count ?? 0;
          label2 = prevMonthData?.label || 'Previous Month';

          monthDiff = m1Data && prevMonthData ? m1Data.avg - prevMonthData.avg : null;
        } else if (reportMonthlyMode === 'compare_1v1') {
          monthlyReportTests1 = reportMonthlyMonth1
            ? sortedTests.filter(t => {
                const d = new Date(t.test.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return key === reportMonthlyMonth1;
              })
            : [];
          monthlyReportTests2 = reportMonthlyMonth2
            ? sortedTests.filter(t => {
                const d = new Date(t.test.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return key === reportMonthlyMonth2;
              })
            : [];
          const m1Data = reportMonthlyMonth1 ? monthlyAvgs.find(m => m.rawKey === reportMonthlyMonth1) : null;
          const m2Data = reportMonthlyMonth2 ? monthlyAvgs.find(m => m.rawKey === reportMonthlyMonth2) : null;
          month1Avg = m1Data?.avg ?? 0;
          month1Count = m1Data?.count ?? 0;
          label1 = m1Data?.label || '';
          
          month2Avg = m2Data?.avg ?? 0;
          month2Count = m2Data?.count ?? 0;
          label2 = m2Data?.label || '';

          monthDiff = m1Data && m2Data ? m2Data.avg - m1Data.avg : null;
        } else if (reportMonthlyMode === 'compare_2v2') {
          const nextMonthKey1 = reportMonthlyMonth1 ? getNextMonthKey(reportMonthlyMonth1) : '';
          const nextMonthKey2 = reportMonthlyMonth2 ? getNextMonthKey(reportMonthlyMonth2) : '';

          monthlyReportTests1 = reportMonthlyMonth1
            ? sortedTests.filter(t => {
                const d = new Date(t.test.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return key === reportMonthlyMonth1 || key === nextMonthKey1;
              })
            : [];
          monthlyReportTests2 = reportMonthlyMonth2
            ? sortedTests.filter(t => {
                const d = new Date(t.test.date);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return key === reportMonthlyMonth2 || key === nextMonthKey2;
              })
            : [];

          const m1AData = reportMonthlyMonth1 ? monthlyAvgs.find(m => m.rawKey === reportMonthlyMonth1) : null;
          const m1BData = nextMonthKey1 ? monthlyAvgs.find(m => m.rawKey === nextMonthKey1) : null;
          const m2AData = reportMonthlyMonth2 ? monthlyAvgs.find(m => m.rawKey === reportMonthlyMonth2) : null;
          const m2BData = nextMonthKey2 ? monthlyAvgs.find(m => m.rawKey === nextMonthKey2) : null;

          // Combined average calculation for Period 1
          const presentM1 = monthlyReportTests1.filter(t => !t.isAbsent);
          const totalM1Marks = presentM1.reduce((sum, t) => sum + (t.marksObtained / t.test.totalMarks) * 100, 0);
          month1Avg = presentM1.length > 0 ? Math.round(totalM1Marks / presentM1.length) : 0;
          month1Count = presentM1.length;
          
          const label1A = m1AData?.label || '';
          const label1B = m1BData?.label || (nextMonthKey1 ? new Date(nextMonthKey1 + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '');
          label1 = label1A && label1B ? `${label1A} & ${label1B}` : label1A || 'Period 1';

          // Combined average calculation for Period 2
          const presentM2 = monthlyReportTests2.filter(t => !t.isAbsent);
          const totalM2Marks = presentM2.reduce((sum, t) => sum + (t.marksObtained / t.test.totalMarks) * 100, 0);
          month2Avg = presentM2.length > 0 ? Math.round(totalM2Marks / presentM2.length) : 0;
          month2Count = presentM2.length;
          
          const label2A = m2AData?.label || '';
          const label2B = m2BData?.label || (nextMonthKey2 ? new Date(nextMonthKey2 + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '');
          label2 = label2A && label2B ? `${label2A} & ${label2B}` : label2A || 'Period 2';

          monthDiff = monthlyReportTests1.length > 0 && monthlyReportTests2.length > 0 ? month2Avg - month1Avg : null;
        }

        if (reportPrintMode === 'monthly') {
          return (
            <div className="hidden print:block absolute top-0 left-0 w-full bg-white text-black min-h-screen" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
              <div className="max-w-[210mm] mx-auto px-10 py-8">
                {/* Header */}
                <div className="border-b-2 border-gray-800 pb-5 mb-6">
                  <div className="text-center">
                    <h1 className="text-2xl font-bold uppercase tracking-widest text-gray-900">{instituteSettings.name || 'RC Tutorials ERP'}</h1>
                    {instituteSettings.address && (
                      <p className="text-sm text-gray-600 mt-1">{instituteSettings.address}</p>
                    )}
                    <div className="flex items-center justify-center gap-6 mt-1 text-xs text-gray-500">
                      {instituteSettings.phone && <span>Phone: {instituteSettings.phone}</span>}
                      {instituteSettings.email && <span>Email: {instituteSettings.email}</span>}
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <span className="inline-block bg-gray-900 text-white text-xs font-bold uppercase tracking-widest px-4 py-1 rounded-sm">
                      {reportMonthlyMode === 'single' ? 'Monthly Report Card' : 'Monthly Comparison Report'}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Student Details</h3>
                    <table className="text-sm">
                      <tbody>
                        <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Name:</td><td className="font-semibold">{student.name}</td></tr>
                        <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Phone:</td><td>{student.phoneNo || 'N/A'}</td></tr>
                        <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Class:</td><td>{student.studentClass || 'N/A'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="text-right">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Report Info</h3>
                    <table className="text-sm ml-auto">
                      <tbody>
                        <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Batch:</td><td className="font-semibold">{batch?.name || 'N/A'}</td></tr>
                        <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Subject Filter:</td><td className="font-semibold uppercase">{reportSubjectFilter}</td></tr>
                        <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Date:</td><td>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Comparison Card */}
                <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-6 mb-6">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-4 text-center">
                    {reportMonthlyMode === 'single' ? 'Performance vs Previous Month' : 'Month-on-Month Performance Comparison'}
                  </h4>
                  <div className="flex items-center justify-around">
                    <div className="text-center">
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-1">
                        {reportMonthlyMode === 'single' ? label2 : label1}
                      </p>
                      <p className="text-3xl font-black text-indigo-700">
                        {reportMonthlyMode === 'single' ? (month2Avg ? `${month2Avg}%` : '—') : (month1Avg ? `${month1Avg}%` : '—')}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {reportMonthlyMode === 'single' ? month2Count : month1Count} test{(reportMonthlyMode === 'single' ? month2Count : month1Count) !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-center justify-center px-8">
                      <div className="h-0.5 w-16 bg-indigo-200 relative mb-4">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-200">
                          VS
                        </div>
                      </div>
                      {monthDiff !== null && (
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${monthDiff > 0 ? 'bg-emerald-100 text-emerald-700' : monthDiff < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                          {monthDiff > 0 ? '+' : ''}{monthDiff}% {monthDiff > 0 ? 'Improved' : monthDiff < 0 ? 'Declined' : 'Same'}
                        </span>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-1">
                        {reportMonthlyMode === 'single' ? label1 : label2}
                      </p>
                      <p className="text-3xl font-black text-indigo-700">
                        {reportMonthlyMode === 'single' ? (month1Avg ? `${month1Avg}%` : '—') : (month2Avg ? `${month2Avg}%` : '—')}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {reportMonthlyMode === 'single' ? month1Count : month2Count} test{(reportMonthlyMode === 'single' ? month1Count : month2Count) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Academic Results Grid (Side-by-side or consecutive tables) */}
                <div className={reportMonthlyMode === 'single' ? 'grid grid-cols-1 mb-10' : 'grid grid-cols-2 gap-6 mb-10'}>
                  {/* Month 1 Tests Table */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{label1 || 'Month 1'} Academic Results</h3>
                    {monthlyReportTests1.length > 0 ? (
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 font-bold uppercase">Date</th>
                            <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 font-bold uppercase">Test</th>
                            <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 font-bold uppercase">Marks</th>
                            <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 font-bold uppercase">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyReportTests1.map(t => {
                            const pct = Math.round((t.marksObtained / t.test.totalMarks) * 100);
                            return (
                              <tr key={t.id}>
                                <td className="border border-gray-300 px-3 py-2 text-gray-600">{new Date(t.test.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                                <td className="border border-gray-300 px-3 py-2 font-medium truncate max-w-[120px]" title={t.test.name}>{t.test.name}</td>
                                <td className="border border-gray-300 px-3 py-2 text-center font-bold">{t.isAbsent ? <span className="text-red-600 font-bold">AB</span> : `${t.marksObtained}/${t.test.totalMarks}`}</td>
                                <td className="border border-gray-300 px-3 py-2 text-center font-bold">{t.isAbsent ? <span className="text-red-600 font-bold">AB</span> : `${pct}%`}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-xs text-gray-500 text-center py-4 border border-gray-300 rounded bg-gray-50/50">No test results available.</p>
                    )}
                  </div>

                  {/* Month 2 Tests Table (Conditional) */}
                  {reportMonthlyMode !== 'single' && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{label2 || 'Month 2'} Academic Results</h3>
                      {monthlyReportTests2.length > 0 ? (
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 font-bold uppercase">Date</th>
                              <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 font-bold uppercase">Test</th>
                              <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 font-bold uppercase">Marks</th>
                              <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 font-bold uppercase">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyReportTests2.map(t => {
                              const pct = Math.round((t.marksObtained / t.test.totalMarks) * 100);
                              return (
                                <tr key={t.id}>
                                  <td className="border border-gray-300 px-3 py-2 text-gray-600">{new Date(t.test.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                                  <td className="border border-gray-300 px-3 py-2 font-medium truncate max-w-[120px]" title={t.test.name}>{t.test.name}</td>
                                  <td className="border border-gray-300 px-3 py-2 text-center font-bold">{t.isAbsent ? <span className="text-red-600 font-bold">AB</span> : `${t.marksObtained}/${t.test.totalMarks}`}</td>
                                  <td className="border border-gray-300 px-3 py-2 text-center font-bold">{t.isAbsent ? <span className="text-red-600 font-bold">AB</span> : `${pct}%`}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-xs text-gray-500 text-center py-4 border border-gray-300 rounded bg-gray-50/50">No test results available.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Signatures */}
                <div className="flex justify-between items-end mt-16">
                  <div className="text-center">
                    <div className="w-40 border-b-2 border-gray-400 mb-1"></div>
                    <p className="text-xs text-gray-500">Parent / Guardian Signature</p>
                  </div>
                  <div className="text-center">
                    <div className="w-40 border-b-2 border-gray-400 mb-1"></div>
                    <p className="text-xs text-gray-500">Authorized Signatory</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-[10px] text-gray-300 border-t pt-3">
                  Generated by {instituteSettings.name || 'RC Tutorials ERP'} Management System • {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="hidden print:block absolute top-0 left-0 w-full bg-white text-black min-h-screen" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
            <div className="max-w-[210mm] mx-auto px-10 py-8">

              {/* Invoice Header Style for Report */}
              <div className="border-b-2 border-gray-800 pb-5 mb-6">
                <div className="text-center">
                  <h1 className="text-2xl font-bold uppercase tracking-widest text-gray-900">{instituteSettings.name || 'RC Tutorials ERP'}</h1>
                  {instituteSettings.address && (
                    <p className="text-sm text-gray-600 mt-1">{instituteSettings.address}</p>
                  )}
                  <div className="flex items-center justify-center gap-6 mt-1 text-xs text-gray-500">
                    {instituteSettings.phone && <span>Phone: {instituteSettings.phone}</span>}
                    {instituteSettings.email && <span>Email: {instituteSettings.email}</span>}
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <span className="inline-block bg-gray-900 text-white text-xs font-bold uppercase tracking-widest px-4 py-1 rounded-sm">
                    Student Performance Report
                  </span>
                </div>
              </div>

              {/* Receipt Meta & Student Details Style */}
              <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Student Details</h3>
                  <table className="text-sm">
                    <tbody>
                      <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Name:</td><td className="font-semibold">{student.name}</td></tr>
                      <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Phone:</td><td>{student.phoneNo || 'N/A'}</td></tr>
                      <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">College:</td><td>{student.collegeName || 'N/A'}</td></tr>
                      <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Class:</td><td>{student.studentClass || 'N/A'}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="text-right">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Report Info</h3>
                  <table className="text-sm ml-auto">
                    <tbody>
                      <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Batch:</td><td className="font-semibold">{batch?.name || 'N/A'}</td></tr>
                      <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Subject Filter:</td><td className="font-semibold uppercase">{reportSubjectFilter}</td></tr>
                      <tr><td className="pr-3 py-0.5 text-gray-500 whitespace-nowrap">Date:</td><td>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detailed Results Table formatted like itemized table */}
              <div className="mb-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Academic Results</h3>
                {sortedTests.length > 0 ? (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2.5 text-left font-semibold text-gray-700">#</th>
                        <th className="border border-gray-300 px-4 py-2.5 text-left font-semibold text-gray-700">Date</th>
                        <th className="border border-gray-300 px-4 py-2.5 text-left font-semibold text-gray-700">Test Name</th>
                        <th className="border border-gray-300 px-4 py-2.5 text-left font-semibold text-gray-700">Subject</th>
                        <th className="border border-gray-300 px-4 py-2.5 text-center font-semibold text-gray-700">Marks</th>
                        <th className="border border-gray-300 px-4 py-2.5 text-center font-semibold text-gray-700">Total</th>
                        <th className="border border-gray-300 px-4 py-2.5 text-center font-semibold text-gray-700">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTests.map((t, idx) => {
                        const pct = Math.round((t.marksObtained / t.test.totalMarks) * 100);
                        return (
                          <tr key={t.id}>
                            <td className="border border-gray-300 px-4 py-3 text-gray-600">{idx + 1}</td>
                            <td className="border border-gray-300 px-4 py-3 text-gray-600">{new Date(t.test.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                            <td className="border border-gray-300 px-4 py-3 font-medium">{t.test.name}</td>
                            <td className="border border-gray-300 px-4 py-3 text-gray-600">{t.test.subject || 'General'}</td>
                            <td className="border border-gray-300 px-4 py-3 text-center font-bold">{t.isAbsent ? <span className="text-red-600 font-bold">AB</span> : t.marksObtained}</td>
                            <td className="border border-gray-300 px-4 py-3 text-center text-gray-600">{t.test.totalMarks}</td>
                            <td className="border border-gray-300 px-4 py-3 text-center font-bold">{t.isAbsent ? <span className="text-red-600 font-bold">AB</span> : `${pct}%`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4 border border-gray-300 rounded">No test results available.</p>
                )}
              </div>

              {/* Summary and Comparison Boxes */}
              <div className="grid grid-cols-2 gap-6 mb-10">
                {/* Performance Summary Box */}
                <div className="border border-gray-300 rounded text-sm h-fit">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 font-semibold text-xs uppercase tracking-wider text-gray-500">
                    Performance Summary
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-gray-200">
                    <span className="text-gray-500">Total Tests Taken</span>
                    <span className="font-semibold">{totalTests}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-gray-200">
                    <span className="text-gray-500">Overall Average Score</span>
                    <span className="font-semibold text-indigo-700">{avgPercent}%</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 border-b border-gray-200">
                    <span className="text-gray-500">Highest Percentage</span>
                    <span className="font-semibold text-green-700">{highest}%</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 bg-gray-50">
                    <span className="font-bold text-gray-800">Lowest Percentage</span>
                    <span className="font-bold text-amber-600">{lowest}%</span>
                  </div>
                </div>

                {/* Month-on-Month Comparison Box */}
                {reportCompareMonth1 && reportCompareMonth1 !== 'none' && reportCompareMonth2 && reportCompareMonth2 !== 'none' && (() => {
                  const m1Data = monthlyAvgs.find(m => m.rawKey === reportCompareMonth1);
                  const m2Data = monthlyAvgs.find(m => m.rawKey === reportCompareMonth2);
                  const diff = m1Data && m2Data ? m2Data.avg - m1Data.avg : null;
                  return (
                    <div className="border border-gray-300 rounded text-sm h-fit">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 font-semibold text-xs uppercase tracking-wider text-gray-500">
                        Month Comparison ({reportSubjectFilter === 'all' ? 'All Subjects' : reportSubjectFilter})
                      </div>
                      <div className="flex justify-between px-4 py-2 border-b border-gray-200">
                        <span className="text-gray-500">{m1Data?.label || 'Month 1'} Average</span>
                        <span className="font-semibold">{m1Data?.avg || 0}%</span>
                      </div>
                      <div className="flex justify-between px-4 py-2 border-b border-gray-200">
                        <span className="text-gray-500">{m2Data?.label || 'Month 2'} Average</span>
                        <span className="font-semibold">{m2Data?.avg || 0}%</span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5 bg-gray-50">
                        <span className="font-bold text-gray-800">Performance Delta</span>
                        <span className={`font-bold ${diff !== null && diff > 0 ? 'text-green-700' : diff !== null && diff < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {diff !== null ? (diff > 0 ? `+${diff}%` : `${diff}%`) : 'N/A'} {diff !== null && diff > 0 ? '(Improved)' : diff !== null && diff < 0 ? '(Declined)' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Signatures */}
              <div className="flex justify-between items-end mt-16">
                <div className="text-center">
                  <div className="w-40 border-b-2 border-gray-400 mb-1"></div>
                  <p className="text-xs text-gray-500">Parent / Guardian Signature</p>
                </div>
                <div className="text-center">
                  <div className="w-40 border-b-2 border-gray-400 mb-1"></div>
                  <p className="text-xs text-gray-500">Authorized Signatory</p>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 text-center text-[10px] text-gray-300 border-t pt-3">
                Generated by {instituteSettings.name || 'RC Tutorials ERP'} Management System • {new Date().toLocaleDateString()}
              </div>

            </div>
          </div>
        );
      })()}
    </>
  );
};

export default AdminDashboard;
