import { ReactNode, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, Bell, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearCurrentUser, getCurrentUser, isDevModeActive, switchDevRole } from "@/lib/localStorage";

export interface SidebarItem {
  id: string;
  label: string;
  icon: any;
  action: () => void;
}

interface DashboardLayoutProps {
  children: ReactNode;
  role: "admin" | "student" | "staff" | "teacher";
  title: string;
  sidebarItems?: SidebarItem[];
  activeSidebarItem?: string;
}

const DashboardLayout = ({ children, role, title, sidebarItems = [], activeSidebarItem }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile menu state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Desktop collapse state
  const [currentUser, setCurrentUserState] = useState(getCurrentUser());
  const [isDev, setIsDev] = useState(isDevModeActive());

  useEffect(() => {
    const handleSync = () => {
      setCurrentUserState(getCurrentUser());
      setIsDev(isDevModeActive());
    };
    window.addEventListener('sankalp_role_changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('sankalp_role_changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const handleRoleSwitch = (targetRole: "admin" | "student" | "staff" | "teacher") => {
    switchDevRole(targetRole);
    navigate(`/${targetRole}-dashboard`);
  };

  const handleLogout = () => {
    clearCurrentUser();
    if (role === "student") {
      navigate("/student");
    } else if (role === "teacher" || role === "staff") {
      navigate("/teacher");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-primary/5 to-accent/5 overflow-x-hidden">
      <header className="bg-card border-b fixed top-0 left-0 right-0 z-40 backdrop-blur-sm bg-card/90 shadow-sm shrink-0">
        <div className="container mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            {sidebarItems.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-8 w-8"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
              </Button>
            )}
            <img src="./icons/sankalp_logo.jpeg" alt="Sankalp Academy Logo" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-primary/20" />
            <span className="font-bold text-sm sm:text-base tracking-tight">Sankalp Academy</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {(isDev || currentUser?.id === 'dev-lakshya' || currentUser?.name?.includes('Dev Mode')) && (
              <div className="flex items-center gap-0.5 sm:gap-1 bg-primary/10 border border-primary/20 rounded-xl px-1.5 sm:px-2 py-0.5 text-xs">
                <span className="font-extrabold text-primary hidden sm:inline-flex items-center gap-1 mr-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Dev:
                </span>
                <button 
                  onClick={() => handleRoleSwitch('admin')}
                  className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-colors ${role === 'admin' ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-primary/20 text-foreground'}`}
                  title="Switch to Admin Dashboard"
                >
                  Admin
                </button>
                <button 
                  onClick={() => handleRoleSwitch('teacher')}
                  className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-colors ${role === 'teacher' ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-primary/20 text-foreground'}`}
                  title="Switch to Teacher Dashboard"
                >
                  Teacher
                </button>
                <button 
                  onClick={() => handleRoleSwitch('staff')}
                  className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-colors ${role === 'staff' ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-primary/20 text-foreground'}`}
                  title="Switch to Staff Dashboard"
                >
                  Staff
                </button>
                <button 
                  onClick={() => handleRoleSwitch('student')}
                  className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-colors ${role === 'student' ? 'bg-primary text-primary-foreground shadow-xs' : 'hover:bg-primary/20 text-foreground'}`}
                  title="Switch to Student Dashboard"
                >
                  Student
                </button>
              </div>
            )}
            <Button variant="ghost" size="icon" aria-label="Notifications" className="h-7 w-7 sm:h-8 sm:w-8">
              <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
            <Button variant="ghost" onClick={handleLogout} aria-label="Logout" className="flex items-center gap-1 h-7 sm:h-8 px-2 sm:px-2.5">
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <span className="hidden sm:inline text-xs font-semibold">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden pt-[65px]">
        {/* Sidebar */}
        {sidebarItems.length > 0 && (
          <>
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
              <div 
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
                onClick={() => setIsSidebarOpen(false)}
              />
            )}
            
            {/* Sidebar Content */}
            <aside
              className={`fixed inset-y-0 left-0 z-50 mt-[65px] bg-card border-r transition-all duration-300 flex flex-col 
              ${isSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"}
              ${isSidebarCollapsed ? "lg:w-16" : "lg:w-64"}`}
            >
              <div className="flex-1 py-4 flex flex-col gap-2 overflow-y-auto px-3">
                {sidebarItems.map((item) => {
                  const isActive = activeSidebarItem === item.id;
                  return (
                    <Button
                      key={item.id}
                      variant={isActive ? "default" : "ghost"}
                      className={`justify-start w-full ${isSidebarCollapsed ? "lg:justify-center px-0" : ""} group`}
                      onClick={() => {
                        item.action();
                        setIsSidebarOpen(false);
                      }}
                      title={isSidebarCollapsed ? item.label : undefined}
                    >
                      <item.icon className={`h-5 w-5 ${isActive ? "text-primary-foreground" : "text-muted-foreground"} ${isSidebarCollapsed ? "mr-0" : "mr-3"}`} />
                      {!isSidebarCollapsed && <span>{item.label}</span>}
                    </Button>
                  );
                })}
              </div>
              <div className="p-3 border-t hidden lg:flex mt-auto justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="mx-auto"
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                >
                  {isSidebarCollapsed ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-panel-left-open h-5 w-5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-panel-left-close h-5 w-5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/></svg>
                  )}
                </Button>
              </div>
            </aside>
          </>
        )}

        <main className={`flex-1 overflow-y-auto transition-all p-4 lg:p-6 ${sidebarItems.length > 0 ? (isSidebarCollapsed ? "lg:ml-16" : "lg:ml-64") : ""}`}>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-1">{title}</h2>
            <p className="hidden sm:block text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {children}

          <footer className="mt-12 py-6 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Sankalp Academy. All rights reserved.</p>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
