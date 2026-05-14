import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, BookOpen, Calendar, BarChart3, Plus, UserPlus, IndianRupee, Printer, CheckSquare, ClipboardCheck, Cake, Edit } from "lucide-react";
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
  getStudentAttendance,
  getFeeRecordByStudent,
  updateFeeRecord,
  addFeePayment,
  getTests,
  addTest,
  deleteTest,
  getTestResultsByTest,
  saveTestResult,
  subscribeToRealtimeUpdates,
  markAttendance,
  getStaff,
  addStaff,
  deleteStaff,
  Student,
  Class,
  Batch,
  FeeRecord,
  FeePayment,
  Test,
  TestResult,
  Staff,
  MCQQuestion,
  InstituteSettings,
  getInstituteSettings,
} from "@/lib/localStorage";

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

  const [activeTab, setActiveTab] = useState<'batches' | 'students' | 'staff' | 'classes' | 'fees' | 'tests' | 'attendance' | 'birthdays'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [selectedReportBatch, setSelectedReportBatch] = useState<string | null>(null);

  // Fees State
  const [selectedStudentForFees, setSelectedStudentForFees] = useState<Student | null>(null);
  const [feeRecord, setFeeRecord] = useState<FeeRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");

  // Tests State
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const selectedTestIdRef = useRef<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [absentMessage, setAbsentMessage] = useState<string>("Hello parent, your child {name} was absent today {date}.");
  const [birthdayMessage, setBirthdayMessage] = useState<string>("Happy Birthday {name}! 🎂 Wishing you a fantastic day ahead! 🎉");

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
      }
    }
  };

  const handlePrint = () => {
    if (receiptData) {
      window.print();
    }
  };

  // Staff Attendance State
  const [selectedAttendanceBatch, setSelectedAttendanceBatch] = useState<string | null>(null);
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, 'present' | 'absent'>>({});

  const handleSaveDailyAttendance = () => {
    if (!selectedAttendanceBatch) return;
    const today = getLocalDateString();
    
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
    const test: Test = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      batchId: selectedBatches[0] || "",
      batchIds: selectedBatches,
      date: formData.get("date") as string,
      totalMarks: testType === 'mcq' ? mcqQuestions.length : Number(formData.get("totalMarks")),
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
    loadData();
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
                  {students.filter(student => student.name.toLowerCase().includes(studentSearch.toLowerCase()) || student.email.toLowerCase().includes(studentSearch.toLowerCase())).map((student) => {
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
                      </div>
                    );
                  })}
                  {students.length === 0 && (
                    <div className="col-span-full py-8 text-center text-muted-foreground bg-accent rounded-lg border-2 border-dashed">
                      No students found. Add your first student to get started.
                    </div>
                  )}
                </div>
              </Card>
            )}

            
            {activeTab === 'fees' && (
              <div className="space-y-6">
                <Card className="p-6">
                  <h3 className="text-xl font-semibold mb-4">Fees Management</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
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
                            <p className={`text-xs ${selectedStudentForFees?.id === s.id ? 'text-primary-foreground' : 'text-muted-foreground'}`}>{s.phoneNo || s.email}</p>
                          </div>
                        ))}
                        {students.length === 0 && (
                          <p className="text-sm text-muted-foreground">No students found.</p>
                        )}
                      </div>
                    </div>

                    
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
                            <div className="bg-accent p-6 rounded-lg border">
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

                              
                              <div className="bg-accent p-4 rounded-lg flex items-end gap-4 max-w-lg">
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

            
            {activeTab === 'tests' && (
              <Card className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b pb-6">
                  <div>
                    <h3 className="text-2xl font-black text-primary">Tests Management</h3>
                    <p className="text-sm text-muted-foreground mt-1">Create exams and track student performance</p>
                  </div>
                  <div className="flex items-center gap-3">
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
                  </div>
                </div>




                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Test List */}
                    <div className="lg:col-span-1 space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                      {tests.map(test => {
                        const batchNames = (test.batchIds && test.batchIds.length > 0)
                          ? test.batchIds.map(bid => batches.find(b => b.id === bid)?.name).filter(Boolean).join(', ')
                          : (batches.find(b => b.id === test.batchId)?.name || 'Unknown');
                        const isSelected = selectedTest?.id === test.id;
                        const results = getTestResultsByTest(test.id);
                        const avgScore = results.length > 0 ? Math.round((results.reduce((s, r) => s + r.marksObtained, 0) / results.length / test.totalMarks) * 100) : null;
                        
                        return (
                          <div 
                            key={test.id} 
                            className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'bg-card'}`}
                            onClick={() => handleSelectTest(test)}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold">{test.name}</h4>
                              <DeleteDialog
                                title="Delete Test"
                                description="Are you sure? This will remove all student marks for this test."
                                onDelete={() => handleDeleteTest(test.id)}
                              />
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
                        )
                      })}
                      {tests.length === 0 && (
                        <p className="text-sm text-center py-4 text-muted-foreground border-2 border-dashed rounded-lg bg-accent/50">No tests created yet.</p>
                      )}
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
                          <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
                            {(() => {
                              const allowedBatchIds = (selectedTest.batchIds && selectedTest.batchIds.length > 0) ? selectedTest.batchIds : (selectedTest.batchId ? [selectedTest.batchId] : []);
                              const batchStudents = students.filter(s => allowedBatchIds.includes(s.batchId));
                              if (batchStudents.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">No students in this batch.</p>;
                              
                              return batchStudents.map(student => {
                                const existingResult = testResults.find(r => r.studentId === student.id);
                                const percent = existingResult ? Math.round((existingResult.marksObtained / selectedTest.totalMarks) * 100) : null;
                                
                                return (
                                  <div key={student.id} className="flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-accent/30 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                        percent === null ? 'bg-muted text-muted-foreground'
                                        : percent >= 75 ? 'bg-emerald-100 text-emerald-700'
                                        : percent >= 40 ? 'bg-amber-100 text-amber-700'
                                        : 'bg-red-100 text-red-700'
                                      }`}>
                                        {percent !== null ? `${percent}%` : '—'}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{student.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{student.phoneNo || student.email}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-3">
                                      <Input 
                                        type="number" 
                                        className="w-20 text-right text-sm" 
                                        placeholder="—"
                                        defaultValue={existingResult?.marksObtained}
                                        onBlur={(e) => handleSaveMarks(student.id, e.target.value)}
                                      />
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">/ {selectedTest.totalMarks}</span>
                                    </div>
                                  </div>
                                );
                              });
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
                          <Button variant="outline" size="sm" onClick={() => navigate(`/admin-dashboard/batches/${batch.id}`)}>
                            View Details
                          </Button>
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
                                const today = getLocalDateString();
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
                                const today = getLocalDateString();
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
                                <td className="p-3 font-medium">{student.name}</td>
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
                      const today = getLocalDateString();
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
          </div>
        </DashboardLayout>
      </div>

      
      {receiptData && (
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
    </>
  );
};

export default AdminDashboard;
