import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Shield, BookOpen, GraduationCap, User, Sparkles, X, ChevronUp, ChevronDown, LogOut } from "lucide-react";
import { getCurrentUser, isDevModeActive, switchDevRole, clearCurrentUser } from "@/lib/localStorage";
import { toast } from "sonner";

type UserRole = "admin" | "teacher" | "student" | "staff";

export const DevModeFloatingSwitcher = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUserState] = useState(getCurrentUser());
  const [isDev, setIsDev] = useState(isDevModeActive());
  const [isExpanded, setIsExpanded] = useState(true);

  // Sync state on role changes and storage updates
  useEffect(() => {
    const syncUser = () => {
      const user = getCurrentUser();
      setCurrentUserState(user);
      setIsDev(isDevModeActive());
    };

    syncUser();
    window.addEventListener("sankalp_role_changed", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("sankalp_role_changed", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, [location.pathname]);

  if (!isDev && !currentUser?.id?.startsWith("dev") && !currentUser?.name?.includes("Dev Mode")) {
    return null;
  }

  // Determine current active dashboard role from path or currentUser
  const currentPath = location.pathname;
  const currentRole: UserRole = currentPath.includes("teacher")
    ? "teacher"
    : currentPath.includes("student")
    ? "student"
    : currentPath.includes("staff")
    ? "staff"
    : "admin";

  const handleSwitch = (role: UserRole) => {
    switchDevRole(role);
    toast.success(`🚀 Switched to ${role.toUpperCase()} mode`);
    navigate(`/${role}-dashboard`);
  };

  const handleExitDev = () => {
    clearCurrentUser();
    toast.info("Exited Dev Mode");
    navigate("/student");
  };

  const rolesConfig: { id: UserRole; label: string; icon: any; color: string; activeColor: string }[] = [
    {
      id: "admin",
      label: "Admin",
      icon: Shield,
      color: "hover:bg-purple-500/20 text-purple-700 dark:text-purple-300",
      activeColor: "bg-purple-600 text-white shadow-md shadow-purple-500/30 scale-105",
    },
    {
      id: "teacher",
      label: "Teacher",
      icon: BookOpen,
      color: "hover:bg-teal-500/20 text-teal-700 dark:text-teal-300",
      activeColor: "bg-teal-600 text-white shadow-md shadow-teal-500/30 scale-105",
    },
    {
      id: "student",
      label: "Student",
      icon: GraduationCap,
      color: "hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
      activeColor: "bg-cyan-600 text-white shadow-md shadow-cyan-500/30 scale-105",
    },
    {
      id: "staff",
      label: "Staff",
      icon: User,
      color: "hover:bg-amber-500/20 text-amber-700 dark:text-amber-300",
      activeColor: "bg-amber-600 text-white shadow-md shadow-amber-500/30 scale-105",
    },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-5 duration-300">
      {isExpanded ? (
        <div className="bg-background/95 dark:bg-zinc-900/95 backdrop-blur-xl border-2 border-primary/30 shadow-2xl rounded-2xl p-2.5 flex flex-col gap-2 max-w-[95vw] sm:max-w-none">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-1.5 pb-1 border-b border-border/50 text-xs">
            <div className="flex items-center gap-1.5 font-black text-primary">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-spin" style={{ animationDuration: "6s" }} />
              <span>DEV MASTER SWITCHER</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                title="Minimize Switcher"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleExitDev}
                className="p-1 hover:bg-destructive/10 rounded-md text-destructive transition-colors"
                title="Logout & Exit Dev Mode"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Role Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {rolesConfig.map((r) => {
              const Icon = r.icon;
              const isActive = currentRole === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => handleSwitch(r.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all duration-200 cursor-pointer ${
                    isActive ? r.activeColor : `${r.color} bg-muted/60`
                  }`}
                  title={`Switch to ${r.label} Dashboard`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-primary text-primary-foreground font-black text-xs px-3.5 py-2 rounded-full shadow-2xl border-2 border-white/20 flex items-center gap-2 hover:scale-105 transition-all"
          title="Open Dev Master Switcher"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          <span>Dev Mode ({currentRole.toUpperCase()})</span>
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export default DevModeFloatingSwitcher;
