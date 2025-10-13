import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ClipboardCheck, FileText, Brain } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const TeacherDashboard = () => {
  const stats = [
    { label: "My Classes", value: "6", icon: Calendar },
    { label: "Today's Attendance", value: "85%", icon: ClipboardCheck },
    { label: "Notes Uploaded", value: "24", icon: FileText },
    { label: "AI Queries", value: "142", icon: Brain },
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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-6">Today's Schedule</h3>
          <div className="space-y-4">
            {[
              { time: "09:00 AM", subject: "Mathematics", class: "Batch A", room: "Room 101" },
              { time: "11:00 AM", subject: "Physics", class: "Batch B", room: "Room 203" },
              { time: "02:00 PM", subject: "Chemistry", class: "Batch C", room: "Lab 1" },
            ].map((lecture, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="text-center min-w-[80px]">
                  <p className="text-sm font-medium text-primary">{lecture.time}</p>
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{lecture.subject}</p>
                  <p className="text-sm text-muted-foreground">
                    {lecture.class} • {lecture.room}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Mark Attendance
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-6">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="h-24 flex flex-col gap-2">
              <ClipboardCheck className="h-6 w-6" />
              <span className="text-sm">Mark Attendance</span>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col gap-2">
              <FileText className="h-6 w-6" />
              <span className="text-sm">Upload Notes</span>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col gap-2">
              <Calendar className="h-6 w-6" />
              <span className="text-sm">Schedule Class</span>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col gap-2">
              <Brain className="h-6 w-6" />
              <span className="text-sm">AI Tools</span>
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
