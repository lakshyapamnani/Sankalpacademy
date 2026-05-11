import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Calendar, BookOpen, Brain, FileText, Home, Bot, UserCircle, MessageSquare, CheckSquare, IndianRupee, Award, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import {
  getClasses,
  getClassesByBatch,
  getCurrentUser,
  getNotesByBatch,
  getStudentAttendance,
  getStudents,
  subscribeToClassNotifications,
  acknowledgeClassNotification,
  getTestsByBatch,
  getTestResultsByStudent,
  getFeeRecordByStudent,
  saveTestResult,
  isClassPast,
  format12h,
  ClassNotification,
  AttendanceRecord,
  Class,
  Note,
  Student,
  Test,
  TestResult,
  FeeRecord
} from "@/lib/localStorage";
import { registerForPushNotifications } from "@/lib/messaging";
import { sendPromptToGemini } from "@/lib/gemini";

const tabOptions: { id: "home" | "notes" | "ai" | "tests" | "profile"; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "notes", label: "Notes", icon: BookOpen },
  { id: "ai", label: "AI", icon: Bot },
  { id: "tests", label: "Tests", icon: CheckSquare },
  { id: "profile", label: "Profile", icon: UserCircle },
];

const StudentDashboard = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attendancePercentage, setAttendancePercentage] = useState(0);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [myClasses, setMyClasses] = useState<Class[]>([]);
  const [classLookup, setClassLookup] = useState<Record<string, Class>>({});
  
  // New States
  const [tests, setTests] = useState<Test[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [feeRecord, setFeeRecord] = useState<FeeRecord | null>(null);

  const [activeTab, setActiveTab] = useState<"home" | "notes" | "ai" | "tests" | "profile">("home");
  const [activeTest, setActiveTest] = useState<Test | null>(null);
  const [testAnswers, setTestAnswers] = useState<Record<string, string>>({});
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const hasRegisteredForPush = useRef(false);
  const currentUser = getCurrentUser();

  // AI chat state
  const [showAiModal, setShowAiModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [inputText, setInputText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = inputText.trim();
    if (!prompt) return;

    setChatMessages(prev => [...prev, { role: 'user', text: prompt }]);
    setInputText("");
    setAiLoading(true);

    try {
      const reply = await sendPromptToGemini(prompt);
      setChatMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch (error) {
      console.error('AI chat error', error);
      toast.error('Unable to get response from AI');
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, I could not process that right now.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  const normalizeStatus = (status?: string): string => status?.trim().toLowerCase() ?? "";

  const calculateAttendancePercentage = (records: AttendanceRecord[]): number => {
    if (!records.length) return 0;
    const presentCount = records.filter(record => normalizeStatus(record.status) === "present").length;
    return Math.round((presentCount / records.length) * 100);
  };

  const resetData = () => {
    setCurrentStudent(null);
    setMyClasses([]);
    setClassLookup({});
    setNotes([]);
    setAttendance([]);
    setAttendancePercentage(0);
    setTests([]);
    setTestResults([]);
    setFeeRecord(null);
  };

  const loadData = () => {
    if (!currentUser) {
      resetData();
      return;
    }

    const students = getStudents();
    const student = students.find(s => s.id === currentUser.id) || null;
    setCurrentStudent(student);

    if (!student) {
      resetData();
      return;
    }

    setNotes(getNotesByBatch(student.batchId));
    setMyClasses(getClassesByBatch(student.batchId));
    
    const allClasses = getClasses();
    const lookup = allClasses.reduce<Record<string, Class>>((acc, cls) => {
      acc[cls.id] = cls;
      return acc;
    }, {});
    setClassLookup(lookup);

    const studentAttendance = getStudentAttendance(student.id);
    setAttendance(studentAttendance);
    setAttendancePercentage(calculateAttendancePercentage(studentAttendance));

    setTests(getTestsByBatch(student.batchId));
    setTestResults(getTestResultsByStudent(student.id));
    setFeeRecord(getFeeRecordByStudent(student.id) || null);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentStudent) return;
    const seen = seenNotificationIds.current;

    const unsubscribe = subscribeToClassNotifications("student", currentStudent.batchId, notifications => {
      notifications.forEach((notification: ClassNotification) => {
        if (seen.has(notification.id)) return;
        seen.add(notification.id);
        toast.success(notification.title, { description: notification.message });
        void acknowledgeClassNotification("student", currentStudent.batchId, notification.id);
        loadData();
      });
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStudent?.batchId]);

  useEffect(() => {
    if (!currentStudent || hasRegisteredForPush.current) return;
    hasRegisteredForPush.current = true;
    void registerForPushNotifications("student", currentStudent.id, { batchId: currentStudent.batchId }).catch(error => {
      console.error("Unable to register student for push notifications", error);
      hasRegisteredForPush.current = false;
    });
  }, [currentStudent?.id, currentStudent?.batchId]);

  const notesBySubject = useMemo(() => {
    return notes.reduce<Record<string, Note[]>>((acc, note) => {
      if (!acc[note.subject]) acc[note.subject] = [];
      acc[note.subject].push(note);
      return acc;
    }, {});
  }, [notes]);

  const renderClassesCard = () => (
    <Card className="p-6">
      <h3 className="text-xl font-semibold mb-6">Lectures & Schedule</h3>
      <div className="space-y-3">
        {[...myClasses].sort((a, b) => {
          const aPast = isClassPast(a);
          const bPast = isClassPast(b);
          if (aPast === bPast) return 0;
          return aPast ? 1 : -1;
        }).map(classItem => {
          const isPast = isClassPast(classItem);
          return (
            <div key={classItem.id} className={`p-4 rounded-lg border transition-colors ${isPast ? 'bg-muted/50 opacity-60 border-muted' : 'bg-card hover:bg-accent/5'}`}>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{classItem.name}</p>
                {isPast && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-muted-foreground/20 text-muted-foreground px-1.5 py-0.5 rounded">Completed</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{classItem.subject}</p>
              <p className="text-xs text-muted-foreground mt-1">{classItem.date} • {format12h(classItem.time)} - {format12h(classItem.endTime)}</p>
            </div>
          );
        })}
        {myClasses.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No classes assigned yet.</p>
        )}
      </div>
    </Card>
  );

  const renderNotesCard = () => (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold">Study Notes</h3>
        <span className="text-sm text-muted-foreground">{notes.length} notes available</span>
      </div>

      {Object.keys(notesBySubject).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(notesBySubject).map(([subject, subjectNotes]) => (
            <div key={subject}>
              <h4 className="text-lg font-semibold mb-3 text-primary">{subject}</h4>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjectNotes.map(note => (
                  <div key={note.id} className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h5 className="font-semibold mb-2">{note.title}</h5>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{note.content}</p>
                    {note.fileUrl ? (
                      <a
                        href={note.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline font-medium"
                      >
                        View File →
                      </a>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full">Read Note</Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No study notes available yet</p>
          <p className="text-sm text-muted-foreground mt-1">Your teachers will upload notes soon</p>
        </div>
      )}
    </Card>
  );

  const renderTestsCard = () => {
    // Test-taking interface
    if (activeTest && activeTest.questions && currentStudent) {
      const questions = activeTest.questions;
      const allAnswered = questions.every(q => testAnswers[q.id]);
      const handleSubmit = () => {
        if (!allAnswered) { toast.error("Please answer all questions"); return; }
        let score = 0;
        questions.forEach(q => { if (testAnswers[q.id] === q.correctOptionId) score += 1; });
        saveTestResult({
          id: `${currentStudent.id}_${activeTest.id}`,
          testId: activeTest.id,
          studentId: currentStudent.id,
          marksObtained: score,
          answers: testAnswers,
          submittedAt: new Date().toISOString(),
        });
        toast.success(`Submitted! You scored ${score}/${questions.length}`);
        setActiveTest(null);
        setTestAnswers({});
        setTestResults(getTestResultsByStudent(currentStudent.id));
      };
      return (
        <div className="space-y-4">
          <Card className="p-4 sticky top-0 z-10 bg-card/95 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold">{activeTest.name}</h3>
                <p className="text-xs text-muted-foreground">{questions.length} questions • {Object.keys(testAnswers).length} answered</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setActiveTest(null); setTestAnswers({}); }}>Cancel</Button>
            </div>
          </Card>
          {questions.map((q, idx) => (
            <Card key={q.id} className="p-5">
              <p className="font-medium mb-3">Q{idx + 1}. {q.question}</p>
              <RadioGroup value={testAnswers[q.id] || ''} onValueChange={(v) => setTestAnswers(prev => ({ ...prev, [q.id]: v }))}>
                <div className="space-y-2">
                  {q.options.map(opt => (
                    <div key={opt.id} className="flex items-center gap-3 p-2 rounded border hover:bg-accent/30">
                      <RadioGroupItem value={opt.id} id={`${q.id}-${opt.id}`} />
                      <Label htmlFor={`${q.id}-${opt.id}`} className="cursor-pointer flex-1">{opt.text}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </Card>
          ))}
          <Button className="w-full" onClick={handleSubmit} disabled={!allAnswered}>Submit Test</Button>
        </div>
      );
    }

    const gradedTests = tests.filter(t => testResults.find(r => r.testId === t.id));
    const overallAvg = gradedTests.length > 0
      ? Math.round(
          gradedTests.reduce((sum, t) => {
            const r = testResults.find(res => res.testId === t.id);
            return sum + (r ? (r.marksObtained / t.totalMarks) * 100 : 0);
          }, 0) / gradedTests.length
        )
      : null;

    const getScoreColor = (pct: number) => {
      if (pct >= 75) return 'text-emerald-600';
      if (pct >= 40) return 'text-amber-500';
      return 'text-red-500';
    };
    const getBarColor = (pct: number) => {
      if (pct >= 75) return 'bg-emerald-500';
      if (pct >= 40) return 'bg-amber-500';
      return 'bg-red-500';
    };

    return (
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/30">
            <CheckSquare className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{tests.length}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Total Tests</p>
          </Card>
          <Card className="p-3 text-center bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-200/30">
            <Award className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{gradedTests.length}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Graded</p>
          </Card>
          <Card className="p-3 text-center bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200/30">
            <TrendingUp className="h-5 w-5 text-purple-500 mx-auto mb-1" />
            <p className={`text-xl font-bold ${overallAvg !== null ? getScoreColor(overallAvg) : ''}`}>{overallAvg !== null ? `${overallAvg}%` : '—'}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Average</p>
          </Card>
        </div>

        {/* Test List */}
        <Card className="divide-y overflow-hidden">
          {tests.map(test => {
            const result = testResults.find(r => r.testId === test.id);
            const hasResult = !!result;
            const pct = hasResult ? Math.round((result.marksObtained / test.totalMarks) * 100) : 0;

            return (
              <div key={test.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold">{test.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(test.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  {hasResult ? (
                    <div className="text-right">
                      <p className={`text-xl font-bold ${getScoreColor(pct)}`}>{result.marksObtained}<span className="text-sm text-muted-foreground font-normal">/{test.totalMarks}</span></p>
                      <p className={`text-xs font-semibold ${getScoreColor(pct)}`}>{pct}%</p>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Not Graded</span>
                  )}
                </div>
                {hasResult && (
                  <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
                    <div className={`h-full rounded-full transition-all duration-500 ${getBarColor(pct)}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
          {tests.length === 0 && (
            <div className="text-center py-12">
              <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground">No tests recorded yet</p>
              <p className="text-sm text-muted-foreground mt-1">Tests will appear here once your teacher creates them</p>
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderProfileAndFees = () => {
    const totalPaid = feeRecord?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const remainingBalance = feeRecord ? feeRecord.totalFees - totalPaid : 0;
    
    return (
      <div className="space-y-6">
        <Card className="p-6 bg-primary/5 border-primary/10">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
              <UserCircle className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{currentStudent?.name}</h2>
              <p className="text-sm text-muted-foreground">{currentStudent?.email}</p>
              <p className="text-sm font-medium mt-1">Batch: {currentStudent?.batchId || 'N/A'}</p>
            </div>
          </div>
        </Card>

        {/* Attendance Summary */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Calendar className="h-5 w-5"/> Attendance Overview</h3>
          <div className="flex items-center justify-between mb-3 border-b pb-4">
            <span className="text-sm font-medium">Overall Attendance</span>
            <span className={`text-2xl font-bold ${attendancePercentage > 75 ? 'text-green-500' : 'text-primary'}`}>{attendancePercentage}%</span>
          </div>
          <p className="text-xs text-muted-foreground">{attendance.length} Total days recorded.</p>
        </Card>

        {/* Fees Summary */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><IndianRupee className="h-5 w-5"/> Fees Structure</h3>
          {feeRecord ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border p-3 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Total Fees</p>
                <p className="font-semibold text-lg">₹{feeRecord.totalFees}</p>
              </div>
              <div className="bg-card border p-3 rounded-lg text-center">
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="font-semibold text-lg text-green-600">₹{totalPaid}</p>
              </div>
              <div className="col-span-2 bg-card border p-3 rounded-lg text-center border-red-200">
                <p className="text-xs text-muted-foreground">Remaining Balance</p>
                <p className="font-bold text-xl text-red-500">₹{remainingBalance}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No fee structure established yet.</p>
          )}
        </Card>
      </div>
    );
  };

  const renderTabContent = () => {
    switch(activeTab) {
      case "home": return renderClassesCard();
      case "notes": return renderNotesCard();
      case "ai": return (
        <Card className="p-6">
          <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 text-primary mt-1" />
              <div className="flex-1">
                <p className="font-semibold mb-1">AI Learning Assistant</p>
                <p className="text-sm text-muted-foreground mb-4">Get instant help with your doubts, 24/7 with AI-powered assistance</p>
                <Button className="w-full" onClick={() => setShowAiModal(true)}>
                  <MessageSquare className="h-4 w-4 mr-2" /> Start Chat
                </Button>
              </div>
            </div>
          </div>
        </Card>
      );
      case "tests": return renderTestsCard();
      case "profile": return renderProfileAndFees();
      default: return null;
    }
  };

  return (
    <DashboardLayout role="student" title="Student Dashboard">
      <div className="hidden lg:flex items-center justify-between mb-8">
        <div className="flex gap-3">
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
      </div>

      {/* Main Content Area */}
      <div className="pb-24 lg:pb-0">{renderTabContent()}</div>

      {/* AI Chat Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAiModal(false)} />
          <div className="relative w-full sm:max-w-2xl bg-card rounded-t-xl sm:rounded-lg p-5 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Bot className="h-5 w-5 text-primary"/> AI Assistant</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowAiModal(false)}>✕</Button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {chatMessages.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>How can I help you learn today?</p>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-2xl max-w-[85%] text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="p-3 bg-muted rounded-2xl rounded-tl-sm text-sm flex gap-1">
                    <span className="animate-bounce">.</span><span className="animate-bounce delay-100">.</span><span className="animate-bounce delay-200">.</span>
                  </div>
                </div>
              )}
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-2 pt-2 border-t mt-auto">
              <Input value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Ask a question..." disabled={aiLoading} className="rounded-full" />
              <Button type="submit" disabled={aiLoading || !inputText.trim()} className="rounded-full px-6">Send</Button>
            </form>
          </div>
        </div>
      )}

      {/* Instagram-style Bottom Nav for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border/40 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-40 supports-[backdrop-filter]:bg-card/80 backdrop-blur-lg">
        <div className="flex items-center justify-between px-6 py-2">
          {tabOptions.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            // Special styling for the center 'AI' button
            if (tab.id === 'ai') {
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex flex-col items-center justify-center -mt-6 rounded-full w-14 h-14 bg-gradient-to-tr from-primary to-accent shadow-lg text-primary-foreground active:scale-95 transition-transform"
                >
                  <Icon className="h-6 w-6" />
                </button>
              )
            }

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-1 p-2 min-w-[50px] transition-colors"
              >
                <div className={`p-1 rounded-xl transition-all duration-300 ${isActive ? 'bg-primary/10' : ''}`}>
                  <Icon 
                    strokeWidth={isActive ? 2.5 : 2} 
                    className={`h-[22px] w-[22px] ${isActive ? "text-primary" : "text-muted-foreground"}`} 
                  />
                </div>
                {/* Optional minimalistic dot instead of labels for peak Instagram aesthetics, but keeping minimal text usually preferred for edtech. Let's strictly use dots to be more like instagram! */}
                <div className={`h-1 w-1 rounded-full transition-all duration-300 mt-0.5 ${isActive ? "bg-primary" : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
