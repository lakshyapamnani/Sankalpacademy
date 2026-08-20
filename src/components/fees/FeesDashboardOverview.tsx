import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  IndianRupee,
  TrendingUp,
  CreditCard,
  Smartphone,
  Banknote,
  Building2,
  FileCheck,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Download,
  Filter,
  RotateCcw,
  Calendar,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { Student, Batch, Class, FeeRecord, FeePayment } from "@/lib/localStorage";
import { toast } from "sonner";

interface FeesDashboardOverviewProps {
  students: Student[];
  batches: Batch[];
  classes: Class[];
  feeRecords: FeeRecord[];
  selectedBatchId?: string | null;
  onSelectBatch?: (batchId: string | null) => void;
  onSelectStudent?: (student: Student) => void;
}

// Custom SVG Circular Progress Ring Component
const CircularProgress: React.FC<{
  percentage: number;
  size?: number;
  strokeWidth?: number;
  colorClass?: string;
  bgStrokeClass?: string;
  glowColor?: string;
  label?: string;
}> = ({
  percentage,
  size = 76,
  strokeWidth = 7,
  colorClass = "text-primary stroke-current",
  bgStrokeClass = "text-muted/40 stroke-current",
  glowColor,
  label,
}) => {
  const safePercentage = Math.min(100, Math.max(0, isNaN(percentage) ? 0 : percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          strokeWidth={strokeWidth}
          className={bgStrokeClass}
        />
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`transition-all duration-700 ease-out ${colorClass}`}
          style={glowColor ? { filter: `drop-shadow(0 0 6px ${glowColor})` } : undefined}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-xs font-black tracking-tight leading-none">
          {safePercentage.toFixed(safePercentage % 1 === 0 ? 0 : 1)}%
        </span>
        {label && <span className="text-[9px] text-muted-foreground font-medium mt-0.5">{label}</span>}
      </div>
    </div>
  );
};

export const FeesDashboardOverview: React.FC<FeesDashboardOverviewProps> = ({
  students,
  batches,
  classes,
  feeRecords,
  selectedBatchId,
  onSelectBatch,
}) => {
  // Local Filter States
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("all");
  const [selectedBatchOrClass, setSelectedBatchOrClass] = useState<string>(selectedBatchId || "all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>("all");

  // Keep internal batch selection synced when prop changes
  React.useEffect(() => {
    if (selectedBatchId) {
      setSelectedBatchOrClass(selectedBatchId);
    }
  }, [selectedBatchId]);

  // Extract distinct academic years from batches
  const academicYears = useMemo(() => {
    const years = new Set<string>();
    batches.forEach((b) => {
      if (b.year && b.year.trim()) years.add(b.year.trim());
    });
    return Array.from(years).sort().reverse();
  }, [batches]);

  // Extract distinct months from all payment records
  const availableMonths = useMemo(() => {
    const monthsMap = new Map<string, string>();
    feeRecords.forEach((record) => {
      (record.payments || []).forEach((p) => {
        if (p.date) {
          try {
            const d = new Date(p.date);
            if (!isNaN(d.getTime())) {
              const year = d.getFullYear();
              const monthNum = String(d.getMonth() + 1).padStart(2, "0");
              const key = `${year}-${monthNum}`;
              const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
              monthsMap.set(key, label);
            }
          } catch {
            // Ignore invalid date
          }
        }
      });
    });

    // Also include current month if not present
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (!monthsMap.has(currentKey)) {
      monthsMap.set(currentKey, now.toLocaleDateString("en-IN", { month: "short", year: "numeric" }));
    }

    return Array.from(monthsMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, label]) => ({ key, label }));
  }, [feeRecords]);

  // Extract unique classes from students & classes list
  const uniqueClassNames = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.studentClass && s.studentClass.trim()) set.add(s.studentClass.trim());
    });
    classes.forEach((c) => {
      if (c.name && c.name.trim()) set.add(c.name.trim());
    });
    return Array.from(set).sort();
  }, [students, classes]);

  // Map student ID to fee record for fast lookup
  const feeRecordMap = useMemo(() => {
    const map = new Map<string, FeeRecord>();
    feeRecords.forEach((r) => {
      if (r && r.studentId) map.set(r.studentId, r);
    });
    return map;
  }, [feeRecords]);

  // Helper to determine a student's payment status
  const getStudentStatus = (student: Student, record?: FeeRecord) => {
    if (!record || !record.totalFees || record.totalFees <= 0) {
      return "unpaid"; // No fee structure configured or 0 total
    }
    const totalPaid = (record.payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const balance = Math.max(0, record.totalFees - totalPaid);

    if (balance <= 0 && record.totalFees > 0) {
      return "fully_paid";
    }

    // Check for overdue installments
    const todayStr = new Date().toISOString().split("T")[0];
    let isOverdue = false;

    if (record.firstEmiDate && record.firstEmiDate < todayStr && totalPaid <= 0) {
      isOverdue = true;
    }

    if (!isOverdue && record.emiMonths && record.emiMonths > 0) {
      const downPayment = record.downPayment || 0;
      const emiRemaining = Math.max(0, record.totalFees - downPayment);
      const months = Math.max(1, record.emiMonths);
      const baseEmi = Math.floor(emiRemaining / months);
      const startDateStr = record.firstEmiDate || (record.payments?.[0]?.date?.split("T")[0] || todayStr);
      const startDate = new Date(startDateStr + "T00:00:00");

      let cumulativeDue = downPayment;
      const today = new Date();

      for (let i = 0; i < months; i++) {
        const instDate = new Date(startDate);
        instDate.setMonth(instDate.getMonth() + i);
        if (instDate <= today) {
          cumulativeDue += baseEmi;
        }
      }

      if (totalPaid < cumulativeDue) {
        isOverdue = true;
      }
    }

    if (isOverdue) return "overdue";
    if (totalPaid > 0) return "partially_paid";
    return "unpaid";
  };

  // Filter students based on all 4 filter criteria
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const studentBatch = batches.find((b) => b.id === student.batchId);
      const record = feeRecordMap.get(student.id);

      // 1. Academic Year filter
      if (selectedAcademicYear !== "all") {
        if (!studentBatch || studentBatch.year !== selectedAcademicYear) {
          return false;
        }
      }

      // 2. Batch / Class filter
      if (selectedBatchOrClass !== "all") {
        if (selectedBatchOrClass === "unassigned") {
          if (student.batchId && batches.some((b) => b.id === student.batchId)) {
            return false;
          }
        } else if (selectedBatchOrClass.startsWith("class:")) {
          const targetClass = selectedBatchOrClass.replace("class:", "");
          if ((student.studentClass || "").trim() !== targetClass) {
            return false;
          }
        } else {
          // Specific batch ID
          if (student.batchId !== selectedBatchOrClass) {
            return false;
          }
        }
      }

      // 3. Payment Status filter
      if (selectedPaymentStatus !== "all") {
        const status = getStudentStatus(student, record);
        if (status !== selectedPaymentStatus) {
          return false;
        }
      }

      // 4. Month filter (when month is selected, only students who have payments in that month or overall match)
      if (selectedMonth !== "all") {
        if (!record || !record.payments || record.payments.length === 0) {
          // If status is unpaid/overdue and we want to see unpaid students, keep them
          if (selectedPaymentStatus !== "unpaid" && selectedPaymentStatus !== "overdue") {
            const hasMonthPayment = (record?.payments || []).some((p) => {
              if (!p.date) return false;
              return p.date.startsWith(selectedMonth);
            });
            if (!hasMonthPayment) return false;
          }
        }
      }

      return true;
    });
  }, [
    students,
    batches,
    feeRecordMap,
    selectedAcademicYear,
    selectedBatchOrClass,
    selectedPaymentStatus,
    selectedMonth,
  ]);

  // Aggregate Metrics based on filtered students and month
  const metrics = useMemo(() => {
    let totalFees = 0;
    let totalReceived = 0;
    let totalDue = 0;

    let fullyPaidCount = 0;
    let partiallyPaidCount = 0;
    let unpaidCount = 0;
    let overdueCount = 0;

    // Payment mode aggregates
    const modeAggregates = {
      cash: { amount: 0, count: 0 },
      upi: { amount: 0, count: 0 },
      card: { amount: 0, count: 0 },
      bank_transfer: { amount: 0, count: 0 },
      cheque: { amount: 0, count: 0 },
      other: { amount: 0, count: 0 },
    };

    // Date range helpers for Today, This Week, This Month
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

    // Start of week (Monday)
    const dayOfWeek = now.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    // Start of month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Collection period aggregates
    const periodStats = {
      today: { collected: 0, count: 0, due: 0 },
      thisWeek: { collected: 0, count: 0, due: 0 },
      thisMonth: { collected: 0, count: 0, due: 0 },
    };

    const studentIds = new Set(filteredStudents.map((s) => s.id));

    filteredStudents.forEach((student) => {
      const record = feeRecordMap.get(student.id);
      const studentTotalFee = Number(record?.totalFees) || 0;
      totalFees += studentTotalFee;

      const payments = record?.payments || [];
      let studentPaid = 0;

      payments.forEach((p) => {
        const amt = Number(p.amount) || 0;
        if (amt <= 0) return;

        // If month filter is applied, only sum payments for that month
        const pDateStr = p.date ? p.date.split("T")[0] : "";
        const matchesMonth = selectedMonth === "all" || (p.date && p.date.startsWith(selectedMonth));

        if (matchesMonth) {
          studentPaid += amt;
          totalReceived += amt;

          // Normalize payment mode
          const rawMode = (p.paymentMode || "cash").toLowerCase().trim();
          let modeKey: keyof typeof modeAggregates = "other";
          if (rawMode.includes("cash")) modeKey = "cash";
          else if (rawMode.includes("upi") || rawMode.includes("gpay") || rawMode.includes("phonepe") || rawMode.includes("paytm")) modeKey = "upi";
          else if (rawMode.includes("card") || rawMode.includes("debit") || rawMode.includes("credit")) modeKey = "card";
          else if (rawMode.includes("bank") || rawMode.includes("transfer") || rawMode.includes("neft") || rawMode.includes("rtgs") || rawMode.includes("imps")) modeKey = "bank_transfer";
          else if (rawMode.includes("cheque") || rawMode.includes("check")) modeKey = "cheque";

          modeAggregates[modeKey].amount += amt;
          modeAggregates[modeKey].count += 1;
        }

        // Period collections (unfiltered by selectedMonth so Today/This Week/This Month always reflect real-time live data)
        if (p.date) {
          try {
            const pDate = new Date(p.date);
            if (!isNaN(pDate.getTime())) {
              // Today
              if (pDateStr === todayStr) {
                periodStats.today.collected += amt;
                periodStats.today.count += 1;
              }
              // This Week
              if (pDate >= monday && pDate <= now) {
                periodStats.thisWeek.collected += amt;
                periodStats.thisWeek.count += 1;
              }
              // This Month
              if (pDate >= startOfMonth && pDate <= now) {
                periodStats.thisMonth.collected += amt;
                periodStats.thisMonth.count += 1;
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
      });

      // Status classification
      const status = getStudentStatus(student, record);
      if (status === "fully_paid") fullyPaidCount++;
      else if (status === "partially_paid") partiallyPaidCount++;
      else if (status === "overdue") overdueCount++;
      else unpaidCount++;
    });

    totalDue = Math.max(0, totalFees - totalReceived);
    periodStats.today.due = totalDue;
    periodStats.thisWeek.due = totalDue;
    periodStats.thisMonth.due = totalDue;

    const totalStudentsCount = filteredStudents.length;
    const receivedPercent = totalFees > 0 ? (totalReceived / totalFees) * 100 : 0;
    const duePercent = totalFees > 0 ? (totalDue / totalFees) * 100 : 0;

    return {
      totalFees,
      totalReceived,
      totalDue,
      receivedPercent,
      duePercent,
      totalStudentsCount,
      fullyPaidCount,
      fullyPaidPercent: totalStudentsCount > 0 ? (fullyPaidCount / totalStudentsCount) * 100 : 0,
      partiallyPaidCount,
      partiallyPaidPercent: totalStudentsCount > 0 ? (partiallyPaidCount / totalStudentsCount) * 100 : 0,
      unpaidCount,
      unpaidPercent: totalStudentsCount > 0 ? (unpaidCount / totalStudentsCount) * 100 : 0,
      overdueCount,
      overduePercent: totalStudentsCount > 0 ? (overdueCount / totalStudentsCount) * 100 : 0,
      periodStats,
      modeAggregates,
    };
  }, [filteredStudents, feeRecordMap, selectedMonth]);

  // Export Filtered CSV Report
  const handleExportFilteredCSV = () => {
    try {
      if (filteredStudents.length === 0) {
        toast.error("No student records to export for current filters");
        return;
      }

      const headers = [
        "Student Name",
        "Student ID",
        "Class",
        "Batch",
        "Academic Year",
        "Total Fees (₹)",
        "Amount Paid (₹)",
        "Due Amount (₹)",
        "Latest Payment Date",
        "Latest Payment Mode",
        "Latest Receipt No",
        "Payment Status",
      ];

      const rows = filteredStudents.map((student) => {
        const record = feeRecordMap.get(student.id);
        const batch = batches.find((b) => b.id === student.batchId);
        const totalFees = record?.totalFees || 0;
        const payments = record?.payments || [];
        const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const dueAmount = Math.max(0, totalFees - totalPaid);

        const latestPayment = payments.length > 0 ? payments[payments.length - 1] : null;
        const latestDate = latestPayment?.date
          ? new Date(latestPayment.date).toLocaleDateString("en-IN")
          : "-";
        const latestMode = (latestPayment?.paymentMode || "-").toUpperCase();
        const latestReceipt = latestPayment?.receiptNo || (latestPayment ? `RCPT-${latestPayment.id.slice(-6).toUpperCase()}` : "-");
        const status = getStudentStatus(student, record).replace("_", " ").toUpperCase();

        return [
          `"${(student.name || "").replace(/"/g, '""')}"`,
          `"${student.id}"`,
          `"${(student.studentClass || "-").replace(/"/g, '""')}"`,
          `"${(batch?.name || "Unassigned").replace(/"/g, '""')}"`,
          `"${(batch?.year || "-").replace(/"/g, '""')}"`,
          totalFees,
          totalPaid,
          dueAmount,
          `"${latestDate}"`,
          `"${latestMode}"`,
          `"${latestReceipt}"`,
          `"${status}"`,
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `Fees_Overview_Report_${new Date().toLocaleDateString("en-IN").replace(/\//g, "-")}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Filtered Fees CSV report exported successfully!");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export report");
    }
  };

  const isAnyFilterActive =
    selectedAcademicYear !== "all" ||
    selectedBatchOrClass !== "all" ||
    selectedMonth !== "all" ||
    selectedPaymentStatus !== "all";

  const handleResetFilters = () => {
    setSelectedAcademicYear("all");
    setSelectedBatchOrClass("all");
    setSelectedMonth("all");
    setSelectedPaymentStatus("all");
    if (onSelectBatch) onSelectBatch(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Header & Live Filters Bar */}
      <div className="bg-card border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Fees Overview Dashboard
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Live financial calculations, payment breakdowns, and student fee status tracking.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isAnyFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 text-xs rounded-xl text-muted-foreground hover:text-foreground gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Filters
              </Button>
            )}
            <Button
              onClick={handleExportFilteredCSV}
              variant="outline"
              size="sm"
              className="h-9 text-xs rounded-xl border-primary/30 text-primary hover:bg-primary/10 gap-1.5 font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              Export Filtered CSV
            </Button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t">
          {/* Academic Year Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-primary/70" /> Academic Year
            </label>
            <select
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              className="h-9 w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="all">All Academic Years</option>
              {academicYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Batch / Class Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Layers className="h-3.5 w-3.5 text-primary/70" /> Batch / Class
            </label>
            <select
              value={selectedBatchOrClass}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedBatchOrClass(val);
                if (onSelectBatch) {
                  if (val === "all" || val.startsWith("class:")) {
                    onSelectBatch(null);
                  } else {
                    onSelectBatch(val);
                  }
                }
              }}
              className="h-9 w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="all">All Batches & Classes</option>
              <optgroup label="Batches">
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.year ? `(${b.year})` : ""}
                  </option>
                ))}
                <option value="unassigned">Unassigned Students</option>
              </optgroup>
              {uniqueClassNames.length > 0 && (
                <optgroup label="Classes">
                  {uniqueClassNames.map((cls) => (
                    <option key={`class:${cls}`} value={`class:${cls}`}>
                      Class: {cls}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Month Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-primary/70" /> Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="all">All Months</option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-primary/70" /> Payment Status
            </label>
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="h-9 w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="fully_paid">Fully Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Top Summary Cards (3 Prominent Cards with Circular Progress) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {/* Card 1: Total Fees */}
        <Card className="relative overflow-hidden p-5 rounded-2xl border bg-gradient-to-br from-card to-primary/5 hover:border-primary/40 transition-all duration-300 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Total Fees
                </p>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                ₹{metrics.totalFees.toLocaleString("en-IN")}
              </h3>
              <p className="text-xs text-muted-foreground">
                Assigned across{" "}
                <span className="font-semibold text-foreground">{metrics.totalStudentsCount}</span>{" "}
                students
              </p>
            </div>

            <CircularProgress
              percentage={100}
              size={76}
              strokeWidth={7}
              colorClass="text-primary stroke-current"
              glowColor="hsl(var(--primary) / 0.3)"
              label="Assigned"
            />
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>Overall Fee Target</span>
            <span className="font-bold text-primary flex items-center gap-0.5">
              100% Target <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </Card>

        {/* Card 2: Received */}
        <Card className="relative overflow-hidden p-5 rounded-2xl border bg-gradient-to-br from-card to-emerald-500/5 hover:border-emerald-500/40 transition-all duration-300 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Received
                </p>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                ₹{metrics.totalReceived.toLocaleString("en-IN")}
              </h3>
              <p className="text-xs text-muted-foreground">
                Collected fee revenue{" "}
                {selectedMonth !== "all" ? `in ${availableMonths.find((m) => m.key === selectedMonth)?.label || selectedMonth}` : ""}
              </p>
            </div>

            <CircularProgress
              percentage={metrics.receivedPercent}
              size={76}
              strokeWidth={7}
              colorClass="text-emerald-500 stroke-current"
              bgStrokeClass="text-emerald-500/20 stroke-current"
              glowColor="rgba(16, 185, 129, 0.35)"
              label="Collected"
            />
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>Collection Rate</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.receivedPercent.toFixed(1)}% of Total
            </span>
          </div>
        </Card>

        {/* Card 3: Due */}
        <Card className="relative overflow-hidden p-5 rounded-2xl border bg-gradient-to-br from-card to-rose-500/5 hover:border-rose-500/40 transition-all duration-300 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <p className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  Due Amount
                </p>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                ₹{metrics.totalDue.toLocaleString("en-IN")}
              </h3>
              <p className="text-xs text-muted-foreground">
                Total outstanding balance remaining
              </p>
            </div>

            <CircularProgress
              percentage={metrics.duePercent}
              size={76}
              strokeWidth={7}
              colorClass="text-rose-500 stroke-current"
              bgStrokeClass="text-rose-500/20 stroke-current"
              glowColor="rgba(244, 63, 94, 0.35)"
              label="Pending"
            />
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>Outstanding Balance</span>
            <span className="font-bold text-rose-600 dark:text-rose-400">
              {metrics.duePercent.toFixed(1)}% Remaining
            </span>
          </div>
        </Card>
      </div>

      {/* 3. Collection Summary & 4. Student Fee Status (2 Columns Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collection Summary Section (2 Columns on Large Screens) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Collection Summary
            </h3>
            <span className="text-xs text-muted-foreground font-medium">Real-time stats</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Today */}
            <Card className="p-4 rounded-2xl border bg-card/60 hover:shadow-md transition-shadow space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  Today
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {metrics.periodStats.today.count} txn{metrics.periodStats.today.count !== 1 ? "s" : ""}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Collection Received</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{metrics.periodStats.today.collected.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="pt-2 border-t text-xs flex justify-between items-center text-muted-foreground">
                <span>Pending / Due:</span>
                <span className="font-semibold text-rose-500">
                  ₹{metrics.periodStats.today.due.toLocaleString("en-IN")}
                </span>
              </div>
            </Card>

            {/* This Week */}
            <Card className="p-4 rounded-2xl border bg-card/60 hover:shadow-md transition-shadow space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  This Week
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {metrics.periodStats.thisWeek.count} txn{metrics.periodStats.thisWeek.count !== 1 ? "s" : ""}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Collection</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{metrics.periodStats.thisWeek.collected.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="pt-2 border-t text-xs flex justify-between items-center text-muted-foreground">
                <span>Total Due:</span>
                <span className="font-semibold text-rose-500">
                  ₹{metrics.periodStats.thisWeek.due.toLocaleString("en-IN")}
                </span>
              </div>
            </Card>

            {/* This Month */}
            <Card className="p-4 rounded-2xl border bg-card/60 hover:shadow-md transition-shadow space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  This Month
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {metrics.periodStats.thisMonth.count} txn{metrics.periodStats.thisMonth.count !== 1 ? "s" : ""}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Collection</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{metrics.periodStats.thisMonth.collected.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="pt-2 border-t text-xs flex justify-between items-center text-muted-foreground">
                <span>Total Due:</span>
                <span className="font-semibold text-rose-500">
                  ₹{metrics.periodStats.thisMonth.due.toLocaleString("en-IN")}
                </span>
              </div>
            </Card>
          </div>
        </div>

        {/* 4. Student Fee Status Overview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Student Fee Status
            </h3>
            <span className="text-xs text-muted-foreground">
              Total: {metrics.totalStudentsCount}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Fully Paid */}
            <div className="p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Fully Paid
                </span>
                <span className="text-xs font-bold text-emerald-600">
                  {metrics.fullyPaidPercent.toFixed(0)}%
                </span>
              </div>
              <p className="text-lg font-bold text-foreground">
                {metrics.fullyPaidCount}{" "}
                <span className="text-xs font-normal text-muted-foreground">students</span>
              </p>
            </div>

            {/* Partially Paid */}
            <div className="p-3 rounded-xl border bg-blue-500/5 border-blue-500/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Partial
                </span>
                <span className="text-xs font-bold text-blue-600">
                  {metrics.partiallyPaidPercent.toFixed(0)}%
                </span>
              </div>
              <p className="text-lg font-bold text-foreground">
                {metrics.partiallyPaidCount}{" "}
                <span className="text-xs font-normal text-muted-foreground">students</span>
              </p>
            </div>

            {/* Unpaid */}
            <div className="p-3 rounded-xl border bg-amber-500/5 border-amber-500/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Unpaid
                </span>
                <span className="text-xs font-bold text-amber-600">
                  {metrics.unpaidPercent.toFixed(0)}%
                </span>
              </div>
              <p className="text-lg font-bold text-foreground">
                {metrics.unpaidCount}{" "}
                <span className="text-xs font-normal text-muted-foreground">students</span>
              </p>
            </div>

            {/* Overdue */}
            <div className="p-3 rounded-xl border bg-rose-500/5 border-rose-500/20 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Overdue
                </span>
                <span className="text-xs font-bold text-rose-600">
                  {metrics.overduePercent.toFixed(0)}%
                </span>
              </div>
              <p className="text-lg font-bold text-foreground">
                {metrics.overdueCount}{" "}
                <span className="text-xs font-normal text-muted-foreground">students</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Payment Mode Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Payment Mode Breakdown
          </h3>
          <span className="text-xs text-muted-foreground">
            Total Collected: ₹{metrics.totalReceived.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Cash */}
          <Card className="p-3.5 rounded-xl border bg-card/60 hover:border-emerald-500/40 transition-colors space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Banknote className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {metrics.modeAggregates.cash.count} txn{metrics.modeAggregates.cash.count !== 1 ? "s" : ""}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Cash</p>
              <p className="text-base font-bold text-foreground">
                ₹{metrics.modeAggregates.cash.amount.toLocaleString("en-IN")}
              </p>
            </div>
            {/* Mini Progress Bar */}
            <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${
                    metrics.totalReceived > 0
                      ? (metrics.modeAggregates.cash.amount / metrics.totalReceived) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </Card>

          {/* UPI */}
          <Card className="p-3.5 rounded-xl border bg-card/60 hover:border-blue-500/40 transition-colors space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Smartphone className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {metrics.modeAggregates.upi.count} txn{metrics.modeAggregates.upi.count !== 1 ? "s" : ""}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">UPI</p>
              <p className="text-base font-bold text-foreground">
                ₹{metrics.modeAggregates.upi.amount.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${
                    metrics.totalReceived > 0
                      ? (metrics.modeAggregates.upi.amount / metrics.totalReceived) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </Card>

          {/* Card */}
          <Card className="p-3.5 rounded-xl border bg-card/60 hover:border-purple-500/40 transition-colors space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <CreditCard className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {metrics.modeAggregates.card.count} txn{metrics.modeAggregates.card.count !== 1 ? "s" : ""}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Card</p>
              <p className="text-base font-bold text-foreground">
                ₹{metrics.modeAggregates.card.amount.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-purple-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${
                    metrics.totalReceived > 0
                      ? (metrics.modeAggregates.card.amount / metrics.totalReceived) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </Card>

          {/* Bank Transfer */}
          <Card className="p-3.5 rounded-xl border bg-card/60 hover:border-indigo-500/40 transition-colors space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {metrics.modeAggregates.bank_transfer.count} txn{metrics.modeAggregates.bank_transfer.count !== 1 ? "s" : ""}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Bank Transfer</p>
              <p className="text-base font-bold text-foreground">
                ₹{metrics.modeAggregates.bank_transfer.amount.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${
                    metrics.totalReceived > 0
                      ? (metrics.modeAggregates.bank_transfer.amount / metrics.totalReceived) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </Card>

          {/* Cheque */}
          <Card className="p-3.5 rounded-xl border bg-card/60 hover:border-amber-500/40 transition-colors space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <FileCheck className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {metrics.modeAggregates.cheque.count} txn{metrics.modeAggregates.cheque.count !== 1 ? "s" : ""}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Cheque</p>
              <p className="text-base font-bold text-foreground">
                ₹{metrics.modeAggregates.cheque.amount.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${
                    metrics.totalReceived > 0
                      ? (metrics.modeAggregates.cheque.amount / metrics.totalReceived) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </Card>

          {/* Other */}
          <Card className="p-3.5 rounded-xl border bg-card/60 hover:border-slate-500/40 transition-colors space-y-2">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400">
                <MoreHorizontal className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {metrics.modeAggregates.other.count} txn{metrics.modeAggregates.other.count !== 1 ? "s" : ""}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Other</p>
              <p className="text-base font-bold text-foreground">
                ₹{metrics.modeAggregates.other.amount.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-slate-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${
                    metrics.totalReceived > 0
                      ? (metrics.modeAggregates.other.amount / metrics.totalReceived) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FeesDashboardOverview;
