import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Calendar, 
  ClipboardCheck, 
  Plus, 
  AlertTriangle, 
  FileText, 
  Trash2, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  UserCheck, 
  Search, 
  MessageSquare, 
  Bell, 
  Star, 
  AlertCircle, 
  Award, 
  ThumbsUp, 
  ThumbsDown, 
  Megaphone, 
  Send, 
  Filter, 
  Check,
  MessageCircle,
  Smartphone,
  Sparkles,
  Share2,
  Users,
  CheckSquare,
  BookOpen,
  ArrowLeft,
  Percent,
  TrendingUp,
  X,
  FileSpreadsheet
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  TeacherTimetableSection,
  LectureAttendancePayload,
} from "@/components/timetable/TeacherTimetableSection";
import {
  getStudents,
  getClasses,
  getBatches,
  getTeachers,
  getCurrentUser,
  markAttendance,
  getAttendance,
  getTimetableLectures,
  TimetableLecture,
  getNotes,
  addNote,
  deleteNote,
  getStudentRemarks,
  addStudentRemark,
  deleteStudentRemark,
  getTests,
  addTest,
  updateTest,
  deleteTest,
  getTestResults,
  saveTestResult,
  subscribeToRealtimeUpdates,
  isDevModeActive,
  getInstituteSettings,
  Student,
  Class,
  Batch,
  Teacher,
  Note,
  StudentRemark,
  RemarkType,
  Test,
  TestResult,
} from "@/lib/localStorage";

export type TeacherTab = "classes" | "timetable" | "attendance" | "marks" | "notes" | "remarks";

const ALL_TEACHER_TABS: { id: TeacherTab; label: string; icon: LucideIcon; desc: string }[] = [
  { id: "classes", label: "Classes", icon: Calendar, desc: "Lecture schedules & classes" },
  { id: "timetable", label: "Timetable", icon: Clock, desc: "Weekly schedule matrix" },
  { id: "attendance", label: "Attendance", icon: ClipboardCheck, desc: "Student attendance tracking" },
  { id: "marks", label: "Tests & Marks", icon: Award, desc: "Enter student marks & grading" },
  { id: "notes", label: "Notes", icon: FileText, desc: "Upload notes & study material" },
  { id: "remarks", label: "Student Remarks", icon: MessageSquare, desc: "Feedback & parent notices" },
];

const TeacherDashboard = () => {
  const [activeTab, setActiveTab] = useState<TeacherTab>("classes");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>(() => getTeachers());
  const [devSelectedTeacherId, setDevSelectedTeacherId] = useState<string>(() => {
    try {
      return sessionStorage.getItem('sankalp_dev_teacher_id') || '';
    } catch {
      return '';
    }
  });
  const [notes, setNotes] = useState<Note[]>([]);
  const [remarks, setRemarks] = useState<StudentRemark[]>([]);
  const [timetableLectures, setTimetableLectures] = useState<TimetableLecture[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  // Tests & Marks State
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [localMarks, setLocalMarks] = useState<Record<string, string>>({});
  const [testSearch, setTestSearch] = useState('');
  const [testSubjectFilter, setTestSubjectFilter] = useState('all');
  const [testBatchFilter, setTestBatchFilter] = useState('all');
  const [studentMarksFilter, setStudentMarksFilter] = useState<'all' | 'graded' | 'pending' | 'absent'>('all');
  const [studentMarksSearch, setStudentMarksSearch] = useState('');
  const [isCreateTestOpen, setIsCreateTestOpen] = useState(false);
  const [newTestName, setNewTestName] = useState('');
  const [newTestSubject, setNewTestSubject] = useState('');
  const [newTestBatchIds, setNewTestBatchIds] = useState<string[]>([]);
  const [newTestTotalMarks, setNewTestTotalMarks] = useState('50');
  const [newTestDate, setNewTestDate] = useState('');
  const [newTestType, setNewTestType] = useState<'subjective' | 'mcq'>('subjective');
  const [selectedAttendanceBatch, setSelectedAttendanceBatch] = useState<string | null>(null);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<Class | null>(null);
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, boolean>>({}); // studentId -> isAbsent
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  // Add Note state (multi-batch)
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteLink, setNoteLink] = useState('');
  const [selectedNoteBatches, setSelectedNoteBatches] = useState<string[]>([]);
  const [noteSubject, setNoteSubject] = useState('');

  // Remarks State
  const [studentSearch, setStudentSearch] = useState('');
  const [remarkBatchFilter, setRemarkBatchFilter] = useState('all');
  const [selectedStudentForRemark, setSelectedStudentForRemark] = useState<Student | null>(null);
  const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
  const [isViewHistoryModalOpen, setIsViewHistoryModalOpen] = useState(false);
  const [remarkType, setRemarkType] = useState<RemarkType>('appreciation');
  const [remarkTitle, setRemarkTitle] = useState('');
  const [remarkDescription, setRemarkDescription] = useState('');
  const [remarkSubject, setRemarkSubject] = useState('');
  const [sendToParentsWhatsApp, setSendToParentsWhatsApp] = useState(false);
  const [remarkFilter, setRemarkFilter] = useState<'all' | 'appreciation' | 'complaint'>('all');
  const [isSubmittingRemark, setIsSubmittingRemark] = useState(false);

  const currentUser = getCurrentUser();

  // Returns YYYY-MM-DD in local timezone
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    setCurrentDateStr(getLocalDateString());
    const interval = setInterval(() => {
      setCurrentDateStr(getLocalDateString());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    setStudents(getStudents());
    setClasses(getClasses());
    setBatches(getBatches());
    setTeachers(getTeachers());
    setNotes(getNotes());
    setRemarks(getStudentRemarks());
    setTimetableLectures(getTimetableLectures());
    setTests(getTests());
    setTestResults(getTestResults());
  };

  useEffect(() => {
    loadData();
    const handleRoleChange = () => {
      loadData();
    };
    window.addEventListener('sankalp_role_changed', handleRoleChange);
    window.addEventListener('sankalp_timetable_changed', handleRoleChange);
    window.addEventListener('storage', handleRoleChange);
    const unsubscribe = subscribeToRealtimeUpdates(() => {
      loadData();
    });
    return () => {
      window.removeEventListener('sankalp_role_changed', handleRoleChange);
      window.removeEventListener('sankalp_timetable_changed', handleRoleChange);
      window.removeEventListener('storage', handleRoleChange);
      unsubscribe();
    };
  }, []);

  // Determine current teacher details
  const activeUser = getCurrentUser();
  const allTeachers = teachers.length > 0 ? teachers : getTeachers();

  const isDevOrAdminSession = !activeUser || 
                              activeUser.id === 'dev-lakshya' || 
                              activeUser.id === 'teacher' || 
                              activeUser.role === 'admin' || 
                              activeUser.name?.includes('Dev Mode');

  // 1. Direct match for a real logged-in teacher
  let matchedTeacher = allTeachers.find(t =>
    (t.id && activeUser?.id && String(t.id).trim() === String(activeUser.id).trim()) ||
    (t.email && activeUser?.id && t.email.trim().toLowerCase() === String(activeUser.id).trim().toLowerCase()) ||
    (t.email && activeUser?.name && t.email.trim().toLowerCase() === String(activeUser.name).trim().toLowerCase()) ||
    (t.name && activeUser?.name && t.name.trim().toLowerCase() === String(activeUser.name).trim().toLowerCase())
  );

  // 2. If in dev mode / admin test session, allow switching or auto-selecting registered teacher
  if ((isDevOrAdminSession || isDevModeActive()) && allTeachers.length > 0) {
    if (devSelectedTeacherId) {
      const explicit = allTeachers.find(t => t.id === devSelectedTeacherId);
      if (explicit) matchedTeacher = explicit;
    }
    if (!matchedTeacher) {
      matchedTeacher = allTeachers.find(t => Array.isArray(t.assignedSubjects) && t.assignedSubjects.length > 0) || allTeachers[0];
    }
  }

  const currentTeacher = matchedTeacher;
  const isFallbackTeacher = !currentTeacher;

  // Strictly compute teacher's assigned subjects - NO generic fallback!
  const teacherSubjects = ((): string[] => {
    if (!currentTeacher) return [];

    const set = new Set<string>();

    // 1. From teacher's assignedSubjects (handling array or comma-separated strings)
    const rawAssigned = currentTeacher.assignedSubjects || (currentTeacher as any).subjects || (currentTeacher as any).subject;
    if (Array.isArray(rawAssigned)) {
      rawAssigned.forEach(s => {
        if (typeof s === 'string') {
          s.split(',').map(x => x.trim()).filter(Boolean).forEach(x => set.add(x));
        }
      });
    } else if (typeof rawAssigned === 'string') {
      rawAssigned.split(',').map(x => x.trim()).filter(Boolean).forEach(x => set.add(x));
    }

    // 2. Also check if the teacher has any assigned classes with subjects
    classes.forEach(c => {
      const isMyClass = c.teacherId === currentTeacher.id ||
                        (Array.isArray(c.teacherIds) && c.teacherIds.includes(currentTeacher.id)) ||
                        (c.teacherName && c.teacherName.trim().toLowerCase() === currentTeacher.name.trim().toLowerCase());
      if (isMyClass && c.subject && c.subject.trim()) {
        set.add(c.subject.trim());
      }
    });

    // 3. Also check timetable lectures assigned to this teacher
    timetableLectures.forEach(l => {
      const teacherIds = [l.teacherId, ...(l.teacherIds || [])].filter(Boolean);
      const teacherNames = [l.teacherName, ...(l.teacherNames || [])].filter(Boolean).map(n => n.toLowerCase());
      const isMyLecture = teacherIds.includes(currentTeacher.id) || teacherNames.includes(currentTeacher.name.toLowerCase());
      if (isMyLecture && l.subjectName && l.subjectName.trim()) {
        set.add(l.subjectName.trim());
      }
    });

    return Array.from(set);
  })();

  // Teacher Feature Permissions & Allowed Tabs
  const allowedFeatures = ((): string[] => {
    if (isFallbackTeacher) {
      return ['classes', 'timetable', 'attendance', 'marks', 'notes', 'remarks'];
    }
    const feats = currentTeacher?.allowedFeatures || currentTeacher?.allowedTabs;
    if (Array.isArray(feats) && feats.length > 0) {
      return feats;
    }
    return ['classes', 'timetable', 'attendance', 'marks', 'notes', 'remarks'];
  })();

  const tabOptions = ALL_TEACHER_TABS.filter(tab => allowedFeatures.includes(tab.id));

  // If currently active tab is not allowed, switch to first allowed tab
  useEffect(() => {
    if (tabOptions.length > 0 && !tabOptions.some(t => t.id === activeTab)) {
      setActiveTab(tabOptions[0].id);
    }
  }, [tabOptions, activeTab]);

  // Batches and Tests accessible by this teacher
  const teacherBatchIds = (() => {
    if (isFallbackTeacher) return batches.map(b => b.id);
    const fromTeacher = currentTeacher?.assignedBatchIds || [];
    const fromClasses = classes
      .filter(c => c.teacherId === currentUser?.id || teacherSubjects.some(s => s.toLowerCase() === c.subject.toLowerCase()))
      .map(c => c.batchId)
      .filter(Boolean);
    const combined = Array.from(new Set([...fromTeacher, ...fromClasses]));
    return combined.length > 0 ? combined : batches.map(b => b.id);
  })();

  const teacherBatches = batches.filter(b => teacherBatchIds.includes(b.id));

  // STRICT SUBJECT ISOLATION: Teachers can ONLY see tests of their assigned subjects
  const teacherTests = tests.filter(t => {
    if (isFallbackTeacher) return true;
    if (teacherSubjects.length === 0) return false;
    const testSubj = (t.subject || '').trim().toLowerCase();
    // Only tests where the subject matches one of the teacher's assigned subjects
    return teacherSubjects.some(s => s.trim().toLowerCase() === testSubj);
  });

  // Automatically reset testSubjectFilter if current filter is not among teacher's assigned subjects
  useEffect(() => {
    if (testSubjectFilter !== 'all' && !teacherSubjects.some(s => s.trim().toLowerCase() === testSubjectFilter.trim().toLowerCase())) {
      setTestSubjectFilter('all');
    }
  }, [teacherSubjects, testSubjectFilter]);

  // Guard: Automatically deselect or block any test outside the teacher's assigned subjects
  useEffect(() => {
    if (selectedTest && !isFallbackTeacher) {
      const testSubj = (selectedTest.subject || '').trim().toLowerCase();
      const hasSubjectMatch = teacherSubjects.some(s => s.trim().toLowerCase() === testSubj);
      if (!hasSubjectMatch) {
        toast.error("Access restricted: You can only view and grade tests of your assigned subjects: " + teacherSubjects.join(', '));
        setSelectedTest(null);
      }
    }
  }, [selectedTest, teacherSubjects, isFallbackTeacher]);

  // Sync localMarks when selectedTest changes or testResults change
  useEffect(() => {
    if (!selectedTest) return;
    const marks: Record<string, string> = {};
    testResults.forEach(r => {
      if (r.testId === selectedTest.id) {
        marks[r.studentId] = r.isAbsent ? '' : String(r.marksObtained);
      }
    });
    setLocalMarks(marks);
  }, [selectedTest, testResults]);

  // Handle Marks Saving
  const handleSaveMarks = (studentId: string, marksRaw: string) => {
    if (!selectedTest) return;
    const trimmed = marksRaw.trim();
    if (trimmed === '') return;
    let marks = Number(trimmed);
    if (isNaN(marks)) {
      toast.error("Please enter a valid numeric mark");
      return;
    }
    if (marks > selectedTest.totalMarks) {
      marks = selectedTest.totalMarks;
      toast.info(`Marks capped at test maximum: ${selectedTest.totalMarks}`);
    }
    if (marks < 0) marks = 0;

    const resultId = `${studentId}_${selectedTest.id}`;
    const resultObj: TestResult = {
      id: resultId,
      testId: selectedTest.id,
      studentId: studentId,
      marksObtained: marks,
      isAbsent: false,
      submittedAt: new Date().toISOString()
    };
    saveTestResult(resultObj);

    setTestResults(prev => {
      const idx = prev.findIndex(r => r.id === resultId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = resultObj;
        return copy;
      }
      return [...prev, resultObj];
    });

    setLocalMarks(prev => ({ ...prev, [studentId]: String(marks) }));
    toast.success("Marks recorded");
  };

  // Toggle Absent State
  const toggleAbsent = (studentId: string) => {
    if (!selectedTest) return;
    const resultId = `${studentId}_${selectedTest.id}`;
    const existing = testResults.find(r => r.id === resultId);
    const isAbsent = !existing?.isAbsent;

    const updatedResult: TestResult = {
      id: resultId,
      testId: selectedTest.id,
      studentId: studentId,
      marksObtained: 0,
      isAbsent: isAbsent,
      submittedAt: new Date().toISOString()
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

    if (isAbsent) {
      setLocalMarks(prev => ({ ...prev, [studentId]: '' }));
    }
    toast.success(isAbsent ? "Marked as absent" : "Marked as present");
  };

  // Send WhatsApp Marks Report to Parent
  const handleShareMarksWhatsApp = (student: Student) => {
    if (!selectedTest) return;
    const phone = student.parentWhatsApp || student.whatsappNo || student.phoneNo;
    if (!phone) {
      toast.error(`No contact number found for ${student.name}`);
      return;
    }
    const cleanedPhone = phone.replace(/[^0-9]/g, '');
    const fullPhone = cleanedPhone.length === 10 ? `91${cleanedPhone}` : cleanedPhone;

    const resultId = `${student.id}_${selectedTest.id}`;
    const result = testResults.find(r => r.id === resultId);
    const isAbsent = result?.isAbsent;
    const marks = result ? result.marksObtained : (localMarks[student.id] ? Number(localMarks[student.id]) : 0);
    const percent = Math.round((marks / selectedTest.totalMarks) * 100);

    const instSettings = getInstituteSettings();
    const instituteName = instSettings?.name || "Sankalp Academy";

    let msg = "";
    if (isAbsent) {
      msg = `*${instituteName} - Test Absence Notice*\n\nDear Parent,\nYour child *${student.name}* was marked *ABSENT* for the test:\n📝 Test: *${selectedTest.name}*\n📚 Subject: *${selectedTest.subject || 'General'}*\n📅 Date: *${selectedTest.date}*\n\nPlease connect with the faculty for makeup exams if applicable.`;
    } else {
      msg = `*${instituteName} - Test Marks Report*\n\nDear Parent,\nHere is the performance report for *${student.name}*:\n📝 Test: *${selectedTest.name}*\n📚 Subject: *${selectedTest.subject || 'General'}*\n📅 Date: *${selectedTest.date}*\n🎯 Marks: *${marks} / ${selectedTest.totalMarks}* (${percent}%)\n\nWe appreciate your support in encouraging regular studies!`;
    }

    const waUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg.replace(/\\n/g, '\n'))}`;
    window.open(waUrl, '_blank');
  };

  // Teacher Create Test
  const handleCreateTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTestName.trim()) {
      toast.error("Please enter test name");
      return;
    }
    if (newTestBatchIds.length === 0) {
      toast.error("Please assign at least one batch");
      return;
    }
    const marksNum = Number(newTestTotalMarks);
    if (!marksNum || marksNum <= 0) {
      toast.error("Please enter a valid total marks greater than 0");
      return;
    }

    const assignedSubjectToSave = newTestSubject || teacherSubjects[0] || 'General';
    if (!isFallbackTeacher && teacherSubjects.length > 0) {
      const isPermittedSubject = teacherSubjects.some(s => s.trim().toLowerCase() === assignedSubjectToSave.trim().toLowerCase());
      if (!isPermittedSubject) {
        toast.error(`You can only create tests for your assigned subjects: ${teacherSubjects.join(', ')}`);
        return;
      }
    }

    const testId = Date.now().toString();
    const createdTest: Test = {
      id: testId,
      name: newTestName.trim(),
      batchIds: newTestBatchIds,
      batchId: newTestBatchIds[0],
      subject: assignedSubjectToSave,
      totalMarks: marksNum,
      date: newTestDate || currentDateStr || getLocalDateString(),
      type: newTestType || 'subjective'
    };

    addTest(createdTest);
    setTests(prev => [createdTest, ...prev]);
    setIsCreateTestOpen(false);
    setNewTestName('');
    setNewTestBatchIds([]);
    setNewTestTotalMarks('50');
    setSelectedTest(createdTest);
    toast.success("Test created! You can now enter student marks below.");
  };

  // Delete Test
  const handleDeleteTest = (testId: string) => {
    if (window.confirm("Are you sure you want to delete this test and all its marks?")) {
      deleteTest(testId);
      setTests(prev => prev.filter(t => t.id !== testId));
      setTestResults(prev => prev.filter(r => r.testId !== testId));
      if (selectedTest?.id === testId) {
        setSelectedTest(null);
      }
      toast.success("Test deleted successfully");
    }
  };
  
  const myClasses = classes.filter(c => {
    if (isFallbackTeacher) return true;
    if (c.teacherId && c.teacherId === currentUser?.id) return true;
    if (teacherSubjects.some(subj => subj.toLowerCase() === c.subject.toLowerCase())) return true;
    return false;
  });

  const isClassPassed = (classItem: Class) => {
    if (!classItem.date || !classItem.endTime) return false;
    const classEndTime = new Date(`${classItem.date}T${classItem.endTime}`);
    return classEndTime < new Date();
  };

  // Helper to check if attendance was already taken for a specific class
  const isClassAttendanceMarked = (classItem: Class) => {
    const targetDate = classItem.date || currentDateStr || getLocalDateString();
    const batchStudents = students.filter(s => s.batchId === classItem.batchId);
    if (batchStudents.length === 0) return false;

    const attendance = getAttendance();
    return batchStudents.some(student =>
      attendance.some(record => record.studentId === student.id && record.date === targetDate && (record.classId === classItem.id || record.classId === 'daily'))
    );
  };

  useEffect(() => {
    if (selectedAttendanceBatch) {
      const targetDate = selectedClassForAttendance?.date || currentDateStr || getLocalDateString();
      const batchStudents = students.filter(s => s.batchId === selectedAttendanceBatch);
      const attendance = getAttendance();

      const existingAttendance: Record<string, boolean> = {};
      batchStudents.forEach(student => {
        const record = attendance.find(r => r.studentId === student.id && r.date === targetDate && (selectedClassForAttendance ? (r.classId === selectedClassForAttendance.id || r.classId === 'daily') : true));
        if (record && record.status === 'absent') {
          existingAttendance[student.id] = true;
        }
      });
      setDailyAttendance(existingAttendance);
    } else {
      setDailyAttendance({});
    }
  }, [selectedAttendanceBatch, selectedClassForAttendance, students, currentDateStr]);

  const handleSaveDailyAttendance = () => {
    if (!selectedAttendanceBatch) return;

    // Authorization check before saving attendance (Requirement 22 & 29)
    const isAuthorizedToSave =
      isFallbackTeacher ||
      !selectedClassForAttendance?.teacherId ||
      selectedClassForAttendance.teacherId === activeUser?.id ||
      (Array.isArray(selectedClassForAttendance.teacherIds) && selectedClassForAttendance.teacherIds.includes(activeUser?.id || ''));

    if (!isAuthorizedToSave) {
      toast.error("Unauthorized: You cannot save attendance for another teacher's lecture.");
      return;
    }

    const targetDate = selectedClassForAttendance?.date || currentDateStr || getLocalDateString();
    const timestamp = new Date().toLocaleTimeString();

    const batchStudents = students.filter(s => s.batchId === selectedAttendanceBatch);
    const targetClassId = selectedClassForAttendance?.id || 'daily';

    batchStudents.forEach((student) => {
      const isAbsent = dailyAttendance[student.id] || false;
      
      // Save for specific classId
      markAttendance({
        id: `${student.id}_${targetClassId}_${targetDate}`,
        studentId: student.id,
        classId: targetClassId,
        date: targetDate,
        status: isAbsent ? 'absent' : 'present',
        markedBy: `Teacher: ${currentUser?.name || 'Teacher'} at ${timestamp}`
      });

      // Also save daily for batch level sync
      if (targetClassId !== 'daily') {
        markAttendance({
          id: `${student.id}_${targetDate}`,
          studentId: student.id,
          classId: 'daily',
          date: targetDate,
          status: isAbsent ? 'absent' : 'present',
          markedBy: `Teacher: ${currentUser?.name || 'Teacher'} at ${timestamp}`
        });
      }
    });

    const batchName = batches.find(b => b.id === selectedAttendanceBatch)?.name;
    toast.success(`Attendance for ${batchName}${selectedClassForAttendance ? ` (${selectedClassForAttendance.name})` : ''} saved & synced with Admin!`);
    
    setSelectedAttendanceBatch(null);
    setSelectedClassForAttendance(null);
    setDailyAttendance({});
    loadData();
  };

  const handleOpenAttendanceForClass = (classItem: Class) => {
    setSelectedClassForAttendance(classItem);
    setSelectedAttendanceBatch(classItem.batchId);
    setActiveTab("attendance");
  };

  const handleOpenAttendanceForLecture = (payload: LectureAttendancePayload) => {
    // Authorization check (Requirement 28 & 29): check teacherId or teacherIds array
    const isAuthorized =
      isFallbackTeacher ||
      payload.teacherId === activeUser?.id ||
      (Array.isArray(payload.teacherIds) && payload.teacherIds.includes(activeUser?.id || ''));

    if (!isAuthorized) {
      toast.error("Unauthorized: You cannot take attendance for another teacher's lecture.");
      return;
    }

    const classItem: Class = {
      id: payload.timetableId,
      name: `${payload.subjectName} (${payload.roomName || 'Classroom'})`,
      subject: payload.subjectName,
      batchId: payload.batchId,
      teacherId: payload.teacherId,
      teacherIds: payload.teacherIds,
      teacherName: payload.teacherName,
      date: payload.date || currentDateStr || getLocalDateString(),
      time: payload.startTime,
      endTime: payload.endTime,
    };
    setSelectedClassForAttendance(classItem);
    setSelectedAttendanceBatch(payload.batchId);
    setActiveTab("attendance");
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || selectedNoteBatches.length === 0 || !noteSubject) {
      toast.error("Please fill in Title, Subject, and select at least one Batch");
      return;
    }

    const newNote: Note = {
      id: Date.now().toString(),
      title: noteTitle,
      content: noteContent,
      fileUrl: noteLink,
      batchId: selectedNoteBatches[0],
      batchIds: selectedNoteBatches,
      subject: noteSubject,
      createdAt: new Date().toISOString(),
    };

    addNote(newNote);
    toast.success("Note uploaded successfully for assigned batches!");
    setNoteTitle('');
    setNoteContent('');
    setNoteLink('');
    setSelectedNoteBatches([]);
    setNoteSubject('');
    setIsAddNoteOpen(false);
    loadData();
  };

  const handleDeleteNote = (noteId: string) => {
    if (deleteNote(noteId)) {
      toast.success("Note deleted");
      loadData();
    }
  };

  const isBatchMarkedToday = (batchId: string) => {
    const today = currentDateStr || getLocalDateString();
    const batchStudents = students.filter(s => s.batchId === batchId);
    if (batchStudents.length === 0) return false;

    const attendance = getAttendance();
    return batchStudents.some(student =>
      attendance.some(record => record.studentId === student.id && record.date === today)
    );
  };

  const format12h = (t24: string) => {
    if (!t24) return '';
    const [h, m] = t24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const renderTimetable = () => (
    <Card className="p-6">
      <TeacherTimetableSection
        currentTeacherId={activeUser?.id || ''}
        isMasterUser={isFallbackTeacher}
        allLectures={timetableLectures}
        allAttendance={getAttendance()}
        allStudents={students}
        onOpenAttendance={handleOpenAttendanceForLecture}
      />
    </Card>
  );

  const renderClasses = () => {
    const sortedClasses = [...myClasses].sort(
      (a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime()
    );

    const upcomingClasses = sortedClasses.filter(c => !isClassPassed(c));
    const pastClasses = sortedClasses.filter(c => isClassPassed(c));

    return (
      <div className="space-y-6">
        <Card className="p-6">
          <TeacherTimetableSection
            currentTeacherId={activeUser?.id || ''}
            isMasterUser={isFallbackTeacher}
            allLectures={timetableLectures}
            allAttendance={getAttendance()}
            allStudents={students}
            onOpenAttendance={handleOpenAttendanceForLecture}
          />
        </Card>

        {/* Existing Class Sessions Section */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-b pb-4">
            <div>
              <h3 className="text-xl font-black text-foreground">Specific Dated Class Sessions</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Individual class sessions scheduled outside recurring weekly timetable.
              </p>
            </div>
          </div>

        {myClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
            <h4 className="text-lg font-bold mb-2">No Classes Found</h4>
            <p className="text-sm text-muted-foreground max-w-md">
              No upcoming or scheduled classes found for your assigned subjects or teacher profile.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Upcoming Classes Section */}
            {upcomingClasses.length > 0 && (
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-primary mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Upcoming Lectures ({upcomingClasses.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingClasses.map(classItem => {
                    const batch = batches.find(b => b.id === classItem.batchId);
                    const attendanceMarked = isClassAttendanceMarked(classItem);
                    return (
                      <div
                        key={classItem.id}
                        onClick={() => handleOpenAttendanceForClass(classItem)}
                        className="p-5 rounded-2xl border-2 border-primary/30 bg-card hover:border-primary hover:shadow-lg transition-all relative overflow-hidden cursor-pointer group"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-0.5 rounded-full inline-block">
                                Upcoming
                              </span>
                              {attendanceMarked && (
                                <span className="text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Marked
                                </span>
                              )}
                            </div>
                            <h4 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">{classItem.name}</h4>
                            <p className="text-sm text-primary font-medium">{classItem.subject}</p>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs text-muted-foreground border-t pt-3 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">Batch:</span>
                            <span className="font-bold text-primary">{batch?.name || "All Batches"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">Date & Time:</span>
                            <span>{classItem.date} ({format12h(classItem.time)} - {format12h(classItem.endTime)})</span>
                          </div>
                        </div>

                        <Button 
                          size="sm"
                          className="w-full mt-4 rounded-xl font-bold gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAttendanceForClass(classItem);
                          }}
                        >
                          <UserCheck className="h-4 w-4" />
                          {attendanceMarked ? "Update Class Attendance" : "Take Class Attendance"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Past/Done Classes Section (Un-highlighted) */}
            {pastClasses.length > 0 && (
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Past / Finished Lectures ({pastClasses.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pastClasses.map(classItem => {
                    const batch = batches.find(b => b.id === classItem.batchId);
                    const attendanceMarked = isClassAttendanceMarked(classItem);
                    return (
                      <div
                        key={classItem.id}
                        onClick={() => handleOpenAttendanceForClass(classItem)}
                        className="p-4 rounded-2xl border border-border/40 bg-muted/20 opacity-60 transition-opacity hover:opacity-100 cursor-pointer"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-medium uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-full inline-block">
                                Finished
                              </span>
                              {attendanceMarked && (
                                <span className="text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Marked
                                </span>
                              )}
                            </div>
                            <h4 className="text-lg font-semibold text-muted-foreground">{classItem.name}</h4>
                            <p className="text-xs text-muted-foreground">{classItem.subject}</p>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1 border-t border-border/20 pt-2 mt-2">
                          <p><span className="font-medium">Batch:</span> {batch?.name || "N/A"}</p>
                          <p><span className="font-medium">Time:</span> {classItem.date} ({format12h(classItem.time)} - {format12h(classItem.endTime)})</p>
                        </div>

                        <Button 
                          size="sm"
                          variant="outline"
                          className="w-full mt-3 rounded-xl font-bold gap-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAttendanceForClass(classItem);
                          }}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          {attendanceMarked ? "View/Edit Attendance" : "Take Attendance"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        </Card>
      </div>
    );
  };

  const renderAttendance = () => (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b pb-6">
        <div>
          <h3 className="text-2xl font-black text-primary">
            {selectedClassForAttendance ? `${selectedClassForAttendance.name} Attendance` : 'Daily Batch Attendance'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedClassForAttendance
              ? `Subject: ${selectedClassForAttendance.subject} • Date: ${selectedClassForAttendance.date || currentDateStr}`
              : 'Take student attendance batch-wise (syncs directly to Admin reports)'}
          </p>
        </div>
      </div>

      {!selectedAttendanceBatch ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {batches.map(batch => {
            const batchStudents = students.filter(s => s.batchId === batch.id);
            const marked = isBatchMarkedToday(batch.id);
            return (
              <div
                key={batch.id}
                onClick={() => {
                  setSelectedClassForAttendance(null);
                  setSelectedAttendanceBatch(batch.id);
                }}
                className={`group p-6 rounded-[32px] border-2 transition-all cursor-pointer relative overflow-hidden ${
                  marked
                    ? 'border-green-500/20 bg-green-50/30'
                    : 'border-primary/5 bg-card hover:border-primary/20 hover:shadow-xl'
                }`}
              >
                <div className={`absolute top-0 right-0 p-4 rounded-bl-[32px] transition-colors ${marked ? 'bg-green-500/10' : 'bg-primary/5 group-hover:bg-primary/10'}`}>
                  <ClipboardCheck className={`h-6 w-6 ${marked ? 'text-green-600' : 'text-primary'}`} />
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="text-2xl font-black mb-1">{batch.name}</h4>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground font-medium">Academic Year {batch.year}</p>
                    {marked && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider animate-in fade-in zoom-in">
                        Completed Today
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${marked ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'}`}>
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
            <Button variant="ghost" onClick={() => { setSelectedAttendanceBatch(null); setSelectedClassForAttendance(null); }} className="gap-2 font-bold p-0">
              <Plus className="h-4 w-4 rotate-45" /> Back
            </Button>
            <div className="text-right">
              <h4 className="text-xl font-black">
                {batches.find(b => b.id === selectedAttendanceBatch)?.name}
                {selectedClassForAttendance ? ` — ${selectedClassForAttendance.name}` : ''}
              </h4>
              <p className="text-xs text-muted-foreground">
                Date: {selectedClassForAttendance?.date || new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            {students.filter(s => s.batchId === selectedAttendanceBatch).map(student => (
              <div key={student.id} className="flex items-center justify-between p-4 bg-accent/5 rounded-2xl border border-primary/5">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-black text-base ${dailyAttendance[student.id] ? 'bg-destructive text-destructive-foreground' : 'bg-primary/10 text-primary'}`}>
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{student.name}</p>
                    <p className="text-[10px] text-muted-foreground">{dailyAttendance[student.id] ? 'Marked Absent' : 'Present'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <span className="text-xs font-bold text-muted-foreground group-hover:text-destructive transition-colors">ABSENT</span>
                    <div
                      onClick={() => setDailyAttendance({...dailyAttendance, [student.id]: !dailyAttendance[student.id]})}
                      className={`w-12 h-6 rounded-full transition-all duration-300 relative ${dailyAttendance[student.id] ? 'bg-destructive' : 'bg-muted'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${dailyAttendance[student.id] ? 'left-7' : 'left-1'}`} />
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <Button onClick={handleSaveDailyAttendance} className="w-full h-12 rounded-xl font-black bg-primary shadow-lg">
            Save Class Attendance & Sync to Admin
          </Button>
        </div>
      )}
    </Card>
  );

  const renderNotes = () => (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b pb-6">
        <div>
          <h3 className="text-2xl font-black text-primary">Batch Notes & Material</h3>
          <p className="text-sm text-muted-foreground mt-1">Upload and assign notes to multiple batches</p>
        </div>
        <Dialog open={isAddNoteOpen} onOpenChange={setIsAddNoteOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 px-6 rounded-2xl font-bold gap-2 shadow-lg shadow-primary/20">
              <Plus className="h-5 w-5" /> Upload Note
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black">Upload Batch Note</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveNote} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="note-title" className="font-bold">Note Title</Label>
                <Input
                  id="note-title"
                  placeholder="e.g. Chapter 1 Formula Sheet"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  required
                  className="h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-bold">Target Batches (Multiple)</Label>
                <p className="text-xs text-muted-foreground mb-2">Select all batches that should receive this note</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border rounded-xl">
                  {batches.map(batch => (
                    <label
                      key={batch.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedNoteBatches.includes(batch.id) ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/30'
                      }`}
                    >
                      <Checkbox
                        checked={selectedNoteBatches.includes(batch.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedNoteBatches(prev => [...prev, batch.id]);
                          } else {
                            setSelectedNoteBatches(prev => prev.filter(id => id !== batch.id));
                          }
                        }}
                      />
                      <div>
                        <span className="font-bold text-sm">{batch.name}</span>
                        <p className="text-[10px] text-muted-foreground">Year {batch.year}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note-subject" className="font-bold">Subject</Label>
                <Input
                  id="note-subject"
                  placeholder="e.g. Physics"
                  value={noteSubject}
                  onChange={(e) => setNoteSubject(e.target.value)}
                  required
                  className="h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="note-content" className="font-bold">Description / Content</Label>
                <Input
                  id="note-content"
                  placeholder="Summary or details about this note"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="note-link" className="font-bold">File URL / Drive Link (Optional)</Label>
                <Input
                  id="note-link"
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={noteLink}
                  onChange={(e) => setNoteLink(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>

              <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 mt-4">
                Save Note
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {notes.map(note => {
          const noteBatchIds = note.batchIds && note.batchIds.length > 0 ? note.batchIds : (note.batchId ? [note.batchId] : []);
          return (
            <div key={note.id} className="p-5 rounded-2xl border bg-card hover:shadow-lg transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="flex flex-wrap gap-1">
                    {noteBatchIds.map(bId => {
                      const b = batches.find(x => x.id === bId);
                      return b ? (
                        <span key={bId} className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                          {b.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteNote(note.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <h4 className="text-lg font-bold text-foreground mb-1">{note.title}</h4>
                <p className="text-xs text-muted-foreground font-medium mb-3">{note.subject}</p>
                {note.content && <p className="text-sm text-foreground/80 mb-4">{note.content}</p>}
              </div>

              {note.fileUrl && (
                <a
                  href={note.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 py-2.5 rounded-xl border border-primary/20 transition-colors mt-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View Note Attachment
                </a>
              )}
            </div>
          );
        })}
        {notes.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-bold">No notes uploaded yet</p>
            <p className="text-sm">Click "Upload Note" to share study materials batch-wise.</p>
          </div>
        )}
      </div>
    </Card>
  );

  const handleSendRemarkWhatsApp = (student: Student | undefined, remark: StudentRemark) => {
    if (!student) {
      toast.error("Student profile not found");
      return;
    }
    const rawPhone = student.parentWhatsApp || student.whatsappNo || student.phoneNo || "";
    const cleanPhone = rawPhone.replace(/[^0-9]/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error(`No valid parent contact number found for ${student.name}`);
      return;
    }
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const batchName = batches.find(b => b.id === student.batchId)?.name || 'Sankalp Academy';
    const dateStr = new Date(remark.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const typeEmoji = remark.type === 'appreciation' ? '⭐ *ACADEMIC APPRECIATION*' : '⚠️ *STUDENT OBSERVATION / NOTICE*';
    
    const messageText = 
      `🎓 *SANKALP ACADEMY - PARENT NOTIFICATION*\n\n` +
      `Dear Parent,\n` +
      `Here is an official feedback update regarding your ward *${student.name}* (${student.studentClass || 'Student'}, ${batchName}):\n\n` +
      `${typeEmoji}\n` +
      `📌 *Subject:* ${remark.subject || 'General'}\n` +
      `📝 *Title:* ${remark.title}\n` +
      `💬 *Feedback:* ${remark.description}\n` +
      `📅 *Date:* ${dateStr}\n` +
      `👨‍🏫 *Faculty:* ${remark.authorName || currentUser?.name || 'Teacher'} (${remark.authorRole || 'Faculty'})\n\n` +
      `Warm regards,\n*Sankalp Academy*`;

    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(messageText)}`, '_blank');
    toast.success(`Opening WhatsApp for ${student.name}'s parents...`);
  };

  const handleSaveRemark = async (e?: React.FormEvent, shouldSendWhatsApp = false) => {
    if (e) e.preventDefault();
    if (!selectedStudentForRemark) {
      toast.error("Please select a student first");
      return;
    }
    if (!remarkTitle.trim() || !remarkDescription.trim()) {
      toast.error("Please provide both a title and description");
      return;
    }

    setIsSubmittingRemark(true);
    try {
      const studentBatch = batches.find(b => b.id === selectedStudentForRemark.batchId);
      const newRemark: StudentRemark = {
        id: Date.now().toString(),
        studentId: selectedStudentForRemark.id,
        studentName: selectedStudentForRemark.name,
        batchId: selectedStudentForRemark.batchId,
        batchName: studentBatch?.name || 'Unknown Batch',
        type: remarkType,
        title: remarkTitle.trim(),
        description: remarkDescription.trim(),
        subject: remarkSubject.trim() || teacherSubjects[0] || 'General',
        authorId: currentUser?.id || 'teacher',
        authorName: currentUser?.name || 'Teacher',
        authorRole: 'teacher',
        createdAt: new Date().toISOString(),
      };

      await addStudentRemark(newRemark);
      toast.success(
        remarkType === 'appreciation' 
          ? `⭐ Appreciation added for ${selectedStudentForRemark.name}!` 
          : `⚠️ Observation recorded for ${selectedStudentForRemark.name}!`
      );

      const targetStudent = selectedStudentForRemark;
      setIsRemarkModalOpen(false);
      setRemarkTitle('');
      setRemarkDescription('');
      setRemarkSubject('');
      loadData();

      if (shouldSendWhatsApp || sendToParentsWhatsApp) {
        setTimeout(() => {
          handleSendRemarkWhatsApp(targetStudent, newRemark);
        }, 300);
      }
    } catch (err: any) {
      console.error("Failed to add remark:", err);
      toast.error("Failed to save remark: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmittingRemark(false);
    }
  };

  const handleDeleteRemark = async (remarkId: string) => {
    if (await deleteStudentRemark(remarkId)) {
      toast.success("Remark deleted");
      loadData();
    } else {
      toast.error("Failed to delete remark");
    }
  };

  const openAddRemarkForStudent = (student: Student, defaultType: RemarkType = 'appreciation') => {
    setSelectedStudentForRemark(student);
    setRemarkType(defaultType);
    setRemarkTitle('');
    setRemarkDescription('');
    setRemarkSubject(teacherSubjects[0] || 'General');
    setSendToParentsWhatsApp(false);
    setIsRemarkModalOpen(true);
  };

  const openHistoryForStudent = (student: Student) => {
    setSelectedStudentForRemark(student);
    setIsViewHistoryModalOpen(true);
  };

  const filteredStudents = students.filter(s => {
    if (remarkBatchFilter !== 'all' && s.batchId !== remarkBatchFilter) return false;
    const q = studentSearch.toLowerCase().trim();
    if (!q) return true;
    const batch = batches.find(b => b.id === s.batchId);
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.phoneNo && s.phoneNo.includes(q)) ||
      (s.parentWhatsApp && s.parentWhatsApp.includes(q)) ||
      (s.studentClass && s.studentClass.toLowerCase().includes(q)) ||
      (batch && batch.name.toLowerCase().includes(q))
    );
  });

  const selectedStudentRemarks = selectedStudentForRemark 
    ? remarks.filter(r => r.studentId === selectedStudentForRemark.id)
    : [];

  const teacherRemarksGiven = remarks.filter(r => 
    r.authorId === currentUser?.id || isFallbackTeacher
  );

  const totalAppreciations = teacherRemarksGiven.filter(r => r.type === 'appreciation').length;
  const totalComplaints = teacherRemarksGiven.filter(r => r.type === 'complaint').length;

  const renderRemarks = () => (
    <div className="space-y-6">
      {/* Top Header & Stats */}
      <Card className="p-4 sm:p-6 rounded-3xl border border-border/60 shadow-sm bg-card/80 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-b pb-5">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" /> Student Remarks & Parent Updates
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Select any student to add instant appreciations or observations in a popup, and optionally notify parents on WhatsApp.
            </p>
          </div>
        </div>

        {/* Quick KPI Stats */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-6">
          <div className="p-3 sm:p-4 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col items-center sm:items-start text-center sm:text-left">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Remarks</span>
            <span className="text-xl sm:text-3xl font-black text-primary mt-0.5">{teacherRemarksGiven.length}</span>
          </div>
          <div className="p-3 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center sm:items-start text-center sm:text-left">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">⭐ Appreciations</span>
            <span className="text-xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{totalAppreciations}</span>
          </div>
          <div className="p-3 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col items-center sm:items-start text-center sm:text-left">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">⚠️ Complaints</span>
            <span className="text-xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{totalComplaints}</span>
          </div>
        </div>

        {/* Search & Batch Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search student name, roll, phone, or class..."
              className="h-11 pl-10 rounded-2xl border border-input text-sm"
            />
          </div>

          <div className="w-full sm:w-56">
            <Select value={remarkBatchFilter} onValueChange={setRemarkBatchFilter}>
              <SelectTrigger className="h-11 rounded-2xl">
                <SelectValue placeholder="All Batches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">👥 All Batches ({students.length})</SelectItem>
                {batches.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({students.filter(s => s.batchId === b.id).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Student Cards Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
            <span>Student Directory ({filteredStudents.length})</span>
            <span>Tap to Add Remark</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[440px] overflow-y-auto p-1">
            {filteredStudents.map(student => {
              const batch = batches.find(b => b.id === student.batchId);
              const studentAppreciations = remarks.filter(r => r.studentId === student.id && r.type === 'appreciation').length;
              const studentComplaints = remarks.filter(r => r.studentId === student.id && r.type === 'complaint').length;
              const totalStudentRemarks = studentAppreciations + studentComplaints;
              const parentContact = student.parentWhatsApp || student.whatsappNo || student.phoneNo || "";

              return (
                <div
                  key={student.id}
                  className="p-3.5 rounded-2xl border border-border/70 hover:border-primary/50 bg-card/90 shadow-sm transition-all flex flex-col justify-between gap-3 group"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center font-extrabold text-sm shrink-0 border border-primary/20 shadow-inner">
                        {student.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground truncate leading-tight">{student.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{batch?.name || 'No Batch'} • {student.studentClass || 'Class'}</p>
                        {parentContact && (
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5 truncate">
                            <Smartphone className="h-2.5 w-2.5 shrink-0" />
                            <span>{parentContact}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 text-[10px] font-bold">
                      {studentAppreciations > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          ⭐ {studentAppreciations}
                        </span>
                      )}
                      {studentComplaints > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          ⚠️ {studentComplaints}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions on Student Card */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <Button
                      size="sm"
                      onClick={() => openAddRemarkForStudent(student, 'appreciation')}
                      className="flex-1 h-9 rounded-xl text-xs font-bold gap-1.5 shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Remark</span>
                    </Button>

                    {totalStudentRemarks > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openHistoryForStudent(student)}
                        className="h-9 px-3 rounded-xl text-xs font-semibold gap-1 border-border/80"
                        title="View Past Remarks"
                      >
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{totalStudentRemarks}</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredStudents.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
                No students match your filter criteria "{studentSearch}"
              </div>
            )}
          </div>
        </div>

        {/* Global Recent Remarks History Feed */}
        <div className="mt-10 pt-8 border-t space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-base sm:text-lg font-black text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Your Remarks History ({teacherRemarksGiven.length})
              </h4>
              <p className="text-xs text-muted-foreground">All feedback notes recorded by you across all batches</p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(['all', 'appreciation', 'complaint'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setRemarkFilter(type)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold capitalize transition-all ${
                    remarkFilter === type 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {type === 'all' ? 'All' : type === 'appreciation' ? '⭐ Appreciations' : '⚠️ Complaints'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {teacherRemarksGiven
              .filter(r => remarkFilter === 'all' || r.type === remarkFilter)
              .map(r => {
                const targetStudent = students.find(s => s.id === r.studentId);
                const hasParentPhone = Boolean(targetStudent?.parentWhatsApp || targetStudent?.whatsappNo || targetStudent?.phoneNo);

                return (
                  <div
                    key={r.id}
                    className={`p-4 rounded-2xl border-2 bg-card flex flex-col justify-between gap-3 shadow-sm ${
                      r.type === 'appreciation' ? 'border-emerald-500/25 bg-emerald-500/[0.02]' : 'border-amber-500/25 bg-amber-500/[0.02]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          r.type === 'appreciation' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {r.type === 'appreciation' ? '⭐ Appreciation' : '⚠️ Complaint'}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          {r.subject && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted font-bold text-muted-foreground">
                              {r.subject}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRemark(r.id)}
                            className="h-7 w-7 text-destructive/70 hover:text-destructive rounded-lg"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <p className="font-bold text-base text-foreground leading-tight">{r.studentName || 'Student'}</p>
                      <p className="text-xs text-primary font-bold mt-0.5 mb-1.5">{r.title}</p>
                      <p className="text-xs text-foreground/80 line-clamp-3 leading-relaxed whitespace-pre-wrap">{r.description}</p>
                    </div>

                    <div className="pt-2.5 border-t border-border/50 flex items-center justify-between gap-2">
                      <div className="text-[10px] text-muted-foreground">
                        <p className="font-semibold text-foreground/70">{r.batchName || 'Batch'}</p>
                        <p>{new Date(r.createdAt).toLocaleDateString()}</p>
                      </div>

                      {/* Send to Parents WhatsApp Button with proper mobile wrapping */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendRemarkWhatsApp(targetStudent, r)}
                        className="h-8 px-2.5 rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-bold gap-1.5 shrink-0 max-w-[150px] truncate"
                        title="Send this remark to parents via WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">Send to Parents</span>
                      </Button>
                    </div>
                  </div>
                );
              })}

            {teacherRemarksGiven.length === 0 && (
              <div className="col-span-full py-10 text-center text-muted-foreground text-sm">
                You have not recorded any student remarks yet.
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* POPUP MODAL 1: Add Remark Dialog Form */}
      <Dialog open={isRemarkModalOpen} onOpenChange={setIsRemarkModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-3xl">
          {selectedStudentForRemark && (
            <div className="space-y-5">
              <DialogHeader className="text-left space-y-2 border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-base shrink-0 border border-primary/20">
                    {selectedStudentForRemark.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-primary">Student Remark Form</span>
                    <DialogTitle className="text-xl sm:text-2xl font-black text-foreground truncate">
                      {selectedStudentForRemark.name}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground truncate">
                      {batches.find(b => b.id === selectedStudentForRemark.batchId)?.name || 'Batch'} • {selectedStudentForRemark.studentClass || 'Class'}
                    </p>
                  </div>
                </div>

                {/* Parent Contact Info Banner */}
                <div className="p-2.5 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 truncate">
                    <Smartphone className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">Parent: <strong>{selectedStudentForRemark.parentWhatsApp || selectedStudentForRemark.whatsappNo || selectedStudentForRemark.phoneNo || 'Not added'}</strong></span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-background text-foreground shrink-0">
                    WA Ready
                  </span>
                </div>
              </DialogHeader>

              <form onSubmit={(e) => handleSaveRemark(e, false)} className="space-y-4">
                {/* Remark Type Switcher */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Remark Type *</Label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRemarkType('appreciation')}
                      className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 transition-all font-bold text-xs sm:text-sm ${
                        remarkType === 'appreciation'
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-sm ring-2 ring-emerald-500/20'
                          : 'border-muted hover:border-emerald-500/40 bg-card text-muted-foreground'
                      }`}
                    >
                      <Award className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="truncate">⭐ Praise / Star</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemarkType('complaint')}
                      className={`p-3 rounded-2xl border-2 flex items-center justify-center gap-2 transition-all font-bold text-xs sm:text-sm ${
                        remarkType === 'complaint'
                          ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-sm ring-2 ring-amber-500/20'
                          : 'border-muted hover:border-amber-500/40 bg-card text-muted-foreground'
                      }`}
                    >
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span className="truncate">⚠️ Observation</span>
                    </button>
                  </div>
                </div>

                {/* Quick Preset Tags */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Quick Suggestions</Label>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {(remarkType === 'appreciation' ? [
                      "Outstanding Performance",
                      "Active Class Participation",
                      "Excellent Homework Submission",
                      "High Test Score",
                      "Disciplined & Attentive",
                      "Helpful to Classmates",
                    ] : [
                      "Incomplete Homework",
                      "Late Arrival to Class",
                      "Disruptive Behavior",
                      "Low Test Score - Needs Revision",
                      "Missing Study Notes",
                      "Irregular Attendance",
                    ]).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setRemarkTitle(tag)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                          remarkTitle === tag
                            ? (remarkType === 'appreciation' ? 'bg-emerald-600 text-white font-bold border-emerald-600' : 'bg-amber-600 text-white font-bold border-amber-600')
                            : 'bg-card hover:bg-muted text-foreground border-border/80'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject & Title */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="popup-remark-title" className="text-xs font-bold">Remark Title *</Label>
                    <Input
                      id="popup-remark-title"
                      value={remarkTitle}
                      onChange={(e) => setRemarkTitle(e.target.value)}
                      placeholder={remarkType === 'appreciation' ? "e.g., Exceptional test score in Physics" : "e.g., Homework incomplete"}
                      required
                      className="h-11 rounded-xl text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="popup-remark-subject" className="text-xs font-bold">Subject / Category</Label>
                    <Input
                      id="popup-remark-subject"
                      value={remarkSubject}
                      onChange={(e) => setRemarkSubject(e.target.value)}
                      placeholder="e.g. Physics"
                      className="h-11 rounded-xl text-sm"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="popup-remark-desc" className="text-xs font-bold">Detailed Feedback Notes *</Label>
                  <textarea
                    id="popup-remark-desc"
                    rows={3}
                    value={remarkDescription}
                    onChange={(e) => setRemarkDescription(e.target.value)}
                    placeholder={remarkType === 'appreciation' 
                      ? "Describe achievements, positive participation, or effort..." 
                      : "Describe observation or areas needing immediate improvement..."}
                    required
                    className="w-full p-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary leading-relaxed"
                  />
                </div>

                {/* WhatsApp Direct Option Checkbox */}
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
                  <Checkbox
                    id="popup-send-whatsapp"
                    checked={sendToParentsWhatsApp}
                    onCheckedChange={(checked) => setSendToParentsWhatsApp(Boolean(checked))}
                    className="mt-0.5"
                  />
                  <label htmlFor="popup-send-whatsapp" className="text-xs text-foreground cursor-pointer leading-tight">
                    <strong className="block text-emerald-700 dark:text-emerald-400 font-bold">Notify Parents on WhatsApp</strong>
                    <span className="text-muted-foreground text-[11px]">Opens WhatsApp with a formatted message for parents right after saving.</span>
                  </label>
                </div>

                {/* Action Buttons: Responsive and Non-Overflowing */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsRemarkModalOpen(false)}
                    className="w-full sm:w-auto h-11 px-4 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    disabled={isSubmittingRemark}
                    className={`flex-1 w-full h-11 rounded-xl font-bold text-xs sm:text-sm gap-2 shadow-sm ${
                      remarkType === 'appreciation' 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                  >
                    <Send className="h-4 w-4 shrink-0" />
                    <span>{isSubmittingRemark ? "Saving..." : "Save Remark"}</span>
                  </Button>

                  <Button
                    type="button"
                    disabled={isSubmittingRemark}
                    onClick={() => handleSaveRemark(undefined, true)}
                    className="flex-1 w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <MessageCircle className="h-4 w-4 shrink-0" />
                    <span className="truncate">Save & Send to Parents</span>
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* POPUP MODAL 2: Student Past Remarks History Modal */}
      <Dialog open={isViewHistoryModalOpen} onOpenChange={setIsViewHistoryModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-3xl">
          {selectedStudentForRemark && (
            <div className="space-y-4">
              <DialogHeader className="text-left border-b pb-3">
                <DialogTitle className="text-xl font-black text-foreground flex items-center justify-between">
                  <span>Remarks History for {selectedStudentForRemark.name}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                    {selectedStudentRemarks.length}
                  </span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {batches.find(b => b.id === selectedStudentForRemark.batchId)?.name || 'Batch'} • {selectedStudentForRemark.studentClass || 'Class'}
                </p>
              </DialogHeader>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {selectedStudentRemarks.map(r => (
                  <div
                    key={r.id}
                    className={`p-3.5 rounded-2xl border-2 bg-card space-y-2 ${
                      r.type === 'appreciation' ? 'border-emerald-500/25 bg-emerald-500/[0.02]' : 'border-amber-500/25 bg-amber-500/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        r.type === 'appreciation' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {r.type === 'appreciation' ? '⭐ Appreciation' : '⚠️ Complaint'}
                      </span>
                      
                      <div className="flex items-center gap-1">
                        {r.subject && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted font-bold text-muted-foreground">
                            {r.subject}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRemark(r.id)}
                          className="h-6 w-6 text-destructive/70 hover:text-destructive rounded-lg"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <p className="font-bold text-sm text-foreground">{r.title}</p>
                    <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{r.description}</p>

                    <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                      <span>{new Date(r.createdAt).toLocaleDateString()} by {r.authorName}</span>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendRemarkWhatsApp(selectedStudentForRemark, r)}
                        className="h-7 px-2.5 rounded-lg border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[11px] font-bold gap-1 shrink-0"
                      >
                        <MessageCircle className="h-3 w-3 text-emerald-500" />
                        <span>Send to Parents</span>
                      </Button>
                    </div>
                  </div>
                ))}

                {selectedStudentRemarks.length === 0 && (
                  <p className="text-xs text-muted-foreground italic py-8 text-center">
                    No remarks recorded yet for {selectedStudentForRemark.name}.
                  </p>
                )}
              </div>

              <div className="pt-2 border-t flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setIsViewHistoryModalOpen(false);
                    openAddRemarkForStudent(selectedStudentForRemark);
                  }}
                  className="rounded-xl text-xs font-bold gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add New Remark</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  // ==========================================
  // TESTS & MARKS UI FOR TEACHERS APP
  // ==========================================
  const renderMarks = () => {
    // Current test's batches and students
    const selectedTestBatchIds = selectedTest
      ? (selectedTest.batchIds && selectedTest.batchIds.length > 0 ? selectedTest.batchIds : (selectedTest.batchId ? [selectedTest.batchId] : []))
      : [];

    const selectedTestBatches = batches.filter(b => selectedTestBatchIds.includes(b.id));

    const testStudents = selectedTest
      ? students.filter(s => selectedTestBatchIds.includes(s.batchId))
      : [];

    // Filter tests in test list
    const filteredTests = teacherTests.filter(t => {
      if (testSubjectFilter !== 'all' && (t.subject || 'General').toLowerCase() !== testSubjectFilter.toLowerCase()) {
        return false;
      }
      if (testBatchFilter !== 'all') {
        const bIds = t.batchIds && t.batchIds.length > 0 ? t.batchIds : (t.batchId ? [t.batchId] : []);
        if (!bIds.includes(testBatchFilter)) return false;
      }
      if (testSearch.trim()) {
        const query = testSearch.trim().toLowerCase();
        const nameMatch = t.name.toLowerCase().includes(query);
        const subjMatch = (t.subject || '').toLowerCase().includes(query);
        if (!nameMatch && !subjMatch) return false;
      }
      return true;
    });

    // Test statistics
    const allTeacherTestResults = testResults.filter(r => teacherTests.some(t => t.id === r.testId));
    const totalTeacherGraded = allTeacherTestResults.filter(r => !r.isAbsent).length;

    // Selected test stats
    const selectedResults = selectedTest
      ? testResults.filter(r => r.testId === selectedTest.id)
      : [];
    const gradedCount = selectedResults.filter(r => !r.isAbsent && testStudents.some(s => s.id === r.studentId)).length;
    const absentCount = selectedResults.filter(r => r.isAbsent && testStudents.some(s => s.id === r.studentId)).length;
    const pendingCount = Math.max(0, testStudents.length - (gradedCount + absentCount));

    const validScores = selectedResults
      .filter(r => !r.isAbsent && testStudents.some(s => s.id === r.studentId))
      .map(r => r.marksObtained);
    const averageScore = validScores.length > 0
      ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
      : null;
    const highestScore = validScores.length > 0 ? Math.max(...validScores) : null;

    // Filter students inside selected test view
    const filteredStudents = testStudents.filter(s => {
      if (studentMarksSearch.trim()) {
        const q = studentMarksSearch.trim().toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesPhone = (s.phoneNo || s.whatsappNo || '').includes(q);
        if (!matchesName && !matchesPhone) return false;
      }

      const res = selectedResults.find(r => r.studentId === s.id);
      const isGraded = res && !res.isAbsent;
      const isAbsent = res && res.isAbsent;

      if (studentMarksFilter === 'graded' && !isGraded) return false;
      if (studentMarksFilter === 'absent' && !isAbsent) return false;
      if (studentMarksFilter === 'pending' && (isGraded || isAbsent)) return false;

      return true;
    });

    return (
      <div className="space-y-6">
        {/* VIEW 1: DEDICATED STUDENT MARKS ENTRY VIEW FOR SELECTED TEST */}
        {selectedTest ? (
          <div className="space-y-6">
            {/* Top Bar / Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-card border border-border shadow-sm">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTest(null)}
                  className="h-10 px-3.5 rounded-xl font-bold gap-2 text-primary hover:bg-primary/10 border-primary/20"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Tests</span>
                </Button>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
                    {selectedTest.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground font-medium">
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold">
                      {selectedTest.subject || 'General'}
                    </span>
                    <span>•</span>
                    <span>Max Marks: <strong className="text-foreground font-bold">{selectedTest.totalMarks}</strong></span>
                    <span>•</span>
                    <span>Date: <strong>{selectedTest.date}</strong></span>
                    <span>•</span>
                    <span>
                      Batches: {selectedTestBatches.map(b => b.name).join(', ') || 'All Assigned'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    testStudents.forEach(st => {
                      const resId = `${st.id}_${selectedTest.id}`;
                      const existing = testResults.find(r => r.id === resId);
                      if (existing?.isAbsent) {
                        toggleAbsent(st.id);
                      }
                    });
                    toast.success("All students set to present");
                  }}
                  className="rounded-xl font-bold text-xs h-9"
                >
                  <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Mark All Present
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    Object.entries(localMarks).forEach(([studentId, val]) => {
                      if (val !== '') {
                        handleSaveMarks(studentId, val);
                      }
                    });
                    toast.success("All marks saved successfully");
                  }}
                  className="rounded-xl font-bold text-xs h-9 shadow-md shadow-primary/20 gap-1.5"
                >
                  <CheckSquare className="h-3.5 w-3.5" /> Save All Marks
                </Button>
              </div>
            </div>

            {/* Test Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-2xl bg-card border border-border/60 shadow-2xs">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Students</p>
                <p className="text-2xl font-black text-foreground mt-0.5">{testStudents.length}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-2xs">
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Graded</p>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">{gradedCount}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-2xs">
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Pending</p>
                <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-0.5">{pendingCount}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-2xs">
                <p className="text-[11px] font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">Absent</p>
                <p className="text-2xl font-black text-red-700 dark:text-red-300 mt-0.5">{absentCount}</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 shadow-2xs">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Average Score</p>
                <p className="text-2xl font-black text-primary mt-0.5">
                  {averageScore !== null ? `${averageScore}/${selectedTest.totalMarks}` : '—'}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 shadow-2xs">
                <p className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Highest Mark</p>
                <p className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-0.5">
                  {highestScore !== null ? `${highestScore}/${selectedTest.totalMarks}` : '—'}
                </p>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted/30 border border-border/50">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search student by name, phone or roll..."
                  value={studentMarksSearch}
                  onChange={(e) => setStudentMarksSearch(e.target.value)}
                  className="pl-10 h-10 rounded-xl bg-background border-border/60 text-sm"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {(['all', 'graded', 'pending', 'absent'] as const).map((filterOpt) => {
                  const isActive = studentMarksFilter === filterOpt;
                  const label = filterOpt === 'all'
                    ? `All (${testStudents.length})`
                    : filterOpt === 'graded'
                    ? `Graded (${gradedCount})`
                    : filterOpt === 'pending'
                    ? `Pending (${pendingCount})`
                    : `Absent (${absentCount})`;

                  return (
                    <button
                      key={filterOpt}
                      onClick={() => setStudentMarksFilter(filterOpt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-background hover:bg-muted text-muted-foreground border border-border/50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Students Marks Entry List */}
            <div className="space-y-3">
              {filteredStudents.map((student, idx) => {
                const resultId = `${student.id}_${selectedTest.id}`;
                const existingResult = selectedResults.find(r => r.studentId === student.id);
                const isAbsent = Boolean(existingResult?.isAbsent);
                const markVal = localMarks[student.id] ?? (existingResult ? String(existingResult.marksObtained) : '');
                const numMark = markVal !== '' ? Number(markVal) : null;
                const percent = numMark !== null && !isNaN(numMark)
                  ? Math.round((numMark / selectedTest.totalMarks) * 100)
                  : null;

                const studentBatch = batches.find(b => b.id === student.batchId);

                return (
                  <div
                    key={student.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      isAbsent
                        ? 'bg-red-500/5 border-red-500/25'
                        : percent !== null
                        ? 'bg-card border-border hover:border-primary/40 shadow-xs'
                        : 'bg-card/70 border-dashed border-border hover:border-border'
                    }`}
                  >
                    {/* Student Info */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className={`h-11 w-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                        isAbsent
                          ? 'bg-red-500/20 text-red-700 dark:text-red-300'
                          : percent !== null && percent >= 75
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : percent !== null && percent >= 40
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                          : percent !== null
                          ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                          : 'bg-primary/10 text-primary'
                      }`}>
                        {student.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm sm:text-base text-foreground leading-tight truncate">
                            {student.name}
                          </p>
                          {studentBatch && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {studentBatch.name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {student.phoneNo || student.whatsappNo || student.email || 'No phone recorded'}
                          {student.parentWhatsApp && <span className="text-emerald-600 font-semibold ml-1.5">• Parent WA Active</span>}
                        </p>
                      </div>
                    </div>

                    {/* Marks Input & Actions */}
                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 shrink-0">
                      {/* Numeric Marks Input */}
                      <div className="flex items-center gap-1.5">
                        {isAbsent ? (
                          <div className="h-10 px-3.5 rounded-xl bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 flex items-center justify-center text-xs font-black tracking-wide border border-red-200 dark:border-red-900">
                            ABSENT
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={selectedTest.totalMarks}
                              value={markVal}
                              placeholder="—"
                              onChange={(e) => {
                                const val = e.target.value;
                                setLocalMarks(prev => ({ ...prev, [student.id]: val }));
                              }}
                              onBlur={(e) => handleSaveMarks(student.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveMarks(student.id, (e.target as HTMLInputElement).value);
                                }
                              }}
                              className="w-20 sm:w-24 h-10 text-right font-black text-base rounded-xl border-2 border-border focus:border-primary"
                            />
                            <span className="text-xs text-muted-foreground font-bold whitespace-nowrap">
                              / {selectedTest.totalMarks}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Percentage Badge */}
                      {!isAbsent && percent !== null && (
                        <div className={`px-2.5 py-1 rounded-xl text-xs font-black min-w-[50px] text-center ${
                          percent >= 75
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : percent >= 40
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                        }`}>
                          {percent}%
                        </div>
                      )}

                      {/* Absent Toggle Button */}
                      <Button
                        type="button"
                        variant={isAbsent ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => toggleAbsent(student.id)}
                        className={`h-9 px-2.5 text-xs font-bold rounded-xl transition-all ${
                          isAbsent
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {isAbsent ? "Mark Present" : "Mark Absent"}
                      </Button>

                      {/* WhatsApp Share Button */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleShareMarksWhatsApp(student)}
                        className="h-9 px-2.5 rounded-xl border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 gap-1.5"
                        title="Send Marks to Parent via WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4 text-emerald-600" />
                        <span className="hidden md:inline text-xs font-bold">WhatsApp</span>
                      </Button>
                    </div>
                  </div>
                );
              })}

              {filteredStudents.length === 0 && (
                <div className="text-center py-12 rounded-3xl border border-dashed p-8 bg-muted/10">
                  <Award className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="font-bold text-foreground">No students found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {studentMarksFilter !== 'all'
                      ? `No students in the '${studentMarksFilter}' category.`
                      : 'No students assigned to the batches in this test.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* VIEW 2: TESTS DIRECTORY AND BATCH OVERVIEW */
          <div className="space-y-6">
            {/* Header with Title and Create Test Trigger */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-card border border-border shadow-sm">
              <div>
                <h3 className="text-2xl font-black text-foreground flex items-center gap-2.5">
                  <Award className="h-7 w-7 text-primary" /> Tests & Marks Evaluation
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Create batch tests, give marks to students, evaluate performance & notify parents
                  </p>
                  {!isFallbackTeacher && teacherSubjects.length > 0 && (
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      Your Subject{teacherSubjects.length > 1 ? 's' : ''}: {teacherSubjects.join(', ')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  onClick={() => {
                    setNewTestName('');
                    setNewTestSubject(teacherSubjects[0] || 'General');
                    setNewTestBatchIds(teacherBatchIds.slice(0, 1));
                    setNewTestTotalMarks('50');
                    setNewTestDate(currentDateStr || getLocalDateString());
                    setIsCreateTestOpen(true);
                  }}
                  className="h-12 px-6 rounded-2xl font-black gap-2 shadow-lg shadow-primary/20 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create New Test</span>
                </Button>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black shrink-0">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Your Tests</span>
                  <p className="text-2xl font-black text-foreground mt-0.5">{teacherTests.length}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black shrink-0">
                  <CheckSquare className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Marks Given</span>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">{totalTeacherGraded}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black shrink-0">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Subjects</span>
                  <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-0.5">{teacherSubjects.length}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-black shrink-0">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Batches</span>
                  <p className="text-2xl font-black text-purple-700 dark:text-purple-300 mt-0.5">{teacherBatches.length}</p>
                </div>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border shadow-xs">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tests by name or subject..."
                  value={testSearch}
                  onChange={(e) => setTestSearch(e.target.value)}
                  className="pl-10 h-10 rounded-xl bg-background border-border/60 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Subject Filter */}
                <Select value={testSubjectFilter} onValueChange={setTestSubjectFilter}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold w-[160px]">
                    <SelectValue placeholder="All Subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {teacherSubjects.length > 0 ? `All My Subjects (${teacherSubjects.length})` : 'All My Subjects'}
                    </SelectItem>
                    {teacherSubjects.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Batch Filter */}
                <Select value={testBatchFilter} onValueChange={setTestBatchFilter}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold w-[150px]">
                    <SelectValue placeholder="All Batches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Batches</SelectItem>
                    {teacherBatches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tests Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTests.map((test) => {
                const bIds = test.batchIds && test.batchIds.length > 0 ? test.batchIds : (test.batchId ? [test.batchId] : []);
                const assignedBatches = batches.filter(b => bIds.includes(b.id));
                const totalStudentsInTest = students.filter(s => bIds.includes(s.batchId)).length;
                const resultsForTest = testResults.filter(r => r.testId === test.id);
                const markedCount = resultsForTest.filter(r => !r.isAbsent).length;
                const progressPct = totalStudentsInTest > 0
                  ? Math.round((resultsForTest.length / totalStudentsInTest) * 100)
                  : 0;

                const validMarks = resultsForTest.filter(r => !r.isAbsent).map(r => r.marksObtained);
                const avgMark = validMarks.length > 0
                  ? Math.round((validMarks.reduce((a, b) => a + b, 0) / validMarks.length) * 10) / 10
                  : null;

                return (
                  <div
                    key={test.id}
                    className="p-5 rounded-3xl bg-card border border-border shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between group gap-4"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary">
                          {test.subject || 'General'}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTest(test.id)}
                            className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                            title="Delete Test"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Test Title & Info */}
                      <h4 className="font-black text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {test.name}
                      </h4>

                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground font-medium">
                        <span>📅 {test.date}</span>
                        <span>•</span>
                        <span>Max Marks: <strong className="text-foreground font-bold">{test.totalMarks}</strong></span>
                      </div>

                      {/* Batches Chips */}
                      <div className="flex flex-wrap gap-1 mt-3">
                        {assignedBatches.map(b => (
                          <span key={b.id} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                            {b.name}
                          </span>
                        ))}
                      </div>

                      {/* Grading Progress */}
                      <div className="mt-4 p-3 rounded-2xl bg-muted/20 border border-border/40 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-muted-foreground">Grading Status</span>
                          <span className="text-primary">{resultsForTest.length} of {totalStudentsInTest} ({progressPct}%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${Math.min(100, progressPct)}%` }}
                          />
                        </div>
                        {avgMark !== null && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Class Avg: <strong className="text-foreground">{avgMark} / {test.totalMarks}</strong> ({Math.round((avgMark / test.totalMarks) * 100)}%)
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Give Marks Action Button */}
                    <Button
                      onClick={() => setSelectedTest(test)}
                      className="w-full h-11 rounded-2xl font-black gap-2 text-sm shadow-md shadow-primary/10 group-hover:shadow-primary/25 transition-all mt-1"
                    >
                      <Award className="h-4 w-4" />
                      <span>Give / Edit Marks</span>
                    </Button>
                  </div>
                );
              })}
            </div>

            {filteredTests.length === 0 && (
              <div className="text-center py-16 rounded-3xl border-2 border-dashed p-8 bg-card/50 space-y-3">
                <div className="h-14 w-14 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <Award className="h-7 w-7" />
                </div>
                <h4 className="text-lg font-black text-foreground">No tests recorded yet</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Create a new test to record exam scores and send performance alerts to parents directly.
                </p>
                <Button
                  onClick={() => setIsCreateTestOpen(true)}
                  className="rounded-2xl font-black px-6 h-11 text-xs gap-1.5 mt-2"
                >
                  <Plus className="h-4 w-4" /> Create Your First Test
                </Button>
              </div>
            )}
          </div>
        )}

        {/* DIALOG: CREATE NEW TEST */}
        <Dialog open={isCreateTestOpen} onOpenChange={setIsCreateTestOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-[32px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black flex items-center gap-2">
                <Award className="h-6 w-6 text-primary" /> Create New Test
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateTest} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="test-name" className="font-bold text-sm">Test Title / Exam Name</Label>
                <Input
                  id="test-name"
                  placeholder="e.g., Weekly Unit Test 1, Midterm Exam"
                  value={newTestName}
                  onChange={(e) => setNewTestName(e.target.value)}
                  required
                  className="h-12 rounded-xl text-base"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-bold text-sm">Subject</Label>
                  <Select value={newTestSubject || teacherSubjects[0] || ''} onValueChange={setNewTestSubject}>
                    <SelectTrigger className="h-12 rounded-xl font-bold">
                      <SelectValue placeholder={teacherSubjects.length > 0 ? "Select subject" : "No subjects assigned"} />
                    </SelectTrigger>
                    <SelectContent>
                      {teacherSubjects.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                      {teacherSubjects.length === 0 && (
                        <SelectItem value="none" disabled>No assigned subjects</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-total-marks" className="font-bold text-sm">Total / Max Marks</Label>
                  <Input
                    id="test-total-marks"
                    type="number"
                    min={1}
                    value={newTestTotalMarks}
                    onChange={(e) => setNewTestTotalMarks(e.target.value)}
                    required
                    className="h-12 rounded-xl text-base font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="test-date" className="font-bold text-sm">Test Conducted Date</Label>
                  <Input
                    id="test-date"
                    type="date"
                    value={newTestDate || currentDateStr || getLocalDateString()}
                    onChange={(e) => setNewTestDate(e.target.value)}
                    required
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-sm">Test Format</Label>
                  <Select value={newTestType} onValueChange={(v: 'subjective' | 'mcq') => setNewTestType(v)}>
                    <SelectTrigger className="h-12 rounded-xl font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subjective">Subjective / Theory</SelectItem>
                      <SelectItem value="mcq">Multiple Choice (MCQ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Assign Batches Checkboxes */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="font-bold text-sm">Assign Batches</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewTestBatchIds(teacherBatches.map(b => b.id))}
                      className="text-xs text-primary font-bold hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground text-xs">|</span>
                    <button
                      type="button"
                      onClick={() => setNewTestBatchIds([])}
                      className="text-xs text-muted-foreground font-bold hover:text-destructive"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 rounded-2xl border bg-muted/20">
                  {teacherBatches.map(batch => {
                    const isChecked = newTestBatchIds.includes(batch.id);
                    return (
                      <label
                        key={batch.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-primary/10 border-primary text-foreground font-bold'
                            : 'bg-background border-border/60 text-muted-foreground hover:border-border'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewTestBatchIds(prev => [...prev, batch.id]);
                            } else {
                              setNewTestBatchIds(prev => prev.filter(id => id !== batch.id));
                            }
                          }}
                        />
                        <span className="text-xs truncate">{batch.name}</span>
                      </label>
                    );
                  })}
                  {teacherBatches.length === 0 && (
                    <p className="text-xs text-muted-foreground col-span-2 text-center py-2">
                      No batches found.
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-13 rounded-2xl font-black text-base shadow-xl shadow-primary/20 mt-3"
              >
                Create Test & Enter Marks
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  return (
    <DashboardLayout role="teacher" title="Teacher Dashboard">
      {/* Dev / Admin Mode Teacher Profile Switcher Banner */}
      {(isDevOrAdminSession || isDevModeActive()) && allTeachers.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 px-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Dev / Admin Mode: Teacher View</span>
            {currentTeacher && (
              <span className="hidden sm:inline font-normal text-muted-foreground">
                ({teacherSubjects.length > 0 ? teacherSubjects.join(', ') : 'No subjects assigned'})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Switch Teacher:</span>
            <Select 
              value={currentTeacher?.id || ''} 
              onValueChange={(val) => {
                setDevSelectedTeacherId(val);
                try { sessionStorage.setItem('sankalp_dev_teacher_id', val); } catch {}
              }}
            >
              <SelectTrigger className="h-8 text-xs font-bold bg-background rounded-xl border-amber-500/40 w-[200px]">
                <SelectValue placeholder="Select teacher" />
              </SelectTrigger>
              <SelectContent>
                {allTeachers.map(t => {
                  const subs = Array.isArray(t.assignedSubjects) ? t.assignedSubjects.join(', ') : '';
                  return (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {subs ? `(${subs})` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="hidden lg:flex items-center gap-3 mb-8">
        {tabOptions.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium transition ${
                isActive ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="pb-24 lg:pb-0">
        {activeTab === "classes" && renderClasses()}
        {activeTab === "timetable" && renderTimetable()}
        {activeTab === "attendance" && renderAttendance()}
        {activeTab === "marks" && renderMarks()}
        {activeTab === "notes" && renderNotes()}
        {activeTab === "remarks" && renderRemarks()}
      </div>

      {/* Bottom Nav for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border/40 shadow-lg z-40 backdrop-blur-lg">
        <div className="flex items-center justify-around px-2 py-2">
          {tabOptions.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-0.5 p-1 min-w-[60px] transition-colors"
              >
                <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-primary/10' : ''}`}>
                  <Icon
                    strokeWidth={isActive ? 2.5 : 2}
                    className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                  />
                </div>
                <span className={`text-[10px] font-bold ${isActive ? "text-primary" : "text-muted-foreground"}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
