import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, ClipboardCheck, FileText, Brain } from "lucide-react";
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
  Class,
  Student,
  Note,
} from "@/lib/localStorage";

const TeacherDashboard = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [attendance, setAttendance] = useState<{ [key: string]: boolean }>({});
  const [openDialog, setOpenDialog] = useState<string | null>(null);
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

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
      // Initialize attendance state
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
    { label: "My Classes", value: classes.length.toString(), icon: Calendar },
    { label: "Notes Uploaded", value: notes.length.toString(), icon: FileText },
    { label: "Total Students", value: students.length.toString(), icon: ClipboardCheck },
    { label: "Active Batches", value: new Set(classes.map(c => c.batchId)).size.toString(), icon: Brain },
  ];

  return (
    <DashboardLayout role="teacher" title="Teacher Dashboard">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card
              key={index}
              className="p-6 animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <Icon className="h-8 w-8 text-primary" />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-6">My Classes</h3>
          <div className="space-y-3">
            {classes.map((classItem) => (
              <div
                key={classItem.id}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedClass?.id === classItem.id
                    ? 'bg-primary/10 border-primary'
                    : 'bg-card hover:bg-accent/5'
                }`}
                onClick={() => handleClassSelect(classItem.id)}
              >
                <p className="font-semibold">{classItem.name}</p>
                <p className="text-sm text-muted-foreground">{classItem.subject}</p>
                <p className="text-xs text-muted-foreground mt-1">{classItem.schedule}</p>
              </div>
            ))}
            {classes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No classes assigned yet. Contact admin.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-6">Quick Actions</h3>
          <div className="space-y-3">
            <Dialog open={openDialog === "attendance"} onOpenChange={(open) => setOpenDialog(open ? "attendance" : null)}>
              <DialogTrigger asChild>
                <Button className="w-full justify-start" size="lg">
                  <ClipboardCheck className="mr-3 h-5 w-5" />
                  Mark Attendance
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Mark Attendance</DialogTitle>
                </DialogHeader>
                {selectedClass ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-accent/10">
                      <p className="font-semibold">{selectedClass.name}</p>
                      <p className="text-sm text-muted-foreground">{selectedClass.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date().toLocaleDateString()}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {students.map((student) => (
                        <div key={student.id} className="flex items-center gap-3 p-3 rounded-lg border">
                          <Checkbox
                            id={student.id}
                            checked={attendance[student.id] || false}
                            onCheckedChange={(checked) => {
                              setAttendance(prev => ({
                                ...prev,
                                [student.id]: checked as boolean
                              }));
                            }}
                          />
                          <Label htmlFor={student.id} className="flex-1 cursor-pointer">
                            {student.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <Button onClick={handleMarkAttendance} className="w-full">
                      Submit Attendance
                    </Button>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Please select a class from the list first
                  </p>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={openDialog === "notes"} onOpenChange={(open) => setOpenDialog(open ? "notes" : null)}>
              <DialogTrigger asChild>
                <Button className="w-full justify-start" size="lg" variant="outline">
                  <FileText className="mr-3 h-5 w-5" />
                  Upload Notes
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Study Notes</DialogTitle>
                </DialogHeader>
                {selectedClass ? (
                  <form onSubmit={handleAddNote} className="space-y-4">
                    <div className="p-4 rounded-lg bg-accent/10">
                      <p className="font-semibold">{selectedClass.name}</p>
                      <p className="text-sm text-muted-foreground">{selectedClass.subject}</p>
                    </div>
                    <div>
                      <Label htmlFor="note-title">Note Title</Label>
                      <Input id="note-title" name="title" placeholder="e.g., Chapter 5: Calculus" required />
                    </div>
                    <div>
                      <Label htmlFor="note-content">Content / Description</Label>
                      <Textarea
                        id="note-content"
                        name="content"
                        placeholder="Add note content or description"
                        rows={4}
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
                    <Button type="submit" className="w-full">Upload Note</Button>
                  </form>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Please select a class from the list first
                  </p>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-6">My Uploaded Notes ({notes.length})</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((note) => (
            <div key={note.id} className="p-4 rounded-lg border bg-card">
              <div className="flex items-start justify-between mb-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-xs text-muted-foreground">
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h4 className="font-semibold mb-1">{note.title}</h4>
              <p className="text-sm text-muted-foreground mb-2">{note.subject}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{note.content}</p>
              {note.fileUrl && (
                <a
                  href={note.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mt-2 inline-block"
                >
                  View File →
                </a>
              )}
            </div>
          ))}
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-8">
              No notes uploaded yet. Start by selecting a class and uploading notes.
            </p>
          )}
        </div>
      </Card>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
