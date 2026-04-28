import { useState, useEffect, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  ClipboardCheck,
  FileText,
  Brain,
  Home,
  UserCircle,
  Users,
  Plus,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  UserCheck,
  UserX,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  getCurrentUser,
  getClassesByTeacher,
  getStudentsByBatch,
  getNotes,
  addNote,
  markAttendance,
  getAttendanceByClass,
  subscribeToClassNotifications,
  acknowledgeClassNotification,
  isClassPast,
  format12h,
  ClassNotification,
  Class,
  Student,
  Note,
  AttendanceRecord,
} from "@/lib/localStorage";
import { registerForPushNotifications } from "@/lib/messaging";

const tabOptions: {
  id: "home" | "attendance" | "notes" | "profile";
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "attendance", label: "Attendance", icon: ClipboardCheck },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "profile", label: "Profile", icon: UserCircle },
];

const TeacherDashboard = () => {
  const [activeTab, setActiveTab] = useState<
    "home" | "attendance" | "notes" | "profile"
  >("home");
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  // attendance state: each student mapped to 'present' | 'absent' | 'unmarked'
  const [attendance, setAttendance] = useState<{
    [key: string]: "present" | "absent" | "unmarked";
  }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const seenNotificationIds = useRef<Set<string>>(new Set());
  const hasRegisteredForPush = useRef(false);
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;
    const seen = seenNotificationIds.current;

    const unsubscribe = subscribeToClassNotifications(
      "teacher",
      currentUser.id,
      (notifications) => {
        notifications.forEach((notification: ClassNotification) => {
          if (seen.has(notification.id)) return;
          seen.add(notification.id);
          toast.success(notification.title, {
            description: notification.message,
          });
          void acknowledgeClassNotification(
            "teacher",
            currentUser.id,
            notification.id
          );
          loadData();
        });
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || hasRegisteredForPush.current) return;
    hasRegisteredForPush.current = true;

    void registerForPushNotifications("teacher", currentUser.id).catch(
      (error) => {
        console.error(
          "Unable to register teacher for push notifications",
          error
        );
        hasRegisteredForPush.current = false;
      }
    );
  }, [currentUser?.id]);

  const loadData = () => {
    const teacherClasses = getClassesByTeacher(currentUser!.id);
    setClasses(teacherClasses);
    const allNotes = getNotes();
    setNotes(allNotes.filter((n) => n.teacherId === currentUser!.id));
  };

  // When selectedClass or attendance date changes, load existing attendance
  useEffect(() => {
    if (!selectedClass) return;
    const batchStudents = getStudentsByBatch(selectedClass.batchId);
    setStudents(batchStudents);

    // Load existing attendance for this class and date
    const existingRecords = getAttendanceByClass(
      selectedClass.id,
      attendanceDate
    );
    const attendanceState: {
      [key: string]: "present" | "absent" | "unmarked";
    } = {};

    batchStudents.forEach((student) => {
      const record = existingRecords.find(
        (r) => r.studentId === student.id
      );
      if (record) {
        attendanceState[student.id] = record.status;
      } else {
        attendanceState[student.id] = "unmarked";
      }
    });

    setAttendance(attendanceState);
    setHasUnsavedChanges(false);
    setSearchQuery("");
  }, [selectedClass, attendanceDate]);

  const handleClassSelectForAttendance = (classItem: Class) => {
    setSelectedClass(classItem);
    setAttendanceDate(new Date().toISOString().split("T")[0]);
    setActiveTab("attendance");
  };

  const toggleStudentAttendance = (studentId: string) => {
    setAttendance((prev) => {
      const current = prev[studentId];
      let next: "present" | "absent" | "unmarked";
      if (current === "unmarked" || current === "absent") {
        next = "present";
      } else {
        next = "absent";
      }
      return { ...prev, [studentId]: next };
    });
    setHasUnsavedChanges(true);
  };

  const markAllPresent = () => {
    const newAttendance: { [key: string]: "present" | "absent" | "unmarked" } =
      {};
    students.forEach((s) => {
      newAttendance[s.id] = "present";
    });
    setAttendance(newAttendance);
    setHasUnsavedChanges(true);
  };

  const markAllAbsent = () => {
    const newAttendance: { [key: string]: "present" | "absent" | "unmarked" } =
      {};
    students.forEach((s) => {
      newAttendance[s.id] = "absent";
    });
    setAttendance(newAttendance);
    setHasUnsavedChanges(true);
  };

  const presentCount = Object.values(attendance).filter(
    (s) => s === "present"
  ).length;
  const absentCount = Object.values(attendance).filter(
    (s) => s === "absent"
  ).length;
  const unmarkedCount = Object.values(attendance).filter(
    (s) => s === "unmarked"
  ).length;

  const handleSaveAttendance = async () => {
    if (!selectedClass) {
      toast.error("Please select a class first");
      return;
    }

    if (unmarkedCount > 0) {
      toast.warning(
        `${unmarkedCount} student(s) are still unmarked. Please mark all students before saving.`
      );
      return;
    }

    setIsSaving(true);

    try {
      // Small delay to show saving state
      await new Promise((resolve) => setTimeout(resolve, 400));

      Object.entries(attendance).forEach(([studentId, status]) => {
        if (status === "unmarked") return;
        markAttendance({
          id: `${attendanceDate}_${selectedClass.id}_${studentId}`,
          studentId,
          classId: selectedClass.id,
          date: attendanceDate,
          status: status,
          markedBy: currentUser!.id,
        });
      });

      toast.success("Attendance saved successfully!", {
        description: `${presentCount} present, ${absentCount} absent for ${selectedClass.name}`,
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Failed to save attendance. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const classId = formData.get("classId") as string;
    const selected = classes.find((c) => c.id === classId);

    if (!selected) {
      toast.error("Please select a class");
      return;
    }

    const note: Note = {
      id: Date.now().toString(),
      title: formData.get("title") as string,
      subject: selected.subject,
      batchId: selected.batchId,
      teacherId: currentUser!.id,
      content: formData.get("content") as string,
      fileUrl: formData.get("fileUrl") as string,
      createdAt: new Date().toISOString(),
    };

    addNote(note);
    toast.success("Note uploaded successfully");
    (e.target as HTMLFormElement).reset();
    loadData();
  };

  const stats = [
    {
      label: "My Classes",
      value: classes.length.toString(),
      icon: Calendar,
      gradient: "from-blue-500/20 to-blue-600/5",
      iconColor: "text-blue-500",
    },
    {
      label: "Notes Uploaded",
      value: notes.length.toString(),
      icon: FileText,
      gradient: "from-amber-500/20 to-amber-600/5",
      iconColor: "text-amber-500",
    },
    {
      label: "Total Students",
      value: classes
        .reduce(
          (acc, c) => acc + getStudentsByBatch(c.batchId).length,
          0
        )
        .toString(),
      icon: Users,
      gradient: "from-emerald-500/20 to-emerald-600/5",
      iconColor: "text-emerald-500",
    },
    {
      label: "Active Batches",
      value: new Set(classes.map((c) => c.batchId)).size.toString(),
      icon: Brain,
      gradient: "from-purple-500/20 to-purple-600/5",
      iconColor: "text-purple-500",
    },
  ];

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const renderHomeTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card
              key={index}
              className={`p-4 bg-gradient-to-br ${stat.gradient} border-none shadow-sm hover:shadow-md transition-shadow`}
            >
              <div className="flex flex-col">
                <Icon className={`h-6 w-6 ${stat.iconColor} mb-2`} />
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <Calendar className="h-5 w-5" /> Today's Classes
        </h3>
        <div className="space-y-3">
          {[...classes].sort((a, b) => {
            const aPast = isClassPast(a);
            const bPast = isClassPast(b);
            if (aPast === bPast) return 0;
            return aPast ? 1 : -1;
          }).map((classItem) => {
            const isPast = isClassPast(classItem);
            return (
            <div
              key={classItem.id}
              className={`p-4 rounded-lg border cursor-pointer transition-all flex justify-between items-center group ${
                isPast
                  ? 'bg-muted/50 opacity-60 border-muted'
                  : 'bg-card hover:border-primary/50'
              }`}
              onClick={() => !isPast && handleClassSelectForAttendance(classItem)}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-lg">{classItem.name}</p>
                  {isPast && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-muted-foreground/20 text-muted-foreground px-1.5 py-0.5 rounded">Completed</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {classItem.subject}
                </p>
                <p className="text-xs font-medium text-primary mt-1">
                  {classItem.date} • {format12h(classItem.time)} - {format12h(classItem.endTime)}
                </p>
              </div>
              {!isPast && (
                <Button
                  variant="outline"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex"
                >
                  <ClipboardCheck className="h-4 w-4 mr-1" />
                  Take Attendance
                </Button>
              )}
            </div>
            );
          })}
          {classes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg bg-accent/30">
              No classes assigned for today.
            </div>
          )}
        </div>
      </Card>
    </div>
  );

  const renderAttendanceTab = () => (
    <div className="space-y-4">
      {!selectedClass ? (
        <Card className="p-6 min-h-[60vh]">
          <div className="h-full flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <ClipboardCheck className="h-10 w-10 text-primary/40" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-foreground">
              Select a Class
            </h3>
            <p className="text-sm max-w-xs mb-8">
              Choose a class below or from the Home tab to start marking
              attendance.
            </p>

            <div className="w-full max-w-sm space-y-2">
              {classes.map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  className="w-full justify-between h-auto py-3"
                  onClick={() => handleClassSelectForAttendance(c)}
                >
                  <div className="text-left">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.subject}
                    </p>
                  </div>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                </Button>
              ))}
              {classes.length === 0 && (
                <p className="text-sm py-4 text-muted-foreground">
                  No classes available.
                </p>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Attendance Header */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (hasUnsavedChanges) {
                    if (
                      confirm(
                        "You have unsaved changes. Are you sure you want to go back?"
                      )
                    ) {
                      setSelectedClass(null);
                      setHasUnsavedChanges(false);
                    }
                  } else {
                    setSelectedClass(null);
                  }
                }}
                className="shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold truncate">
                  {selectedClass.name}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {selectedClass.subject} • {selectedClass.date} {format12h(selectedClass.time)} to {format12h(selectedClass.endTime)}
                </p>
              </div>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-auto"
                />
              </div>
              {hasUnsavedChanges && (
                <span className="text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full animate-pulse">
                  ● Unsaved changes
                </span>
              )}
            </div>
          </Card>

          {/* Stats & Quick Actions */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center bg-emerald-500/10 border-emerald-500/20">
              <UserCheck className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-emerald-600">
                {presentCount}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Present
              </p>
            </Card>
            <Card className="p-3 text-center bg-red-500/10 border-red-500/20">
              <UserX className="h-5 w-5 text-red-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-red-500">{absentCount}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Absent
              </p>
            </Card>
            <Card className="p-3 text-center bg-muted/50 border-muted-foreground/10">
              <Users className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-xl font-bold">{students.length}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Total
              </p>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
              onClick={markAllPresent}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              All Present
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-500/10"
              onClick={markAllAbsent}
            >
              <XCircle className="h-4 w-4 mr-1" />
              All Absent
            </Button>
          </div>

          {/* Search */}
          {students.length > 5 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {/* Student List */}
          <Card className="divide-y overflow-hidden">
            <div className="max-h-[45vh] sm:max-h-[50vh] overflow-y-auto">
              {filteredStudents.map((student) => {
                const status = attendance[student.id] || "unmarked";
                return (
                  <div
                    key={student.id}
                    className={`flex items-center justify-between p-3 sm:p-4 cursor-pointer transition-all duration-200 active:scale-[0.99] ${
                      status === "present"
                        ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                        : status === "absent"
                        ? "bg-red-500/5 hover:bg-red-500/10"
                        : "hover:bg-accent/50"
                    }`}
                    onClick={() => toggleStudentAttendance(student.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold transition-colors ${
                          status === "present"
                            ? "bg-emerald-500 text-white"
                            : status === "absent"
                            ? "bg-red-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {status === "present" ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : status === "absent" ? (
                          <XCircle className="h-5 w-5" />
                        ) : (
                          student.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm sm:text-base truncate">
                          {student.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {student.email}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ml-2 transition-colors ${
                        status === "present"
                          ? "bg-emerald-500/20 text-emerald-600"
                          : status === "absent"
                          ? "bg-red-500/20 text-red-500"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {status === "present"
                        ? "P"
                        : status === "absent"
                        ? "A"
                        : "—"}
                    </div>
                  </div>
                );
              })}
              {filteredStudents.length === 0 && students.length > 0 && (
                <p className="text-sm text-center py-6 text-muted-foreground">
                  No students match "{searchQuery}"
                </p>
              )}
              {students.length === 0 && (
                <p className="text-sm text-center py-6 text-muted-foreground">
                  No students found in this batch.
                </p>
              )}
            </div>
          </Card>

          {/* Save Button - Sticky */}
          {students.length > 0 && (
            <div className="sticky bottom-20 lg:bottom-4 z-30">
              <Button
                className={`w-full h-12 text-base font-semibold shadow-lg transition-all ${
                  hasUnsavedChanges
                    ? "bg-primary hover:bg-primary/90 animate-none"
                    : "bg-primary/80"
                }`}
                size="lg"
                onClick={handleSaveAttendance}
                disabled={isSaving || unmarkedCount === students.length}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : hasUnsavedChanges ? (
                  <>
                    <ClipboardCheck className="h-5 w-5 mr-2" />
                    Save Attendance
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Attendance Saved
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderNotesTab = () => (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5" /> Upload New Note
        </h3>
        <form onSubmit={handleAddNote} className="space-y-4 max-w-xl">
          <div>
            <Label htmlFor="classId">Select Class</Label>
            <Select name="classId" required>
              <SelectTrigger>
                <SelectValue placeholder="Choose a class to share with" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.subject})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="note-title">Note Title</Label>
            <Input
              id="note-title"
              name="title"
              placeholder="e.g., Chapter 5: Calculus"
              required
            />
          </div>
          <div>
            <Label htmlFor="note-content">Content / Description</Label>
            <Textarea
              id="note-content"
              name="content"
              placeholder="Add note content or description"
              rows={3}
              required
            />
          </div>
          <div>
            <Label htmlFor="note-file">File URL (optional)</Label>
            <Input
              id="note-file"
              name="fileUrl"
              type="url"
              placeholder="https://example.com/notes.pdf"
            />
          </div>
          <Button type="submit">Upload Document</Button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">My Uploaded Notes</h3>
          <span className="text-sm text-muted-foreground">
            {notes.length} notes
          </span>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-xs text-muted-foreground">
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h4 className="font-semibold mb-1">{note.title}</h4>
              <p className="text-sm text-muted-foreground mb-2">
                {note.subject}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {note.content}
              </p>
              {note.fileUrl && (
                <a
                  href={note.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-primary hover:underline mt-3 inline-block"
                >
                  Access File →
                </a>
              )}
            </div>
          ))}
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full py-4 bg-accent/30 rounded-lg text-center">
              No notes uploaded yet.
            </p>
          )}
        </div>
      </Card>
    </div>
  );

  const renderProfileTab = () => (
    <div className="space-y-6">
      <Card className="p-6 bg-primary/5 border-primary/10">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
            <UserCircle className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{currentUser?.name}</h2>
            <p className="text-sm text-muted-foreground">
              Instructor • SmartClass
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" /> Overview
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border p-3 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Classes</p>
            <p className="font-semibold text-lg">{classes.length}</p>
          </div>
          <div className="bg-card border p-3 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Notes</p>
            <p className="font-semibold text-lg">{notes.length}</p>
          </div>
          <div className="col-span-2 bg-card border p-3 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Active Batches</p>
            <p className="font-bold text-xl text-primary">
              {new Set(classes.map((c) => c.batchId)).size}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "home":
        return renderHomeTab();
      case "attendance":
        return renderAttendanceTab();
      case "notes":
        return renderNotesTab();
      case "profile":
        return renderProfileTab();
      default:
        return null;
    }
  };

  return (
    <DashboardLayout role="teacher" title="Teacher Dashboard">
      {/* Desktop Top Tabs - matching student style (pill buttons) */}
      <div className="hidden lg:flex items-center justify-between mb-8">
        <div className="flex gap-3">
          {tabOptions.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
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

      {/* Instagram-style Bottom Nav for Mobile - matching student style */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border/40 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-40 supports-[backdrop-filter]:bg-card/80 backdrop-blur-lg">
        <div className="flex items-center justify-between px-6 py-2">
          {tabOptions.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            // Special styling for the center 'attendance' button - matching student AI button style
            if (tab.id === "attendance") {
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex flex-col items-center justify-center -mt-6 rounded-full w-14 h-14 bg-gradient-to-tr from-primary to-accent shadow-lg text-primary-foreground active:scale-95 transition-transform"
                >
                  <Icon className="h-6 w-6" />
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-1 p-2 min-w-[50px] transition-colors"
              >
                <div
                  className={`p-1 rounded-xl transition-all duration-300 ${
                    isActive ? "bg-primary/10" : ""
                  }`}
                >
                  <Icon
                    strokeWidth={isActive ? 2.5 : 2}
                    className={`h-[22px] w-[22px] ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                </div>
                <div
                  className={`h-1 w-1 rounded-full transition-all duration-300 mt-0.5 ${
                    isActive ? "bg-primary" : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
