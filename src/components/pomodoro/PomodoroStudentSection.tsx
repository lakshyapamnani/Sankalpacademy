import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  ShieldAlert, 
  ShieldCheck, 
  Trophy, 
  Flame, 
  Timer, 
  Coffee, 
  BookOpen, 
  CheckCircle2, 
  Award, 
  Sparkles, 
  AlertTriangle,
  Clock,
  ArrowRight,
  Maximize2,
  Minimize2,
  Medal,
  Crown,
  Search,
  Users,
  Square
} from "lucide-react";
import { toast } from "sonner";
import { soundManager } from "@/lib/soundUtils";
import { 
  Student, 
  Batch, 
  Subject, 
  getBatches, 
  getSubjects, 
  logStudySession, 
  getStudySessionsByStudent,
  getStudentStudyStat,
  getStudentHighestSession,
  StudySession
} from "@/lib/localStorage";
import { computeLeaderboard, formatStudyDuration, isToday, isThisWeek } from "@/lib/pomodoroUtils";

interface PomodoroStudentSectionProps {
  currentStudent: Student | null;
}

const FOCUS_TIME_SECONDS = 25 * 60; // 25 mins
const BREAK_TIME_SECONDS = 5 * 60;  // 5 mins
const LONG_BREAK_SECONDS = 15 * 60; // 15 mins after 4 cycles

const MOTIVATIONAL_QUOTES = [
  "“Push yourself, because no one else is going to do it for you.”",
  "“Success doesn't just find you. You have to go out and get it.”",
  "“Small daily improvements over time lead to stunning results.”",
  "“Focus on being productive instead of busy.”",
  "“Every minute of study is a step closer to your dream rank.”",
  "“Your future self will thank you for the hard work you do today.”",
];

export const PomodoroStudentSection: React.FC<PomodoroStudentSectionProps> = ({ currentStudent }) => {
  // Timer States
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [cycleCount, setCycleCount] = useState<number>(1); // 1 to 4
  const [totalCompletedCycles, setTotalCompletedCycles] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(FOCUS_TIME_SECONDS);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isInterrupted, setIsInterrupted] = useState<boolean>(false);
  const [interruptionCount, setInterruptionCount] = useState<number>(0);
  const [interruptionReason, setInterruptionReason] = useState<string>("");

  // Sound & Visuals
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundManager.isEnabled());
  const [selectedSubject, setSelectedSubject] = useState<string>("Self Study");
  const [customSubject, setCustomSubject] = useState<string>("");
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [quoteIndex, setQuoteIndex] = useState<number>(0);

  // View state: 'timer' or 'leaderboard'
  const [activeSubTab, setActiveSubTab] = useState<"timer" | "leaderboard">("timer");

  // Leaderboard filters
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<"all-time" | "week" | "today">("all-time");
  const [leaderboardBatch, setLeaderboardBatch] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Data
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [todaySeconds, setTodaySeconds] = useState<number>(0);
  const [totalHours, setTotalHours] = useState<number>(0);
  const [highestSessionSeconds, setHighestSessionSeconds] = useState<number>(0);

  // References for anti-cheat interval & visibility
  const isRunningRef = useRef<boolean>(isRunning);
  const modeRef = useRef<"focus" | "break">(mode);
  const lastActiveTimestampRef = useRef<number>(Date.now());
  const secondsSpentInCurrentSessionRef = useRef<number>(0);
  const fullScreenContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Load batches and subjects
  useEffect(() => {
    setBatches(getBatches());
    setSubjects(getSubjects());
    loadStudentStats();
  }, [currentStudent]);

  const loadStudentStats = useCallback(() => {
    if (!currentStudent) return;
    const stat = getStudentStudyStat(currentStudent.id);
    if (stat) {
      setTotalHours(stat.totalHours || 0);
    }
    const sessions = getStudySessionsByStudent(currentStudent.id);
    const todaySum = sessions
      .filter(s => s.type === "focus" && isToday(s.completedAt || s.date))
      .reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
    setTodaySeconds(todaySum);

    const highest = getStudentHighestSession(currentStudent.id);
    const maxSec = Math.max(highest?.durationSeconds || 0, stat?.highestSessionSeconds || 0);
    setHighestSessionSeconds(maxSec);
  }, [currentStudent]);

  // Periodic quote rotation
  useEffect(() => {
    const qInterval = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % MOTIVATIONAL_QUOTES.length);
    }, 20000);
    return () => clearInterval(qInterval);
  }, []);

  // ─── UNBREAKABLE ANTI-CHEAT FOCUS PROTECTION ────────────────────────
  // If tab is switched, minimized, phone locked, or user leaves the app/window:
  const triggerFocusInterruption = useCallback((reason: string) => {
    if (!isRunningRef.current) return;

    // Immediately stop the timer
    setIsRunning(false);
    setIsInterrupted(true);
    setInterruptionReason(reason);
    setInterruptionCount(prev => prev + 1);

    // Audio & vibration alarm
    soundManager.playInterruptedAlert();

    toast.warning("Focus Timer Stopped!", {
      description: "You left the app or switched windows. Study timer is paused to ensure honest study hours.",
      duration: 6000,
    });
  }, []);

  // Window & Document event listeners
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRunningRef.current) {
        triggerFocusInterruption("App backgrounded or tab switched");
      }
    };

    const handleWindowBlur = () => {
      // Blur can happen when switching to another desktop window or phone notification shade
      if (isRunningRef.current) {
        triggerFocusInterruption("Lost window focus or opened another application");
      }
    };

    const handlePageHide = () => {
      if (isRunningRef.current) {
        triggerFocusInterruption("Page or app hidden");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("pagehide", handlePageHide);

    // Capacitor Native App state listener if running on mobile Android / iOS
    let capacitorListenerRemove: (() => void) | null = null;
    try {
      const cap = (window as any).Capacitor;
      if (cap?.Plugins?.App?.addListener) {
        const handle = cap.Plugins.App.addListener("appStateChange", (state: { isActive: boolean }) => {
          if (!state.isActive && isRunningRef.current) {
            triggerFocusInterruption("Mobile app put in background or screen locked");
          }
        });
        capacitorListenerRemove = () => {
          handle?.then?.((h: any) => h.remove?.()).catch?.(() => {});
        };
      }
    } catch {
      // ignore
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("pagehide", handlePageHide);
      if (capacitorListenerRemove) capacitorListenerRemove();
    };
  }, [triggerFocusInterruption]);

  // ─── TIMER TICK ENGINE ──────────────────────────────────────────────
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning) {
      lastActiveTimestampRef.current = Date.now();

      interval = setInterval(() => {
        // Anti-tamper check: ensure screen is still visible
        if (document.hidden) {
          triggerFocusInterruption("Screen was hidden during study");
          return;
        }

        const now = Date.now();
        const deltaMs = now - lastActiveTimestampRef.current;
        lastActiveTimestampRef.current = now;

        // If the browser was put to sleep or heavily throttled for > 3.5 seconds
        if (deltaMs > 3500) {
          triggerFocusInterruption("Device sleep or long system pause detected");
          return;
        }

        // Increment time spent in focus
        if (modeRef.current === "focus") {
          secondsSpentInCurrentSessionRef.current += 1;
        }

        setTimeLeft(prev => {
          if (prev <= 1) {
            // Timer Finished!
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, triggerFocusInterruption]);

  // ─── TIMER COMPLETION HANDLER ───────────────────────────────────────
  const handleTimerComplete = async () => {
    setIsRunning(false);

    if (mode === "focus") {
      // 25 mins focus completed!
      soundManager.playFocusComplete();
      toast.success("🎉 Focus Session Complete!", {
        description: "Excellent discipline! Take a well-deserved 5-minute break.",
        duration: 8000,
      });

      // Save verified focus session
      if (currentStudent) {
        const studentBatch = batches.find(b => b.id === currentStudent.batchId);
        const effectiveSubject = customSubject.trim() || selectedSubject;

        const newSession: StudySession = {
          id: Date.now().toString(),
          studentId: currentStudent.id,
          studentName: currentStudent.name,
          batchId: currentStudent.batchId,
          batchName: studentBatch?.name || "Unassigned",
          durationMinutes: 25,
          durationSeconds: 25 * 60,
          type: "focus",
          subject: effectiveSubject,
          completedAt: new Date().toISOString(),
          date: new Date().toISOString().split("T")[0],
          interruptions: interruptionCount,
        };

        try {
          await logStudySession(newSession);
          loadStudentStats();
        } catch (e) {
          console.error("Failed to log study session", e);
        }
      }

      // Transition to break
      const nextCycle = cycleCount >= 4 ? 1 : cycleCount + 1;
      setTotalCompletedCycles(prev => prev + 1);
      setCycleCount(nextCycle);
      setMode("break");
      setTimeLeft(BREAK_TIME_SECONDS);
      setInterruptionCount(0);
      setIsInterrupted(false);
      secondsSpentInCurrentSessionRef.current = 0;
    } else {
      // 5 mins break completed!
      soundManager.playBreakComplete();
      toast.info("⚡ Break is over!", {
        description: "Time to dive into your next 25-minute focus session.",
        duration: 6000,
      });

      // Switch back to Focus
      setMode("focus");
      setTimeLeft(FOCUS_TIME_SECONDS);
      setInterruptionCount(0);
      setIsInterrupted(false);
      secondsSpentInCurrentSessionRef.current = 0;
    }
  };

  // ─── CONTROLS ───────────────────────────────────────────────────────
  const handleStart = () => {
    soundManager.playStart();
    setIsRunning(true);
    setIsInterrupted(false);
    lastActiveTimestampRef.current = Date.now();
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleResume = () => {
    soundManager.playStart();
    setIsInterrupted(false);
    setIsRunning(true);
    lastActiveTimestampRef.current = Date.now();
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsInterrupted(false);
    setTimeLeft(mode === "focus" ? FOCUS_TIME_SECONDS : BREAK_TIME_SECONDS);
    secondsSpentInCurrentSessionRef.current = 0;
  };

  const handleStop = async () => {
    // Determine elapsed seconds in current session
    const elapsedSeconds = secondsSpentInCurrentSessionRef.current > 0
      ? secondsSpentInCurrentSessionRef.current
      : (mode === "focus" ? Math.max(0, FOCUS_TIME_SECONDS - timeLeft) : 0);

    if (elapsedSeconds <= 0 && !isRunning) {
      toast.info("No active study session to stop.");
      return;
    }

    setIsRunning(false);

    if (elapsedSeconds >= 5 && currentStudent) {
      soundManager.playBreakComplete();
      const studentBatch = batches.find(b => b.id === currentStudent.batchId);
      const effectiveSubject = customSubject.trim() || selectedSubject;

      const newSession: StudySession = {
        id: Date.now().toString(),
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        batchId: currentStudent.batchId,
        batchName: studentBatch?.name || "Unassigned",
        durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
        durationSeconds: elapsedSeconds,
        type: "focus",
        subject: effectiveSubject,
        completedAt: new Date().toISOString(),
        date: new Date().toISOString().split("T")[0],
        interruptions: interruptionCount,
      };

      try {
        await logStudySession(newSession);
        loadStudentStats();
        toast.success("Study Session Stopped & Saved!", {
          description: `Logged ${formatStudyDuration(elapsedSeconds)} with timestamp to leaderboard.`,
        });
      } catch (e) {
        console.error("Failed to log study session", e);
      }
    } else if (elapsedSeconds < 5 && elapsedSeconds > 0) {
      toast.info("Session too short", {
        description: "Study sessions under 5 seconds are not logged to the leaderboard.",
      });
    }

    // Reset back to initial state so clicking start again restarts fresh
    setTimeLeft(mode === "focus" ? FOCUS_TIME_SECONDS : BREAK_TIME_SECONDS);
    secondsSpentInCurrentSessionRef.current = 0;
    setIsInterrupted(false);
    setInterruptionCount(0);
  };

  const handleSwitchMode = (targetMode: "focus" | "break") => {
    setIsRunning(false);
    setIsInterrupted(false);
    setMode(targetMode);
    setTimeLeft(targetMode === "focus" ? FOCUS_TIME_SECONDS : BREAK_TIME_SECONDS);
    secondsSpentInCurrentSessionRef.current = 0;
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setEnabled(next);
  };

  const toggleFullScreen = () => {
    if (!fullScreenContainerRef.current) return;
    if (!document.fullscreenElement) {
      fullScreenContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullScreen(false);
    }
  };

  // Formatting helpers
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const totalTimeForCurrentMode = mode === "focus" ? FOCUS_TIME_SECONDS : BREAK_TIME_SECONDS;
  const progressPercentage = ((totalTimeForCurrentMode - timeLeft) / totalTimeForCurrentMode) * 100;
  const strokeDashoffset = 440 - (440 * progressPercentage) / 100;

  // Leaderboard data
  const rankedStudents = useMemo(() => {
    return computeLeaderboard(leaderboardTimeframe, leaderboardBatch, searchQuery);
  }, [leaderboardTimeframe, leaderboardBatch, searchQuery, totalHours, todaySeconds]);

  // Current student rank
  const myRankInfo = useMemo(() => {
    if (!currentStudent) return null;
    return rankedStudents.find(s => s.studentId === currentStudent.id);
  }, [rankedStudents, currentStudent]);

  return (
    <div ref={fullScreenContainerRef} className="space-y-6">
      {/* Top Banner / Tab Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border rounded-2xl p-2.5 sm:p-3 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
              Pomodoro & Study Tracker
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/5 text-[10px] py-0">
                <ShieldCheck className="w-3 h-3 mr-1 inline" /> Unbreakable
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground hidden sm:block">
              25m Focus • 5m Break • Anti-Distraction Strict Mode
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex p-1 bg-muted/60 rounded-xl border">
            <button
              onClick={() => setActiveSubTab("timer")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === "timer"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Timer className="w-3.5 h-3.5" />
              Focus Timer
            </button>
            <button
              onClick={() => setActiveSubTab("leaderboard")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === "leaderboard"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              Leaderboard
              {myRankInfo && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold">
                  #{myRankInfo.rank}
                </span>
              )}
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSound}
            className="h-8 w-8 rounded-xl"
            title={soundEnabled ? "Mute Sound" : "Enable Sound"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullScreen}
            className="h-8 w-8 rounded-xl hidden md:inline-flex"
            title="Toggle Distraction-free Fullscreen"
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* ─── TIMER VIEW ──────────────────────────────────────────────── */}
      {activeSubTab === "timer" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Focus Clock Column */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="p-6 sm:p-8 relative overflow-hidden border-2 shadow-md bg-gradient-to-b from-card via-card to-primary/[0.02]">
              {/* Top Mode Selector & Anti-cheat Badge */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl border">
                  <button
                    onClick={() => handleSwitchMode("focus")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      mode === "focus"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    25m Focus
                  </button>
                  <button
                    onClick={() => handleSwitchMode("break")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      mode === "break"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Coffee className="w-3.5 h-3.5" />
                    5m Break
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                    Strict Anti-Cheat Guard Active
                  </div>
                </div>
              </div>

              {/* Interruption Alert Banner */}
              {isInterrupted && (
                <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-900 dark:text-amber-100 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-extrabold text-sm sm:text-base">Focus Interrupted!</p>
                      <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                        {interruptionReason || "You switched apps, minimized the browser, or locked your screen."} The timer automatically stopped so that study hours reflect only 100% active screen presence.
                      </p>
                      <div className="pt-2 flex items-center gap-3">
                        <Button
                          size="sm"
                          onClick={handleResume}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs h-8 px-4"
                        >
                          <Play className="w-3.5 h-3.5 mr-1 fill-current" />
                          Resume Studying
                        </Button>
                        <span className="text-[11px] text-muted-foreground">
                          Interrupted: <strong className="text-foreground">{interruptionCount}</strong> {interruptionCount === 1 ? "time" : "times"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Circular SVG Timer */}
              <div className="flex flex-col items-center justify-center my-6">
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                    {/* Background Ring */}
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      className="stroke-muted/30"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    {/* Animated Progress Ring */}
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      className={`transition-all duration-1000 ease-linear ${
                        mode === "focus"
                          ? isRunning
                            ? "stroke-primary"
                            : "stroke-primary/70"
                          : "stroke-emerald-500"
                      }`}
                      strokeWidth="10"
                      strokeDasharray="440"
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>

                  {/* Inner Timer Content */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
                    <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                      {mode === "focus" ? (
                        <>
                          <Flame className="w-3.5 h-3.5 text-primary inline" /> Focus Mode
                        </>
                      ) : (
                        <>
                          <Coffee className="w-3.5 h-3.5 text-emerald-500 inline" /> Relax & Recharge
                        </>
                      )}
                    </span>
                    <span className="text-5xl sm:text-6xl font-black tracking-tight font-mono text-foreground drop-shadow-xs">
                      {formatTime(timeLeft)}
                    </span>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        Cycle {cycleCount} / 4
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Timer Action Controls */}
                <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                  {!isRunning ? (
                    <Button
                      onClick={handleStart}
                      size="lg"
                      className="rounded-2xl px-7 py-6 text-base font-black shadow-lg shadow-primary/25 hover:shadow-xl transition-all"
                    >
                      <Play className="w-5 h-5 mr-2 fill-current" />
                      {secondsSpentInCurrentSessionRef.current > 0 || timeLeft < totalTimeForCurrentMode ? "Resume Focus" : "Start Focus"}
                    </Button>
                  ) : (
                    <Button
                      onClick={handlePause}
                      variant="secondary"
                      size="lg"
                      className="rounded-2xl px-7 py-6 text-base font-black border hover:bg-muted"
                    >
                      <Pause className="w-5 h-5 mr-2" />
                      Pause
                    </Button>
                  )}

                  {/* Stop Button: Saves elapsed time to leaderboard & resets session */}
                  <Button
                    onClick={handleStop}
                    variant="destructive"
                    size="lg"
                    disabled={!isRunning && (secondsSpentInCurrentSessionRef.current === 0 && timeLeft === totalTimeForCurrentMode)}
                    className="rounded-2xl px-6 py-6 text-base font-black shadow-md hover:shadow-lg transition-all"
                    title="Stop Session & Save to Leaderboard"
                  >
                    <Square className="w-4 h-4 mr-2 fill-current" />
                    Stop
                  </Button>

                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-2xl"
                    title="Reset Timer"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Subject Tag Selector */}
              <div className="pt-6 border-t mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-bold text-muted-foreground">Subject / Topic:</span>
                </div>

                <div className="flex-1 max-w-sm flex items-center gap-2">
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Select Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Self Study">Self Study (General)</SelectItem>
                      {subjects.map(s => (
                        <SelectItem key={s.id} value={s.name}>
                          {s.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="Custom">Custom Topic...</SelectItem>
                    </SelectContent>
                  </Select>

                  {selectedSubject === "Custom" && (
                    <Input
                      placeholder="e.g. Chapter 3 Calculus"
                      value={customSubject}
                      onChange={e => setCustomSubject(e.target.value)}
                      className="h-9 text-xs rounded-xl"
                    />
                  )}
                </div>
              </div>

              {/* Motivational Quote Footnote */}
              <div className="mt-4 text-center">
                <p className="text-xs italic text-muted-foreground transition-opacity duration-500">
                  {MOTIVATIONAL_QUOTES[quoteIndex]}
                </p>
              </div>
            </Card>

            {/* Anti-Cheat Explanation Card */}
            <Card className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-border/60">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-black">How Unbreakable Focus Works</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    To make the student study leaderboard authentic and trustworthy, this timer continuously checks your active screen presence. If you switch to Instagram, WhatsApp, YouTube, lock your phone, or switch browser tabs, the timer immediately stops until you return.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Sidebar: Personal Stats & Mini Leaderboard */}
          <div className="lg:col-span-4 space-y-6">
            {/* My Study Stats Card */}
            <Card className="p-5 sm:p-6 rounded-2xl border shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  Your Study Progress
                </h3>
                {myRankInfo && (
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-primary/20 text-xs font-black">
                    Rank #{myRankInfo.rank}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Today</span>
                  <span className="text-lg font-black text-primary">
                    {formatStudyDuration(todaySeconds)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">All Time</span>
                  <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                    {totalHours.toFixed(1)} hrs
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 col-span-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Highest Self-Study</span>
                      <span className="text-[11px] text-muted-foreground">Personal Best Session</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {highestSessionSeconds > 0 ? formatStudyDuration(highestSessionSeconds) : "0 mins"}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t text-xs text-muted-foreground space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>Sessions Finished Today:</span>
                  <span className="font-bold text-foreground">
                    {Math.floor(todaySeconds / (25 * 60))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Completed Cycles:</span>
                  <span className="font-bold text-foreground">{totalCompletedCycles}</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full text-xs font-bold rounded-xl"
                onClick={() => setActiveSubTab("leaderboard")}
              >
                <Trophy className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                View Full Academy Leaderboard
              </Button>
            </Card>

            {/* Quick Top 3 Preview Card */}
            <Card className="p-5 sm:p-6 rounded-2xl border shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-500" />
                  Top Academy Scholars
                </h3>
                <span className="text-[10px] font-bold text-muted-foreground">All-Time</span>
              </div>

              <div className="space-y-2">
                {rankedStudents.slice(0, 3).map((item, idx) => (
                  <div
                    key={item.studentId}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      item.studentId === currentStudent?.id
                        ? "bg-primary/10 border-primary/30"
                        : "bg-muted/30 border-border/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          idx === 0
                            ? "bg-amber-400 text-amber-950 shadow-xs"
                            : idx === 1
                            ? "bg-slate-300 text-slate-800"
                            : "bg-amber-700 text-amber-100"
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate max-w-[120px] sm:max-w-[140px]">
                          {item.name} {item.studentId === currentStudent?.id && "(You)"}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{item.batchName}</p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-primary shrink-0">
                      {item.totalHours.toFixed(1)}h
                    </span>
                  </div>
                ))}

                {rankedStudents.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No study records yet. Complete a 25m session to claim #1!
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ─── FULL LEADERBOARD VIEW ────────────────────────────────────── */}
      {activeSubTab === "leaderboard" && (
        <div className="space-y-6">
          {/* Personal Rank Hero Banner */}
          {myRankInfo && (
            <Card className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-primary/15 via-accent/10 to-primary/5 border-2 border-primary/20 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black text-2xl shadow-md">
                    #{myRankInfo.rank}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black tracking-tight">
                      You are Ranked #{myRankInfo.rank} in Sankalp Academy!
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                      Total Focus Time: <strong className="text-foreground">{myRankInfo.totalHours.toFixed(1)} hours</strong> ({myRankInfo.sessionsCompleted} completed pomodoros)
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => setActiveSubTab("timer")}
                  className="font-bold rounded-xl text-xs h-9 px-4 shrink-0 shadow-xs"
                >
                  <Timer className="w-4 h-4 mr-1.5" /> Start Study Session
                </Button>
              </div>
            </Card>
          )}

          {/* Filter Bar */}
          <Card className="p-4 rounded-2xl border shadow-xs">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Timeframe Buttons */}
              <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border self-start">
                <button
                  onClick={() => setLeaderboardTimeframe("all-time")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    leaderboardTimeframe === "all-time"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Time
                </button>
                <button
                  onClick={() => setLeaderboardTimeframe("week")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    leaderboardTimeframe === "week"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  This Week
                </button>
                <button
                  onClick={() => setLeaderboardTimeframe("today")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    leaderboardTimeframe === "today"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Today
                </button>
              </div>

              {/* Batch Filter & Search */}
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Select value={leaderboardBatch} onValueChange={setLeaderboardBatch}>
                  <SelectTrigger className="h-9 text-xs rounded-xl w-36 sm:w-40">
                    <SelectValue placeholder="All Batches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Batches</SelectItem>
                    {batches.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search student..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 text-xs rounded-xl"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Top 3 Podium (Visible if we have candidates) */}
          {rankedStudents.length >= 3 && !searchQuery && (
            <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 pb-2 items-end max-w-2xl mx-auto">
              {/* 2nd Place */}
              <Card className="p-3 sm:p-4 text-center rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-slate-500/5 order-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 flex items-center justify-center font-black mx-auto mb-2 text-sm sm:text-base shadow-xs">
                  🥈 2
                </div>
                <p className="font-black text-xs sm:text-sm truncate">{rankedStudents[1].name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{rankedStudents[1].batchName}</p>
                <Badge variant="secondary" className="mt-2 text-[10px] font-bold">
                  {rankedStudents[1].totalHours.toFixed(1)} hrs
                </Badge>
              </Card>

              {/* 1st Place (Gold) */}
              <Card className="p-4 sm:p-6 text-center rounded-3xl border-2 border-amber-400 bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent order-2 -translate-y-2 shadow-lg shadow-amber-500/10">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center font-black mx-auto mb-2 text-base sm:text-xl shadow-md ring-4 ring-amber-300/50">
                  👑 1
                </div>
                <p className="font-black text-sm sm:text-base text-amber-950 dark:text-amber-200 truncate">
                  {rankedStudents[0].name}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{rankedStudents[0].batchName}</p>
                <Badge className="mt-2 text-xs font-black bg-amber-500 text-amber-950 hover:bg-amber-500">
                  {rankedStudents[0].totalHours.toFixed(1)} hrs
                </Badge>
              </Card>

              {/* 3rd Place */}
              <Card className="p-3 sm:p-4 text-center rounded-2xl border-2 border-amber-700/40 bg-amber-700/5 order-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-700/20 text-amber-800 dark:text-amber-200 flex items-center justify-center font-black mx-auto mb-2 text-sm sm:text-base shadow-xs">
                  🥉 3
                </div>
                <p className="font-black text-xs sm:text-sm truncate">{rankedStudents[2].name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{rankedStudents[2].batchName}</p>
                <Badge variant="secondary" className="mt-2 text-[10px] font-bold">
                  {rankedStudents[2].totalHours.toFixed(1)} hrs
                </Badge>
              </Card>
            </div>
          )}

          {/* Full Rankings Table */}
          <Card className="rounded-2xl border overflow-hidden shadow-xs">
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
              <h4 className="text-sm font-black flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                Rankings ({rankedStudents.length} Students)
              </h4>
              <span className="text-xs text-muted-foreground">
                Showing {leaderboardTimeframe === "all-time" ? "All Time" : leaderboardTimeframe === "week" ? "This Week" : "Today"}
              </span>
            </div>

            <div className="divide-y max-h-[600px] overflow-y-auto">
              {rankedStudents.map(student => {
                const isMe = student.studentId === currentStudent?.id;
                return (
                  <div
                    key={student.studentId}
                    className={`flex items-center justify-between p-3 sm:p-4 transition-colors ${
                      isMe ? "bg-primary/10 font-bold" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                          student.rank === 1
                            ? "bg-amber-400 text-amber-950 shadow-xs"
                            : student.rank === 2
                            ? "bg-slate-300 text-slate-800"
                            : student.rank === 3
                            ? "bg-amber-700 text-amber-100"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        #{student.rank}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold truncate">
                            {student.name}
                          </p>
                          {isMe && (
                            <Badge className="bg-primary text-primary-foreground text-[10px] py-0 px-1.5 h-4">
                              You
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {student.batchName} {student.rollNo ? `• Roll ${student.rollNo}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-primary">
                        {student.totalHours.toFixed(1)} hrs
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {student.sessionsCompleted} sessions
                      </p>
                    </div>
                  </div>
                );
              })}

              {rankedStudents.length === 0 && (
                <div className="p-8 text-center text-muted-foreground space-y-2">
                  <Users className="w-8 h-8 mx-auto text-muted-foreground/50" />
                  <p className="text-sm font-medium">No student study records match this filter.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
