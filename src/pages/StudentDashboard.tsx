import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, BookOpen, Brain, TrendingUp, FileText } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  getCurrentUser,
  getStudents,
  getClassesByBatch,
  getNotesByBatch,
  getStudentAttendance,
  getClasses,
  Note,
  AttendanceRecord,
} from "@/lib/localStorage";

const StudentDashboard = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attendancePercentage, setAttendancePercentage] = useState(0);
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const loadData = () => {
    // Get student info
    const students = getStudents();
    const student = students.find(s => s.id === currentUser!.id);
    
    if (student) {
      // Get notes for student's batch
      const batchNotes = getNotesByBatch(student.batchId);
      setNotes(batchNotes);

      // Get attendance records
      const studentAttendance = getStudentAttendance(student.id);
      setAttendance(studentAttendance);

      // Calculate attendance percentage
      if (studentAttendance.length > 0) {
        const presentCount = studentAttendance.filter(a => a.status === 'present').length;
        const percentage = Math.round((presentCount / studentAttendance.length) * 100);
        setAttendancePercentage(percentage);
      }
    }
  };

  const students = getStudents();
  const currentStudent = students.find(s => s.id === currentUser?.id);
  const myClasses = currentStudent ? getClassesByBatch(currentStudent.batchId) : [];

  const stats = [
    { label: "Attendance", value: `${attendancePercentage}%`, icon: Calendar, trend: attendance.length > 0 ? `${attendance.length} days` : "No data" },
    { label: "Notes Available", value: notes.length.toString(), icon: BookOpen, trend: "From teachers" },
    { label: "My Classes", value: myClasses.length.toString(), icon: TrendingUp, trend: "Active" },
    { label: "Batch", value: currentStudent?.batchId ? getStudents().find(s => s.id === currentStudent.id)?.batchId || "N/A" : "N/A", icon: Brain, trend: "2024" },
  ];

  // Group notes by subject
  const notesBySubject = notes.reduce((acc, note) => {
    if (!acc[note.subject]) {
      acc[note.subject] = [];
    }
    acc[note.subject].push(note);
    return acc;
  }, {} as { [key: string]: Note[] });

  return (
    <DashboardLayout role="student" title="Student Dashboard">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card
              key={index}
              className="p-6 animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <Icon className="h-8 w-8 text-primary" />
              </div>
              <p className="text-xs text-accent font-medium">{stat.trend}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-6">My Classes</h3>
          <div className="space-y-3">
            {myClasses.map((classItem) => (
              <div
                key={classItem.id}
                className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <p className="font-semibold">{classItem.name}</p>
                <p className="text-sm text-muted-foreground">{classItem.subject}</p>
                <p className="text-xs text-muted-foreground mt-1">{classItem.schedule}</p>
              </div>
            ))}
            {myClasses.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No classes assigned yet.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-6">Attendance Overview</h3>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
              <div className="flex items-center justify-between mb-2">
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

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Recent Attendance</h4>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {attendance.slice(-5).reverse().map((record) => {
                  const classItem = getClasses().find(c => c.id === record.classId);
                  return (
                    <div key={record.id} className="flex items-center justify-between p-2 rounded border text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{classItem?.name || 'Class'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(record.date).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          record.status === 'present'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        }`}
                      >
                        {record.status}
                      </span>
                    </div>
                  );
                })}
                {attendance.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No attendance records yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

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
                  {subjectNotes.map((note) => (
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
            <p className="text-sm text-muted-foreground mt-1">
              Your teachers will upload notes soon
            </p>
          </div>
        )}
      </Card>

      <div className="mt-6">
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
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
