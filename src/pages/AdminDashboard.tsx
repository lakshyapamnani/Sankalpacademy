import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, BookOpen, Calendar, BarChart3, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import {
  getTeachers,
  getStudents,
  getClasses,
  getBatches,
  addTeacher,
  addStudent,
  addClass,
  addBatch,
  deleteTeacher,
  deleteStudent,
  deleteClass,
  Teacher,
  Student,
  Class,
  Batch,
} from "@/lib/localStorage";

const formatFirebaseError = (message: string): string => {
  const normalized = message.replace(/_/g, " ");
  const upper = message.toUpperCase();

  if (upper.includes("EMAIL EXISTS")) {
    return "That email is already registered.";
  }

  if (upper.includes("WEAK PASSWORD")) {
    return "Password must be at least 6 characters.";
  }

  return normalized;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [openDialog, setOpenDialog] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setTeachers(getTeachers());
    setStudents(getStudents());
    setClasses(getClasses());
    setBatches(getBatches());
  };

  const handleDeleteTeacher = (teacherId: string) => {
    if (deleteTeacher(teacherId)) {
      toast.success("Teacher deleted successfully");
      loadData();
    } else {
      toast.error("Failed to delete teacher");
    }
  };

  const handleDeleteStudent = (studentId: string) => {
    if (deleteStudent(studentId)) {
      toast.success("Student deleted successfully");
      loadData();
    } else {
      toast.error("Failed to delete student");
    }
  };

  const handleDeleteClass = (classId: string) => {
    if (deleteClass(classId)) {
      toast.success("Class deleted successfully");
      loadData();
    } else {
      toast.error("Failed to delete class");
    }
  };

  const handleAddTeacher = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const teacher: Teacher = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      subject: formData.get("subject") as string,
      password: formData.get("password") as string,
    };
    const form = e.currentTarget;
    try {
      await addTeacher(teacher);
      form.reset();
      toast.success("Teacher added successfully");
      setOpenDialog(null);
      loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add teacher";
      toast.error(formatFirebaseError(message));
    }
  };

  const handleAddStudent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const student: Student = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      batchId: formData.get("batchId") as string,
      password: formData.get("password") as string,
    };
    const form = e.currentTarget;
    try {
      await addStudent(student);
      form.reset();
      toast.success("Student added successfully");
      setOpenDialog(null);
      loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add student";
      toast.error(formatFirebaseError(message));
    }
  };

  const handleAddClass = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const classData: Class = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      subject: formData.get("subject") as string,
      teacherId: formData.get("teacherId") as string,
      batchId: formData.get("batchId") as string,
      schedule: formData.get("schedule") as string,
    };
    addClass(classData);
    toast.success("Class created successfully");
    setOpenDialog(null);
    loadData();
  };

  const handleAddBatch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const batch: Batch = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      year: formData.get("year") as string,
    };
    addBatch(batch);
    toast.success("Batch created successfully");
    setOpenDialog(null);
    loadData();
  };

  const stats = [
    { label: "Total Students", value: students.length.toString(), icon: Users, color: "from-cyan-500 to-cyan-600" },
    { label: "Total Teachers", value: teachers.length.toString(), icon: BookOpen, color: "from-blue-500 to-blue-600" },
    { label: "Active Classes", value: classes.length.toString(), icon: Calendar, color: "from-purple-500 to-purple-600" },
    { label: "Total Batches", value: batches.length.toString(), icon: BarChart3, color: "from-green-500 to-green-600" },
  ];

  return (
    <DashboardLayout role="admin" title="Administrator Dashboard">
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
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Dialog open={openDialog === "teacher"} onOpenChange={(open) => setOpenDialog(open ? "teacher" : null)}>
              <DialogTrigger asChild>
                <Button className="w-full h-20 flex flex-col gap-2" variant="outline">
                  <Plus className="h-5 w-5" />
                  <span className="text-sm">Add Teacher</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Teacher</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddTeacher} className="space-y-4">
                  <div>
                    <Label htmlFor="teacher-name">Full Name</Label>
                    <Input id="teacher-name" name="name" required />
                  </div>
                  <div>
                    <Label htmlFor="teacher-email">Email</Label>
                    <Input id="teacher-email" name="email" type="email" required />
                  </div>
                  <div>
                    <Label htmlFor="teacher-subject">Subject</Label>
                    <Input id="teacher-subject" name="subject" required />
                  </div>
                  <div>
                    <Label htmlFor="teacher-password">Password</Label>
                    <Input id="teacher-password" name="password" type="password" required />
                  </div>
                  <Button type="submit" className="w-full">Add Teacher</Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={openDialog === "student"} onOpenChange={(open) => setOpenDialog(open ? "student" : null)}>
              <DialogTrigger asChild>
                <Button className="w-full h-20 flex flex-col gap-2" variant="outline">
                  <Plus className="h-5 w-5" />
                  <span className="text-sm">Add Student</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Student</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddStudent} className="space-y-4">
                  <div>
                    <Label htmlFor="student-name">Full Name</Label>
                    <Input id="student-name" name="name" required />
                  </div>
                  <div>
                    <Label htmlFor="student-email">Email</Label>
                    <Input id="student-email" name="email" type="email" required />
                  </div>
                  <div>
                    <Label htmlFor="student-batch">Batch</Label>
                    <Select name="batchId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {batches.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="student-password">Password</Label>
                    <Input id="student-password" name="password" type="password" required />
                  </div>
                  <Button type="submit" className="w-full">Add Student</Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={openDialog === "class"} onOpenChange={(open) => setOpenDialog(open ? "class" : null)}>
              <DialogTrigger asChild>
                <Button className="w-full h-20 flex flex-col gap-2" variant="outline">
                  <Plus className="h-5 w-5" />
                  <span className="text-sm">Create Class</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Class</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddClass} className="space-y-4">
                  <div>
                    <Label htmlFor="class-name">Class Name</Label>
                    <Input id="class-name" name="name" placeholder="e.g., Advanced Mathematics" required />
                  </div>
                  <div>
                    <Label htmlFor="class-subject">Subject</Label>
                    <Input id="class-subject" name="subject" required />
                  </div>
                  <div>
                    <Label htmlFor="class-teacher">Assign Teacher</Label>
                    <Select name="teacherId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name} - {teacher.subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="class-batch">Assign Batch</Label>
                    <Select name="batchId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {batches.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="class-schedule">Schedule</Label>
                    <Input id="class-schedule" name="schedule" placeholder="e.g., Mon, Wed, Fri - 10:00 AM" required />
                  </div>
                  <Button type="submit" className="w-full">Create Class</Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={openDialog === "batch"} onOpenChange={(open) => setOpenDialog(open ? "batch" : null)}>
              <DialogTrigger asChild>
                <Button className="w-full h-20 flex flex-col gap-2" variant="outline">
                  <Plus className="h-5 w-5" />
                  <span className="text-sm">Create Batch</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Batch</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddBatch} className="space-y-4">
                  <div>
                    <Label htmlFor="batch-name">Batch Name</Label>
                    <Input id="batch-name" name="name" placeholder="e.g., Batch D" required />
                  </div>
                  <div>
                    <Label htmlFor="batch-year">Academic Year</Label>
                    <Input id="batch-year" name="year" placeholder="e.g., 2024" required />
                  </div>
                  <Button type="submit" className="w-full">Create Batch</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-6">Batches Overview</h3>
          <div className="space-y-4">
            {batches.map((batch) => {
              const batchStudents = students.filter(s => s.batchId === batch.id);
              const batchClasses = classes.filter(c => c.batchId === batch.id);
              return (
                <div key={batch.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-semibold">{batch.name}</h4>
                      <span className="text-xs text-muted-foreground">Academic Year {batch.year}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/admin-dashboard/batches/${batch.id}`)}>
                      View Students
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>{batchStudents.length} students</span>
                    <span>{batchClasses.length} classes</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">Teachers ({teachers.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {teachers.map((teacher) => (
              <div key={teacher.id} className="p-3 rounded-lg border bg-card text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{teacher.name}</p>
                    <p className="text-xs text-muted-foreground">{teacher.subject}</p>
                    <p className="text-xs text-muted-foreground">{teacher.email}</p>
                  </div>
                  <DeleteDialog
                    title="Delete Teacher"
                    description={`Are you sure you want to delete ${teacher.name}? This will also delete all their classes and notes. This action cannot be undone.`}
                    onDelete={() => handleDeleteTeacher(teacher.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">Students ({students.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {students.map((student) => {
              const batch = batches.find(b => b.id === student.batchId);
              return (
                <div key={student.id} className="p-3 rounded-lg border bg-card text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{batch?.name || 'Unknown batch'}</p>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                    </div>
                    <DeleteDialog
                      title="Delete Student"
                      description={`Are you sure you want to delete ${student.name}? This will also delete all their attendance records. This action cannot be undone.`}
                      onDelete={() => handleDeleteStudent(student.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">Classes ({classes.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {classes.map((classItem) => {
              const teacher = teachers.find(t => t.id === classItem.teacherId);
              const batch = batches.find(b => b.id === classItem.batchId);
              return (
                <div key={classItem.id} className="p-3 rounded-lg border bg-card text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{classItem.name}</p>
                      <p className="text-xs text-muted-foreground">{classItem.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {teacher?.name} • {batch?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{classItem.schedule}</p>
                    </div>
                    <DeleteDialog
                      title="Delete Class"
                      description={`Are you sure you want to delete ${classItem.name}? This will also delete all attendance records for this class. This action cannot be undone.`}
                      onDelete={() => handleDeleteClass(classItem.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
