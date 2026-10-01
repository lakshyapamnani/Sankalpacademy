import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ClipboardCheck,
  UserCheck,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import {
  TimetableLecture,
  AttendanceRecord,
  Student,
  formatTimeRange12h,
  timeToMinutes,
  DAYS_OF_WEEK,
  DAY_ORDER_MAP,
  getLectureTeacherIds,
  getLectureTeacherNames,
  formatLectureTeachers,
} from '@/lib/localStorage';
import {
  getCurrentLocalDayName,
  toLocalDateString,
  getWeekInfo,
  getDateForDayInWeek,
} from '@/lib/timetableUtils';

export interface LectureAttendancePayload {
  timetableId: string;
  batchId: string;
  divisionId?: string;
  subjectName: string;
  teacherId: string;
  teacherIds?: string[];
  teacherName: string;
  date: string;
  startTime: string;
  endTime: string;
  roomName: string;
}

interface TeacherTimetableSectionProps {
  currentTeacherId: string;
  isMasterUser?: boolean; // For dev-lakshya / admin mode
  allLectures: TimetableLecture[];
  allAttendance: AttendanceRecord[];
  allStudents: Student[];
  onOpenAttendance: (payload: LectureAttendancePayload) => void;
}

export const TeacherTimetableSection = ({
  currentTeacherId,
  isMasterUser = false,
  allLectures,
  allAttendance,
  allStudents,
  onOpenAttendance,
}: TeacherTimetableSectionProps) => {
  const [viewMode, setViewMode] = useState<'today_upcoming' | 'weekly'>('today_upcoming');

  const todayDateStr = useMemo(() => toLocalDateString(new Date()), []);
  const todayDayName = useMemo(() => getCurrentLocalDayName(), []);
  const weekInfo = useMemo(() => getWeekInfo(new Date()), []);

  // Filter lectures assigned to this teacher (or all for dev master)
  // Teacher sees lecture if their teacherId exists in teacherIds or teacherId (Requirement 23)
  const teacherLectures = useMemo(() => {
    return allLectures.filter(l => {
      if (isMasterUser) return true;
      const ids = getLectureTeacherIds(l);
      return ids.includes(currentTeacherId);
    });
  }, [allLectures, currentTeacherId, isMasterUser]);

  // Helper to check if attendance has been taken for a specific lecture on a specific date
  const isAttendanceCompleted = (lecture: TimetableLecture, targetDate: string): boolean => {
    const batchStudents = allStudents.filter(s => s.batchId === lecture.batchId);
    if (batchStudents.length === 0) return false;

    // Check if attendance exists for this timetableId or for this batch on targetDate
    return batchStudents.some(s =>
      allAttendance.some(
        a =>
          a.studentId === s.id &&
          a.date === targetDate &&
          (a.classId === lecture.timetableId || a.classId === 'daily')
      )
    );
  };

  // TODAY'S LECTURES (sorted by start time)
  const todayLectures = useMemo(() => {
    return teacherLectures
      .filter(l => l.day.toLowerCase() === todayDayName.toLowerCase())
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [teacherLectures, todayDayName]);

  // UPCOMING LECTURES: Chronologically after today's schedule within the current week
  const upcomingLectures = useMemo(() => {
    const currentDayOrder = DAY_ORDER_MAP[todayDayName] || 1;
    // Find lectures scheduled for days later than today in the week
    const laterLectures = teacherLectures.filter(l => {
      const order = DAY_ORDER_MAP[l.day] || 1;
      return order > currentDayOrder;
    });

    return laterLectures.sort((a, b) => {
      const orderA = DAY_ORDER_MAP[a.day] || 1;
      const orderB = DAY_ORDER_MAP[b.day] || 1;
      if (orderA !== orderB) return orderA - orderB;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
  }, [teacherLectures, todayDayName]);

  // MY WEEKLY TIMETABLE (grouped by day)
  const weeklyLecturesByDay = useMemo(() => {
    const map: Record<string, TimetableLecture[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    };

    teacherLectures.forEach(l => {
      if (map[l.day]) {
        map[l.day].push(l);
      }
    });

    Object.keys(map).forEach(day => {
      map[day].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    });

    return map;
  }, [teacherLectures]);

  const handleLectureClick = (lecture: TimetableLecture, targetDate: string) => {
    onOpenAttendance({
      timetableId: lecture.timetableId,
      batchId: lecture.batchId,
      divisionId: lecture.divisionId,
      subjectName: lecture.subjectName,
      teacherId: lecture.teacherId || lecture.teacherIds?.[0] || currentTeacherId,
      teacherIds: getLectureTeacherIds(lecture),
      teacherName: formatLectureTeachers(lecture),
      date: targetDate,
      startTime: lecture.startTime,
      endTime: lecture.endTime,
      roomName: lecture.roomName,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header and View Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h3 className="text-2xl font-black text-primary flex items-center gap-2">
            <Clock className="h-6 w-6" />
            {isMasterUser ? 'Timetable & Class Schedule' : 'My Timetable & Schedule'}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isMasterUser
              ? 'View all scheduled lectures across batches and click any card to take or review attendance.'
              : 'View your assigned lectures and click to take batch attendance.'}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-muted p-1 rounded-xl">
          <Button
            size="sm"
            variant={viewMode === 'today_upcoming' ? 'default' : 'ghost'}
            onClick={() => setViewMode('today_upcoming')}
            className="text-xs font-bold rounded-lg"
          >
            Today & Upcoming
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'weekly' ? 'default' : 'ghost'}
            onClick={() => setViewMode('weekly')}
            className="text-xs font-bold rounded-lg"
          >
            {isMasterUser ? 'Weekly Timetable' : 'My Weekly Timetable'}
          </Button>
        </div>
      </div>

      {viewMode === 'today_upcoming' ? (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* TODAY'S LECTURES SECTION */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h4 className="text-base sm:text-lg font-black uppercase tracking-wider text-foreground">
                  Today's Lectures ({todayDayName}, {todayDateStr})
                </h4>
              </div>
              <Badge variant="outline" className="font-bold text-xs">
                {todayLectures.length} {todayLectures.length === 1 ? 'Lecture' : 'Lectures'}
              </Badge>
            </div>

            {todayLectures.length === 0 ? (
              <Card className="p-8 text-center border-dashed rounded-2xl bg-accent/5">
                <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-base font-bold text-muted-foreground">
                  No lectures scheduled for today.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enjoy your day or check the weekly timetable for upcoming classes.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {todayLectures.map(lecture => {
                  const marked = isAttendanceCompleted(lecture, todayDateStr);

                  return (
                    <Card
                      key={lecture.timetableId}
                      onClick={() => handleLectureClick(lecture, todayDateStr)}
                      className="p-5 rounded-2xl border-2 hover:border-primary/60 hover:shadow-lg transition-all cursor-pointer bg-card group relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-black">
                            <Clock className="h-3 w-3" />
                            {formatTimeRange12h(lecture.startTime, lecture.endTime)}
                          </span>
                          <h4 className="text-xl font-black text-foreground mt-2 group-hover:text-primary transition-colors">
                            {lecture.subjectName}
                          </h4>
                        </div>

                        {/* Attendance Status Badge */}
                        {marked ? (
                          <Badge className="bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="h-3 w-3" /> Attendance Completed ✓
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-amber-600 border-amber-500/40 bg-amber-50/50 font-bold text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0"
                          >
                            <AlertCircle className="h-3 w-3" /> Attendance Not Taken
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs text-muted-foreground border-t pt-3 mt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">Batch:</span>
                          <span className="font-black text-primary">
                            {lecture.batchName}{' '}
                            {lecture.divisionName ? `(Div ${lecture.divisionName})` : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">Room:</span>
                          <span className="font-bold text-foreground inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-primary" />
                            {lecture.roomName || 'Room 1'}
                          </span>
                        </div>
                        {(isMasterUser || getLectureTeacherNames(lecture).length > 1) && (
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">
                              {getLectureTeacherNames(lecture).length > 1 ? 'Teachers:' : 'Teacher:'}
                            </span>
                            <span className="font-bold text-foreground">
                              {formatLectureTeachers(lecture)}
                            </span>
                          </div>
                        )}
                      </div>

                      <Button
                        size="sm"
                        className="w-full mt-4 rounded-xl font-bold gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-xs"
                        onClick={e => {
                          e.stopPropagation();
                          handleLectureClick(lecture, todayDateStr);
                        }}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        {marked ? 'Update Attendance' : 'Take Attendance'}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* UPCOMING LECTURES SECTION */}
          {upcomingLectures.length > 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base sm:text-lg font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Lectures ({upcomingLectures.length})
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingLectures.map(lecture => {
                  const targetDate = getDateForDayInWeek(lecture.day, weekInfo.startDate);
                  const marked = isAttendanceCompleted(lecture, targetDate);

                  return (
                    <Card
                      key={lecture.timetableId}
                      onClick={() => handleLectureClick(lecture, targetDate)}
                      className="p-4 rounded-2xl border hover:border-primary/40 hover:shadow-md transition-all cursor-pointer bg-card group"
                    >
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-black uppercase tracking-wider text-primary">
                          {lecture.day}
                        </span>
                        <span className="text-muted-foreground font-semibold">
                          {formatTimeRange12h(lecture.startTime, lecture.endTime)}
                        </span>
                      </div>

                      <h5 className="font-black text-base text-foreground group-hover:text-primary transition-colors">
                        {lecture.subjectName}
                      </h5>

                      <div className="text-xs text-muted-foreground space-y-1 mt-2 pt-2 border-t">
                        <div className="flex justify-between">
                          <span>Batch:</span>
                          <span className="font-semibold text-foreground">
                            {lecture.batchName}{' '}
                            {lecture.divisionName ? `(Div ${lecture.divisionName})` : ''}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Room:</span>
                          <span className="font-semibold text-foreground">
                            {lecture.roomName || 'Room 1'}
                          </span>
                        </div>
                        {(isMasterUser || getLectureTeacherNames(lecture).length > 1) && (
                          <div className="flex justify-between">
                            <span>{getLectureTeacherNames(lecture).length > 1 ? 'Teachers:' : 'Teacher:'}</span>
                            <span className="font-semibold text-foreground">
                              {formatLectureTeachers(lecture)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t flex items-center justify-between">
                        {marked ? (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Marked
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            Not Taken
                          </span>
                        )}
                        <span className="text-xs text-primary font-bold inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                          Take Attendance <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* MY WEEKLY TIMETABLE VIEW */
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs font-semibold text-muted-foreground flex items-center justify-between">
            <span>
              Week: <strong className="text-foreground">{weekInfo.label}</strong>
            </span>
            <span className="text-primary font-bold">
              Total {teacherLectures.length} Weekly Lectures
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {DAYS_OF_WEEK.map(day => {
              const dayLectures = weeklyLecturesByDay[day] || [];
              const targetDate = getDateForDayInWeek(day, weekInfo.startDate);
              const isToday = day.toLowerCase() === todayDayName.toLowerCase();

              return (
                <Card
                  key={day}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    isToday ? 'border-primary shadow-sm bg-primary/[0.02]' : 'bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-base text-foreground">{day}</h4>
                      {isToday && (
                        <Badge className="bg-primary text-white text-[10px] py-0 px-1.5 font-bold">
                          Today
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-semibold">
                      {dayLectures.length} {dayLectures.length === 1 ? 'class' : 'classes'}
                    </span>
                  </div>

                  {dayLectures.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center italic">
                      No lectures scheduled.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {dayLectures.map(lecture => {
                        const marked = isAttendanceCompleted(lecture, targetDate);

                        return (
                          <div
                            key={lecture.timetableId}
                            onClick={() => handleLectureClick(lecture, targetDate)}
                            className="p-3 rounded-xl border bg-muted/20 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-extrabold text-foreground group-hover:text-primary transition-colors">
                                {lecture.subjectName}
                              </span>
                              <span className="text-[11px] font-bold text-primary">
                                {formatTimeRange12h(lecture.startTime, lecture.endTime)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5">
                              <span>
                                {lecture.batchName}{' '}
                                {lecture.divisionName ? `(Div ${lecture.divisionName})` : ''}
                              </span>
                              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                                <MapPin className="h-2.5 w-2.5 text-primary" />
                                {lecture.roomName || 'Room 1'}
                              </span>
                            </div>

                            {(isMasterUser || getLectureTeacherNames(lecture).length > 1) && (
                              <div className="text-[11px] text-muted-foreground mt-1">
                                {getLectureTeacherNames(lecture).length > 1 ? 'Teachers:' : 'Teacher:'}{' '}
                                <span className="font-semibold text-foreground">{formatLectureTeachers(lecture)}</span>
                              </div>
                            )}

                            <div className="mt-2 pt-1.5 border-t border-border/60 flex items-center justify-between">
                              <span
                                className={`text-[10px] font-bold ${
                                  marked ? 'text-emerald-600' : 'text-amber-600'
                                }`}
                              >
                                {marked ? '✓ Attendance Taken' : 'Attendance Not Taken'}
                              </span>
                              <span className="text-[11px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                Open &rarr;
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherTimetableSection;
