import React from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  variant?: "icon" | "pill" | "card";
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = "",
  variant = "icon",
  showLabel = false,
}) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Avoid hydration mismatch
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 rounded-xl ${className}`}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4 opacity-50" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark" || theme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  if (variant === "card") {
    return (
      <div
        onClick={toggleTheme}
        className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
          isDark
            ? "bg-primary/10 border-primary/30 hover:bg-primary/15"
            : "bg-muted/40 border-border hover:bg-muted/60"
        } ${className}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl transition-colors ${
              isDark ? "bg-amber-400/20 text-amber-400" : "bg-primary/10 text-primary"
            }`}
          >
            {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              {isDark ? "Dark Theme Active" : "Light Theme Active"}
            </p>
            <p className="text-xs text-muted-foreground">
              Tap to switch to {isDark ? "Light mode" : "Dark mode"}
            </p>
          </div>
        </div>

        <div
          className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors ${
            isDark ? "bg-primary justify-end" : "bg-muted-foreground/30 justify-start"
          }`}
        >
          <div className="bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform" />
        </div>
      </div>
    );
  }

  if (variant === "pill") {
    return (
      <button
        onClick={toggleTheme}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-xs ${
          isDark
            ? "bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700"
            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
        } ${className}`}
        title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
      >
        {isDark ? <Moon className="h-3.5 w-3.5 fill-current" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
        <span>{isDark ? "Dark" : "Light"}</span>
      </button>
    );
  }

  return (
    <Button
      variant="ghost"
      size={showLabel ? "default" : "icon"}
      onClick={toggleTheme}
      className={`h-8 rounded-xl font-bold transition-all relative overflow-hidden ${
        isDark
          ? "hover:bg-slate-800 text-amber-400"
          : "hover:bg-primary/10 text-slate-700"
      } ${className}`}
      title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
      aria-label="Toggle dark mode"
    >
      <div className="flex items-center gap-1.5">
        {isDark ? (
          <Moon className="h-4 w-4 transition-transform duration-300 rotate-0" />
        ) : (
          <Sun className="h-4 w-4 transition-transform duration-300 text-amber-500" />
        )}
        {showLabel && (
          <span className="text-xs">{isDark ? "Dark" : "Light"}</span>
        )}
      </div>
    </Button>
  );
};
