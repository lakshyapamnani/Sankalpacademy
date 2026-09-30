import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  ClipboardCheck,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Check,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import {
  TeacherTimetableSection,
  LectureAttendancePayload,
} from "@/components/timetable/TeacherTimetableSection";
import {
  getStudents,
  getClasses,
  getBatches,
  getCurrentUser,
  markAttendance,
  getAttendance,
  getTimetableLectures,
  subscribeToRealtimeUpdates,
  Student,
  Class,
  Batch,
  TimetableLecture,
} from "@/lib/localStorage";

const tabOptions: { id: "classes" | "timetable" | "attendance"; label: string; icon: LucideIcon }[] = [
  { id: "classes", label: "Classes", icon: Calendar },
  { id: "timetable", label: "Timetable", icon: Clock },
  { id: "attendance", label: "Attendance", icon: ClipboardCheck },
];

const StaffDashboard = () => {
  const [activeTab, setActiveTab] = useState<"classes" | "timetable" | "attendance">("classes");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [timetableLectures, setTimetableLectures] = useState<TimetableLecture[]>([]);
  const [selectedAttendanceBatch, setSelectedAttendanceBatch] = useState<string | null>(null);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<Class | null>(null);
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, boolean>>({}); // studentId -> isAbsent
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  const currentUser = getCurrentUser();

  // Returns YYYY-MM-DD in the local timezone (not UTC)
  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const format12h = (t24: string) => {
    if (!t24) return "";
    const [h, m] = t24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${(m || 0).toString().padStart(2, '0')} ${period}`;
  };

  useEffect(() => {
    setCurrentDateStr(getLocalDateString());
    const interval = setInterval(() => {
      setCurrentDateStr(getLocalDateString());
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    setStudents(getStudents());
    setClasses(getClasses());
    setBatches(getBatches());
    setTimetableLectures(getTimetableLectures());
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

  useEffect(() => {
    if (selectedAttendanceBatch) {
      const targetDate = selectedClassForAttendance?.date || currentDateStr || getLocalDateString();
      const batchStudents = students.filter(s => s.batchId === selectedAttendanceBatch);
      const attendance = getAttendance();
      
      const existingAttendance: Record<string, boolean> = {};
      batchStudents.forEach(student => {
        const record = attendance.find(
          r =>
            r.studentId === student.id &&
            r.date === targetDate &&
            (selectedClassForAttendance ? (r.classId === selectedClassForAttendance.id || r.classId === 'daily') : true)
        );
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
    const targetDate = selectedClassForAttendance?.date || currentDateStr || getLocalDateString();
    const timestamp = new Date().toLocaleTimeString();
    
    const batchStudents = students.filter(s => s.batchId === selectedAttendanceBatch);
    const targetClassId = selectedClassForAttendance?.id || 'daily';
    
    batchStudents.forEach((student) => {
      const isAbsent = dailyAttendance[student.id] || false;
      const status = isAbsent ? 'absent' as const : 'present' as const;
      const markedBy = `Staff: ${currentUser?.name || 'Staff'} at ${timestamp}`;
      
      // Save for specific classId (e.g. timetableId)
      markAttendance({
        id: `${student.id}_${targetClassId}_${targetDate}`,
        studentId: student.id,
        classId: targetClassId,
        date: targetDate,
        status,
        markedBy,
      });

      // Also save daily for batch level sync
      if (targetClassId !== 'daily') {
        markAttendance({
          id: `${student.id}_${targetDate}`,
          studentId: student.id,
          classId: 'daily',
          date: targetDate,
          status,
          markedBy,
        });
      }
    });
    
    const batchName = batches.find(b => b.id === selectedAttendanceBatch)?.name;
    toast.success(
      `Attendance for ${batchName}${selectedClassForAttendance ? ` (${selectedClassForAttendance.name})` : ''} saved & synced!`
    );
    setSelectedAttendanceBatch(null);
    setSelectedClassForAttendance(null);
    setDailyAttendance({});
    loadData();
  };

  const handleMarkAll = (absent: boolean) => {
    if (!selectedAttendanceBatch) return;
    const batchStudents = students.filter(s => s.batchId === selectedAttendanceBatch);
    const updated: Record<string, boolean> = {};
    batchStudents.forEach(s => {
      updated[s.id] = absent;
    });
    setDailyAttendance(updated);
  };

  const handleOpenAttendanceForLecture = (payload: LectureAttendancePayload) => {
    const classItem: Class = {
      id: payload.timetableId,
      name: `${payload.subjectName} (${payload.roomName || 'Classroom'})`,
      subject: payload.subjectName,
      batchId: payload.batchId,
      teacherId: payload.teacherId,
      teacherName: payload.teacherName,
      date: payload.date || currentDateStr || getLocalDateString(),
      time: payload.startTime,
      endTime: payload.endTime,
    };
    setSelectedClassForAttendance(classItem);
    setSelectedAttendanceBatch(payload.batchId);
    setActiveTab("attendance");
  };

  const handleOpenAttendanceForClass = (classItem: Class) => {
    setSelectedClassForAttendance(classItem);
    setSelectedAttendanceBatch(classItem.batchId);
    setActiveTab("attendance");
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

  const isClassAttendanceMarked = (classItem: Class) => {
    const targetDate = classItem.date || currentDateStr || getLocalDateString();
    const batchStudents = students.filter(s => s.batchId === classItem.batchId);
    if (batchStudents.length === 0) return false;

    const attendance = getAttendance();
    return batchStudents.some(student =>
      attendance.some(record => record.studentId === student.id && record.date === targetDate && (record.classId === classItem.id || record.classId === 'daily'))
    );
  };

  const isClassPassed = (classItem: Class) => {
    if (!classItem.date || !classItem.endTime) return false;
    const classEndTime = new Date(`${classItem.date}T${classItem.endTime}`);
    return classEndTime < new Date();
  };

  const renderTimetable = () => (
    <Card className="p-6">
      <TeacherTimetableSection
        currentTeacherId={currentUser?.id || ''}
        isMasterUser={true}
        allLectures={timetableLectures}
        allAttendance={getAttendance()}
        allStudents={students}
        onOpenAttendance={handleOpenAttendanceForLecture}
      />
    </Card>
  );

  const renderClasses = () => {
    const sortedClasses = [...classes].sort(
      (a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime()
    );

    return (
      <div className="space-y-6">
        {/* Main Timetable and Class Schedule for all lectures */}
        <Card className="p-6">
          <TeacherTimetableSection
            currentTeacherId={currentUser?.id || ''}
            isMasterUser={true}
            allLectures={timetableLectures}
            allAttendance={getAttendance()}
            allStudents={students}
            onOpenAttendance={handleOpenAttendanceForLecture}
          />
        </Card>

        {/* Dated Class Sessions (if any) */}
        {sortedClasses.length > 0 && (
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2 border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Specific Dated Sessions</h3>
                <p className="text-xs text-muted-foreground">Individual one-off sessions created outside weekly timetable.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedClasses.map(classItem => {
                const batch = batches.find(b => b.id === classItem.batchId);
                const passed = isClassPassed(classItem);
                const attendanceMarked = isClassAttendanceMarked(classItem);

                return (
                  <div
                    key={classItem.id}
                    onClick={() => handleOpenAttendanceForClass(classItem)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      passed ? 'opacity-60 bg-muted/20' : 'bg-card hover:bg-accent/5 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {passed && (
                            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-medium uppercase tracking-wider">
                              Finished
                            </span>
                          )}
                          {attendanceMarked && (
                            <span className="text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Marked
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-base">{classItem.name}</p>
                        <p className="text-sm text-muted-foreground">{classItem.subject}</p>
                        <p className="text-xs font-medium text-primary mt-1">Batch: {batch?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {classItem.date} • {format12h(classItem.time)} - {format12h(classItem.endTime)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg font-bold text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAttendanceForClass(classItem);
                        }}
                      >
                        {attendanceMarked ? "Edit Attendance" : "Take Attendance"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    );
  };

  const renderAttendance = () => {
    const selectedBatchObj = batches.find(b => b.id === selectedAttendanceBatch);
    const targetDate = selectedClassForAttendance?.date || currentDateStr || getLocalDateString();
    const batchStudents = selectedAttendanceBatch ? students.filter(s => s.batchId === selectedAttendanceBatch) : [];
    const absentCount = Object.values(dailyAttendance).filter(Boolean).length;
    const presentCount = batchStudents.length - absentCount;

    return (
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b pb-6">
          <div>
            <h3 className="text-2xl font-black text-primary">
              {selectedClassForAttendance ? `${selectedClassForAttendance.name} Attendance` : 'Daily Batch Attendance'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedClassForAttendance
                ? `Subject: ${selectedClassForAttendance.subject} • Date: ${targetDate}${selectedClassForAttendance.teacherName ? ` • Teacher: ${selectedClassForAttendance.teacherName}` : ''}${selectedClassForAttendance.time ? ` • Time: ${format12h(selectedClassForAttendance.time)} - ${format12h(selectedClassForAttendance.endTime)}` : ''}`
                : 'Take student attendance batch-wise across the institute'}
            </p>
          </div>
          {selectedClassForAttendance && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 text-primary font-bold text-xs">
              <Clock className="h-4 w-4" />
              <span>Timetable Lecture ID: {selectedClassForAttendance.id}</span>
            </div>
          )}
        </div>

        {!selectedAttendanceBatch ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {batches.map(batch => {
              const bStudents = students.filter(s => s.batchId === batch.id);
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
                      {bStudents.length} Students
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedAttendanceBatch(null);
                  setSelectedClassForAttendance(null);
                }}
                className="gap-2 font-bold p-0 w-fit"
              >
                <ArrowLeft className="h-4 w-4" /> Back to List
              </Button>
              <div className="text-left sm:text-right">
                <h4 className="text-xl font-black">
                  {selectedBatchObj?.name}
                  {selectedClassForAttendance ? ` — ${selectedClassForAttendance.name}` : ''}
                </h4>
                <p className="text-xs text-muted-foreground">
                  Date: {targetDate}
                  {selectedClassForAttendance?.teacherName ? ` • Teacher: ${selectedClassForAttendance.teacherName}` : ''}
                </p>
              </div>
            </div>

            {/* Quick Actions & Summary bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 mb-6 rounded-2xl bg-muted/30 border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Quick Mark:</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold rounded-lg border-emerald-500/40 text-emerald-600 hover:bg-emerald-50"
                  onClick={() => handleMarkAll(false)}
                >
                  <Check className="h-3.5 w-3.5 mr-1" /> All Present
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-bold rounded-lg border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => handleMarkAll(true)}
                >
                  <X className="h-3.5 w-3.5 mr-1" /> All Absent
                </Button>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="text-emerald-600">{presentCount} Present</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-destructive">{absentCount} Absent</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-foreground">{batchStudents.length} Total</span>
              </div>
            </div>

            <div className="space-y-3 mb-8">
              {batchStudents.map(student => (
                <div key={student.id} className="flex items-center justify-between p-4 bg-accent/5 rounded-2xl border border-primary/5 hover:border-primary/20 transition-all">
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
                      <span className={`text-xs font-bold transition-colors ${dailyAttendance[student.id] ? 'text-destructive' : 'text-muted-foreground group-hover:text-destructive'}`}>
                        {dailyAttendance[student.id] ? 'ABSENT' : 'PRESENT'}
                      </span>
                      <div 
                        onClick={() => setDailyAttendance({...dailyAttendance, [student.id]: !dailyAttendance[student.id]})}
                        className={`w-12 h-6 rounded-full transition-all duration-300 relative ${dailyAttendance[student.id] ? 'bg-destructive' : 'bg-emerald-500'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${dailyAttendance[student.id] ? 'left-7' : 'left-1'}`} />
                      </div>
                    </label>
                  </div>
                </div>
              ))}
              {batchStudents.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No students found enrolled in this batch.
                </p>
              )}
            </div>

            <Button
              onClick={handleSaveDailyAttendance}
              disabled={batchStudents.length === 0}
              className="w-full h-12 rounded-xl font-black bg-primary shadow-lg hover:shadow-primary/25 transition-all text-sm"
            >
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Save Attendance & Sync to Records
            </Button>
          </div>
        )}
      </Card>
    );
  };

  return (
    <DashboardLayout role="staff" title="Staff Dashboard">
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
      </div>

      {/* Bottom Nav for Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border/40 shadow-lg z-40 backdrop-blur-lg">
        <div className="flex items-center justify-around px-6 py-2">
          {tabOptions.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-1 p-2 min-w-[80px] transition-colors"
              >
                <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-primary/10' : ''}`}>
                  <Icon 
                    strokeWidth={isActive ? 2.5 : 2} 
                    className={`h-6 w-6 ${isActive ? "text-primary" : "text-muted-foreground"}`} 
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

export default StaffDashboard;
