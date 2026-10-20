import React, { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Trophy, 
  Crown, 
  Medal, 
  Clock, 
  Flame, 
  Users, 
  Search, 
  Filter, 
  RotateCcw, 
  CheckCircle2, 
  BookOpen, 
  AlertTriangle, 
  Calendar,
  Sparkles,
  Download,
  Trash2,
  Eye,
  Timer,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { 
  Batch, 
  Student, 
  StudySession, 
  getBatches, 
  getStudents, 
  getStudySessions, 
  getStudySessionsByStudent, 
  resetStudentStudyStats 
} from "@/lib/localStorage";
import { computeLeaderboard, formatStudyDuration, RankedStudent, isToday } from "@/lib/pomodoroUtils";

export const PomodoroAdminSection: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [timeframe, setTimeframe] = useState<"all-time" | "week" | "today">("all-time");
  const [selectedBatch, setSelectedBatch] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Detailed Student Modal
  const [selectedStudentForLogs, setSelectedStudentForLogs] = useState<RankedStudent | null>(null);
  const [studentSessions, setStudentSessions] = useState<StudySession[]>([]);

  // Reset Confirmation Modal
  const [studentToReset, setStudentToReset] = useState<RankedStudent | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Refresh trigger
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    setBatches(getBatches());
  }, [refreshKey]);

  // Compute leaderboard
  const rankedStudents = useMemo(() => {
    return computeLeaderboard(timeframe, selectedBatch, searchQuery);
  }, [timeframe, selectedBatch, searchQuery, refreshKey]);

  // Overall Statistics
  const overallStats = useMemo(() => {
    const allSessions = getStudySessions().filter(s => s.type === "focus");
    const totalSeconds = allSessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
    const totalHours = (totalSeconds / 3600).toFixed(1);

    const todaySessions = allSessions.filter(s => isToday(s.completedAt || s.date));
    const activeStudentIdsToday = new Set(todaySessions.map(s => s.studentId));

    const topPerformer = rankedStudents.length > 0 && rankedStudents[0].totalSeconds > 0 ? rankedStudents[0] : null;

    return {
      totalHours,
      totalSessions: allSessions.length,
      activeTodayCount: activeStudentIdsToday.size,
      topPerformer,
    };
  }, [rankedStudents, refreshKey]);

  // Open study logs for a student
  const handleOpenStudentLogs = (student: RankedStudent) => {
    setSelectedStudentForLogs(student);
    const logs = getStudySessionsByStudent(student.studentId);
    logs.sort((a, b) => new Date(b.completedAt || b.date).getTime() - new Date(a.completedAt || a.date).getTime());
    setStudentSessions(logs);
  };

  // Reset student study stats
  const handleConfirmReset = async () => {
    if (!studentToReset) return;
    setIsResetting(true);
    try {
      const ok = await resetStudentStudyStats(studentToReset.studentId);
      if (ok) {
        toast.success(`Study stats for ${studentToReset.name} have been reset.`);
        setStudentToReset(null);
        setSelectedStudentForLogs(null);
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error("Failed to reset study stats.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Error resetting stats");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Badges */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            Study Hours & Pomodoro Leaderboard
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Monitor real-time study hours, focus session completions, and academy scholar rankings.
          </p>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 sm:p-5 rounded-2xl border shadow-xs bg-gradient-to-br from-primary/5 via-card to-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Study Time</p>
              <h3 className="text-xl sm:text-2xl font-black text-foreground">{overallStats.totalHours} hrs</h3>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 rounded-2xl border shadow-xs bg-gradient-to-br from-amber-500/5 via-card to-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Focus Sessions</p>
              <h3 className="text-xl sm:text-2xl font-black text-foreground">{overallStats.totalSessions}</h3>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 rounded-2xl border shadow-xs bg-gradient-to-br from-emerald-500/5 via-card to-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Active Today</p>
              <h3 className="text-xl sm:text-2xl font-black text-foreground">{overallStats.activeTodayCount} students</h3>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 rounded-2xl border shadow-xs bg-gradient-to-br from-amber-500/15 via-card to-card">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-400 text-amber-950 font-black">
              <Crown className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">#1 Scholar</p>
              <h3 className="text-sm sm:text-base font-black truncate">
                {overallStats.topPerformer ? overallStats.topPerformer.name : "None yet"}
              </h3>
              {overallStats.topPerformer && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {overallStats.topPerformer.totalHours.toFixed(1)} hrs • {overallStats.topPerformer.batchName}
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 rounded-2xl border shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Timeframe Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border self-start">
            <button
              onClick={() => setTimeframe("all-time")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeframe === "all-time"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setTimeframe("week")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeframe === "week"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setTimeframe("today")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeframe === "today"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Today
            </button>
          </div>

          {/* Batch Selector & Search */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger className="h-9 text-xs rounded-xl w-36 sm:w-44">
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
                placeholder="Search student or roll no..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-xs rounded-xl"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Top 3 Podium (When available) */}
      {rankedStudents.length >= 3 && !searchQuery && rankedStudents[0].totalSeconds > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-4 pb-2 items-end max-w-2xl mx-auto">
          {/* 2nd Place */}
          <Card 
            onClick={() => handleOpenStudentLogs(rankedStudents[1])}
            className="p-3 sm:p-4 text-center rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-slate-500/5 order-1 cursor-pointer hover:border-slate-400 hover:shadow-md transition-all group"
            title="Click to view all study sessions"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 flex items-center justify-center font-black mx-auto mb-2 text-sm sm:text-base shadow-xs">
              🥈 2
            </div>
            <p className="font-black text-xs sm:text-sm truncate group-hover:text-primary group-hover:underline">{rankedStudents[1].name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{rankedStudents[1].batchName}</p>
            <Badge variant="secondary" className="mt-2 text-[10px] font-bold">
              {rankedStudents[1].totalHours.toFixed(1)} hrs
            </Badge>
          </Card>

          {/* 1st Place (Gold) */}
          <Card 
            onClick={() => handleOpenStudentLogs(rankedStudents[0])}
            className="p-4 sm:p-6 text-center rounded-3xl border-2 border-amber-400 bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent order-2 -translate-y-2 shadow-lg shadow-amber-500/10 cursor-pointer hover:border-amber-500 transition-all group"
            title="Click to view all study sessions"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center font-black mx-auto mb-2 text-base sm:text-xl shadow-md ring-4 ring-amber-300/50">
              👑 1
            </div>
            <p className="font-black text-sm sm:text-base text-amber-950 dark:text-amber-200 truncate group-hover:underline">
              {rankedStudents[0].name}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">{rankedStudents[0].batchName}</p>
            <Badge className="mt-2 text-xs font-black bg-amber-500 text-amber-950 hover:bg-amber-500">
              {rankedStudents[0].totalHours.toFixed(1)} hrs
            </Badge>
          </Card>

          {/* 3rd Place */}
          <Card 
            onClick={() => handleOpenStudentLogs(rankedStudents[2])}
            className="p-3 sm:p-4 text-center rounded-2xl border-2 border-amber-700/40 bg-amber-700/5 order-3 cursor-pointer hover:border-amber-700/60 hover:shadow-md transition-all group"
            title="Click to view all study sessions"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-700/20 text-amber-800 dark:text-amber-200 flex items-center justify-center font-black mx-auto mb-2 text-sm sm:text-base shadow-xs">
              🥉 3
            </div>
            <p className="font-black text-xs sm:text-sm truncate group-hover:text-primary group-hover:underline">{rankedStudents[2].name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{rankedStudents[2].batchName}</p>
            <Badge variant="secondary" className="mt-2 text-[10px] font-bold">
              {rankedStudents[2].totalHours.toFixed(1)} hrs
            </Badge>
          </Card>
        </div>
      )}

      {/* Rankings Table */}
      <Card className="rounded-2xl border overflow-hidden shadow-xs">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              Full Student Study Leaderboard
            </h4>
            <p className="text-xs text-muted-foreground">
              Ranked strictly by verified study hours ({timeframe === "all-time" ? "All Time" : timeframe === "week" ? "This Week" : "Today"}). Click student name to view all sessions.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {rankedStudents.length} Students
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b font-bold text-muted-foreground">
              <tr>
                <th className="py-3 px-4 w-16">Rank</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Batch</th>
                <th className="py-3 px-4 text-right">Study Time</th>
                <th className="py-3 px-4 text-center">Sessions</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rankedStudents.map(student => (
                <tr key={student.studentId} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3.5 px-4 font-black">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-xl text-xs font-black ${
                        student.rank === 1
                          ? "bg-amber-400 text-amber-950"
                          : student.rank === 2
                          ? "bg-slate-300 text-slate-800"
                          : student.rank === 3
                          ? "bg-amber-700 text-amber-100"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      #{student.rank}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-foreground">
                    <div>
                      <button
                        type="button"
                        onClick={() => handleOpenStudentLogs(student)}
                        className="text-left font-bold text-sm text-foreground hover:text-primary hover:underline flex items-center gap-1.5 transition-colors cursor-pointer group"
                        title={`Click to view all study sessions for ${student.name}`}
                      >
                        <span className="group-hover:text-primary">{student.name}</span>
                        <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 text-primary shrink-0 transition-opacity" />
                      </button>
                      {student.rollNo && (
                        <p className="text-[10px] text-muted-foreground">Roll No: {student.rollNo}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground font-medium">
                    {student.batchName}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-primary text-sm">
                    {student.totalHours.toFixed(1)} hrs
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      {formatStudyDuration(student.totalSeconds)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold">
                    <Badge variant="secondary" className="text-xs font-bold">
                      {student.sessionsCompleted}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenStudentLogs(student)}
                        className="h-8 px-2.5 text-xs rounded-xl"
                        title="View Detailed Study Logs"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Sessions
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStudentToReset(student)}
                        className="h-8 px-2 text-xs rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Reset Student Stats"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {rankedStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="font-medium text-sm">No students match this filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Student Study Logs Modal */}
      {selectedStudentForLogs && (
        <Dialog open={!!selectedStudentForLogs} onOpenChange={() => setSelectedStudentForLogs(null)}>
          <DialogContent className="max-w-xl rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-primary" />
                  {selectedStudentForLogs.name} • Study Sessions
                </span>
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  {selectedStudentForLogs.totalHours.toFixed(1)} hrs Total
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 my-2">
              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-muted/40 border text-center">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Batch</span>
                  <span className="text-xs font-bold text-foreground truncate block">{selectedStudentForLogs.batchName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Sessions</span>
                  <span className="text-xs font-bold text-foreground block">{studentSessions.length} recorded</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Highest Session</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                    {formatStudyDuration(
                      selectedStudentForLogs.highestSessionSeconds || 
                      (studentSessions.length > 0 ? Math.max(...studentSessions.map(s => s.durationSeconds || 0)) : 0)
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {studentSessions.map((session, i) => (
                  <div key={session.id || i} className="p-3 rounded-2xl border bg-card/60 flex items-center justify-between text-xs hover:border-primary/30 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-foreground text-sm">
                          {session.subject || "Self Study"}
                        </p>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold uppercase tracking-wider text-primary border-primary/20">
                          {session.type || "focus"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(session.completedAt || session.date).toLocaleString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {session.interruptions ? ` • ${session.interruptions} interruptions` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm font-extrabold text-primary block">
                        {formatStudyDuration(session.durationSeconds || session.durationMinutes * 60)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {session.durationMinutes} mins
                      </span>
                    </div>
                  </div>
                ))}

                {studentSessions.length === 0 && (
                  <div className="py-10 text-center text-muted-foreground text-xs space-y-2">
                    <Timer className="w-8 h-8 mx-auto text-muted-foreground/30" />
                    <p className="font-medium">No individual study session logs recorded for this student yet.</p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setStudentToReset(selectedStudentForLogs);
                }}
                className="rounded-xl text-xs font-bold"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Reset Stats
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedStudentForLogs(null)}
                className="rounded-xl text-xs font-bold"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmation Dialog for Resetting Stats */}
      {studentToReset && (
        <Dialog open={!!studentToReset} onOpenChange={() => setStudentToReset(null)}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Reset Study Stats?
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs sm:text-sm text-muted-foreground">
              <p>
                Are you sure you want to reset the study hours and focus logs for{" "}
                <strong className="text-foreground">{studentToReset.name}</strong>?
              </p>
              <p className="text-destructive font-semibold">
                This will reset their total hours and ranking on the leaderboard to zero.
              </p>
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStudentToReset(null)}
                className="rounded-xl text-xs font-bold"
                disabled={isResetting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmReset}
                className="rounded-xl text-xs font-bold"
                disabled={isResetting}
              >
                {isResetting ? "Resetting..." : "Yes, Reset Stats"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
