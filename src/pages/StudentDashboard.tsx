import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, BookOpen, Brain, TrendingUp, FileText, Home, Bot, UserCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  getClasses,
  getClassesByBatch,
  getCurrentUser,
  getNotesByBatch,
  getStudentAttendance,
  getStudents,
  AttendanceRecord,
  Class,
  Note,
  Student,
} from "@/lib/localStorage";

const tabOptions: { id: "home" | "ai" | "profile"; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "ai", label: "AI", icon: Bot },
  { id: "profile", label: "Profile", icon: UserCircle },
];

const StudentDashboard = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attendancePercentage, setAttendancePercentage] = useState(0);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [myClasses, setMyClasses] = useState<Class[]>([]);
  const [classLookup, setClassLookup] = useState<Record<string, Class>>({});
  const [activeTab, setActiveTab] = useState<"home" | "ai" | "profile">("home");
  const currentUser = getCurrentUser();

  const normalizeStatus = (status?: string): string => status?.trim().toLowerCase() ?? "";

  const calculateAttendancePercentage = (records: AttendanceRecord[]): number => {
    if (!records.length) {
      return 0;
    }
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

    const batchNotes = getNotesByBatch(student.batchId);
    setNotes(batchNotes);

    const classesForBatch = getClassesByBatch(student.batchId);
    setMyClasses(classesForBatch);

    const allClasses = getClasses();
    const lookup = allClasses.reduce<Record<string, Class>>((acc, cls) => {
      acc[cls.id] = cls;
      return acc;
    }, {});
    setClassLookup(lookup);

    const studentAttendance = getStudentAttendance(student.id);
    setAttendance(studentAttendance);
    setAttendancePercentage(calculateAttendancePercentage(studentAttendance));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const stats = useMemo(() => {
    return [
      {
        label: "Attendance",
        value: `${attendancePercentage}%`,
        icon: Calendar,
        trend: attendance.length > 0 ? `${attendance.length} days recorded` : "No data",
      },
      { label: "Notes Available", value: notes.length.toString(), icon: BookOpen, trend: "Uploaded by teachers" },
      { label: "My Classes", value: myClasses.length.toString(), icon: TrendingUp, trend: "Active schedule" },
      {
        label: "Batch",
        value: currentStudent?.batchId ?? "N/A",
        icon: Brain,
        trend: "Current session",
      },
    ];
  }, [attendancePercentage, attendance.length, notes.length, myClasses.length, currentStudent?.batchId]);

  const notesBySubject = useMemo(() => {
    return notes.reduce<Record<string, Note[]>>((acc, note) => {
      if (!acc[note.subject]) {
        acc[note.subject] = [];
      }
      acc[note.subject].push(note);
      return acc;
    }, {});
  }, [notes]);

  const recentAttendance = useMemo(() => attendance.slice(-5).reverse(), [attendance]);

  const attendanceSummary = useMemo(() => {
    const total = attendance.length;
    const present = attendance.filter(record => normalizeStatus(record.status) === "present").length;
    const absent = total - present;
    return { total, present, absent };
  }, [attendance]);

  const renderClassesCard = () => (
    <Card className="p-6">
      <h3 className="text-xl font-semibold mb-6">My Classes</h3>
      <div className="space-y-3">
        {myClasses.map(classItem => (
          <div key={classItem.id} className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
            <p className="font-semibold">{classItem.name}</p>
            <p className="text-sm text-muted-foreground">{classItem.subject}</p>
            <p className="text-xs text-muted-foreground mt-1">{classItem.schedule}</p>
          </div>
        ))}
        {myClasses.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No classes assigned yet.</p>
        )}
      </div>
    </Card>
  );

  const renderAttendanceCard = () => (
    <Card className="p-6">
      <h3 className="text-xl font-semibold mb-6">Attendance Overview</h3>
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Overall Attendance</span>
            <span className="text-2xl font-bold text-primary">{attendancePercentage}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-gradient-to-r from-primary to-accent h-2 rounded-full transition-all"
              style={{ width: `${attendancePercentage}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg border">
            <p className="text-xs text-muted-foreground">Total Days</p>
            <p className="text-lg font-semibold">{attendanceSummary.total}</p>
          </div>
          <div className="p-3 rounded-lg border">
            <p className="text-xs text-muted-foreground">Present</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">{attendanceSummary.present}</p>
          </div>
          <div className="p-3 rounded-lg border">
            <p className="text-xs text-muted-foreground">Absent</p>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">{attendanceSummary.absent}</p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Recent Attendance</h4>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {recentAttendance.map(record => {
              const classItem = classLookup[record.classId];
              return (
                <div key={record.id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{classItem?.name || "Class"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(record.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      normalizeStatus(record.status) === "present"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    }`}
                  >
                    {record.status}
                  </span>
                </div>
              );
            })}
            {recentAttendance.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No attendance records yet</p>
            )}
          </div>
        </div>
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
                      <Button size="sm" variant="outline" className="w-full">
                        Read Note
                      </Button>
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

  const renderAiCard = () => (
    <Card className="p-6">
      <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
        <div className="flex items-start gap-3">
          <Brain className="h-5 w-5 text-primary mt-1" />
          <div>
            <p className="font-semibold mb-1">AI Learning Assistant</p>
            <p className="text-sm text-muted-foreground mb-3">
              Get instant help with your doubts, 24/7 with AI-powered assistance
            </p>
            <Button size="sm" variant="default">
              Start Chat (Coming Soon)
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );

  const renderProfileContent = () => (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-semibold mt-2">{stat.value}</p>
                </div>
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">{stat.trend}</p>
            </Card>
          );
        })}
      </div>
      {renderAttendanceCard()}
      {renderNotesCard()}
    </div>
  );

  const renderTabContent = () => {
    if (activeTab === "home") {
      return <div className="space-y-4">{renderClassesCard()}</div>;
    }

    if (activeTab === "ai") {
      return renderAiCard();
    }

    return renderProfileContent();
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
                type="button"
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

      <div className="hidden lg:block space-y-6">{renderTabContent()}</div>

      <div className="lg:hidden pb-24 space-y-6">{renderTabContent()}</div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex max-w-md items-center justify-around">
          {tabOptions.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 flex-col items-center gap-1 py-2 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
