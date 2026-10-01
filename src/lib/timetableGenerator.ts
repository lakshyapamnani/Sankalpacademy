import {
  Teacher,
  TimetableLecture,
  DAY_ORDER_MAP,
  DAYS_OF_WEEK,
  formatTimeRange12h,
  formatTime12h,
  timeToMinutes,
  getLectureTeacherIds,
  getLectureTeacherNames,
} from './localStorage';

export interface BatchSubjectConfig {
  subjectName: string;
  selected: boolean;
  lecturesPerWeek: number; // 1, 2, 3, 4, 5, or workingDays.length
  assignTwoTeachers: boolean;
  durationMinutes?: number; // optional override
}

export interface BatchScheduleConfig {
  batchId: string;
  batchName: string;
  selected: boolean;
  preferredStartTime: string; // HH:MM e.g. "16:00"
  preferredEndTime: string;   // HH:MM e.g. "21:00"
  defaultLecturesPerWeek?: number;
  isCombinedBatch?: boolean;
  subjectConfigs: Record<string, BatchSubjectConfig>;
}

export interface AutoGenerateConfig {
  academicYear: string;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;   // YYYY-MM-DD
  workingDays: string[]; // e.g. ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  instituteStartTime: string; // HH:MM e.g. "15:00"
  instituteEndTime: string;   // HH:MM e.g. "21:00"
  defaultDuration: number;    // in minutes e.g. 120 (2 hours)
  gapMinutes: number;         // in minutes e.g. 30
  batchConfigs: Record<string, BatchScheduleConfig>;
}

export interface UnscheduledIssue {
  id: string;
  batchId: string;
  batchName: string;
  subjectName: string;
  lectureNum: number;
  reason: string;
}

export interface ConflictValidationIssue {
  id: string;
  type:
    | 'batch'
    | 'teacher'
    | 'additional_teacher'
    | 'room'
    | 'time'
    | 'gap'
    | 'teacher_subject'
    | 'duplicate';
  severity: 'hard';
  message: string;
  lectureAId: string;
  lectureBId?: string;
  batchName: string;
  day: string;
  timeRange: string;
}

export interface ValidationSummary {
  isValid: boolean;
  batchConflicts: number;
  teacherConflicts: number;
  additionalTeacherConflicts: number;
  roomConflicts: number;
  timeConflicts: number;
  gapConflicts: number;
  teacherSubjectConflicts: number;
  duplicateConflicts: number;
  totalConflicts: number;
  issues: ConflictValidationIssue[];
}

export interface GeneratorResult {
  lectures: TimetableLecture[];
  unscheduled: UnscheduledIssue[];
  stats: {
    batchesCount: number;
    lecturesCount: number;
    teachersCount: number;
    roomsCount: number;
    conflictsCount: number;
    unscheduledCount: number;
  };
  validation: ValidationSummary;
}

/**
 * Converts minutes (from 00:00) to HH:MM format (24-hour)
 */
export const minutesToTime = (minutes: number): string => {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, minutes));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Overlap detection: start1 < end2 && start2 < end1
 */
export const isTimesOverlap = (
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean => {
  return start1 < end2 && start2 < end1;
};

/**
 * Checks if the configured gap is respected between two non-overlapping slots on the same day.
 * If gapMinutes <= 0, returns false (no violation).
 */
export const isGapViolated = (
  start1: number,
  end1: number,
  start2: number,
  end2: number,
  gapMinutes: number
): boolean => {
  if (gapMinutes <= 0) return false;
  // If they overlap, that's already an overlap violation, not a gap violation
  if (isTimesOverlap(start1, end1, start2, end2)) return false;

  if (end1 <= start2) {
    return start2 < end1 + gapMinutes;
  }
  if (end2 <= start1) {
    return start1 < end2 + gapMinutes;
  }
  return false;
};

/**
 * Finds eligible teachers assigned to a given subject (case-insensitive)
 */
export const findEligibleTeachers = (
  subjectName: string,
  teachers: Teacher[]
): Teacher[] => {
  const normSubj = subjectName.trim().toLowerCase();
  return teachers.filter(t =>
    (t.assignedSubjects || []).some(s => s.trim().toLowerCase() === normSubj)
  );
};

interface LectureTask {
  batchId: string;
  batchName: string;
  subjectName: string;
  subjectNames?: string[];
  isCombinedBatch?: boolean;
  primarySubject?: string;
  secondarySubject?: string;
  durationMinutes: number;
  assignTwoTeachers: boolean;
  lectureNum: number;
  totalLectures: number;
  preferredStartTime: string;
  preferredEndTime: string;
  eligibleTeachers: Teacher[];
  eligibleSecondaryTeachers?: Teacher[];
}

/**
 * Deterministic Constraint-Based Timetable Generator
 */
export const generateAutoTimetable = (
  config: AutoGenerateConfig,
  teachers: Teacher[],
  availableRooms: string[]
): GeneratorResult => {
  const scheduledLectures: TimetableLecture[] = [];
  const unscheduled: UnscheduledIssue[] = [];

  // Filter selected batches
  const selectedBatches = Object.values(config.batchConfigs).filter(b => b.selected);
  const workingDays = config.workingDays.length > 0
    ? config.workingDays
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const rooms = availableRooms.length > 0
    ? availableRooms
    : ['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5'];

  // Global scheduleId for this generation run
  const scheduleId = `sched_auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Build and prioritize lecture tasks
  const tasks: LectureTask[] = [];

  for (const bConfig of selectedBatches) {
    const selectedSubjects = Object.values(bConfig.subjectConfigs).filter(s => s.selected);

    if (bConfig.isCombinedBatch && selectedSubjects.length >= 2) {
      // Group subjects into pairs to assign 2 subjects at the exact same time
      const pairs: Array<{ subj1: BatchSubjectConfig; subj2: BatchSubjectConfig; lecturesCount: number }> = [];
      for (let i = 0; i < selectedSubjects.length; i += 2) {
        if (i + 1 < selectedSubjects.length) {
          const s1 = selectedSubjects[i];
          const s2 = selectedSubjects[i + 1];
          const lecturesCount = Math.max(s1.lecturesPerWeek, s2.lecturesPerWeek, 1);
          pairs.push({ subj1: s1, subj2: s2, lecturesCount });
        } else {
          // Odd subject remaining: pair with the first subject
          const s1 = selectedSubjects[i];
          const s2 = selectedSubjects[0];
          const lecturesCount = Math.max(s1.lecturesPerWeek, 1);
          pairs.push({ subj1: s1, subj2: s2, lecturesCount });
        }
      }

      for (const pair of pairs) {
        const eligible1 = findEligibleTeachers(pair.subj1.subjectName, teachers);
        const eligible2 = findEligibleTeachers(pair.subj2.subjectName, teachers);
        const combinedName = `${pair.subj1.subjectName} & ${pair.subj2.subjectName}`;
        const numLectures = Math.min(pair.lecturesCount, workingDays.length);
        const duration = pair.subj1.durationMinutes && pair.subj1.durationMinutes > 0
          ? pair.subj1.durationMinutes
          : config.defaultDuration;

        if (eligible1.length === 0) {
          for (let i = 1; i <= numLectures; i++) {
            unscheduled.push({
              id: `unsched_${bConfig.batchId}_${pair.subj1.subjectName}_${i}`,
              batchId: bConfig.batchId,
              batchName: bConfig.batchName,
              subjectName: pair.subj1.subjectName,
              lectureNum: i,
              reason: `No teacher is assigned to subject "${pair.subj1.subjectName}" in Institute Settings.`,
            });
          }
          continue;
        }

        if (eligible2.length === 0) {
          for (let i = 1; i <= numLectures; i++) {
            unscheduled.push({
              id: `unsched_${bConfig.batchId}_${pair.subj2.subjectName}_${i}`,
              batchId: bConfig.batchId,
              batchName: bConfig.batchName,
              subjectName: pair.subj2.subjectName,
              lectureNum: i,
              reason: `No teacher is assigned to subject "${pair.subj2.subjectName}" in Institute Settings.`,
            });
          }
          continue;
        }

        const hasDistinctPair = eligible1.some(tA => eligible2.some(tB => tA.id !== tB.id));
        if (!hasDistinctPair) {
          for (let i = 1; i <= numLectures; i++) {
            unscheduled.push({
              id: `unsched_${bConfig.batchId}_${combinedName}_${i}`,
              batchId: bConfig.batchId,
              batchName: bConfig.batchName,
              subjectName: combinedName,
              lectureNum: i,
              reason: `Two distinct teachers required to teach "${pair.subj1.subjectName}" and "${pair.subj2.subjectName}" simultaneously in combined batch.`,
            });
          }
          continue;
        }

        for (let i = 1; i <= numLectures; i++) {
          tasks.push({
            batchId: bConfig.batchId,
            batchName: bConfig.batchName,
            subjectName: combinedName,
            subjectNames: [pair.subj1.subjectName, pair.subj2.subjectName],
            isCombinedBatch: true,
            primarySubject: pair.subj1.subjectName,
            secondarySubject: pair.subj2.subjectName,
            durationMinutes: duration,
            assignTwoTeachers: true,
            lectureNum: i,
            totalLectures: numLectures,
            preferredStartTime: bConfig.preferredStartTime || config.instituteStartTime,
            preferredEndTime: bConfig.preferredEndTime || config.instituteEndTime,
            eligibleTeachers: eligible1,
            eligibleSecondaryTeachers: eligible2,
          });
        }
      }
    } else {
      for (const sCfg of selectedSubjects) {
        const eligible = findEligibleTeachers(sCfg.subjectName, teachers);
        const duration = sCfg.durationMinutes && sCfg.durationMinutes > 0
          ? sCfg.durationMinutes
          : config.defaultDuration;

        const numLectures = Math.min(sCfg.lecturesPerWeek, workingDays.length);

        if (eligible.length === 0) {
          for (let i = 1; i <= numLectures; i++) {
            unscheduled.push({
              id: `unsched_${bConfig.batchId}_${sCfg.subjectName}_${i}`,
              batchId: bConfig.batchId,
              batchName: bConfig.batchName,
              subjectName: sCfg.subjectName,
              lectureNum: i,
              reason: `No teacher is assigned to subject "${sCfg.subjectName}" in Institute Settings.`,
            });
          }
          continue;
        }

        if (sCfg.assignTwoTeachers && eligible.length < 2) {
          for (let i = 1; i <= numLectures; i++) {
            unscheduled.push({
              id: `unsched_${bConfig.batchId}_${sCfg.subjectName}_${i}`,
              batchId: bConfig.batchId,
              batchName: bConfig.batchName,
              subjectName: sCfg.subjectName,
              lectureNum: i,
              reason: `Two teachers required for "${sCfg.subjectName}", but only 1 teacher (${eligible[0].name}) is assigned to this subject.`,
            });
          }
          continue;
        }

        for (let i = 1; i <= numLectures; i++) {
          tasks.push({
            batchId: bConfig.batchId,
            batchName: bConfig.batchName,
            subjectName: sCfg.subjectName,
            subjectNames: [sCfg.subjectName],
            isCombinedBatch: false,
            primarySubject: sCfg.subjectName,
            durationMinutes: duration,
            assignTwoTeachers: sCfg.assignTwoTeachers,
            lectureNum: i,
            totalLectures: numLectures,
            preferredStartTime: bConfig.preferredStartTime || config.instituteStartTime,
            preferredEndTime: bConfig.preferredEndTime || config.instituteEndTime,
            eligibleTeachers: eligible,
          });
        }
      }
    }
  }

  // Sort tasks by constraint tightness (Most Constrained First)
  tasks.sort((a, b) => {
    // 1. Tasks requiring 2 teachers or combined batch are more constrained
    const aTwo = a.assignTwoTeachers || a.isCombinedBatch ? 1 : 0;
    const bTwo = b.assignTwoTeachers || b.isCombinedBatch ? 1 : 0;
    if (aTwo !== bTwo) return bTwo - aTwo;

    // 2. Fewer eligible teachers = more constrained
    if (a.eligibleTeachers.length !== b.eligibleTeachers.length) {
      return a.eligibleTeachers.length - b.eligibleTeachers.length;
    }

    // 3. Smaller preferred time window = more constrained
    const aWindow = timeToMinutes(a.preferredEndTime) - timeToMinutes(a.preferredStartTime);
    const bWindow = timeToMinutes(b.preferredEndTime) - timeToMinutes(b.preferredStartTime);
    if (aWindow !== bWindow) return aWindow - bWindow;

    // 4. Stable sort by batchName then subjectName then lectureNum
    if (a.batchName !== b.batchName) return a.batchName.localeCompare(b.batchName);
    if (a.subjectName !== b.subjectName) return a.subjectName.localeCompare(b.subjectName);
    return a.lectureNum - b.lectureNum;
  });

  // Track teacher assignment counts to balance load
  const teacherLoadMap: Record<string, number> = {};
  teachers.forEach(t => {
    teacherLoadMap[t.id] = 0;
  });

  // Helper: Preferred day distribution for a subject with N lectures across D working days
  const getPreferredDaysForTask = (
    lectureNum: number,
    totalLectures: number,
    daysList: string[]
  ): string[] => {
    const D = daysList.length;
    if (totalLectures === 1) {
      // Middle of week
      const midIdx = Math.floor(D / 2);
      const reordered = [daysList[midIdx], ...daysList.filter((_, idx) => idx !== midIdx)];
      return reordered;
    }

    // Evenly spaced target index
    const step = D / totalLectures;
    const idealIdx = Math.min(D - 1, Math.floor((lectureNum - 1) * step));
    const idealDay = daysList[idealIdx];

    // Order all days starting with idealDay, followed by other days sorted by distance
    const dayIndices = daysList.map((_, idx) => idx);
    dayIndices.sort((x, y) => Math.abs(x - idealIdx) - Math.abs(y - idealIdx));
    return dayIndices.map(idx => daysList[idx]);
  };

  // Helper: Deterministically select teachers for a task (handles combined 2-subject pairs & single-subject)
  const selectTeachersForTask = (
    currentTask: LectureTask,
    dayLectures: TimetableLecture[],
    slotStart: number,
    slotEnd: number,
    currentLoadMap: Record<string, number>
  ): {
    selectedTeachers: Teacher[];
    teacherSubjectMap: Record<string, string>;
    subjectNames: string[];
  } | null => {
    if (
      currentTask.isCombinedBatch &&
      currentTask.eligibleSecondaryTeachers &&
      currentTask.primarySubject &&
      currentTask.secondarySubject
    ) {
      const free1 = currentTask.eligibleTeachers.filter(t => {
        return !dayLectures.some(l => {
          const lTeacherIds = getLectureTeacherIds(l);
          return (
            lTeacherIds.includes(t.id) &&
            isTimesOverlap(slotStart, slotEnd, timeToMinutes(l.startTime), timeToMinutes(l.endTime))
          );
        });
      });

      const free2 = currentTask.eligibleSecondaryTeachers.filter(t => {
        return !dayLectures.some(l => {
          const lTeacherIds = getLectureTeacherIds(l);
          return (
            lTeacherIds.includes(t.id) &&
            isTimesOverlap(slotStart, slotEnd, timeToMinutes(l.startTime), timeToMinutes(l.endTime))
          );
        });
      });

      free1.sort((a, b) => (currentLoadMap[a.id] || 0) - (currentLoadMap[b.id] || 0) || a.name.localeCompare(b.name));
      free2.sort((a, b) => (currentLoadMap[a.id] || 0) - (currentLoadMap[b.id] || 0) || a.name.localeCompare(b.name));

      let chosenT1: Teacher | null = null;
      let chosenT2: Teacher | null = null;

      for (const tA of free1) {
        for (const tB of free2) {
          if (tA.id !== tB.id) {
            chosenT1 = tA;
            chosenT2 = tB;
            break;
          }
        }
        if (chosenT1 && chosenT2) break;
      }

      if (!chosenT1 || !chosenT2) return null;

      return {
        selectedTeachers: [chosenT1, chosenT2],
        teacherSubjectMap: {
          [chosenT1.id]: currentTask.primarySubject,
          [chosenT2.id]: currentTask.secondarySubject,
        },
        subjectNames: [currentTask.primarySubject, currentTask.secondarySubject],
      };
    }

    const free = currentTask.eligibleTeachers.filter(t => {
      return !dayLectures.some(l => {
        const lTeacherIds = getLectureTeacherIds(l);
        return (
          lTeacherIds.includes(t.id) &&
          isTimesOverlap(slotStart, slotEnd, timeToMinutes(l.startTime), timeToMinutes(l.endTime))
        );
      });
    });

    const needed = currentTask.assignTwoTeachers ? 2 : 1;
    if (free.length < needed) return null;

    free.sort((a, b) => (currentLoadMap[a.id] || 0) - (currentLoadMap[b.id] || 0) || a.name.localeCompare(b.name));
    const selected = free.slice(0, needed);

    const tSubjMap: Record<string, string> = {};
    selected.forEach(t => {
      tSubjMap[t.id] = currentTask.subjectName;
    });

    return {
      selectedTeachers: selected,
      teacherSubjectMap: tSubjMap,
      subjectNames: currentTask.subjectNames && currentTask.subjectNames.length > 0 ? currentTask.subjectNames : [currentTask.subjectName],
    };
  };

  // 2. Schedule each task deterministically
  for (const task of tasks) {
    const candidateDays = getPreferredDaysForTask(
      task.lectureNum,
      task.totalLectures,
      workingDays
    );

    const bStartMin = timeToMinutes(task.preferredStartTime);
    const bEndMin = timeToMinutes(task.preferredEndTime);
    const instStartMin = timeToMinutes(config.instituteStartTime);
    const instEndMin = timeToMinutes(config.instituteEndTime);

    const actualStartMin = Math.max(instStartMin, bStartMin);
    const actualEndMin = Math.min(instEndMin, bEndMin);

    let scheduled = false;
    let failureReason = 'No available time slot without batch, teacher, or room conflict.';

    // Try each candidate day in priority order
    for (const day of candidateDays) {
      if (scheduled) break;

      // Soft rule: Avoid same subject twice on same day if totalLectures <= workingDays.length
      const batchDayLectures = scheduledLectures.filter(
        l => l.batchId === task.batchId && l.day.toLowerCase() === day.toLowerCase()
      );

      const alreadyHasSubjectToday = batchDayLectures.some(
        l => l.subjectName.toLowerCase() === task.subjectName.toLowerCase()
      );
      if (alreadyHasSubjectToday && task.totalLectures <= workingDays.length) {
        // Skip this day on the first pass if other days are available
        continue;
      }

      // Generate candidate start times
      const candidateStartTimes: number[] = [];

      // 1. Immediately after existing batch lectures (with gap)
      batchDayLectures.forEach(l => {
        const afterLec = timeToMinutes(l.endTime) + config.gapMinutes;
        if (afterLec + task.durationMinutes <= actualEndMin && afterLec >= actualStartMin) {
          if (!candidateStartTimes.includes(afterLec)) {
            candidateStartTimes.push(afterLec);
          }
        }
      });

      // 2. Preferred start time
      if (actualStartMin + task.durationMinutes <= actualEndMin) {
        if (!candidateStartTimes.includes(actualStartMin)) {
          candidateStartTimes.push(actualStartMin);
        }
      }

      // 3. Regular 30-min intervals
      for (let t = actualStartMin; t + task.durationMinutes <= actualEndMin; t += 30) {
        if (!candidateStartTimes.includes(t)) {
          candidateStartTimes.push(t);
        }
      }

      // Sort candidate times so earlier and preferred times are tested first
      candidateStartTimes.sort((a, b) => a - b);

      // Evaluate candidate slots
      for (const slotStart of candidateStartTimes) {
        const slotEnd = slotStart + task.durationMinutes;

        // A. HARD CHECK: Batch conflict & gap on this day
        let batchHasConflict = false;
        for (const existing of batchDayLectures) {
          const exStart = timeToMinutes(existing.startTime);
          const exEnd = timeToMinutes(existing.endTime);

          if (isTimesOverlap(slotStart, slotEnd, exStart, exEnd)) {
            batchHasConflict = true;
            break;
          }
          if (isGapViolated(slotStart, slotEnd, exStart, exEnd, config.gapMinutes)) {
            batchHasConflict = true;
            break;
          }
        }
        if (batchHasConflict) continue;

        // B. HARD CHECK: Teacher availability
        const dayLectures = scheduledLectures.filter(
          l => l.day.toLowerCase() === day.toLowerCase()
        );

        const teacherAssignment = selectTeachersForTask(
          task,
          dayLectures,
          slotStart,
          slotEnd,
          teacherLoadMap
        );

        if (!teacherAssignment) {
          failureReason = task.isCombinedBatch
            ? `No available pair of teachers free at this time for "${task.primarySubject}" and "${task.secondarySubject}".`
            : `No available ${task.subjectName} teacher free at this time.`;
          continue;
        }

        // C. HARD CHECK: Room availability
        // Find an unoccupied room
        const occupiedRoomNames = new Set(
          dayLectures
            .filter(l => {
              const exStart = timeToMinutes(l.startTime);
              const exEnd = timeToMinutes(l.endTime);
              return isTimesOverlap(slotStart, slotEnd, exStart, exEnd);
            })
            .map(l => (l.roomName || '').trim().toLowerCase())
        );

        // Soft optimization: prefer the room this batch is already using on this day
        const existingBatchRoom = batchDayLectures.find(l => l.roomName)?.roomName;
        let chosenRoom = '';

        if (
          existingBatchRoom &&
          !occupiedRoomNames.has(existingBatchRoom.trim().toLowerCase()) &&
          rooms.some(r => r.trim().toLowerCase() === existingBatchRoom.trim().toLowerCase())
        ) {
          chosenRoom = existingBatchRoom;
        } else {
          // Pick first free room
          for (const rm of rooms) {
            if (!occupiedRoomNames.has(rm.trim().toLowerCase())) {
              chosenRoom = rm;
              break;
            }
          }
        }

        if (!chosenRoom) {
          failureReason = 'All classrooms/rooms are occupied during this time slot.';
          continue;
        }

        // ALL HARD CONSTRAINTS SATISFIED! Schedule this lecture
        const teacherIds = teacherAssignment.selectedTeachers.map(t => t.id);
        const teacherNames = teacherAssignment.selectedTeachers.map(t => t.name);

        // Update teacher loads
        teacherAssignment.selectedTeachers.forEach(t => {
          teacherLoadMap[t.id] = (teacherLoadMap[t.id] || 0) + 1;
        });

        const newLecture: TimetableLecture = {
          timetableId: `lec_auto_${Date.now()}_${scheduledLectures.length}_${Math.random().toString(36).substring(2, 6)}`,
          academicYear: config.academicYear,
          batchId: task.batchId,
          batchName: task.batchName,
          day: day,
          dayOrder: DAY_ORDER_MAP[day] || 1,
          startTime: minutesToTime(slotStart),
          endTime: minutesToTime(slotEnd),
          subjectName: task.subjectName,
          subjectNames: teacherAssignment.subjectNames,
          teacherSubjectMap: teacherAssignment.teacherSubjectMap,
          teacherId: teacherIds[0],
          teacherName: teacherNames[0],
          teacherIds: teacherIds,
          teacherNames: teacherNames,
          roomName: chosenRoom,
          effectiveFrom: config.weekStart,
          effectiveTo: config.weekEnd,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        scheduledLectures.push(newLecture);
        scheduled = true;
        break;
      }
    }

    // Secondary pass: if not scheduled due to consecutive/duplicate day soft rule, try any open slot on any working day
    if (!scheduled) {
      for (const day of workingDays) {
        if (scheduled) break;

        const batchDayLectures = scheduledLectures.filter(
          l => l.batchId === task.batchId && l.day.toLowerCase() === day.toLowerCase()
        );

        for (let t = actualStartMin; t + task.durationMinutes <= actualEndMin; t += 30) {
          const slotStart = t;
          const slotEnd = t + task.durationMinutes;

          let batchHasConflict = false;
          for (const existing of batchDayLectures) {
            const exStart = timeToMinutes(existing.startTime);
            const exEnd = timeToMinutes(existing.endTime);
            if (isTimesOverlap(slotStart, slotEnd, exStart, exEnd)) {
              batchHasConflict = true;
              break;
            }
            if (isGapViolated(slotStart, slotEnd, exStart, exEnd, config.gapMinutes)) {
              batchHasConflict = true;
              break;
            }
          }
          if (batchHasConflict) continue;

          const dayLectures = scheduledLectures.filter(
            l => l.day.toLowerCase() === day.toLowerCase()
          );

          const teacherAssignment = selectTeachersForTask(
            task,
            dayLectures,
            slotStart,
            slotEnd,
            teacherLoadMap
          );

          if (!teacherAssignment) continue;

          const occupiedRoomNames = new Set(
            dayLectures
              .filter(l => isTimesOverlap(slotStart, slotEnd, timeToMinutes(l.startTime), timeToMinutes(l.endTime)))
              .map(l => (l.roomName || '').trim().toLowerCase())
          );

          let chosenRoom = '';
          for (const rm of rooms) {
            if (!occupiedRoomNames.has(rm.trim().toLowerCase())) {
              chosenRoom = rm;
              break;
            }
          }
          if (!chosenRoom) continue;

          const teacherIds = teacherAssignment.selectedTeachers.map(tc => tc.id);
          const teacherNames = teacherAssignment.selectedTeachers.map(tc => tc.name);
          teacherAssignment.selectedTeachers.forEach(tc => {
            teacherLoadMap[tc.id] = (teacherLoadMap[tc.id] || 0) + 1;
          });

          const newLecture: TimetableLecture = {
            timetableId: `lec_auto_${Date.now()}_${scheduledLectures.length}_${Math.random().toString(36).substring(2, 6)}`,
            academicYear: config.academicYear,
            batchId: task.batchId,
            batchName: task.batchName,
            day: day,
            dayOrder: DAY_ORDER_MAP[day] || 1,
            startTime: minutesToTime(slotStart),
            endTime: minutesToTime(slotEnd),
            subjectName: task.subjectName,
            subjectNames: teacherAssignment.subjectNames,
            teacherSubjectMap: teacherAssignment.teacherSubjectMap,
            teacherId: teacherIds[0],
            teacherName: teacherNames[0],
            teacherIds: teacherIds,
            teacherNames: teacherNames,
            roomName: chosenRoom,
            effectiveFrom: config.weekStart,
            effectiveTo: config.weekEnd,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          scheduledLectures.push(newLecture);
          scheduled = true;
          break;
        }
      }
    }

    if (!scheduled) {
      unscheduled.push({
        id: `unsched_${task.batchId}_${task.subjectName}_${task.lectureNum}`,
        batchId: task.batchId,
        batchName: task.batchName,
        subjectName: task.subjectName,
        lectureNum: task.lectureNum,
        reason: failureReason,
      });
    }
  }

  // 3. Second Validation Pass
  const validation = validateGeneratedTimetable(scheduledLectures, config, teachers);

  // 4. Compute statistics
  const uniqueBatchesCount = new Set(scheduledLectures.map(l => l.batchId)).size;
  const uniqueTeachersCount = new Set(
    scheduledLectures.flatMap(l => getLectureTeacherIds(l))
  ).size;
  const uniqueRoomsCount = new Set(
    scheduledLectures.map(l => (l.roomName || '').trim()).filter(Boolean)
  ).size;

  return {
    lectures: scheduledLectures,
    unscheduled,
    stats: {
      batchesCount: uniqueBatchesCount,
      lecturesCount: scheduledLectures.length,
      teachersCount: uniqueTeachersCount,
      roomsCount: uniqueRoomsCount,
      conflictsCount: validation.totalConflicts,
      unscheduledCount: unscheduled.length,
    },
    validation,
  };
};

/**
 * SECOND VALIDATION PASS
 * Exhaustively checks every scheduled lecture against all other lectures for any hard constraint violations.
 */
export const validateGeneratedTimetable = (
  lectures: TimetableLecture[],
  config: AutoGenerateConfig,
  teachers: Teacher[]
): ValidationSummary => {
  const issues: ConflictValidationIssue[] = [];
  let batchConflicts = 0;
  let teacherConflicts = 0;
  let additionalTeacherConflicts = 0;
  let roomConflicts = 0;
  let timeConflicts = 0;
  let gapConflicts = 0;
  let teacherSubjectConflicts = 0;
  let duplicateConflicts = 0;

  const instStartMin = timeToMinutes(config.instituteStartTime || '08:00');
  const instEndMin = timeToMinutes(config.instituteEndTime || '22:00');

  // Individual lecture validations
  for (const lec of lectures) {
    const sMin = timeToMinutes(lec.startTime);
    const eMin = timeToMinutes(lec.endTime);

    // 1. Duration & bounds check
    if (eMin <= sMin) {
      timeConflicts++;
      issues.push({
        id: `time_invalid_${lec.timetableId}`,
        type: 'time',
        severity: 'hard',
        message: `End time (${formatTime12h(lec.endTime)}) must be later than start time (${formatTime12h(lec.startTime)}).`,
        lectureAId: lec.timetableId,
        batchName: lec.batchName,
        day: lec.day,
        timeRange: formatTimeRange12h(lec.startTime, lec.endTime),
      });
    }

    if (sMin < instStartMin || eMin > instEndMin) {
      timeConflicts++;
      issues.push({
        id: `time_bounds_${lec.timetableId}`,
        type: 'time',
        severity: 'hard',
        message: `Lecture is outside institute operating hours (${formatTimeRange12h(config.instituteStartTime, config.instituteEndTime)}).`,
        lectureAId: lec.timetableId,
        batchName: lec.batchName,
        day: lec.day,
        timeRange: formatTimeRange12h(lec.startTime, lec.endTime),
      });
    }

    // 2. Teacher-Subject validity
    const tIds = getLectureTeacherIds(lec);
    const tNames = getLectureTeacherNames(lec);

    for (let idx = 0; idx < tIds.length; idx++) {
      const tId = tIds[idx];
      const tName = tNames[idx] || 'Assigned teacher';
      const assignedSubj =
        lec.teacherSubjectMap?.[tId] ||
        (lec.subjectNames && lec.subjectNames[idx]) ||
        lec.subjectName;

      const eligibleTeachers = findEligibleTeachers(assignedSubj, teachers);
      const eligibleIds = new Set(eligibleTeachers.map(t => t.id));

      if (!eligibleIds.has(tId)) {
        teacherSubjectConflicts++;
        issues.push({
          id: `ts_${lec.timetableId}_${tId}`,
          type: 'teacher_subject',
          severity: 'hard',
          message: `${tName} is not assigned to teach "${assignedSubj}" in institute settings.`,
          lectureAId: lec.timetableId,
          batchName: lec.batchName,
          day: lec.day,
          timeRange: formatTimeRange12h(lec.startTime, lec.endTime),
        });
      }
    }
  }

  // Pairwise checks
  for (let i = 0; i < lectures.length; i++) {
    for (let j = i + 1; j < lectures.length; j++) {
      const a = lectures[i];
      const b = lectures[j];

      // Only check lectures on the same day
      if (a.day.toLowerCase() !== b.day.toLowerCase()) continue;

      const aStart = timeToMinutes(a.startTime);
      const aEnd = timeToMinutes(a.endTime);
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);

      const overlap = isTimesOverlap(aStart, aEnd, bStart, bEnd);

      // Check Exact Duplicate
      const aTeachers = getLectureTeacherIds(a);
      const bTeachers = getLectureTeacherIds(b);
      const sameBatch = a.batchId === b.batchId;
      const sameSubject = a.subjectName.toLowerCase() === b.subjectName.toLowerCase();
      const sameRoom = (a.roomName || '').trim().toLowerCase() === (b.roomName || '').trim().toLowerCase();
      const sameTime = a.startTime === b.startTime && a.endTime === b.endTime;
      const sameTeachers =
        aTeachers.length > 0 &&
        aTeachers.length === bTeachers.length &&
        aTeachers.every(id => bTeachers.includes(id));

      if (sameBatch && sameSubject && sameRoom && sameTime && sameTeachers) {
        duplicateConflicts++;
        issues.push({
          id: `dup_${a.timetableId}_${b.timetableId}`,
          type: 'duplicate',
          severity: 'hard',
          message: `Duplicate lecture detected for ${a.batchName} on ${a.day} at ${formatTimeRange12h(a.startTime, a.endTime)}.`,
          lectureAId: a.timetableId,
          lectureBId: b.timetableId,
          batchName: a.batchName,
          day: a.day,
          timeRange: formatTimeRange12h(a.startTime, a.endTime),
        });
      }

      // If overlapping:
      if (overlap) {
        // A. Batch conflict
        if (sameBatch) {
          batchConflicts++;
          issues.push({
            id: `batch_conflict_${a.timetableId}_${b.timetableId}`,
            type: 'batch',
            severity: 'hard',
            message: `${a.batchName} has overlapping lectures: "${a.subjectName}" (${formatTimeRange12h(a.startTime, a.endTime)}) and "${b.subjectName}" (${formatTimeRange12h(b.startTime, b.endTime)}).`,
            lectureAId: a.timetableId,
            lectureBId: b.timetableId,
            batchName: a.batchName,
            day: a.day,
            timeRange: `${formatTimeRange12h(a.startTime, a.endTime)} vs ${formatTimeRange12h(b.startTime, b.endTime)}`,
          });
        }

        // B. Teacher conflict (Primary and Additional Teachers)
        const commonTeachers = aTeachers.filter(id => bTeachers.includes(id));
        if (commonTeachers.length > 0) {
          for (const cId of commonTeachers) {
            const teacherObj = teachers.find(t => t.id === cId);
            const teacherName = teacherObj?.name || 'Teacher';
            const isAdditionalInA = aTeachers.indexOf(cId) > 0;
            const isAdditionalInB = bTeachers.indexOf(cId) > 0;

            if (isAdditionalInA || isAdditionalInB) {
              additionalTeacherConflicts++;
              issues.push({
                id: `add_teacher_conflict_${a.timetableId}_${b.timetableId}_${cId}`,
                type: 'additional_teacher',
                severity: 'hard',
                message: `Co-teacher "${teacherName}" is assigned to two overlapping lectures: ${a.batchName} (${formatTimeRange12h(a.startTime, a.endTime)}) and ${b.batchName} (${formatTimeRange12h(b.startTime, b.endTime)}).`,
                lectureAId: a.timetableId,
                lectureBId: b.timetableId,
                batchName: `${a.batchName} / ${b.batchName}`,
                day: a.day,
                timeRange: `${formatTimeRange12h(a.startTime, a.endTime)} vs ${formatTimeRange12h(b.startTime, b.endTime)}`,
              });
            } else {
              teacherConflicts++;
              issues.push({
                id: `teacher_conflict_${a.timetableId}_${b.timetableId}_${cId}`,
                type: 'teacher',
                severity: 'hard',
                message: `Teacher "${teacherName}" is assigned to two overlapping lectures: ${a.batchName} (${formatTimeRange12h(a.startTime, a.endTime)}) and ${b.batchName} (${formatTimeRange12h(b.startTime, b.endTime)}).`,
                lectureAId: a.timetableId,
                lectureBId: b.timetableId,
                batchName: `${a.batchName} / ${b.batchName}`,
                day: a.day,
                timeRange: `${formatTimeRange12h(a.startTime, a.endTime)} vs ${formatTimeRange12h(b.startTime, b.endTime)}`,
              });
            }
          }
        }

        // C. Room conflict
        if (sameRoom && (a.roomName || '').trim() !== '') {
          roomConflicts++;
          issues.push({
            id: `room_conflict_${a.timetableId}_${b.timetableId}`,
            type: 'room',
            severity: 'hard',
            message: `Room "${a.roomName}" is occupied by two different batches at the same time: ${a.batchName} and ${b.batchName}.`,
            lectureAId: a.timetableId,
            lectureBId: b.timetableId,
            batchName: `${a.batchName} / ${b.batchName}`,
            day: a.day,
            timeRange: `${formatTimeRange12h(a.startTime, a.endTime)} vs ${formatTimeRange12h(b.startTime, b.endTime)}`,
          });
        }
      } else {
        // If not overlapping, check if the configured batch gap is violated
        if (sameBatch && isGapViolated(aStart, aEnd, bStart, bEnd, config.gapMinutes)) {
          gapConflicts++;
          issues.push({
            id: `gap_conflict_${a.timetableId}_${b.timetableId}`,
            type: 'gap',
            severity: 'hard',
            message: `Minimum gap of ${config.gapMinutes} minutes violated for ${a.batchName} between "${a.subjectName}" (${formatTimeRange12h(a.startTime, a.endTime)}) and "${b.subjectName}" (${formatTimeRange12h(b.startTime, b.endTime)}).`,
            lectureAId: a.timetableId,
            lectureBId: b.timetableId,
            batchName: a.batchName,
            day: a.day,
            timeRange: `${formatTimeRange12h(a.startTime, a.endTime)} → ${formatTimeRange12h(b.startTime, b.endTime)}`,
          });
        }
      }
    }
  }

  const totalConflicts =
    batchConflicts +
    teacherConflicts +
    additionalTeacherConflicts +
    roomConflicts +
    timeConflicts +
    gapConflicts +
    teacherSubjectConflicts +
    duplicateConflicts;

  return {
    isValid: totalConflicts === 0,
    batchConflicts,
    teacherConflicts,
    additionalTeacherConflicts,
    roomConflicts,
    timeConflicts,
    gapConflicts,
    teacherSubjectConflicts,
    duplicateConflicts,
    totalConflicts,
    issues,
  };
};

/**
 * AUTO-FIX ENGINE
 * Attempts to resolve conflicts automatically by:
 * 1. Trying another available room
 * 2. Trying another eligible teacher
 * 3. Shifting the slot to another valid opening on the same day or another working day
 * Never deletes any lecture.
 */
export const autoFixTimetable = (
  currentLectures: TimetableLecture[],
  config: AutoGenerateConfig,
  teachers: Teacher[],
  availableRooms: string[]
): { lectures: TimetableLecture[]; fixedCount: number; validation: ValidationSummary } => {
  let fixedLectures = [...currentLectures];
  const rooms = availableRooms.length > 0 ? availableRooms : ['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Room 5'];
  const workingDays = config.workingDays.length > 0 ? config.workingDays : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let initialValidation = validateGeneratedTimetable(fixedLectures, config, teachers);
  if (initialValidation.isValid) {
    return { lectures: fixedLectures, fixedCount: 0, validation: initialValidation };
  }

  let fixedCount = 0;
  const maxIterations = 5;

  for (let iter = 0; iter < maxIterations; iter++) {
    const currentValidation = validateGeneratedTimetable(fixedLectures, config, teachers);
    if (currentValidation.isValid) break;

    // Pick issues to resolve
    for (const issue of currentValidation.issues) {
      const targetLecIndex = fixedLectures.findIndex(l => l.timetableId === issue.lectureBId || l.timetableId === issue.lectureAId);
      if (targetLecIndex === -1) continue;

      const targetLec = fixedLectures[targetLecIndex];
      const otherLectures = fixedLectures.filter((_, idx) => idx !== targetLecIndex);
      const duration = Math.max(30, timeToMinutes(targetLec.endTime) - timeToMinutes(targetLec.startTime));

      // 1. Try room swap if room conflict
      if (issue.type === 'room') {
        const sMin = timeToMinutes(targetLec.startTime);
        const eMin = timeToMinutes(targetLec.endTime);
        const dayOccupiedRooms = new Set(
          otherLectures
            .filter(l => l.day.toLowerCase() === targetLec.day.toLowerCase() && isTimesOverlap(sMin, eMin, timeToMinutes(l.startTime), timeToMinutes(l.endTime)))
            .map(l => (l.roomName || '').trim().toLowerCase())
        );

        const freeRoom = rooms.find(r => !dayOccupiedRooms.has(r.trim().toLowerCase()));
        if (freeRoom) {
          fixedLectures[targetLecIndex] = {
            ...targetLec,
            roomName: freeRoom,
            updatedAt: new Date().toISOString(),
          };
          fixedCount++;
          continue;
        }
      }

      // 2. Try teacher swap if teacher conflict
      if (issue.type === 'teacher' || issue.type === 'additional_teacher') {
        const eligible = findEligibleTeachers(targetLec.subjectName, teachers);
        const sMin = timeToMinutes(targetLec.startTime);
        const eMin = timeToMinutes(targetLec.endTime);

        const dayLectures = otherLectures.filter(l => l.day.toLowerCase() === targetLec.day.toLowerCase());
        const freeTeachers = eligible.filter(t => {
          return !dayLectures.some(l => {
            const tIds = getLectureTeacherIds(l);
            return tIds.includes(t.id) && isTimesOverlap(sMin, eMin, timeToMinutes(l.startTime), timeToMinutes(l.endTime));
          });
        });

        const currentTeacherIds = getLectureTeacherIds(targetLec);
        const needed = currentTeacherIds.length > 1 ? 2 : 1;

        if (freeTeachers.length >= needed) {
          const chosen = freeTeachers.slice(0, needed);
          const newIds = chosen.map(t => t.id);
          const newNames = chosen.map(t => t.name);

          fixedLectures[targetLecIndex] = {
            ...targetLec,
            teacherId: newIds[0],
            teacherName: newNames[0],
            teacherIds: newIds,
            teacherNames: newNames,
            updatedAt: new Date().toISOString(),
          };
          fixedCount++;
          continue;
        }
      }

      // 3. Try slot relocation (shift to next valid slot on this day or another day)
      const bConfig = config.batchConfigs[targetLec.batchId];
      const startMin = timeToMinutes(bConfig?.preferredStartTime || config.instituteStartTime);
      const endMin = timeToMinutes(bConfig?.preferredEndTime || config.instituteEndTime);
      const eligible = findEligibleTeachers(targetLec.subjectName, teachers);
      const currentTeacherIds = getLectureTeacherIds(targetLec);
      const neededTeachers = currentTeacherIds.length > 1 ? 2 : 1;

      let foundNewSlot = false;

      for (const day of workingDays) {
        if (foundNewSlot) break;

        const dayLecs = otherLectures.filter(l => l.day.toLowerCase() === day.toLowerCase());
        const batchDayLecs = dayLecs.filter(l => l.batchId === targetLec.batchId);

        for (let t = startMin; t + duration <= endMin; t += 30) {
          const sMin = t;
          const eMin = t + duration;

          // Check batch
          const batchOverlap = batchDayLecs.some(l => isTimesOverlap(sMin, eMin, timeToMinutes(l.startTime), timeToMinutes(l.endTime)));
          if (batchOverlap) continue;

          const batchGap = batchDayLecs.some(l => isGapViolated(sMin, eMin, timeToMinutes(l.startTime), timeToMinutes(l.endTime), config.gapMinutes));
          if (batchGap) continue;

          // Check teachers
          const freeTeachers = eligible.filter(tc => {
            return !dayLecs.some(l => {
              const tIds = getLectureTeacherIds(l);
              return tIds.includes(tc.id) && isTimesOverlap(sMin, eMin, timeToMinutes(l.startTime), timeToMinutes(l.endTime));
            });
          });
          if (freeTeachers.length < neededTeachers) continue;

          // Check room
          const occupiedRooms = new Set(
            dayLecs
              .filter(l => isTimesOverlap(sMin, eMin, timeToMinutes(l.startTime), timeToMinutes(l.endTime)))
              .map(l => (l.roomName || '').trim().toLowerCase())
          );
          const freeRoom = rooms.find(r => !occupiedRooms.has(r.trim().toLowerCase()));
          if (!freeRoom) continue;

          const chosenTeachers = freeTeachers.slice(0, neededTeachers);
          const newIds = chosenTeachers.map(tc => tc.id);
          const newNames = chosenTeachers.map(tc => tc.name);

          fixedLectures[targetLecIndex] = {
            ...targetLec,
            day,
            dayOrder: DAY_ORDER_MAP[day] || 1,
            startTime: minutesToTime(sMin),
            endTime: minutesToTime(eMin),
            teacherId: newIds[0],
            teacherName: newNames[0],
            teacherIds: newIds,
            teacherNames: newNames,
            roomName: freeRoom,
            updatedAt: new Date().toISOString(),
          };
          foundNewSlot = true;
          fixedCount++;
          break;
        }
      }
    }
  }

  const finalValidation = validateGeneratedTimetable(fixedLectures, config, teachers);
  return {
    lectures: fixedLectures,
    fixedCount,
    validation: finalValidation,
  };
};
