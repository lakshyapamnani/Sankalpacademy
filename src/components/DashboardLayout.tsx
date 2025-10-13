import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearCurrentUser, getCurrentUser } from "@/lib/localStorage";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "admin" | "teacher" | "student";
  title: string;
}

const DashboardLayout = ({ children, role, title }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const handleLogout = () => {
    clearCurrentUser();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
      <header className="bg-card border-b sticky top-0 z-50 backdrop-blur-sm bg-card/90">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                SmartClass
              </h1>
              <p className="text-xs text-muted-foreground capitalize">{role} Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser && (
              <span className="text-sm text-muted-foreground mr-2">
                Welcome, <span className="font-medium text-foreground">{currentUser.name}</span>
              </span>
            )}
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-4xl font-bold mb-2">{title}</h2>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
