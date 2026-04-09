import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, BookOpen, Calendar, BarChart3, Plus, UserPlus, IndianRupee, Printer, CheckSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import DashboardLayout, { SidebarItem } from "@/components/DashboardLayout";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import {
  getTeachers,
  getStudents,
  getClasses,
  getBatches,
  addTeacher,
  addStudent,
  addClass,
  addBatch,
  deleteTeacher,
  deleteStudent,
  deleteClass,
  getStudentAttendance,
  getFeeRecordByStudent,
  updateFeeRecord,
  addFeePayment,
  getTests,
  addTest,
  deleteTest,
  getTestResultsByTest,
  saveTestResult,
  Teacher,
  Student,
  Class,
  Batch,
  FeeRecord,
  FeePayment,
  Test,
  TestResult,
} from "@/lib/localStorage";

const formatFirebaseError = (message: string): string => {
  const normalized = message.replace(/_/g, " ");
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
  const [activeTab, setActiveTab] = useState<'batches' | 'students' | 'teachers' | 'classes' | 'fees' | 'tests'>('students');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [openDialog, setOpenDialog] = useState<string | null>(null);

  // Fees State
  const [selectedStudentForFees, setSelectedStudentForFees] = useState<Student | null>(null);
  const [feeRecord, setFeeRecord] = useState<FeeRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");

  // Tests State
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  // Print state
  const [receiptData, setReceiptData] = useState<{
    student: Student;
    payment: FeePayment;
    record: FeeRecord;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const isClassPassed = (classItem: Class) => {
    if (!classItem.date || !classItem.endTime) return false;
    const classEndTime = new Date(`${classItem.date}T${classItem.endTime}`);
    return classEndTime < new Date();
  };

  const loadData = () => {
    setTeachers(getTeachers());
    const loadedStudents = getStudents();
    setStudents(loadedStudents);
    setClasses(getClasses());
    setBatches(getBatches());
    setTests(getTests());

    if (selectedStudentForFees) {
      // Reload fee record if editing
      const freshRecord = getFeeRecordByStudent(selectedStudentForFees.id);
      setFeeRecord(freshRecord || null);
    }
    
    if (selectedTest) {
      const results = getTestResultsByTest(selectedTest.id);
      setTestResults(results);
    }
  };

  const handleSelectStudentForFees = (student: Student) => {
    setSelectedStudentForFees(student);
    const record = getFeeRecordByStudent(student.id);
    setFeeRecord(record || null);
    setPaymentAmount("");
  };

  const handleSelectTest = (test: Test) => {
    setSelectedTest(test);
    const results = getTestResultsByTest(test.id);
    setTestResults(results);
  };

  const handleSaveFeeStructure = (e: React.FormEvent<HTMLFormElement>) => {
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
    updateFeeRecord(newRecord);
    setFeeRecord(newRecord);
    toast.success("Fee structure saved successfully");
  };

  const handleAddPayment = () => {
    if (!selectedStudentForFees || !feeRecord || !paymentAmount) return;
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    const updatedRecord = addFeePayment(selectedStudentForFees.id, amount);
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
      }
    }
  };

  const handlePrint = () => {
    if (receiptData) {
      window.print();
    }
  };

  const handleDeleteTeacher = (teacherId: string) => {
    if (deleteTeacher(teacherId)) {
      toast.success("Teacher deleted successfully");
      loadData();
    } else {
      toast.error("Failed to delete teacher");
    }
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

  const handleDeleteTest = (testId: string) => {
    if (deleteTest(testId)) {
      toast.success("Test deleted successfully");
      if (selectedTest?.id === testId) setSelectedTest(null);
      loadData();
    } else {
      toast.error("Failed to delete test");
    }
  };

  const handleAddTeacher = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const teacher: Teacher = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      subject: formData.get("subject") as string,
      password: formData.get("password") as string,
    };
    const form = e.currentTarget;
    try {
      await addTeacher(teacher);
      form.reset();
      toast.success("Teacher added successfully");
      setOpenDialog(null);
      loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add teacher";
      toast.error(formatFirebaseError(message));
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
      studentClass: formData.get("studentClass") as string,
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

  const handleAddClass = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const startTime = formData.get("time") as string;
    const startPeriod = formData.get("timePeriod") as string;
    const endTime = formData.get("endTime") as string;
    const endPeriod = formData.get("endTimePeriod") as string;

    const convertTo24h = (time: string, period: string) => {
      let [hours, minutes] = time.split(':');
      let h = parseInt(hours);
      if (period === 'PM' && h < 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return `${h.toString().padStart(2, '0')}:${minutes}`;
    };

    const classData: Class = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      subject: formData.get("subject") as string,
      teacherId: formData.get("teacherId") as string,
      batchId: formData.get("batchId") as string,
      date: formData.get("date") as string,
      time: convertTo24h(startTime, startPeriod),
      endTime: convertTo24h(endTime, endPeriod),
    };
    
    try {
      await addClass(classData);
      toast.success("Class created successfully");
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
    const test: Test = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      batchId: formData.get("batchId") as string,
      date: formData.get("date") as string,
      totalMarks: Number(formData.get("totalMarks")),
    };
    addTest(test);
    toast.success("Test added successfully");
    setOpenDialog(null);
    loadData();
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
      marksObtained: marks
    });
    
    // update local state instantly for UI
    setTestResults(prev => {
      const idx = prev.findIndex(r => r.id === resultId);
      const newR = { id: resultId, testId: selectedTest.id, studentId, marksObtained: marks };
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newR;
        return copy;
      }
      return [...prev, newR];
    });
    toast.success("Marks saved");
  };

  const sidebarItems: SidebarItem[] = [
    { id: 'students', label: 'Students', icon: Users, action: () => setActiveTab('students') },
    { id: 'teachers', label: 'Teachers', icon: BookOpen, action: () => setActiveTab('teachers') },
    { id: 'classes', label: 'Classes', icon: Calendar, action: () => setActiveTab('classes') },
    { id: 'batches', label: 'Batches', icon: BarChart3, action: () => setActiveTab('batches') },
    { id: 'fees', label: 'Fees Mgmt', icon: IndianRupee, action: () => setActiveTab('fees') },
    { id: 'tests', label: 'Tests', icon: CheckSquare, action: () => setActiveTab('tests') },
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
            
            {/* STUDENTS VIEW */}
            {activeTab === 'students' && (
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Students</h3>
                    <p className="text-sm text-muted-foreground mr-4">Manage your {students.length} students</p>
                  </div>
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
                          <Label htmlFor="student-password">Password</Label>
                          <Input id="student-password" name="password" type="password" required />
                        </div>
                        <Button type="submit" className="w-full">Add Student</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {students.map((student) => {
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
                              {student.phoneNo && <p className="text-xs text-muted-foreground">{student.phoneNo}</p>}
                            </div>
                            <DeleteDialog
                              title="Delete Student"
                              description={`Are you sure you want to delete ${student.name}? This will also delete all their attendance records. This action cannot be undone.`}
                              onDelete={() => handleDeleteStudent(student.id)}
                            />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            {student.collegeName && (
                              <p className="col-span-2"><span className="font-medium">College:</span> {student.collegeName}</p>
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
                      </div>
                    );
                  })}
                  {students.length === 0 && (
                    <div className="col-span-full py-8 text-center text-muted-foreground bg-accent/50 rounded-lg border-2 border-dashed">
                      No students found. Add your first student to get started.
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* FEES VIEW */}
            {activeTab === 'fees' && (
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-xl font-semibold mb-4">Fees Management</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Student Selector */}
                    <div className="col-span-1 border-r pr-6 border-border hidden md:block max-h-[60vh] overflow-y-auto">
                      <h4 className="font-medium text-sm text-muted-foreground mb-3 uppercase tracking-wider">Select Student</h4>
                      <div className="space-y-2">
                        {students.map(s => (
                          <div 
                            key={s.id} 
                            onClick={() => handleSelectStudentForFees(s)}
                            className={`p-3 rounded-md cursor-pointer transition-colors ${selectedStudentForFees?.id === s.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                          >
                            <p className="font-medium text-sm">{s.name}</p>
                            <p className={`text-xs ${selectedStudentForFees?.id === s.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{s.phoneNo || s.email}</p>
                          </div>
                        ))}
                        {students.length === 0 && (
                          <p className="text-sm text-muted-foreground">No students found.</p>
                        )}
                      </div>
                    </div>

                    {/* Mobile Selector */}
                    <div className="md:hidden block mb-4">
                       <h4 className="font-medium text-sm text-muted-foreground mb-2">Select Student</h4>
                       <Select onValueChange={(val) => {
                         const student = students.find(st => st.id === val);
                         if(student) handleSelectStudentForFees(student);
                       }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a student" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {students.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} ({s.phoneNo || s.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Student Fees Data */}
                    <div className="col-span-1 md:col-span-2">
                      {!selectedStudentForFees ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground py-12 text-sm border-2 border-dashed rounded-lg">
                          Select a student to manage fees
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex justify-between items-start border-b pb-4">
                            <div>
                              <h3 className="text-2xl font-bold">{selectedStudentForFees.name}</h3>
                              <p className="text-sm text-muted-foreground">{selectedStudentForFees.collegeName || "No College specified"} • {selectedStudentForFees.studentClass || "No Class specified"}</p>
                            </div>
                            
                            {receiptData && receiptData.student.id === selectedStudentForFees.id && (
                              <Button onClick={handlePrint} variant="outline" className="gap-2 shrink-0">
                                <Printer className="h-4 w-4" /> Print Latest Receipt
                              </Button>
                            )}
                          </div>

                          {!feeRecord ? (
                            <div className="bg-accent/50 p-6 rounded-lg border">
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
                              {/* Structure Summary */}
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

                              {/* Add Payment form */}
                              <div className="bg-accent/30 p-4 rounded-lg flex items-end gap-4 max-w-lg">
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

                              {/* Payment History */}
                              <div>
                                <h4 className="font-semibold mb-3">Payment History</h4>
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                  {feeRecord.payments?.length > 0 ? (
                                    feeRecord.payments.map((p, index) => (
                                      <div key={p.id} className="flex justify-between items-center bg-card border p-3 rounded-md text-sm">
                                        <div>
                                          <p className="font-medium">Payment #{index + 1}</p>
                                          <p className="text-xs text-muted-foreground">{new Date(p.date).toLocaleString()}</p>
                                        </div>
                                        <div className="font-semibold text-green-600">+₹{p.amount}</div>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* TESTS VIEW */}
            {activeTab === 'tests' && (
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Tests Management</h3>
                    <p className="text-sm text-muted-foreground">Create tests and assign marks</p>
                  </div>
                  <Dialog open={openDialog === "test"} onOpenChange={(open) => setOpenDialog(open ? "test" : null)}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        <span>Add Test</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Test</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddTest} className="space-y-4">
                        <div>
                          <Label htmlFor="test-name">Test Name</Label>
                          <Input id="test-name" name="name" placeholder="e.g. Midterm exam" required />
                        </div>
                        <div>
                          <Label htmlFor="test-batch">Batch</Label>
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
                          <Label htmlFor="test-date">Date</Label>
                          <Input id="test-date" name="date" type="date" required />
                        </div>
                        <div>
                          <Label htmlFor="test-marks">Total Marks</Label>
                          <Input id="test-marks" name="totalMarks" type="number" required />
                        </div>
                        <Button type="submit" className="w-full">Create Test</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Test List */}
                  <div className="lg:col-span-1 space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {tests.map(test => {
                      const batch = batches.find(b => b.id === test.batchId);
                      return (
                        <div 
                          key={test.id} 
                          className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${selectedTest?.id === test.id ? 'border-primary ring-1 ring-primary' : 'bg-card'}`}
                          onClick={() => handleSelectTest(test)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-sm">{test.name}</h4>
                            <DeleteDialog
                              title="Delete Test"
                              description="Are you sure? This will remove all student marks for this test."
                              onDelete={() => handleDeleteTest(test.id)}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>Batch: {batch?.name}</p>
                            <p>Date: {new Date(test.date).toLocaleDateString()}</p>
                            <p>Total Marks: {test.totalMarks}</p>
                          </div>
                        </div>
                      )
                    })}
                    {tests.length === 0 && (
                      <p className="text-sm text-center py-4 text-muted-foreground border-2 border-dashed rounded-lg bg-accent/50">No tests created yet.</p>
                    )}
                  </div>

                  {/* Student Marks Entry */}
                  <div className="lg:col-span-2">
                    {selectedTest ? (
                      <div className="bg-card border rounded-lg p-4">
                        <div className="border-b pb-4 mb-4">
                          <h4 className="text-lg font-semibold">{selectedTest.name} Grading</h4>
                          <p className="text-sm text-muted-foreground">Max marks: {selectedTest.totalMarks}</p>
                        </div>
                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                          {(() => {
                            const batchStudents = students.filter(s => s.batchId === selectedTest.batchId);
                            if (batchStudents.length === 0) return <p className="text-sm text-muted-foreground">No students in this batch.</p>;
                            
                            return batchStudents.map(student => {
                              const existingResult = testResults.find(r => r.studentId === student.id);
                              
                              return (
                                <div key={student.id} className="flex items-center justify-between p-3 border rounded bg-accent/20">
                                  <div>
                                    <p className="font-medium text-sm">{student.name}</p>
                                    <p className="text-xs text-muted-foreground">{student.phoneNo || student.email}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input 
                                      type="number" 
                                      className="w-24 text-right" 
                                      placeholder="Marks"
                                      defaultValue={existingResult?.marksObtained}
                                      onBlur={(e) => handleSaveMarks(student.id, e.target.value)}
                                    />
                                    <span className="text-sm text-muted-foreground">/ {selectedTest.totalMarks}</span>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full min-h-[200px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg bg-accent/50">
                        Select a test from the left to enter marks.
                      </div>
                    )}
                  </div>
                </div>

              </Card>
            )}

            {/* TEACHERS VIEW */}
            {activeTab === 'teachers' && (
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Teachers</h3>
                    <p className="text-sm text-muted-foreground">Manage your {teachers.length} teachers</p>
                  </div>
                  <Dialog open={openDialog === "teacher"} onOpenChange={(open) => setOpenDialog(open ? "teacher" : null)}>
                    <DialogTrigger asChild>
                      <Button className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4" />
                        <span>Add Teacher</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Teacher</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddTeacher} className="space-y-4">
                        <div>
                          <Label htmlFor="teacher-name">Full Name</Label>
                          <Input id="teacher-name" name="name" required />
                        </div>
                        <div>
                          <Label htmlFor="teacher-email">Email</Label>
                          <Input id="teacher-email" name="email" type="email" required />
                        </div>
                        <div>
                          <Label htmlFor="teacher-subject">Subject</Label>
                          <Input id="teacher-subject" name="subject" required />
                        </div>
                        <div>
                          <Label htmlFor="teacher-password">Password</Label>
                          <Input id="teacher-password" name="password" type="password" required />
                        </div>
                        <Button type="submit" className="w-full">Add Teacher</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teachers.map((teacher) => (
                    <div key={teacher.id} className="p-4 rounded-lg border bg-card text-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-base">{teacher.name}</p>
                            <p className="text-xs text-muted-foreground">{teacher.email}</p>
                          </div>
                          <DeleteDialog
                            title="Delete Teacher"
                            description={`Are you sure you want to delete ${teacher.name}? This will also delete all their classes and notes. This action cannot be undone.`}
                            onDelete={() => handleDeleteTeacher(teacher.id)}
                          />
                        </div>
                        <div className="mt-3">
                          <p className="text-xs bg-primary/10 text-primary px-2 py-1 rounded inline-block font-medium">
                            Subject: {teacher.subject}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {teachers.length === 0 && (
                    <div className="col-span-full py-8 text-center text-muted-foreground bg-accent/50 rounded-lg border-2 border-dashed">
                      No teachers found. Add your first teacher to get started.
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* CLASSES VIEW */}
            {activeTab === 'classes' && (
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">Classes</h3>
                    <p className="text-sm text-muted-foreground">Manage your {classes.length} active classes</p>
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
                        <DialogTitle className="text-2xl font-black uppercase text-primary">Add Teaching Session</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddClass} className="space-y-6 pt-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="class-name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Class Name</Label>
                            <Input id="class-name" name="name" placeholder="e.g., Advanced Mathematics" className="h-12 rounded-xl border-accent/20 focus:ring-primary" required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="class-subject" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Subject</Label>
                            <Input id="class-subject" name="subject" placeholder="e.g., Calculus" className="h-12 rounded-xl border-accent/20 focus:ring-primary" required />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="class-teacher" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Assign Teacher</Label>
                            <Select name="teacherId" required>
                              <SelectTrigger className="h-12 rounded-xl border-accent/20">
                                <SelectValue placeholder="Select teacher" />
                              </SelectTrigger>
                              <SelectContent>
                                {teachers.map((teacher) => (
                                  <SelectItem key={teacher.id} value={teacher.id}>
                                    {teacher.name} ({teacher.subject})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="class-batch" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Assign Batch</Label>
                            <Select name="batchId" required>
                              <SelectTrigger className="h-12 rounded-xl border-accent/20">
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

                        <div className="bg-primary/5 p-5 rounded-[24px] border border-primary/10 space-y-4">
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
                        <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg bg-primary hover:scale-[1.01] transition-transform shadow-xl shadow-primary/20">
                          CREATE CLASS SESSION
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map((classItem) => {
                    const teacher = teachers.find(t => t.id === classItem.teacherId);
                    const batch = batches.find(b => b.id === classItem.batchId);
                    const passed = isClassPassed(classItem);
                    return (
                      <div key={classItem.id} className={`p-4 rounded-lg border bg-card text-sm flex flex-col justify-between hover:shadow-md transition-shadow ${passed ? 'opacity-50 grayscale-[0.2]' : ''}`}>
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-base">{classItem.name}</p>
                                {passed && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium uppercase">Ended</span>}
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
                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Instructor: {teacher?.name || 'Unknown'}</span>
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
                    <div className="col-span-full py-8 text-center text-muted-foreground bg-accent/50 rounded-lg border-2 border-dashed">
                      No classes found. Create your first class to get started.
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* BATCHES VIEW */}
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
                          <Button variant="outline" size="sm" onClick={() => navigate(`/admin-dashboard/batches/${batch.id}`)}>
                            View Details
                          </Button>
                        </div>
                        <div className="flex gap-4">
                          <div className="bg-primary/5 text-primary px-3 py-1.5 rounded-md text-sm font-medium">
                            {batchStudents.length} Students
                          </div>
                          <div className="bg-primary/5 text-primary px-3 py-1.5 rounded-md text-sm font-medium">
                            {batchClasses.length} Classes
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {batches.length === 0 && (
                    <div className="col-span-full py-8 text-center text-muted-foreground bg-accent/50 rounded-lg border-2 border-dashed">
                      No batches found. Create your first batch to get started.
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </DashboardLayout>
      </div>

      {/* PRINT RECEIPT LAYER - Hidden unless printing */}
      {receiptData && (
        <div className="hidden print:block absolute top-0 left-0 w-full p-8 bg-white text-black min-h-screen font-sans">
          <div className="max-w-2xl mx-auto border-2 border-black p-8 rounded-lg">
            
            <div className="text-center mb-8 border-b-2 border-black pb-4">
              <h1 className="text-3xl font-bold uppercase tracking-widest text-black">SmartClass</h1>
              <p className="text-gray-600 mt-1">Official Fee Receipt</p>
            </div>

            <div className="flex justify-between items-start mb-8 text-black">
              <div>
                <p className="font-bold text-lg mb-2">Student Details:</p>
                <p><strong>Name:</strong> {receiptData.student.name}</p>
                <p><strong>Phone:</strong> {receiptData.student.phoneNo || 'N/A'}</p>
                <p><strong>College:</strong> {receiptData.student.collegeName || 'N/A'}</p>
                <p><strong>Class:</strong> {receiptData.student.studentClass || 'N/A'}</p>
              </div>
              <div className="text-right">
                <p><strong>Receipt Date:</strong> {new Date(receiptData.payment.date).toLocaleDateString()}</p>
                <p><strong>Receipt ID:</strong> RCPT-{receiptData.payment.id.slice(-6)}</p>
              </div>
            </div>

            <div className="mb-8 border border-black rounded">
              <table className="w-full text-left">
                <thead className="bg-gray-100 border-b border-black text-black">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody className="text-black">
                  <tr>
                    <td className="p-3 font-medium">Fee Payment Installment</td>
                    <td className="p-3 text-right text-lg font-bold">₹{receiptData.payment.amount.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mb-12 text-black">
              <div className="w-1/2 bg-gray-50 border border-gray-300 p-4 rounded text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Course Fees:</span>
                  <span className="font-semibold text-black">₹{receiptData.record.totalFees.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Paid (including this):</span>
                  <span className="font-semibold text-black">₹{receiptData.record.payments.reduce((a, b) => a + b.amount, 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-gray-300 pt-2 pb-1 text-black">
                  <span className="font-bold">Remaining Balance:</span>
                  <span className="font-bold text-red-600">₹{(receiptData.record.totalFees - receiptData.record.payments.reduce((a, b) => a + b.amount, 0)).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-16 flex justify-between text-black">
              <div className="text-center">
                <div className="w-32 border-b-2 border-black mb-2"></div>
                <p className="text-sm text-gray-600">Student Signature</p>
              </div>
              <div className="text-center">
                <div className="w-32 border-b-2 border-black mb-2"></div>
                <p className="text-sm text-gray-600">Authorized Signatory</p>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default AdminDashboard;
