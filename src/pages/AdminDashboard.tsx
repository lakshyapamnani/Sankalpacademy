import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, BookOpen, Calendar, BarChart3, Plus } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const AdminDashboard = () => {
  const stats = [
    { label: "Total Students", value: "1,234", icon: Users, color: "from-cyan-500 to-cyan-600" },
    { label: "Total Teachers", value: "48", icon: BookOpen, color: "from-blue-500 to-blue-600" },
    { label: "Active Classes", value: "24", icon: Calendar, color: "from-purple-500 to-purple-600" },
    { label: "Attendance Rate", value: "92%", icon: BarChart3, color: "from-green-500 to-green-600" },
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

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Quick Actions</h3>
          </div>
          <div className="space-y-3">
            <Button className="w-full justify-start" variant="outline" size="lg">
              <Plus className="mr-2 h-5 w-5" />
              Add New Teacher
            </Button>
            <Button className="w-full justify-start" variant="outline" size="lg">
              <Plus className="mr-2 h-5 w-5" />
              Add New Student
            </Button>
            <Button className="w-full justify-start" variant="outline" size="lg">
              <Plus className="mr-2 h-5 w-5" />
              Create New Class
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-6">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4 pb-4 border-b">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <div className="flex-1">
                <p className="font-medium">New teacher registered</p>
                <p className="text-sm text-muted-foreground">John Smith joined as Math teacher</p>
                <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-4 pb-4 border-b">
              <div className="w-2 h-2 rounded-full bg-accent mt-2" />
              <div className="flex-1">
                <p className="font-medium">Class created</p>
                <p className="text-sm text-muted-foreground">Advanced Physics - Batch A</p>
                <p className="text-xs text-muted-foreground mt-1">5 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <div className="flex-1">
                <p className="font-medium">Students enrolled</p>
                <p className="text-sm text-muted-foreground">45 students added to Batch B</p>
                <p className="text-xs text-muted-foreground mt-1">1 day ago</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
