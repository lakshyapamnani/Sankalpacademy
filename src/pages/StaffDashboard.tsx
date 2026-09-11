import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ClipboardCheck, Home, Plus, Bell, Megaphone, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  getStudents,
  getClasses,
  getBatches,
  getCurrentUser,
  markAttendance,
  getAttendance,
  getNotices,
  addNotice,
  deleteNotice,
  subscribeToRealtimeUpdates,
  Student,
  Class,
  Batch,
  Notice,
} from "@/lib/localStorage";

const tabOptions: { id: "classes" | "attendance" | "notices"; label: string; icon: LucideIcon }[] = [
  { id: "classes", label: "Classes", icon: Calendar },
  { id: "attendance", label: "Attendance", icon: ClipboardCheck },
  { id: "notices", label: "Notices", icon: Bell },
];

const StaffDashboard = () => {
  const [activeTab, setActiveTab] = useState<"classes" | "attendance" | "notices">("classes");
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selectedAttendanceBatch, setSelectedAttendanceBatch] = useState<string | null>(null);
  const [dailyAttendance, setDailyAttendance] = useState<Record<string, boolean>>({}); // studentId -> isAbsent
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  // Notice State
  const [isAddNoticeOpen, setIsAddNoticeOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeBatch, setNoticeBatch] = useState('all');
  const [noticePriority, setNoticePriority] = useState<'normal' | 'important' | 'urgent'>('normal');

  const currentUser = getCurrentUser();

  // Returns YYYY-MM-DD in the local timezone (not UTC)
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
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    setStudents(getStudents());
    setClasses(getClasses());
    setBatches(getBatches());
    setNotices(getNotices());
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToRealtimeUpdates(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedAttendanceBatch && currentDateStr) {
      const today = currentDateStr;
      const batchStudents = students.filter(s => s.batchId === selectedAttendanceBatch);
      const attendance = getAttendance();
      
      const existingAttendance: Record<string, boolean> = {};
      batchStudents.forEach(student => {
        const record = attendance.find(r => r.studentId === student.id && r.date === today);
        if (record && record.status === 'absent') {
          existingAttendance[student.id] = true;
        }
      });
      setDailyAttendance(existingAttendance);
    } else {
      setDailyAttendance({});
    }
  }, [selectedAttendanceBatch, students]);

  const handleSaveDailyAttendance = () => {
    if (!selectedAttendanceBatch) return;
    const today = currentDateStr || getLocalDateString();
    const timestamp = new Date().toLocaleTimeString();
    
    const batchStudents = students.filter(s => s.batchId === selectedAttendanceBatch);
    
    // Find all classes for this batch scheduled on today's date
    const todayClasses = classes.filter(
      c => c.batchId === selectedAttendanceBatch && c.date === today
    );
    
    batchStudents.forEach((student) => {
      const isAbsent = dailyAttendance[student.id] || false;
      const status = isAbsent ? 'absent' as const : 'present' as const;
      const markedBy = `${currentUser?.name || 'Staff'} at ${timestamp}`;
      
      if (todayClasses.length > 0) {
        // Mark attendance for every lecture scheduled today
        todayClasses.forEach(classItem => {
          markAttendance({
            id: `${student.id}_${classItem.id}_${today}`,
            studentId: student.id,
            classId: classItem.id,
            date: today,
            status,
            markedBy,
          });
        });
      } else {
        // No classes scheduled today — create a general day record
        markAttendance({
          id: `${student.id}_day_${today}`,
          studentId: student.id,
          classId: `day_${selectedAttendanceBatch}_${today}`,
          date: today,
          status,
          markedBy,
        });
      }
    });
    
    const classCount = todayClasses.length;
    const batchName = batches.find(b => b.id === selectedAttendanceBatch)?.name;
    toast.success(
      classCount > 0
        ? `Attendance marked for ${classCount} lecture${classCount > 1 ? 's' : ''} in ${batchName}!`
        : `Day attendance for ${batchName} saved!`
    );
    setSelectedAttendanceBatch(null);
    setDailyAttendance({});
    loadData();
  };

  const isBatchMarkedToday = (batchId: string) => {
    const today = currentDateStr || getLocalDateString();
    const batchStudents = students.filter(s => s.batchId === batchId);
    if (batchStudents.length === 0) return false;
    
    // Check if at least one student in the batch has a record for today
    // In a real app, you might want to check if ALL have records, but this is a good indicator
    const attendance = getAttendance();
    return batchStudents.some(student => 
      attendance.some(record => record.studentId === student.id && record.date === today)
    );
  };

  const isClassPassed = (classItem: Class) => {
    if (!classItem.date || !classItem.endTime) return false;
    const classEndTime = new Date(`${classItem.date}T${classItem.endTime}`);
    return classEndTime < new Date();
  };

  const renderClasses = () => (
    <Card className="p-6">
      <h3 className="text-xl font-semibold mb-6">Lectures & Schedule</h3>
      <div className="space-y-3">
        {classes.sort((a, b) => new Date(b.date + 'T' + b.time).getTime() - new Date(a.date + 'T' + a.time).getTime()).map(classItem => {
          const batch = batches.find(b => b.id === classItem.batchId);
          const passed = isClassPassed(classItem);
          return (
            <div 
              key={classItem.id} 
              className={`p-4 rounded-lg border transition-all ${
                passed ? 'opacity-40 bg-muted/20' : 'bg-card hover:bg-accent/5'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{classItem.name}</p>
                  <p className="text-sm text-muted-foreground">{classItem.subject}</p>
                  <p className="text-xs font-medium text-primary mt-1">Batch: {batch?.name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {classItem.date} • {(() => {
                      const format12h = (t24: string) => {
                        const [h, m] = t24.split(':').map(Number);
                        const period = h >= 12 ? 'PM' : 'AM';
                        const displayH = h % 12 || 12;
                        return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
                      };
                      return `${format12h(classItem.time)} - ${format12h(classItem.endTime)}`;
                    })()}
                  </p>
                </div>
                {passed && (
                  <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-medium uppercase tracking-wider">
                    Finished
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {classes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No classes scheduled yet.</p>
        )}
      </div>
    </Card>
  );

  const renderAttendance = () => (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b pb-6">
        <div>
          <h3 className="text-2xl font-black text-primary">Daily Batch Attendance</h3>
          <p className="text-sm text-muted-foreground mt-1">Take student attendance batch-wise for today</p>
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
                onClick={() => setSelectedAttendanceBatch(batch.id)}
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
                        Completed
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
            <Button variant="ghost" onClick={() => setSelectedAttendanceBatch(null)} className="gap-2 font-bold p-0">
              <Plus className="h-4 w-4 rotate-45" /> Back
            </Button>
            <div className="text-right">
              <h4 className="text-xl font-black">
                {batches.find(b => b.id === selectedAttendanceBatch)?.name}
              </h4>
              <p className="text-xs text-muted-foreground">Today: {new Date().toLocaleDateString()}</p>
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
            Save Attendance
          </Button>
        </div>
      )}
    </Card>
  );

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      toast.error("Please fill in both notice title and description");
      return;
    }

    try {
      const newNotice: Notice = {
        id: Date.now().toString(),
        title: noticeTitle.trim(),
        content: noticeContent.trim(),
        batchId: noticeBatch,
        authorId: currentUser?.id || 'staff',
        authorName: currentUser?.name || 'Staff',
        authorRole: 'staff',
        priority: noticePriority,
        createdAt: new Date().toISOString(),
      };

      await addNotice(newNotice);
      toast.success("Notice published to students tab & synced with Firebase!");
      setIsAddNoticeOpen(false);
      setNoticeTitle('');
      setNoticeContent('');
      setNoticeBatch('all');
      setNoticePriority('normal');
      loadData();
    } catch (err: any) {
      console.error("Failed to add notice:", err);
      toast.error("Failed to post notice: " + (err.message || "Unknown error"));
    }
  };

  const handleDeleteNotice = async (noticeId: string) => {
    if (await deleteNotice(noticeId)) {
      toast.success("Notice deleted");
      loadData();
    } else {
      toast.error("Failed to delete notice");
    }
  };

  const renderNotices = () => (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b pb-6">
        <div>
          <h3 className="text-2xl font-black text-primary flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Academy Notices & Announcements
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Broadcast fee reminders, schedules, and general announcements to students
          </p>
        </div>
        <Dialog open={isAddNoticeOpen} onOpenChange={setIsAddNoticeOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 px-6 rounded-2xl font-bold gap-2 shadow-lg shadow-primary/20">
              <Plus className="h-5 w-5" /> Post Notice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black flex items-center gap-2">
                <Megaphone className="h-6 w-6 text-primary" /> Post Notice for Students
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveNotice} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="staff-notice-title" className="font-bold">Notice Title *</Label>
                <Input
                  id="staff-notice-title"
                  placeholder="e.g. Academy Holiday on Monday / Fee Due Reminder"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  required
                  className="h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="staff-notice-batch" className="font-bold">Target Audience</Label>
                <Select value={noticeBatch} onValueChange={setNoticeBatch}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Select target batch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">📢 All Batches / All Students</SelectItem>
                    {batches.map(b => (
                      <SelectItem key={b.id} value={b.id}>Batch: {b.name} ({b.year})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="staff-notice-priority" className="font-bold">Priority</Label>
                <Select value={noticePriority} onValueChange={(val: any) => setNoticePriority(val)}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal Announcement</SelectItem>
                    <SelectItem value="important">Important Notice ⚠️</SelectItem>
                    <SelectItem value="urgent">Urgent / Action Required 🚨</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="staff-notice-content" className="font-bold">Notice Details / Message *</Label>
                <textarea
                  id="staff-notice-content"
                  rows={4}
                  placeholder="Type the announcement message..."
                  value={noticeContent}
                  onChange={(e) => setNoticeContent(e.target.value)}
                  required
                  className="w-full p-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 mt-4">
                Publish Notice
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {notices.map(notice => {
          const targetBatchName = notice.batchId === 'all' || !notice.batchId
            ? 'All Students'
            : batches.find(b => b.id === notice.batchId)?.name || 'Specific Batch';
          const canDelete = notice.authorId === currentUser?.id || currentUser?.role === 'staff' || currentUser?.name === 'Staff';

          return (
            <div
              key={notice.id}
              className={`p-5 rounded-2xl border-2 bg-card hover:shadow-lg transition-all flex flex-col justify-between ${
                notice.priority === 'urgent'
                  ? 'border-red-500/40 bg-red-500/5'
                  : notice.priority === 'important'
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-primary/20'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      notice.priority === 'urgent'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 animate-pulse'
                        : notice.priority === 'important'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {notice.priority || 'Announcement'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-bold">
                      {targetBatchName}
                    </span>
                  </div>

                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteNotice(notice.id)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-xl shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <h4 className="text-lg font-bold text-foreground mb-2">{notice.title}</h4>
                <p className="text-sm text-foreground/85 whitespace-pre-wrap mb-4">{notice.content}</p>
              </div>

              <div className="text-[11px] text-muted-foreground pt-3 border-t flex items-center justify-between">
                <span>By: <strong>{notice.authorName}</strong> ({notice.authorRole})</span>
                <span>{new Date(notice.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}

        {notices.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-bold">No notices posted yet</p>
            <p className="text-sm">Click "Post Notice" to send announcements to students.</p>
          </div>
        )}
      </div>
    </Card>
  );

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
        {activeTab === "attendance" && renderAttendance()}
        {activeTab === "notices" && renderNotices()}
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
