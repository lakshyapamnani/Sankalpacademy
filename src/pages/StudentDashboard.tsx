import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, BookOpen, Brain, TrendingUp } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const StudentDashboard = () => {
  const stats = [
    { label: "Attendance", value: "92%", icon: Calendar, trend: "+2%" },
    { label: "Notes Accessed", value: "18", icon: BookOpen, trend: "+5" },
    { label: "Tests Taken", value: "12", icon: TrendingUp, trend: "88% avg" },
    { label: "AI Queries", value: "34", icon: Brain, trend: "+8" },
  ];

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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-6">Upcoming Classes</h3>
          <div className="space-y-4">
            {[
              { subject: "Mathematics", teacher: "Prof. Smith", time: "Tomorrow, 09:00 AM" },
              { subject: "Physics", teacher: "Dr. Johnson", time: "Tomorrow, 11:00 AM" },
              { subject: "Chemistry", teacher: "Prof. Williams", time: "Tomorrow, 02:00 PM" },
            ].map((lecture, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-semibold">{lecture.subject}</p>
                  <p className="text-sm text-muted-foreground">
                    {lecture.teacher} • {lecture.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-6">Learning Tools</h3>
          <div className="space-y-3">
            <Button className="w-full justify-start" size="lg" variant="default">
              <Brain className="mr-3 h-5 w-5" />
              AI Doubt Solver
              <span className="ml-auto text-xs bg-accent/20 px-2 py-1 rounded">New</span>
            </Button>
            <Button className="w-full justify-start" size="lg" variant="outline">
              <BookOpen className="mr-3 h-5 w-5" />
              Study Notes
            </Button>
            <Button className="w-full justify-start" size="lg" variant="outline">
              <TrendingUp className="mr-3 h-5 w-5" />
              Practice Tests
            </Button>
          </div>

          <div className="mt-8 p-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 text-primary mt-1" />
              <div>
                <p className="font-semibold mb-1">AI Learning Assistant</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Get instant help with your doubts, 24/7
                </p>
                <Button size="sm" variant="default">
                  Start Chat
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
