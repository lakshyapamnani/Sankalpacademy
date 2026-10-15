import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AlertCircle, ArrowLeft, Home, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/5 px-4 text-foreground selection:bg-primary/20">
      <div className="w-full max-w-md p-8 rounded-3xl bg-card/90 border border-border shadow-2xl backdrop-blur-md text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
          <AlertCircle className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight text-foreground">404</h1>
          <p className="text-base font-bold text-muted-foreground">Page Not Found</p>
          <p className="text-xs text-muted-foreground/80">
            The page <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px] text-primary">{location.pathname}</code> does not exist or has moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            onClick={() => navigate("/")}
            className="w-full sm:w-auto h-11 px-5 rounded-xl font-bold gap-2 text-xs shadow-md shadow-primary/20"
          >
            <Home className="h-4 w-4" />
            <span>Return to Home</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/studentapp")}
            className="w-full sm:w-auto h-11 px-5 rounded-xl font-bold gap-2 text-xs"
          >
            <Smartphone className="h-4 w-4" />
            <span>Student App</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

