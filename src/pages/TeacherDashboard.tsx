import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, ClipboardCheck, Plus, AlertTriangle, FileText, Trash2, ExternalLink, Clock, CheckCircle2, UserCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  getStudents,
  getClasses,
  getBatches,
  getTeachers,
  getCurrentUser,
  markAttendance,
  getAttendance,
  getNotes,
  addNote,
  deleteNote,
  subscribeToRealtimeUpdates,
  Student,
  Class,
  Batch,
  Teacher,
  Note,
} from "@/lib/localStorage";

const tabOptions: { id: "classes" | "attendance" | "notes"; label: string; icon: LucideIcon }[] = [
  { id: "classes", label: "My Classes", icon: Calendar },
  { id: "attendance", label: "Take Attendance", icon: ClipboardCheck },
  { id: "notes", label: "Batch Notes", icon: FileText },
];

const TeacherDashboard = () => {
  const [activeTab, setActiveTab] = useState<"classes" | "attendance" | "notes">("classes");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
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
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRealtimeUpdates(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  // Determine current teacher details
  const currentTeacher = teachers.find(t => t.id === currentUser?.id);
  const teacherSubjects = currentTeacher?.assignedSubjects || [];

  const isFallbackTeacher = currentUser?.id === 'teacher' || currentUser?.name === 'Teacher';
  
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

  const renderClasses = () => {
    const sortedClasses = [...myClasses].sort(
      (a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime()
    );

    const upcomingClasses = sortedClasses.filter(c => !isClassPassed(c));
    const pastClasses = sortedClasses.filter(c => isClassPassed(c));

    return (
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-b pb-4">
          <div>
            <h3 className="text-2xl font-black text-primary">My Schedule & Lectures</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Click on any class to take student attendance (syncs with Admin Reports)
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

  return (
    <DashboardLayout role="teacher" title="Teacher Dashboard">
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
        {activeTab === "attendance" && renderAttendance()}
        {activeTab === "notes" && renderNotes()}
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

export default TeacherDashboard;
