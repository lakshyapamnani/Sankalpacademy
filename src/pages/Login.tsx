import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, User, BookOpen, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { clearCurrentUser, authenticateUser, getCurrentUser, setCurrentUser, isDevModeActive, switchDevRole } from "@/lib/localStorage";

type UserRole = "admin" | "student" | "staff" | "teacher";

interface LoginProps {
  defaultRole?: UserRole;
  forceRole?: boolean;
}

const Login = ({ defaultRole, forceRole }: LoginProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get("role") as UserRole | null;
  const validRoles: UserRole[] = ["admin", "student", "staff", "teacher"];
  const effectiveDefaultRole = defaultRole || (roleParam && validRoles.includes(roleParam) ? roleParam : undefined);

  const [selectedRole, setSelectedRole] = useState<UserRole>(effectiveDefaultRole || "student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const existing = getCurrentUser();
    const isDev = isDevModeActive() || (existing && (existing.id === 'dev-lakshya' || existing.name?.includes('Dev Mode')));
    
    // If Dev Mode user visits /student, /teacher, /staff, /admin, /login
    if (isDev) {
      const targetRole = effectiveDefaultRole || (existing?.role as UserRole) || 'admin';
      switchDevRole(targetRole);
      navigate(`/${targetRole}-dashboard`);
      return;
    }

    if (effectiveDefaultRole) {
      setSelectedRole(effectiveDefaultRole);
      if (existing && existing.role !== effectiveDefaultRole) {
        clearCurrentUser();
      } else if (existing && existing.role === effectiveDefaultRole) {
        navigate(`/${existing.role}-dashboard`);
      }
    } else if (existing) {
      // if a user is already stored, skip role selection and go straight to their dashboard
      navigate(`/${existing.role}-dashboard`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDefaultRole]);

  const roles = [
    {
      id: "admin" as UserRole,
      title: "Administrator",
      description: "Manage students, batches, and institute operations",
      icon: Shield,
      color: "from-purple-500 to-purple-600",
    },
    {
      id: "teacher" as UserRole,
      title: "Teacher",
      description: "Take lecture attendance, upload notes, and give remarks",
      icon: BookOpen,
      color: "from-teal-500 to-emerald-600",
    },
    {
      id: "student" as UserRole,
      title: "Student",
      description: "Access classes, study notes, tests, and AI tutor",
      icon: GraduationCap,
      color: "from-cyan-500 to-cyan-600",
    },
    {
      id: "staff" as UserRole,
      title: "Staff",
      description: "Manage attendance and publish academy notices",
      icon: User,
      color: "from-orange-500 to-orange-600",
    },
  ];

  const handleDevLogin = (roleToUse?: UserRole) => {
    const activeRole = roleToUse || selectedRole || 'admin';
    switchDevRole(activeRole);
    toast.success(`🚀 Dev Mode Activated! Accessing ${activeRole.toUpperCase()} dashboard...`);
    navigate(`/${activeRole}-dashboard`);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    const normEmail = email.trim().toLowerCase();
    const normPass = password.trim();

    // DEV MODE MASTER ACCESS
    if (normEmail === 'lakshya@dev.com' && (normPass === 'admin123' || normPass === 'dev123' || normPass === 'admin')) {
      handleDevLogin(selectedRole);
      return;
    }

    const user = authenticateUser(email, password, selectedRole || 'student');
    
    if (!user) {
      toast.error("Invalid credentials");
      return;
    }

    const userRole = selectedRole || (user.id === 'admin' ? 'admin' : 'student');
    setCurrentUser({ id: user.id, role: userRole, name: user.name });
    toast.success(`Welcome back, ${user.name}!`);
    navigate(`/${userRole}-dashboard`);
  };

  const currentRole = roles.find((r) => r.id === selectedRole) || roles[0];
  const Icon = currentRole.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex flex-col p-4">
      <div className="flex-1 flex items-center justify-center py-8">
        <Card className="w-full max-w-md p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-xl border-2">
          {/* Role Switcher Pills on Top */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-muted/80 rounded-2xl mb-6 border border-border/50">
            {roles.map((r) => {
              const RoleIcon = r.icon;
              const isSelected = selectedRole === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRole(r.id)}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-background text-primary shadow-sm border border-primary/20 scale-100"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
                >
                  <RoleIcon className="h-3.5 w-3.5" />
                  <span>{r.id.charAt(0).toUpperCase() + r.id.slice(1)}</span>
                </button>
              );
            })}
          </div>

          <div className="text-center mb-6">
            <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${currentRole.color} flex items-center justify-center mb-3 shadow-lg`}>
              <Icon className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black mb-1">{currentRole.title} Login</h2>
            <p className="text-muted-foreground text-xs sm:text-sm">{currentRole.description}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>

            <Button type="submit" className="w-full rounded-xl font-bold text-sm shadow-md" size="lg">
              Sign In as {currentRole.title}
            </Button>
          </form>

          {/* Quick Dev Login Helper */}
          <div className="mt-5 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDevLogin(selectedRole)}
              className="w-full rounded-xl text-xs font-bold gap-2 border-primary/30 hover:border-primary hover:bg-primary/5 text-primary py-2 h-auto"
            >
              <Sparkles className="h-4 w-4 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
              <span>⚡ Quick Dev Login ({selectedRole.toUpperCase()})</span>
            </Button>
            <p className="text-[11px] text-center text-muted-foreground mt-2">
              Master Dev Account: <span className="font-mono text-foreground font-semibold">lakshya@dev.com</span> / <span className="font-mono text-foreground font-semibold">admin123</span>
            </p>
          </div>
        </Card>
      </div>
      <footer className="py-4 w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-foreground border-t border-primary/10">
        <p>&copy; {new Date().getFullYear()} Sankalp Academy. All rights reserved.</p>
        <p className="font-medium">Sankalp Academy ERP v2.0</p>
      </footer>
    </div>
  );
};

export default Login;
