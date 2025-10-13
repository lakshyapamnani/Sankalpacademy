import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { toast } from "sonner";
import {
  getBatches,
  getClasses,
  getStudentsByBatch,
  deleteStudent,
  changeStudentPassword,
  Batch,
  Student,
  Class,
} from "@/lib/localStorage";

const BatchDetails = () => {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [passwordDialogStudent, setPasswordDialogStudent] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) return;
    loadBatchData(batchId);
  }, [batchId]);

  const loadBatchData = (id: string) => {
    const batches = getBatches();
    const currentBatch = batches.find(b => b.id === id) || null;
    setBatch(currentBatch);
    setStudents(getStudentsByBatch(id));
    setClasses(getClasses().filter(cls => cls.batchId === id));
  };

  const handleDeleteStudent = (studentId: string) => {
    if (!studentId) return;

    if (deleteStudent(studentId)) {
      toast.success("Student deleted successfully");
      if (batchId) {
        loadBatchData(batchId);
      }
    } else {
      toast.error("Failed to delete student");
    }
  };

  const handlePasswordChange = (studentId: string, newPassword: string): boolean => {
    if (!newPassword.trim()) {
      toast.error("Password cannot be empty");
      return false;
    }

    if (changeStudentPassword(studentId, newPassword)) {
      toast.success("Password updated successfully");
      setPasswordDialogStudent(null);
      return true;
    }

    toast.error("Failed to update password");
    return false;
  };

  const batchStats = useMemo(() => {
    return {
      totalStudents: students.length,
      totalClasses: classes.length,
    };
  }, [students.length, classes.length]);

  if (!batchId) {
    return (
      <DashboardLayout role="admin" title="Batch Details">
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Invalid Batch</h2>
            <p className="text-sm text-muted-foreground">No batch identifier was provided.</p>
            <Button onClick={() => navigate("/admin-dashboard")}>Back to Dashboard</Button>
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  if (!batch) {
    return (
      <DashboardLayout role="admin" title="Batch Details">
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Batch not found</h2>
            <p className="text-sm text-muted-foreground">We couldn't find the batch you're looking for.</p>
            <Button onClick={() => navigate("/admin-dashboard")}>Back to Dashboard</Button>
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin" title={`Batch: ${batch.name}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <Button variant="ghost" onClick={() => navigate("/admin-dashboard")}>Back to Dashboard</Button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{batch.name}</h1>
            <Badge variant="secondary">{batch.year}</Badge>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Students</p>
            <p className="text-2xl font-bold">{batchStats.totalStudents}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Classes</p>
            <p className="text-2xl font-bold">{batchStats.totalClasses}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Students</h2>
              <p className="text-sm text-muted-foreground">Manage students in this batch</p>
            </div>
            <Badge variant="outline">{students.length} total</Badge>
          </div>

          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students are currently assigned to this batch.</p>
          ) : (
            <div className="space-y-3">
              {students.map((student) => (
                <Card key={student.id} className="p-4">
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{student.name}</h3>
                      <p className="text-sm text-muted-foreground">{student.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <Dialog
                        open={passwordDialogStudent === student.id}
                        onOpenChange={(open) => setPasswordDialogStudent(open ? student.id : null)}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            Change Password
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Change Password</DialogTitle>
                          </DialogHeader>
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              const formData = new FormData(event.currentTarget);
                              const newPassword = (formData.get("password") as string) || "";
                              const success = handlePasswordChange(student.id, newPassword);
                              if (success) {
                                event.currentTarget.reset();
                              }
                            }}
                            className="space-y-4"
                          >
                            <div>
                              <Label htmlFor={`password-${student.id}`}>New Password</Label>
                              <Input id={`password-${student.id}`} name="password" type="password" required minLength={6} />
                            </div>
                            <DialogFooter>
                              <Button type="submit">Update Password</Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                      <DeleteDialog
                        title="Delete Student"
                        description={`Are you sure you want to delete ${student.name}? This will also delete all their attendance records. This action cannot be undone.`}
                        onDelete={() => handleDeleteStudent(student.id)}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Classes</h2>
          {classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No classes are currently scheduled for this batch.</p>
          ) : (
            <div className="space-y-3">
              {classes.map((cls) => (
                <Card key={cls.id} className="p-3">
                  <p className="font-semibold">{cls.name}</p>
                  <p className="text-sm text-muted-foreground">{cls.subject}</p>
                  <p className="text-xs text-muted-foreground">{cls.schedule}</p>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BatchDetails;
