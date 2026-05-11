import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Users, BookOpen, Calendar, BarChart3, Plus, UserPlus, IndianRupee, Printer, CheckSquare, Settings, Award, TrendingUp, UserX, MessageCircle, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  getInstituteSettings,
  saveInstituteSettings,
  getAbsentStudentsForDate,
  isClassPast,
  format12h,
  Teacher,
  Student,
  Class,
  Batch,
  FeeRecord,
  FeePayment,
  Test,
  TestResult,
  MCQQuestion,
  MCQOption,
  InstituteSettings,
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
  const [activeTab, setActiveTab] = useState<'batches' | 'students' | 'teachers' | 'classes' | 'fees' | 'tests' | 'absent' | 'settings'>('students');
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

  // Institute Settings State
  const [instituteSettings, setInstituteSettingsState] = useState<InstituteSettings>(getInstituteSettings());

  // Absent Today State
  const [absentDate, setAbsentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [waMessageTemplate, setWaMessageTemplate] = useState<string>(
    () => localStorage.getItem('smartclass_wa_template') ||
      'Hello Parent, your child {name} was absent today {date}. Kindly look into this. - {institute}'
  );

  // MCQ Test Builder State
  const [testForm, setTestForm] = useState<{ name: string; date: string; batchIds: string[]; questions: MCQQuestion[] }>({
    name: '',
    date: new Date().toISOString().split('T')[0],
    batchIds: [],
    questions: [{ id: 'q1', question: '', options: [
      { id: 'o1', text: '' }, { id: 'o2', text: '' }, { id: 'o3', text: '' }, { id: 'o4', text: '' }
    ], correctOptionId: 'o1' }],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setTeachers(getTeachers());
    const loadedStudents = getStudents();
    setStudents(loadedStudents);
    setClasses(getClasses());
    setBatches(getBatches());
    setTests(getTests());
    setInstituteSettingsState(getInstituteSettings());

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
      whatsappNo: formData.get("whatsappNo") as string,
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
    const classData: Class = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      subject: formData.get("subject") as string,
      teacherId: formData.get("teacherId") as string,
      batchId: formData.get("batchId") as string,
      schedule: formData.get("schedule") as string || undefined,
      date: formData.get("date") as string,
      time: formData.get("time") as string,
      endTime: formData.get("endTime") as string,
      endDate: (formData.get("endDate") as string) || undefined,
    };
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

  const handleCreateMCQTest = () => {
    const { name, date, batchIds, questions } = testForm;
    if (!name.trim()) { toast.error("Test name is required"); return; }
    if (batchIds.length === 0) { toast.error("Select at least one batch"); return; }
    if (questions.length === 0) { toast.error("Add at least one question"); return; }
    for (const q of questions) {
      if (!q.question.trim()) { toast.error("Every question needs text"); return; }
      if (q.options.some(o => !o.text.trim())) { toast.error("All options need text"); return; }
      if (!q.options.find(o => o.id === q.correctOptionId)) { toast.error("Pick a correct answer for every question"); return; }
    }
    const test: Test = {
      id: Date.now().toString(),
      name: name.trim(),
      batchIds,
      date,
      totalMarks: questions.length,
      questions,
    };
    addTest(test);
    toast.success("MCQ test created");
    setOpenDialog(null);
    setTestForm({
      name: '', date: new Date().toISOString().split('T')[0], batchIds: [],
      questions: [{ id: 'q1', question: '', options: [
        { id: 'o1', text: '' }, { id: 'o2', text: '' }, { id: 'o3', text: '' }, { id: 'o4', text: '' }
      ], correctOptionId: 'o1' }],
    });
    loadData();
  };

  const addQuestionToForm = () => {
    const qid = `q${Date.now()}`;
    setTestForm(prev => ({
      ...prev,
      questions: [...prev.questions, {
        id: qid, question: '',
        options: [
          { id: `${qid}_o1`, text: '' }, { id: `${qid}_o2`, text: '' },
          { id: `${qid}_o3`, text: '' }, { id: `${qid}_o4`, text: '' },
        ],
        correctOptionId: `${qid}_o1`,
      }],
    }));
  };

  const removeQuestionFromForm = (qid: string) => {
    setTestForm(prev => ({ ...prev, questions: prev.questions.filter(q => q.id !== qid) }));
  };

  const updateQuestionField = (qid: string, patch: Partial<MCQQuestion>) => {
    setTestForm(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === qid ? { ...q, ...patch } : q),
    }));
  };

  const updateOptionText = (qid: string, oid: string, text: string) => {
    setTestForm(prev => ({
      ...prev,
      questions: prev.questions.map(q => q.id === qid ? {
        ...q, options: q.options.map(o => o.id === oid ? { ...o, text } : o)
      } : q),
    }));
  };

  const toggleBatchInTestForm = (batchId: string, checked: boolean) => {
    setTestForm(prev => ({
      ...prev,
      batchIds: checked ? [...prev.batchIds, batchId] : prev.batchIds.filter(b => b !== batchId),
    }));
  };

  const saveWaTemplate = (val: string) => {
    setWaMessageTemplate(val);
    localStorage.setItem('smartclass_wa_template', val);
  };

  const buildWaLink = (student: Student, dateStr: string): string | null => {
    const phone = (student.whatsappNo || student.phoneNo || '').replace(/\D/g, '');
    if (!phone) return null;
    const formattedDate = new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const text = waMessageTemplate
      .replace(/\{name\}/g, student.name)
      .replace(/\{date\}/g, formattedDate)
      .replace(/\{institute\}/g, instituteSettings.name || 'SmartClass');
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
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

  const handleSaveInstituteSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const settings: InstituteSettings = {
      name: formData.get("instName") as string || "SmartClass",
      address: formData.get("instAddress") as string || "",
      phone: formData.get("instPhone") as string || "",
      email: formData.get("instEmail") as string || "",
    };
    try {
      await saveInstituteSettings(settings);
      setInstituteSettingsState(settings);
      toast.success("Institute settings saved!");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  const getScoreColor = (percent: number): string => {
    if (percent >= 75) return "text-emerald-600";
    if (percent >= 40) return "text-amber-500";
    return "text-red-500";
  };

  const getScoreBgColor = (percent: number): string => {
    if (percent >= 75) return "bg-emerald-500";
    if (percent >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  const sidebarItems: SidebarItem[] = [
    { id: 'students', label: 'Students', icon: Users, action: () => setActiveTab('students') },
    { id: 'teachers', label: 'Teachers', icon: BookOpen, action: () => setActiveTab('teachers') },
    { id: 'classes', label: 'Classes', icon: Calendar, action: () => setActiveTab('classes') },
    { id: 'batches', label: 'Batches', icon: BarChart3, action: () => setActiveTab('batches') },
    { id: 'absent', label: 'Absent Today', icon: UserX, action: () => setActiveTab('absent') },
    { id: 'fees', label: 'Fees Mgmt', icon: IndianRupee, action: () => setActiveTab('fees') },
    { id: 'tests', label: 'Tests', icon: CheckSquare, action: () => setActiveTab('tests') },
    { id: 'settings', label: 'Settings', icon: Settings, action: () => setActiveTab('settings') },
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
                          <Label htmlFor="student-whatsappNo">WhatsApp Number (with country code, e.g. 9198XXXXXXXX)</Label>
                          <Input id="student-whatsappNo" name="whatsappNo" placeholder="e.g. 919876543210" />
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
                             {student.phoneNo && <p className="text-xs text-muted-foreground">📞 {student.phoneNo}</p>}
                             {student.whatsappNo && <p className="text-xs text-emerald-600">💬 {student.whatsappNo}</p>}
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

            {/* ABSENT TODAY VIEW */}
            {activeTab === 'absent' && (() => {
              const absentList = getAbsentStudentsForDate(absentDate);
              return (
                <div className="space-y-6">
                  <Card className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                      <div>
                        <h3 className="text-xl font-semibold flex items-center gap-2"><UserX className="h-5 w-5 text-red-500" /> Absent Students</h3>
                        <p className="text-sm text-muted-foreground">Notify parents via WhatsApp with one click</p>
                      </div>
                      <div>
                        <Label htmlFor="absent-date" className="text-xs">Date</Label>
                        <Input id="absent-date" type="date" value={absentDate} onChange={(e) => setAbsentDate(e.target.value)} />
                      </div>
                    </div>

                    <div className="mb-6 p-4 rounded-lg border bg-accent/30">
                      <Label htmlFor="wa-template" className="text-sm font-medium">WhatsApp Message Template</Label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Available placeholders: <code className="bg-muted px-1 rounded">{"{name}"}</code>, <code className="bg-muted px-1 rounded">{"{date}"}</code>, <code className="bg-muted px-1 rounded">{"{institute}"}</code>
                      </p>
                      <Textarea
                        id="wa-template"
                        rows={3}
                        value={waMessageTemplate}
                        onChange={(e) => saveWaTemplate(e.target.value)}
                      />
                    </div>

                    {absentList.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground bg-accent/20 rounded-lg border-2 border-dashed">
                        🎉 No absent students recorded for this date.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {absentList.map(({ student }) => {
                          const link = buildWaLink(student, absentDate);
                          const batch = batches.find(b => b.id === student.batchId);
                          return (
                            <div key={student.id} className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <p className="font-semibold">{student.name}</p>
                                  <p className="text-xs text-muted-foreground">{batch?.name || 'No batch'}</p>
                                </div>
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Absent</span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-3">
                                {student.whatsappNo ? `WhatsApp: ${student.whatsappNo}` : student.phoneNo ? `Phone: ${student.phoneNo}` : 'No contact number'}
                              </p>
                              {link ? (
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-2 transition-colors"
                                >
                                  <MessageCircle className="h-4 w-4" /> Send WhatsApp
                                </a>
                              ) : (
                                <Button disabled variant="outline" className="w-full" size="sm">No WhatsApp number</Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </div>
              );
            })()}

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

            {/* TESTS VIEW - Professional Redesign */}
            {activeTab === 'tests' && (
              <div className="space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/30">
                    <CheckSquare className="h-5 w-5 text-blue-500 mb-1" />
                    <p className="text-2xl font-bold">{tests.length}</p>
                    <p className="text-xs text-muted-foreground">Total Tests</p>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-200/30">
                    <Award className="h-5 w-5 text-emerald-500 mb-1" />
                    <p className="text-2xl font-bold">{batches.length}</p>
                    <p className="text-xs text-muted-foreground">Active Batches</p>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200/30">
                    <Users className="h-5 w-5 text-amber-500 mb-1" />
                    <p className="text-2xl font-bold">{students.length}</p>
                    <p className="text-xs text-muted-foreground">Total Students</p>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200/30">
                    <TrendingUp className="h-5 w-5 text-purple-500 mb-1" />
                    <p className="text-2xl font-bold">
                      {selectedTest && testResults.length > 0
                        ? Math.round(testResults.reduce((sum, r) => sum + r.marksObtained, 0) / testResults.length)
                        : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg Score</p>
                  </Card>
                </div>

                <Card className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                    <div>
                      <h3 className="text-xl font-semibold">Tests & Assessments</h3>
                      <p className="text-sm text-muted-foreground">Create tests and assign marks to students</p>
                    </div>
                    <Dialog open={openDialog === "test"} onOpenChange={(open) => setOpenDialog(open ? "test" : null)}>
                      <DialogTrigger asChild>
                        <Button className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          <span>Add Test</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Create MCQ Test</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="test-name">Test Name</Label>
                              <Input id="test-name" value={testForm.name} onChange={(e) => setTestForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Midterm Exam" />
                            </div>
                            <div>
                              <Label htmlFor="test-date">Date</Label>
                              <Input id="test-date" type="date" value={testForm.date} onChange={(e) => setTestForm(p => ({ ...p, date: e.target.value }))} />
                            </div>
                          </div>

                          <div>
                            <Label className="mb-2 block">Assign to Batches (select one or more)</Label>
                            <div className="grid grid-cols-2 gap-2 p-3 border rounded-md bg-accent/20">
                              {batches.map(batch => (
                                <label key={batch.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <Checkbox
                                    checked={testForm.batchIds.includes(batch.id)}
                                    onCheckedChange={(c) => toggleBatchInTestForm(batch.id, !!c)}
                                  />
                                  <span>{batch.name}</span>
                                </label>
                              ))}
                              {batches.length === 0 && <p className="text-xs text-muted-foreground col-span-2">No batches available</p>}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>Questions ({testForm.questions.length})</Label>
                              <Button type="button" size="sm" variant="outline" onClick={addQuestionToForm}>
                                <Plus className="h-3 w-3 mr-1" /> Add Question
                              </Button>
                            </div>
                            {testForm.questions.map((q, qIdx) => (
                              <div key={q.id} className="border rounded-md p-4 bg-card space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground">Question {qIdx + 1}</Label>
                                    <Textarea
                                      rows={2}
                                      placeholder="Enter the question"
                                      value={q.question}
                                      onChange={(e) => updateQuestionField(q.id, { question: e.target.value })}
                                    />
                                  </div>
                                  {testForm.questions.length > 1 && (
                                    <Button type="button" size="icon" variant="ghost" className="text-red-500 mt-5" onClick={() => removeQuestionFromForm(q.id)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground">Tick the correct answer</p>
                                  {q.options.map((opt, optIdx) => (
                                    <div key={opt.id} className="flex items-center gap-2">
                                      <Checkbox
                                        checked={q.correctOptionId === opt.id}
                                        onCheckedChange={(c) => { if (c) updateQuestionField(q.id, { correctOptionId: opt.id }); }}
                                      />
                                      <Input
                                        placeholder={`Option ${optIdx + 1}`}
                                        value={opt.text}
                                        onChange={(e) => updateOptionText(q.id, opt.id, e.target.value)}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>

                          <Button onClick={handleCreateMCQTest} className="w-full">Create Test</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
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
              </div>
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
                      <form onSubmit={handleAddClass} className="space-y-4">
                        <div>
                          <Label htmlFor="class-name">Class Name</Label>
                          <Input id="class-name" name="name" placeholder="e.g., Advanced Mathematics" required />
                        </div>
                        <div>
                          <Label htmlFor="class-subject">Subject</Label>
                          <Input id="class-subject" name="subject" required />
                        </div>
                        <div>
                          <Label htmlFor="class-teacher">Assign Teacher</Label>
                          <Select name="teacherId" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select teacher" />
                            </SelectTrigger>
                            <SelectContent>
                              {teachers.map((teacher) => (
                                <SelectItem key={teacher.id} value={teacher.id}>
                                  {teacher.name} - {teacher.subject}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="class-batch">Assign Batch</Label>
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
                          <Label htmlFor="class-schedule">Schedule (optional text)</Label>
                          <Input id="class-schedule" name="schedule" placeholder="e.g., Mon, Wed, Fri" />
                        </div>
                        <div>
                          <Label htmlFor="class-date">Date</Label>
                          <Input id="class-date" name="date" type="date" required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="class-time">Start Time</Label>
                            <Input id="class-time" name="time" type="time" required />
                          </div>
                          <div>
                            <Label htmlFor="class-endTime">End Time</Label>
                            <Input id="class-endTime" name="endTime" type="time" required />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="class-endDate">End Date (optional)</Label>
                          <Input id="class-endDate" name="endDate" type="date" />
                          <p className="text-xs text-muted-foreground mt-1">Classes past this date will appear as completed.</p>
                        </div>
                        <Button type="submit" className="w-full">Create Class</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...classes].sort((a, b) => {
                    const aPast = isClassPast(a);
                    const bPast = isClassPast(b);
                    if (aPast === bPast) return 0;
                    return aPast ? 1 : -1;
                  }).map((classItem) => {
                    const teacher = teachers.find(t => t.id === classItem.teacherId);
                    const batch = batches.find(b => b.id === classItem.batchId);
                    const isPast = isClassPast(classItem);
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
                          <div className="mt-3 space-y-1">
                            <p className="text-xs">
                              <span className="font-medium">Instructor:</span> {teacher?.name || 'Unknown'}
                            </p>
                            <p className="text-xs">
                              <span className="font-medium">Batch:</span> {batch?.name || 'Unknown'}
                            </p>
                            <p className="text-xs">
                              <span className="font-medium">Schedule:</span> {classItem.date} • {format12h(classItem.time)} - {format12h(classItem.endTime)}
                            </p>
                            {classItem.endDate && (
                              <p className="text-xs">
                                <span className="font-medium">End Date:</span> {new Date(classItem.endDate).toLocaleDateString()}
                              </p>
                            )}
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

            {/* SETTINGS VIEW */}
            {activeTab === 'settings' && (
              <Card className="p-6 max-w-2xl">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold flex items-center gap-2"><Settings className="h-5 w-5" /> Institute Settings</h3>
                  <p className="text-sm text-muted-foreground mt-1">Configure institute details that appear on fee receipts and invoices.</p>
                </div>
                <form onSubmit={handleSaveInstituteSettings} className="space-y-5">
                  <div>
                    <Label htmlFor="instName">Institute / Organization Name</Label>
                    <Input id="instName" name="instName" defaultValue={instituteSettings.name} placeholder="e.g., ABC Coaching Classes" required />
                  </div>
                  <div>
                    <Label htmlFor="instAddress">Address</Label>
                    <Textarea id="instAddress" name="instAddress" defaultValue={instituteSettings.address} placeholder="e.g., 123 Main Street, City, State - 400001" rows={2} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="instPhone">Phone Number</Label>
                      <Input id="instPhone" name="instPhone" defaultValue={instituteSettings.phone} placeholder="e.g., +91 98765 43210" />
                    </div>
                    <div>
                      <Label htmlFor="instEmail">Email</Label>
                      <Input id="instEmail" name="instEmail" type="email" defaultValue={instituteSettings.email} placeholder="e.g., info@institute.com" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full sm:w-auto">Save Settings</Button>
                </form>
                
                {/* Preview */}
                <div className="mt-8 border-t pt-6">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Receipt Header Preview</p>
                  <div className="border rounded-lg p-6 bg-white text-black text-center">
                    <h2 className="text-xl font-bold uppercase tracking-wide">{instituteSettings.name || 'SmartClass'}</h2>
                    {instituteSettings.address && <p className="text-sm text-gray-600 mt-1">{instituteSettings.address}</p>}
                    <div className="flex items-center justify-center gap-4 mt-1 text-xs text-gray-500">
                      {instituteSettings.phone && <span>📞 {instituteSettings.phone}</span>}
                      {instituteSettings.email && <span>✉ {instituteSettings.email}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            )}

          </div>
        </DashboardLayout>
      </div>

      {/* PROFESSIONAL INVOICE RECEIPT - Visible only when printing */}
      {receiptData && (
        <div className="hidden print:block absolute top-0 left-0 w-full bg-white text-black min-h-screen" style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
          <div className="max-w-[210mm] mx-auto px-10 py-8">
            
            {/* Invoice Header */}
            <div className="border-b-2 border-gray-800 pb-5 mb-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold uppercase tracking-widest text-gray-900">{instituteSettings.name || 'SmartClass'}</h1>
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
              Generated by {instituteSettings.name || 'SmartClass'} Management System • {new Date().toLocaleDateString()}
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default AdminDashboard;
