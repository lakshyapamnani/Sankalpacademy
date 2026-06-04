import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, User, BookOpen, Shield } from "lucide-react";
import { toast } from "sonner";
import { clearCurrentUser, authenticateUser, getCurrentUser, setCurrentUser } from "@/lib/localStorage";

type UserRole = "admin" | "student" | "staff";

interface LoginProps {
  defaultRole?: UserRole;
  forceRole?: boolean;
}

const Login = ({ defaultRole, forceRole }: LoginProps) => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(defaultRole || null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const existing = getCurrentUser();
    
    if (defaultRole) {
      setSelectedRole(defaultRole);
      if (existing && existing.role !== defaultRole) {
        clearCurrentUser();
      } else if (existing && existing.role === defaultRole) {
        navigate(`/${existing.role}-dashboard`);
      }
    } else if (existing) {
      // if a user is already stored, skip role selection and go straight to their dashboard
      navigate(`/${existing.role}-dashboard`);
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultRole]);

  const roles = [
    {
      id: "admin" as UserRole,
      title: "Administrator",
      description: "Manage students, and classes",
      icon: Shield,
      color: "from-purple-500 to-purple-600",
    },
    {
      id: "staff" as UserRole,
      title: "Staff",
      description: "Manage classes and take attendance",
      icon: User,
      color: "from-orange-500 to-orange-600",
    },
    {
      id: "student" as UserRole,
      title: "Student",
      description: "Access classes, notes, and AI learning tools",
      icon: GraduationCap,
      color: "from-cyan-500 to-cyan-600",
    },
  ];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    const user = authenticateUser(email, password, selectedRole!);
    
    if (!user) {
      toast.error("Invalid credentials");
      return;
    }

    setCurrentUser({ id: user.id, role: selectedRole!, name: user.name });
    toast.success(`Welcome back, ${user.name}!`);
    navigate(`/${selectedRole}-dashboard`);
  };

  if (!selectedRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex flex-col p-4">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-5xl">
          <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
              <img src="/icons/rctlogo.jpg" alt="RCT Logo" className="w-20 h-20 rounded-full object-cover border-4 border-primary/10 shadow-xl" />
              <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                RC Tutorials ERP
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              AI-Powered Learning & Management Platform
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {roles.map((role, index) => {
              const Icon = role.icon;
              return (
                <Card
                  key={role.id}
                  className="p-8 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-2 hover:border-primary/50 animate-in fade-in slide-in-from-bottom-8"
                  style={{ animationDelay: `${index * 100}ms` }}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${role.color} flex items-center justify-center mb-6 shadow-lg`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{role.title}</h3>
                  <p className="text-muted-foreground">{role.description}</p>
                </Card>
              );
            })}
          </div>
          </div>
        </div>
        <footer className="mt-8 py-6 w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground border-t border-primary/10">
          <p>&copy; {new Date().getFullYear()} Drona. All rights reserved.</p>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <p>
              Powered by <a href="https://drona-impact.vercel.app" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">Drona</a>
            </p>
            <a href="https://instagram.com/_.drona._" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-pink-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-instagram"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              <span className="font-medium">_.drona._</span>
            </a>
          </div>
        </footer>
      </div>
    );
  }

  const currentRole = roles.find((r) => r.id === selectedRole)!;
  const Icon = currentRole.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex flex-col p-4">
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-md p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {!forceRole && (
          <button
            onClick={() => setSelectedRole(null)}
            className="text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            ← Back to role selection
          </button>
        )}

        <div className="text-center mb-8">
          <div className={`w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br ${currentRole.color} flex items-center justify-center mb-4 shadow-lg`}>
            <Icon className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-2">{currentRole.title} Login</h2>
          <p className="text-muted-foreground">{currentRole.description}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" size="lg">
            Sign In
          </Button>
        </form>

        {(selectedRole === 'staff' || selectedRole === 'student') && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            Accounts are created in the Admin panel
          </p>
        )}
        </Card>
      </div>
      <footer className="mt-8 py-6 w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground border-t border-primary/10">
        <p>&copy; {new Date().getFullYear()} Drona. All rights reserved.</p>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <p>
            Powered by <a href="https://drona-impact.vercel.app" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline">Drona</a>
          </p>
          <a href="https://instagram.com/_.drona._" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-pink-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-instagram"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
            <span className="font-medium">_.drona._</span>
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Login;
