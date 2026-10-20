import { 
  getStudySessions, 
  getStudentStudyStats, 
  getStudents, 
  getBatches, 
  StudentStudyStats, 
  StudySession, 
  Student 
} from "./localStorage";

export interface RankedStudent {
  rank: number;
  studentId: string;
  name: string;
  rollNo?: string;
  batchId?: string;
  batchName: string;
  totalSeconds: number;
  totalMinutes: number;
  totalHours: number;
  sessionsCompleted: number;
  highestSessionSeconds: number;
  lastActive?: string;
}

/**
 * Check if an ISO date string falls into "today" (local date)
 */
export const isToday = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

/**
 * Check if an ISO date string falls within the last 7 days
 */
export const isThisWeek = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return now - d <= sevenDaysMs && d <= now;
};

/**
 * Formats seconds into human-readable "X hrs Y mins", "Y mins Zs", or "Zs"
 */
export const formatStudyDuration = (totalSeconds: number): string => {
  if (!totalSeconds || totalSeconds <= 0) return "0 mins";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hrs`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes} mins`;
  }
  return `${seconds}s`;
};

/**
 * Computes ranked leaderboard based on timeframe and optional batch filter
 */
export const computeLeaderboard = (
  timeframe: 'all-time' | 'week' | 'today' = 'all-time',
  filterBatchId: string = 'all',
  searchQuery: string = ''
): RankedStudent[] => {
  const students = getStudents();
  const batches = getBatches();
  const batchLookup = new Map<string, string>();
  batches.forEach(b => batchLookup.set(b.id, b.name));

  const studentLookup = new Map<string, Student>();
  students.forEach(s => studentLookup.set(s.id, s));

  // If all-time: we can combine StudentStudyStats + verified sessions
  const allSessions = getStudySessions().filter(s => s.type === 'focus');
  const allStats = getStudentStudyStats();

  // Aggregate seconds per studentId for the chosen timeframe
  const studentSecondsMap = new Map<string, { seconds: number; sessions: number; lastActive?: string }>();

  if (timeframe === 'all-time') {
    // Start with allStats
    allStats.forEach(stat => {
      studentSecondsMap.set(stat.studentId, {
        seconds: stat.totalSeconds || 0,
        sessions: stat.sessionsCompleted || 0,
        lastActive: stat.lastActive,
      });
    });

    // Also include any sessions not captured or supplement
    allSessions.forEach(session => {
      const current = studentSecondsMap.get(session.studentId) || { seconds: 0, sessions: 0, lastActive: session.completedAt };
      if (!allStats.some(s => s.studentId === session.studentId)) {
        current.seconds += session.durationSeconds || 0;
        current.sessions += 1;
        if (!current.lastActive || new Date(session.completedAt) > new Date(current.lastActive)) {
          current.lastActive = session.completedAt;
        }
        studentSecondsMap.set(session.studentId, current);
      }
    });
  } else {
    // For 'today' or 'week', compute directly from session logs
    allSessions.forEach(session => {
      const matchesTimeframe =
        timeframe === 'today' ? isToday(session.completedAt || session.date) : isThisWeek(session.completedAt || session.date);

      if (matchesTimeframe) {
        const current = studentSecondsMap.get(session.studentId) || { seconds: 0, sessions: 0, lastActive: session.completedAt };
        current.seconds += session.durationSeconds || 0;
        current.sessions += 1;
        if (!current.lastActive || new Date(session.completedAt) > new Date(current.lastActive)) {
          current.lastActive = session.completedAt;
        }
        studentSecondsMap.set(session.studentId, current);
      }
    });
  }

  // Ensure all active students in the directory exist in ranking if needed, or only those who have studied
  const rankedList: RankedStudent[] = [];

  students.forEach(student => {
    // Batch filter
    if (filterBatchId !== 'all' && student.batchId !== filterBatchId) {
      return;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = student.name.toLowerCase().includes(q);
      const rollMatch = student.rollNo?.toLowerCase().includes(q);
      if (!nameMatch && !rollMatch) return;
    }

    const data = studentSecondsMap.get(student.id);
    const totalSeconds = data?.seconds || 0;
    const totalMinutes = Math.round(totalSeconds / 60);
    const totalHours = Number((totalSeconds / 3600).toFixed(2));
    const sessionsCompleted = data?.sessions || 0;

    const studentSessions = allSessions.filter(s => s.studentId === student.id);
    const maxFromSessions = studentSessions.reduce((max, s) => Math.max(max, s.durationSeconds || 0), 0);
    const statItem = allStats.find(s => s.studentId === student.id);
    const highestSessionSeconds = Math.max(statItem?.highestSessionSeconds || 0, maxFromSessions);

    const batchName = student.batchId ? batchLookup.get(student.batchId) || 'Unassigned' : 'Unassigned';

    rankedList.push({
      rank: 0, // will assign after sorting
      studentId: student.id,
      name: student.name,
      rollNo: student.rollNo,
      batchId: student.batchId,
      batchName,
      totalSeconds,
      totalMinutes,
      totalHours,
      sessionsCompleted,
      highestSessionSeconds,
      lastActive: data?.lastActive,
    });
  });

  // Sort by highest seconds/hours descending
  rankedList.sort((a, b) => {
    if (b.totalSeconds !== a.totalSeconds) {
      return b.totalSeconds - a.totalSeconds;
    }
    // secondary sort: sessions count
    return b.sessionsCompleted - a.sessionsCompleted;
  });

  // Assign ranks (1-indexed)
  rankedList.forEach((item, index) => {
    item.rank = index + 1;
  });

  return rankedList;
};
