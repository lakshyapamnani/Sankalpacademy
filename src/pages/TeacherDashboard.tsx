import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, ClipboardCheck, FileText, Brain, UserCircle, LogOut, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import {
  getCurrentUser,
  getClassesByTeacher,
  getStudentsByBatch,
  getNotes,
  addNote,
  markAttendance,
  subscribeToClassNotifications,
  acknowledgeClassNotification,
  ClassNotification,
  Class,
  Student,
  Note,
} from "@/lib/localStorage";
import { registerForPushNotifications } from "@/lib/messaging";

const TeacherDashboard = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [attendance, setAttendance] = useState<{ [key: string]: boolean }>({});
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"classes" | "profile" | "notes">("classes");
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const navigate = useNavigate();
  const hasRegisteredForPush = useRef(false);
  const currentUser = getCurrentUser();

  console.log("Teacher dashboard rendering with tab:", activeTab);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const seen = seenNotificationIds.current;

    const unsubscribe = subscribeToClassNotifications("teacher", currentUser.id, notifications => {
      notifications.forEach((notification: ClassNotification) => {
        if (seen.has(notification.id)) {
          return;
        }

        seen.add(notification.id);
        toast.success(notification.title, {
          description: notification.message,
        });
        void acknowledgeClassNotification("teacher", currentUser.id, notification.id);
        loadData();
      });
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || hasRegisteredForPush.current) {
      return;
    }

    hasRegisteredForPush.current = true;

    void registerForPushNotifications("teacher", currentUser.id).catch(error => {
      console.error("Unable to register teacher for push notifications", error);
      hasRegisteredForPush.current = false;
    });
  }, [currentUser?.id]);

  const loadData = () => {
    const teacherClasses = getClassesByTeacher(currentUser!.id);
    setClasses(teacherClasses);
    const allNotes = getNotes();
    setNotes(allNotes.filter(n => n.teacherId === currentUser!.id));
  };

  const handleClassSelect = (classId: string) => {
    const selected = classes.find(c => c.id === classId);
    if (selected) {
      setSelectedClass(selected);
      const batchStudents = getStudentsByBatch(selected.batchId);
      setStudents(batchStudents);
      const attendanceState: { [key: string]: boolean } = {};
      batchStudents.forEach(student => {
        attendanceState[student.id] = false;
      });
      setAttendance(attendanceState);
    }
  };

  const handleMarkAttendance = () => {
    if (!selectedClass) {
      toast.error("Please select a class first");
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    Object.entries(attendance).forEach(([studentId, isPresent]) => {
      markAttendance({
        id: Date.now().toString() + studentId,
        studentId,
        classId: selectedClass.id,
        date: today,
        status: isPresent ? 'present' : 'absent',
        markedBy: currentUser!.id,
      });
    });

    toast.success("Attendance marked successfully");
    setSelectedClass(null);
    setStudents([]);
    setAttendance({});
  };

  const isClassPassed = (classItem: Class) => {
    if (!classItem.date || !classItem.endTime) return false;
    const classEndTime = new Date(`${classItem.date}T${classItem.endTime}`);
    return classEndTime < new Date();
  };

  const sortedClasses = [...classes].sort((a, b) => {
    const aPassed = isClassPassed(a);
    const bPassed = isClassPassed(b);
    if (aPassed && !bPassed) return 1;
    if (!aPassed && bPassed) return -1;
    const aTime = new Date(`${a.date}T${a.time}`).getTime();
    const bTime = new Date(`${b.date}T${b.time}`).getTime();
    return aTime - bTime;
  });

  const todayClasses = sortedClasses.filter(c => c.date === new Date().toISOString().split('T')[0]);
  const otherClasses = sortedClasses.filter(c => c.date !== new Date().toISOString().split('T')[0]);

  const tabOptions: { id: "classes" | "profile" | "notes"; label: string; icon: any }[] = [
    { id: "classes", label: "Classes", icon: Calendar },
    { id: "notes", label: "Notes", icon: FileText },
    { id: "profile", label: "Profile", icon: UserCircle },
  ];

  const handleAddNote = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (!selectedClass) {
      toast.error("Please select a class first");
      return;
    }

    const note: Note = {
      id: Date.now().toString(),
      title: formData.get("title") as string,
      subject: selectedClass.subject,
      batchId: selectedClass.batchId,
      teacherId: currentUser!.id,
      content: formData.get("content") as string,
      fileUrl: formData.get("fileUrl") as string,
      createdAt: new Date().toISOString(),
    };

    addNote(note);
    toast.success("Note uploaded successfully");
    setOpenDialog(null);
    loadData();
  };

  const stats = [
    { label: "Total Sessions", value: classes.length.toString(), icon: Calendar },
    { label: "Study Materials", value: notes.length.toString(), icon: FileText },
    { label: "My Students", value: students.length.toString() === "0" ? "Active" : students.length.toString(), icon: ClipboardCheck },
    { label: "Class Batches", value: new Set(classes.map(c => c.batchId)).size.toString(), icon: Brain },
  ];

  const renderClassesContent = () => (
    <div className="space-y-6">
      {!selectedClass ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <Card
                  key={index}
                  className="p-5 border-none bg-primary/5 hover:bg-primary/10 transition-colors shadow-none"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white dark:bg-card rounded-2xl shadow-sm text-primary">
                       <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                      <p className="text-2xl font-black">{stat.value}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 rounded-3xl border-none shadow-sm bg-white dark:bg-card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Today's Schedule</h3>
                <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-bold">
                  {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <div className="space-y-4">
                {todayClasses.map((classItem) => {
                  const passed = isClassPassed(classItem);
                  return (
                    <div
                      key={classItem.id}
                      onClick={() => handleClassSelect(classItem.id)}
                      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer group ${
                        passed ? 'opacity-40 grayscale-[0.5] border-transparent bg-muted/20' : 'bg-card border-accent/10 hover:border-primary shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {!passed && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> }
                            <p className="font-black text-lg leading-tight">{classItem.name}</p>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3 font-medium">{classItem.subject}</p>
                          <div className="flex items-center gap-2">
                             <div className="text-[10px] bg-primary/5 text-primary px-2.5 py-1 rounded-lg border border-primary/10 font-bold uppercase tracking-wider">
                               Batch ID: {classItem.batchId.slice(-4)}
                            </div>
                          </div>
                        </div>
                          <div className="text-right">
                          <p className={`text-base font-black ${passed ? 'text-muted-foreground' : 'text-primary'}`}>
                            {(() => {
                              const format12h = (t24: string) => {
                                const [h, m] = t24.split(':').map(Number);
                                const period = h >= 12 ? 'PM' : 'AM';
                                const displayH = h % 12 || 12;
                                return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
                              };
                              return `${format12h(classItem.time)} - ${format12h(classItem.endTime)}`;
                            })()}
                          </p>
                          {passed ? (
                            <p className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-lg mt-2 inline-block font-bold">FINISHED</p>
                          ) : (
                            <div className="flex items-center justify-end gap-1 mt-2 text-primary">
                              <span className="text-[10px] font-black uppercase tracking-widest">RECORD</span>
                              <ChevronRight className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {todayClasses.length === 0 && (
                  <div className="text-center py-12 bg-accent/5 rounded-3xl border-2 border-dashed border-muted-foreground/20">
                    <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground font-bold">Enjoy your day! No classes today.</p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6 rounded-3xl border-none shadow-sm bg-white dark:bg-card">
              <h3 className="text-xl font-bold mb-6">Upcoming Sessions</h3>
              <div className="space-y-3">
                {otherClasses.map((classItem) => {
                  const passed = isClassPassed(classItem);
                  return (
                    <div 
                      key={classItem.id} 
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${passed ? 'opacity-40 border-transparent bg-muted/10' : 'bg-card border-accent/5 hover:border-primary/30'}`}
                      onClick={() => handleClassSelect(classItem.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold">{classItem.name}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase mt-1">{classItem.date} • {classItem.time} - {classItem.endTime}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-30" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 zoom-in-95">
           <div className="flex items-center gap-4">
             <Button variant="ghost" size="sm" onClick={() => setSelectedClass(null)} className="p-0 h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20 text-primary">
                <ChevronLeft className="h-6 w-6" />
             </Button>
             <div>
                <h3 className="text-2xl font-black">{selectedClass.name}</h3>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{selectedClass.subject} • ATTENDANCE SHEET</p>
             </div>
           </div>
           
           <Card className="p-6 border-none bg-white dark:bg-card rounded-[32px] shadow-lg">
            <div className="flex items-center justify-between mb-8 pb-4 border-b">
              <h3 className="text-lg font-black uppercase tracking-tight">Student Roster ({students.length})</h3>
              <div className="text-[10px] bg-accent/10 text-accent-foreground px-4 py-2 rounded-full font-black uppercase shadow-inner">
                {selectedClass.time} to {selectedClass.endTime}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {students.map((student) => (
                <div 
                  key={student.id} 
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    attendance[student.id] ? 'bg-primary border-primary text-white scale-[0.98]' : 'bg-accent/5 border-transparent hover:bg-accent/10'
                  }`}
                  onClick={() => {
                    setAttendance(prev => ({ ...prev, [student.id]: !prev[student.id] }));
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-black text-lg transition-all ${
                      attendance[student.id] ? 'bg-white text-primary rotate-12' : 'bg-white dark:bg-card text-accent-foreground shadow-sm'
                    }`}>
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-base leading-none mb-1">{student.name}</p>
                      <p className={`text-[9px] font-black uppercase tracking-widest ${attendance[student.id] ? 'text-white/70' : 'text-muted-foreground'}`}>ID-{student.id.slice(-6)}</p>
                    </div>
                  </div>
                  <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    attendance[student.id] ? 'bg-white border-white' : 'border-muted-foreground/30'
                  }`}>
                    {attendance[student.id] && <Plus className="h-4 w-4 text-primary rotate-45" />}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="fixed lg:relative bottom-12 lg:bottom-0 left-0 right-0 p-6 lg:p-0 z-50">
              <Button onClick={handleMarkAttendance} className="w-full py-8 text-xl font-black rounded-3xl shadow-2xl shadow-primary/40 hover:scale-[1.02] active:scale-[0.95] transition-all" size="lg">
                SAVE ATTENDANCE
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );

  const renderProfileContent = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-10">
      <Card className="p-10 border-none bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white rounded-[40px] shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl" />
        
        <div className="flex flex-col items-center relative z-10 text-center">
          <div className="h-28 w-28 rounded-3xl bg-white shadow-xl flex items-center justify-center mb-6 rotate-3">
            <UserCircle className="h-20 w-20 text-primary" strokeWidth={1} />
          </div>
          <h3 className="text-3xl font-black mb-1 leading-tight">{currentUser?.name}</h3>
          <p className="text-white/60 font-black uppercase tracking-[0.4em] text-[10px] mb-8 py-1 rounded-full">{currentUser?.subject} Educator</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm">
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-3xl text-center border border-white/10">
              <p className="text-[9px] text-white/50 mb-1 font-black uppercase tracking-widest">Email Address</p>
              <p className="text-xs font-bold truncate">{currentUser?.email}</p>
            </div>
             <div className="bg-white/10 backdrop-blur-md p-4 rounded-3xl text-center border border-white/10">
              <p className="text-[9px] text-white/50 mb-1 font-black uppercase tracking-widest">Official ID</p>
              <p className="text-xs font-black font-mono">EDUS-T-2024</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <Button variant="outline" className="w-full justify-between h-16 rounded-[28px] px-8 text-base font-bold bg-white dark:bg-card border-none hover:bg-accent/5 transition-all group shadow-sm" onClick={() => toast.info("Settings available in v2.0")}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl group-hover:scale-110 transition-transform">
              <UserCircle className="h-5 w-5 text-primary" />
            </div>
            <span>Profile Settings</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
        </Button>
        <Button variant="outline" className="w-full justify-between h-16 rounded-[28px] px-8 text-base font-bold bg-destructive/10 border-none text-destructive hover:bg-destructive/20 group transition-all" onClick={() => {
          localStorage.removeItem("smartclass_current_user");
          navigate("/login");
          toast.success("Signed out successfully");
        }}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-destructive/20 rounded-2xl group-hover:rotate-12 transition-transform">
              <LogOut className="h-5 w-5 text-destructive" />
            </div>
            <span>Log Out Account</span>
          </div>
          <ChevronRight className="h-4 w-4 text-destructive/30" />
        </Button>
      </div>

      <div className="text-center pt-8 opacity-40">
        <p className="text-[10px] font-black uppercase tracking-[0.3em]">
          SmartClass AI Console Pro
        </p>
      </div>
    </div>
  );

  const renderNotesContent = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-black uppercase tracking-tight">Study Materials</h3>
        <Dialog open={openDialog === "notes"} onOpenChange={(open) => setOpenDialog(open ? "notes" : null)}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl shadow-xl bg-primary hover:scale-105 transition-transform p-6 font-bold">
              <Plus className="mr-2 h-5 w-5" /> NEW
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-[32px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase">Upload Material</DialogTitle>
            </DialogHeader>
            {classes.length > 0 ? (
              <form onSubmit={handleAddNote} className="space-y-5 pt-4">
                  <div className="space-y-2">
                  <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Select Recipient Class</Label>
                  <Select onValueChange={(val) => handleClassSelect(val)} required>
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Target Batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note-title" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Title</Label>
                  <Input id="note-title" name="title" placeholder="e.g., Mathematics Vol. 1" className="h-12 rounded-xl" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note-content" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Description</Label>
                  <Textarea id="note-content" name="content" placeholder="Briefly explain what this is..." rows={4} className="rounded-xl" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note-file" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Resource URL</Label>
                  <Input id="note-file" name="fileUrl" type="url" placeholder="Direct link to PDF/Doc" className="h-12 rounded-xl" />
                </div>
                <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg">UPLOAD MATERIAL</Button>
              </form>
            ) : (
              <p className="text-center py-8 text-muted-foreground font-bold">No assigned classes found.</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {notes.map((note) => (
          <div key={note.id} className="p-6 rounded-[32px] border-none bg-white dark:bg-card shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60">
                {new Date(note.createdAt).toLocaleDateString()}
              </span>
            </div>
            <h4 className="text-lg font-black mb-1 group-hover:text-primary transition-colors">{note.title}</h4>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4 bg-primary/5 px-2 py-1 rounded-full inline-block">{note.subject}</p>
            <p className="text-sm text-muted-foreground line-clamp-3 mb-6 font-medium leading-relaxed">{note.content}</p>
            {note.fileUrl && (
              <a href={note.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-black text-primary hover:underline group-hover:translate-x-1 transition-transform">
                DOWNLOAD RESOURCE <ChevronRight className="h-3 w-3" />
              </a>
            )}
          </div>
        ))}
        {notes.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-40">
             <FileText className="h-16 w-16 mx-auto mb-4" strokeWidth={1} />
             <p className="text-lg font-black uppercase tracking-widest">No materials uploaded</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch(activeTab) {
      case "classes": return renderClassesContent();
      case "profile": return renderProfileContent();
      case "notes": return renderNotesContent();
      default: return renderClassesContent();
    }
  };

  return (
    <DashboardLayout role="teacher" title="Edusmart AI Console">
      {/* Desktop Navigation */}
      <div className="hidden lg:flex items-center justify-between mb-10">
        <div className="flex bg-accent/10 p-2 rounded-3xl gap-2 shadow-inner">
          {tabOptions.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 rounded-[20px] px-8 py-4 text-sm font-black tracking-tight transition-all ${
                  isActive ? "bg-primary text-primary-foreground shadow-2xl shadow-primary/30 scale-105" : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "animate-bounce" : ""}`} />
                <span>{tab.label.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Viewport Area */}
      <div className="pb-32 lg:pb-10 min-h-screen">
        {renderTabContent()}
      </div>

      {/* FIXED Bottom Navigation (ALWAYS ON TOP) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] p-6 pointer-events-none">
        <div className="max-w-xs mx-auto bg-white/95 dark:bg-card/90 backdrop-blur-3xl border border-white/20 dark:border-white/5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] rounded-[35px] pointer-events-auto overflow-hidden">
          <div className="flex items-center justify-around h-20">
            {tabOptions.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex flex-col items-center justify-center w-full h-full transition-all group"
                  aria-label={tab.label}
                >
                  <div className={`transition-all duration-700 transform ${isActive ? 'scale-125 -translate-y-1' : 'opacity-40 hover:opacity-100 group-hover:scale-110'}`}>
                    <Icon 
                      strokeWidth={isActive ? 3 : 2} 
                      className={`h-7 w-7 ${isActive ? "text-primary" : "text-muted-foreground"}`} 
                    />
                  </div>
                  <div className={`absolute bottom-3 h-1.5 w-1.5 rounded-full transition-all duration-700 bg-primary ${isActive ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
