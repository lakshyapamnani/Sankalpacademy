import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import {
  TimetableLecture,
  formatTimeRange12h,
  timeToMinutes,
  DAYS_OF_WEEK,
  DAY_ORDER_MAP,
  formatLectureTeachers,
  getLectureTeacherNames,
} from '@/lib/localStorage';
import {
  getCurrentLocalDayName,
  toLocalDateString,
  getWeekInfo,
  getDateForDayInWeek,
} from '@/lib/timetableUtils';

interface StudentTimetableSectionProps {
  studentBatchId: string;
  studentDivisionId?: string;
  batchName?: string;
  allLectures: TimetableLecture[];
}

export const StudentTimetableSection = ({
  studentBatchId,
  studentDivisionId,
  batchName,
  allLectures,
}: StudentTimetableSectionProps) => {
  const [viewMode, setViewMode] = useState<'today_upcoming' | 'weekly'>('today_upcoming');

  const todayDayName = useMemo(() => getCurrentLocalDayName(), []);
  const todayDateStr = useMemo(() => toLocalDateString(new Date()), []);
  const weekInfo = useMemo(() => getWeekInfo(new Date()), []);

  // Filter lectures belonging strictly to this student's batch & division
  // Multi-teacher lecture appears ONLY ONCE (Requirement 32)
  const studentLectures = useMemo(() => {
    if (!studentBatchId) return [];
    const seen = new Set<string>();
    return allLectures.filter(l => {
      if (l.batchId !== studentBatchId) return false;
      if (studentDivisionId && l.divisionId && l.divisionId !== studentDivisionId) {
        return false;
      }
      if (seen.has(l.timetableId)) return false;
      seen.add(l.timetableId);
      return true;
    });
  }, [allLectures, studentBatchId, studentDivisionId]);

  // TODAY'S CLASSES (sorted by start time)
  const todayClasses = useMemo(() => {
    return studentLectures
      .filter(l => l.day.toLowerCase() === todayDayName.toLowerCase())
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [studentLectures, todayDayName]);

  // UPCOMING CLASSES (chronologically later in the week)
  const upcomingClasses = useMemo(() => {
    const currentDayOrder = DAY_ORDER_MAP[todayDayName] || 1;
    const later = studentLectures.filter(l => {
      const order = DAY_ORDER_MAP[l.day] || 1;
      return order > currentDayOrder;
    });

    return later.sort((a, b) => {
      const orderA = DAY_ORDER_MAP[a.day] || 1;
      const orderB = DAY_ORDER_MAP[b.day] || 1;
      if (orderA !== orderB) return orderA - orderB;
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
  }, [studentLectures, todayDayName]);

  // MY WEEKLY TIMETABLE (grouped by day)
  const weeklyClassesByDay = useMemo(() => {
    const map: Record<string, TimetableLecture[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    };

    studentLectures.forEach(l => {
      if (map[l.day]) {
        map[l.day].push(l);
      }
    });

    Object.keys(map).forEach(day => {
      map[day].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    });

    return map;
  }, [studentLectures]);

  return (
    <div className="space-y-6">
      {/* Header with Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-primary flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Class Timetable & Schedule
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {batchName ? `Batch: ${batchName}` : 'Your Batch Schedule'}
            {studentDivisionId ? ` • Division ${studentDivisionId}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-muted p-1 rounded-xl self-start sm:self-auto">
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
            Weekly Schedule
          </Button>
        </div>
      </div>

      {viewMode === 'today_upcoming' ? (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* TODAY'S CLASSES */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h4 className="text-base sm:text-lg font-black uppercase tracking-wider text-foreground">
                  Today's Classes ({todayDayName}, {todayDateStr})
                </h4>
              </div>
              <Badge variant="outline" className="font-bold text-xs">
                {todayClasses.length} {todayClasses.length === 1 ? 'Class' : 'Classes'}
              </Badge>
            </div>

            {todayClasses.length === 0 ? (
              <Card className="p-8 text-center border-dashed rounded-2xl bg-accent/5">
                <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-base font-bold text-muted-foreground">
                  No classes scheduled for today.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enjoy your study break or review past notes.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {todayClasses.map(lecture => (
                  <Card
                    key={lecture.timetableId}
                    className="p-5 rounded-2xl border-2 border-primary/20 bg-card hover:border-primary/50 transition-all shadow-xs"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-black">
                        <Clock className="h-3 w-3" />
                        {formatTimeRange12h(lecture.startTime, lecture.endTime)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md bg-muted text-foreground">
                        <MapPin className="h-3 w-3 text-primary" />
                        {lecture.roomName || 'Room 1'}
                      </span>
                    </div>

                    <h4 className="text-xl font-black text-foreground mt-2">
                      {lecture.subjectName}
                    </h4>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3 mt-3">
                      <User className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>
                        {getLectureTeacherNames(lecture).length > 1 ? 'Teachers:' : 'Teacher:'}{' '}
                        <strong className="text-foreground">{formatLectureTeachers(lecture)}</strong>
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* UPCOMING CLASSES */}
          {upcomingClasses.length > 0 && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base sm:text-lg font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Upcoming Classes ({upcomingClasses.length})
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingClasses.map(lecture => (
                  <Card
                    key={lecture.timetableId}
                    className="p-4 rounded-2xl border bg-card hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <Badge variant="secondary" className="font-black uppercase text-[10px]">
                        {lecture.day}
                      </Badge>
                      <span className="font-bold text-primary">
                        {formatTimeRange12h(lecture.startTime, lecture.endTime)}
                      </span>
                    </div>

                    <h5 className="font-black text-base text-foreground mt-1">
                      {lecture.subjectName}
                    </h5>

                    <div className="text-xs text-muted-foreground space-y-1 mt-2.5 pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span>
                          {getLectureTeacherNames(lecture).length > 1 ? 'Teachers:' : 'Teacher:'}{' '}
                          <strong className="text-foreground">{formatLectureTeachers(lecture)}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span>Room: <strong className="text-foreground">{lecture.roomName || 'Room 1'}</strong></span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* MY WEEKLY TIMETABLE */
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs font-semibold text-muted-foreground flex items-center justify-between">
            <span>
              Week: <strong className="text-foreground">{weekInfo.label}</strong>
            </span>
            <span className="text-primary font-bold">
              Total {studentLectures.length} Classes Scheduled
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {DAYS_OF_WEEK.map(day => {
              const dayClasses = weeklyClassesByDay[day] || [];
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
                      {dayClasses.length} {dayClasses.length === 1 ? 'class' : 'classes'}
                    </span>
                  </div>

                  {dayClasses.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center italic">
                      No classes scheduled.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {dayClasses.map(lecture => (
                        <div
                          key={lecture.timetableId}
                          className="p-3 rounded-xl border bg-muted/20 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-foreground">
                              {lecture.subjectName}
                            </span>
                            <span className="text-[11px] font-bold text-primary">
                              {formatTimeRange12h(lecture.startTime, lecture.endTime)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                            <span className="flex items-center gap-1 truncate mr-2">
                              <User className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate">
                                {getLectureTeacherNames(lecture).length > 1 ? 'Teachers:' : 'Teacher:'}{' '}
                                <strong className="text-foreground font-semibold">{formatLectureTeachers(lecture)}</strong>
                              </span>
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-foreground shrink-0">
                              <MapPin className="h-3 w-3 text-primary" />
                              {lecture.roomName || 'Room 1'}
                            </span>
                          </div>
                        </div>
                      ))}
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

export default StudentTimetableSection;
