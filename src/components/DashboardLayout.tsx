import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearCurrentUser, getCurrentUser } from "@/lib/localStorage";
import { useState } from "react";

export interface SidebarItem {
  id: string;
  label: string;
  icon: any;
  action: () => void;
}

interface DashboardLayoutProps {
  children: ReactNode;
  role: "admin" | "teacher" | "student";
  title: string;
  sidebarItems?: SidebarItem[];
  activeSidebarItem?: string;
}

const DashboardLayout = ({ children, role, title, sidebarItems = [], activeSidebarItem }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile menu state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Desktop collapse state
  const currentUser = getCurrentUser();

  const handleLogout = () => {
    clearCurrentUser();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-primary/5 to-accent/5 overflow-x-hidden">
      <header className="bg-card border-b sticky top-0 z-40 backdrop-blur-sm bg-card/90 shadow-sm shrink-0">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {sidebarItems.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                {/* A basic menu icon */}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
              </Button>
            )}
            <GraduationCap className="h-8 w-8 text-primary hidden sm:block" />
            <span className="font-semibold sm:hidden text-lg">SmartClass</span>
            <span className="sr-only">SmartClass</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" onClick={handleLogout} aria-label="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
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
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
