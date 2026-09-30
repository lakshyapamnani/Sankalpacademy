import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  User,
  MapPin,
  BookOpen,
  Sparkles,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Batch,
  Subject,
  Teacher,
  TimetableLecture,
  addTimetableLecture,
  updateTimetableLecture,
  deleteTimetableLecture,
  validateTimetableLecture,
  getTeachersForSubject,
  getRooms,
  DAY_ORDER_MAP,
  DAYS_OF_WEEK,
  formatTimeRange12h,
  formatTime12h,
  timeToMinutes,
} from '@/lib/localStorage';
import {
  DEFAULT_ROOMS,
  DEFAULT_DIVISIONS,
  getWeekInfo,
  parseLocalDate,
  toLocalDateString,
  getDateForDayInWeek,
} from '@/lib/timetableUtils';

interface AdminTimetableBuilderProps {
  batches: Batch[];
  subjects: Subject[];
  teachers: Teacher[];
  timetableLectures: TimetableLecture[];
  onDataChange: () => void;
}

export const AdminTimetableBuilder = ({
  batches,
  subjects,
  teachers,
  timetableLectures,
  onDataChange,
}: AdminTimetableBuilderProps) => {
  // Current Academic Year calculation
  const academicYears = useMemo(() => {
    const yearsSet = new Set<string>();
    batches.forEach(b => {
      if (b.year) yearsSet.add(b.year);
    });
    yearsSet.add('2026-27');
    yearsSet.add('2025-26');
    yearsSet.add('2024-25');
    return Array.from(yearsSet).sort().reverse();
  }, [batches]);

  // Primary Selectors
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(
    academicYears[0] || '2026-27'
  );
  const [selectedBatchId, setSelectedBatchId] = useState<string>(
    batches[0]?.id || ''
  );
  const [selectedDivision, setSelectedDivision] = useState<string>('All');

  // Week Selector (defaults to current week)
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date());
  const weekInfo = useMemo(() => getWeekInfo(currentWeekDate), [currentWeekDate]);

  // Filters for Weekly Timetable View
  const [filterTeacherId, setFilterTeacherId] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterRoom, setFilterRoom] = useState<string>('all');
  const [showSunday, setShowSunday] = useState<boolean>(false);

  // Modal State for Add / Edit Lecture
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [editingLecture, setEditingLecture] = useState<TimetableLecture | null>(null);

  // Form States within Add/Edit Dialog
  const [formDay, setFormDay] = useState<string>('Monday');
  const [formStartTime, setFormStartTime] = useState<string>('16:00');
  const [formEndTime, setFormEndTime] = useState<string>('18:00');
  const [formSubjectName, setFormSubjectName] = useState<string>('');
  const [formTeacherId, setFormTeacherId] = useState<string>('');
  const [formRoomMode, setFormRoomMode] = useState<string>('Room 1');
  const [formCustomRoom, setFormCustomRoom] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSavingLecture, setIsSavingLecture] = useState<boolean>(false);

  // Sync when timetable updates in realtime
  useEffect(() => {
    const handleTimetableChange = () => {
      onDataChange();
    };
    window.addEventListener('sankalp_timetable_changed', handleTimetableChange);
    return () => {
      window.removeEventListener('sankalp_timetable_changed', handleTimetableChange);
    };
  }, [onDataChange]);

  // Sync selectedBatchId if batches load late
  useEffect(() => {
    if (!selectedBatchId && batches.length > 0) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  // Selected batch object
  const selectedBatch = useMemo(
    () => batches.find(b => b.id === selectedBatchId),
    [batches, selectedBatchId]
  );

  // Auto-sync academic year when batch changes if batch has year
  useEffect(() => {
    if (selectedBatch?.year && academicYears.includes(selectedBatch.year)) {
      setSelectedAcademicYear(selectedBatch.year);
    }
  }, [selectedBatch, academicYears]);

  const [configuredRooms, setConfiguredRooms] = useState<string[]>(() => getRooms());
  useEffect(() => {
    setConfiguredRooms(getRooms());
  }, [timetableLectures, isDialogOpen]);

  // Distinct rooms currently in use
  const distinctRooms = useMemo(() => {
    const rSet = new Set<string>(configuredRooms);
    timetableLectures.forEach(l => {
      if (l.roomName) rSet.add(l.roomName);
    });
    return Array.from(rSet);
  }, [configuredRooms, timetableLectures]);

  // Teachers assigned to the currently selected subject in modal form
  const eligibleTeachers = useMemo(() => {
    if (!formSubjectName) return [];
    return getTeachersForSubject(formSubjectName, teachers);
  }, [formSubjectName, teachers]);

  // Whenever subject changes in the form, automatically handle teacher selection:
  // - 1 teacher -> auto-select
  // - >1 teachers -> clear teacher if not in eligible list
  // - 0 teachers -> clear teacher
  const handleSubjectChange = (newSubject: string) => {
    setFormSubjectName(newSubject);
    setValidationError(null);

    const eligible = getTeachersForSubject(newSubject, teachers);
    if (eligible.length === 1) {
      setFormTeacherId(eligible[0].id);
    } else if (eligible.length > 1) {
      // Check if current teacher is still eligible
      const stillEligible = eligible.some(t => t.id === formTeacherId);
      if (!stillEligible) {
        setFormTeacherId('');
      }
    } else {
      setFormTeacherId('');
    }
  };

  // Open modal to add a lecture for a specific day
  const handleOpenAddLecture = (day: string) => {
    setEditingLecture(null);
    setFormDay(day);
    setFormStartTime('16:00');
    setFormEndTime('18:00');
    setValidationError(null);

    // Default subject to first available subject
    const defaultSubject = subjects[0]?.name || 'Mathematics';
    setFormSubjectName(defaultSubject);

    // Calculate teacher for this default subject
    const eligible = getTeachersForSubject(defaultSubject, teachers);
    if (eligible.length === 1) {
      setFormTeacherId(eligible[0].id);
    } else {
      setFormTeacherId('');
    }

    setFormRoomMode(configuredRooms[0] || 'Room 1');
    setFormCustomRoom('');
    setIsDialogOpen(true);
  };

  // Open modal to edit an existing lecture
  const handleOpenEditLecture = (lecture: TimetableLecture) => {
    setEditingLecture(lecture);
    setFormDay(lecture.day);
    setFormStartTime(lecture.startTime);
    setFormEndTime(lecture.endTime);
    setFormSubjectName(lecture.subjectName);
    setFormTeacherId(lecture.teacherId);
    setValidationError(null);

    if (configuredRooms.includes(lecture.roomName)) {
      setFormRoomMode(lecture.roomName);
      setFormCustomRoom('');
    } else {
      setFormRoomMode('custom');
      setFormCustomRoom(lecture.roomName);
    }

    setIsDialogOpen(true);
  };

  // Handle saving the lecture with conflict validation
  const handleSaveLecture = async () => {
    setValidationError(null);

    if (!selectedBatchId) {
      toast.error('Please select a Batch first.');
      return;
    }

    if (!formSubjectName.trim()) {
      setValidationError('Please select or enter a Subject.');
      return;
    }

    if (eligibleTeachers.length === 0) {
      setValidationError(
        'No teacher is assigned to this subject. Please assign a teacher first in the Teachers section.'
      );
      return;
    }

    if (!formTeacherId) {
      setValidationError('Please select a Teacher for this lecture.');
      return;
    }

    const finalRoomName =
      formRoomMode === 'custom' ? formCustomRoom.trim() : formRoomMode;
    if (!finalRoomName) {
      setValidationError('Please specify a Classroom / Room.');
      return;
    }

    const assignedTeacher = teachers.find(t => t.id === formTeacherId);
    const dayOrder = DAY_ORDER_MAP[formDay] || 1;

    const candidateLecture = {
      timetableId: editingLecture ? editingLecture.timetableId : undefined,
      academicYear: selectedAcademicYear,
      batchId: selectedBatchId,
      batchName: selectedBatch?.name || 'Batch',
      divisionId: selectedDivision !== 'All' ? selectedDivision : undefined,
      divisionName: selectedDivision !== 'All' ? selectedDivision : undefined,
      day: formDay,
      dayOrder,
      startTime: formStartTime,
      endTime: formEndTime,
      subjectName: formSubjectName.trim(),
      teacherId: formTeacherId,
      teacherName: assignedTeacher?.name || 'Teacher',
      roomId: finalRoomName.toLowerCase().replace(/\s+/g, '_'),
      roomName: finalRoomName,
      effectiveFrom: weekInfo.startDate,
      effectiveTo: weekInfo.endDate,
    };

    // Conflict detection
    const validation = validateTimetableLecture(
      candidateLecture,
      timetableLectures,
      editingLecture?.timetableId
    );

    if (!validation.isValid) {
      setValidationError(validation.message || 'Lecture conflict detected.');
      toast.error(validation.message || 'Timetable conflict detected.');
      return;
    }

    if (isSavingLecture) return;
    setIsSavingLecture(true);

    try {
      if (editingLecture) {
        await updateTimetableLecture(editingLecture.timetableId, {
          ...candidateLecture,
          timetableId: editingLecture.timetableId,
        });
        toast.success(`Lecture updated successfully for ${formDay}!`);
      } else {
        const newTimetableId = `tt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await addTimetableLecture({
          ...candidateLecture,
          timetableId: newTimetableId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        toast.success(`Lecture added to ${formDay} successfully!`);
      }

      setIsDialogOpen(false);
      onDataChange();
    } catch (err: any) {
      console.error('Failed to save timetable lecture:', err);
      toast.error('Failed to save lecture. Please try again.');
    } finally {
      setIsSavingLecture(false);
    }
  };

  // Handle lecture deletion
  const handleDeleteLecture = async (timetableId: string, lectureName: string) => {
    try {
      const ok = await deleteTimetableLecture(timetableId);
      if (ok) {
        toast.success(`Lecture "${lectureName}" removed.`);
        onDataChange();
      } else {
        toast.error('Failed to delete lecture.');
      }
    } catch (err) {
      console.error('Delete lecture error:', err);
      toast.error('Error deleting lecture.');
    }
  };

  // Navigate weeks
  const handlePrevWeek = () => {
    const prev = new Date(currentWeekDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekDate(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekDate);
    next.setDate(next.getDate() + 7);
    setCurrentWeekDate(next);
  };

  const handleCurrentWeek = () => {
    setCurrentWeekDate(new Date());
  };

  // Filter lectures for display
  const filteredLectures = useMemo(() => {
    return timetableLectures.filter(l => {
      // Academic year match if specified
      if (selectedAcademicYear && l.academicYear && l.academicYear !== selectedAcademicYear) {
        // allow if matches or general
      }
      // Batch match
      if (selectedBatchId && l.batchId !== selectedBatchId) {
        return false;
      }
      // Division match
      if (selectedDivision !== 'All' && l.divisionId && l.divisionId !== selectedDivision) {
        return false;
      }
      // Secondary filters
      if (filterTeacherId !== 'all' && l.teacherId !== filterTeacherId) {
        return false;
      }
      if (filterSubject !== 'all' && l.subjectName.toLowerCase() !== filterSubject.toLowerCase()) {
        return false;
      }
      if (filterRoom !== 'all' && l.roomName.toLowerCase() !== filterRoom.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [
    timetableLectures,
    selectedAcademicYear,
    selectedBatchId,
    selectedDivision,
    filterTeacherId,
    filterSubject,
    filterRoom,
  ]);

  // Group lectures by day and sort by start time
  const lecturesByDay = useMemo(() => {
    const map: Record<string, TimetableLecture[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    };

    filteredLectures.forEach(l => {
      if (map[l.day]) {
        map[l.day].push(l);
      }
    });

    // Sort each day's lectures by start time
    Object.keys(map).forEach(day => {
      map[day].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    });

    return map;
  }, [filteredLectures]);

  const activeDays = showSunday
    ? DAYS_OF_WEEK
    : DAYS_OF_WEEK.filter(d => d !== 'Sunday');

  const totalLecturesCount = filteredLectures.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Control Deck */}
      <Card className="p-5 sm:p-6 bg-card border-2 shadow-sm rounded-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Weekly Timetable Builder
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Configure weekly lectures with automatic teacher assignment, conflict detection, and multiple lectures per day.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSunday(!showSunday)}
              className="text-xs font-semibold rounded-xl"
            >
              {showSunday ? 'Hide Sunday' : '+ Show Sunday'}
            </Button>
            <Badge variant="secondary" className="font-bold text-xs px-3 py-1 rounded-lg">
              {totalLecturesCount} {totalLecturesCount === 1 ? 'Lecture' : 'Lectures'} Scheduled
            </Badge>
          </div>
        </div>

        {/* Primary Dropdowns Row: Academic Year, Batch, Division, Effective Week */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {/* Academic Year */}
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Academic Year
            </Label>
            <Select
              value={selectedAcademicYear}
              onValueChange={setSelectedAcademicYear}
            >
              <SelectTrigger className="h-11 rounded-xl bg-background border-border/80 font-semibold text-sm">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map(yr => (
                  <SelectItem key={yr} value={yr} className="font-medium">
                    {yr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Batch / Class */}
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Batch / Class
            </Label>
            <Select
              value={selectedBatchId}
              onValueChange={setSelectedBatchId}
            >
              <SelectTrigger className="h-11 rounded-xl bg-background border-border/80 font-bold text-sm text-primary">
                <SelectValue placeholder="Select Batch" />
              </SelectTrigger>
              <SelectContent>
                {batches.map(b => (
                  <SelectItem key={b.id} value={b.id} className="font-medium">
                    {b.name} {b.year ? `(${b.year})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Division */}
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Division
            </Label>
            <Select
              value={selectedDivision}
              onValueChange={setSelectedDivision}
            >
              <SelectTrigger className="h-11 rounded-xl bg-background border-border/80 font-semibold text-sm">
                <SelectValue placeholder="Division" />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_DIVISIONS.map(div => (
                  <SelectItem key={div} value={div} className="font-medium">
                    {div === 'All' ? 'All Divisions' : `Division ${div}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Effective Week Navigation */}
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Effective Week</span>
              <button
                type="button"
                onClick={handleCurrentWeek}
                className="text-[10px] text-primary hover:underline font-bold"
              >
                Current Week
              </button>
            </Label>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevWeek}
                className="h-11 w-10 shrink-0 rounded-xl"
                title="Previous Week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 h-11 px-2.5 rounded-xl border border-border/80 bg-background flex items-center justify-center text-center text-xs font-bold text-foreground">
                <Calendar className="h-3.5 w-3.5 mr-1 text-primary shrink-0" />
                <span className="truncate">{weekInfo.label}</span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextWeek}
                className="h-11 w-10 shrink-0 rounded-xl"
                title="Next Week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Secondary Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-4 mt-4 border-t text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground font-bold shrink-0">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters:</span>
          </div>

          {/* Filter by Teacher */}
          <Select value={filterTeacherId} onValueChange={setFilterTeacherId}>
            <SelectTrigger className="h-8 rounded-lg text-xs w-[160px] bg-background">
              <SelectValue placeholder="All Teachers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teachers</SelectItem>
              {teachers.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filter by Subject */}
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="h-8 rounded-lg text-xs w-[150px] bg-background">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map(s => (
                <SelectItem key={s.id} value={s.name}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filter by Room */}
          <Select value={filterRoom} onValueChange={setFilterRoom}>
            <SelectTrigger className="h-8 rounded-lg text-xs w-[140px] bg-background">
              <SelectValue placeholder="All Rooms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rooms</SelectItem>
              {distinctRooms.map(r => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(filterTeacherId !== 'all' || filterSubject !== 'all' || filterRoom !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterTeacherId('all');
                setFilterSubject('all');
                setFilterRoom('all');
              }}
              className="h-8 text-xs font-bold text-destructive hover:bg-destructive/10"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Main Weekly Timetable Grid & Days */}
      <div className="space-y-6">
        {activeDays.map(day => {
          const lectures = lecturesByDay[day] || [];
          const dayDate = getDateForDayInWeek(day, weekInfo.startDate);

          return (
            <Card
              key={day}
              className="p-4 sm:p-5 rounded-2xl border-2 transition-all bg-card shadow-xs hover:border-primary/40"
            >
              {/* Day Header with + Add Lecture Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
                    {day.substring(0, 3).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-foreground">{day}</h3>
                      <span className="text-xs font-semibold text-muted-foreground">
                        ({dayDate})
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lectures.length === 0
                        ? 'No lectures scheduled'
                        : `${lectures.length} ${lectures.length === 1 ? 'lecture' : 'lectures'} scheduled`}
                    </p>
                  </div>
                </div>

                {/* + Add Lecture button specifically for this day */}
                <Button
                  size="sm"
                  onClick={() => handleOpenAddLecture(day)}
                  className="rounded-xl font-bold text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  + Add Lecture
                </Button>
              </div>

              {/* Lecture List for this Day */}
              {lectures.length === 0 ? (
                <div className="py-8 text-center border border-dashed rounded-xl mt-3 bg-accent/5">
                  <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-muted-foreground">
                    No lectures scheduled for {day}
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => handleOpenAddLecture(day)}
                    className="text-primary font-bold text-xs mt-1"
                  >
                    + Add first lecture for {day}
                  </Button>
                </div>
              ) : (
                <>
                  {/* Desktop Table Format */}
                  <div className="hidden md:block overflow-x-auto mt-3">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b text-[11px] font-black uppercase tracking-wider text-muted-foreground/80 bg-muted/30">
                          <th className="py-2.5 px-3">Time</th>
                          <th className="py-2.5 px-3">Subject</th>
                          <th className="py-2.5 px-3">Teacher</th>
                          <th className="py-2.5 px-3">Room</th>
                          <th className="py-2.5 px-3">Batch / Division</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {lectures.map((lecture, idx) => (
                          <tr
                            key={lecture.timetableId || idx}
                            className="hover:bg-accent/5 transition-colors group"
                          >
                            <td className="py-3 px-3 font-bold text-foreground whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                                <Clock className="h-3 w-3" />
                                {formatTimeRange12h(lecture.startTime, lecture.endTime)}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-extrabold text-foreground">
                                {lecture.subjectName}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-[10px] font-bold">
                                  {lecture.teacherName?.charAt(0) || 'T'}
                                </div>
                                <span className="font-semibold text-foreground">
                                  {lecture.teacherName}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground">
                                <MapPin className="h-3 w-3 text-primary" />
                                {lecture.roomName || 'Room 1'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-xs text-muted-foreground font-medium">
                              <span>{lecture.batchName}</span>
                              {lecture.divisionName && (
                                <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1 font-bold">
                                  Div {lecture.divisionName}
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEditLecture(lecture)}
                                  className="h-8 px-2.5 text-xs font-bold hover:bg-primary/10 hover:text-primary rounded-lg"
                                >
                                  <Edit2 className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Button>
                                <DeleteDialog
                                  title="Delete Timetable Lecture"
                                  description={`Are you sure you want to remove ${lecture.subjectName} (${formatTimeRange12h(lecture.startTime, lecture.endTime)}) from ${day}?`}
                                  onDelete={() =>
                                    handleDeleteLecture(lecture.timetableId, lecture.subjectName)
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Stacked Card View */}
                  <div className="grid grid-cols-1 gap-3 md:hidden mt-3">
                    {lectures.map((lecture, idx) => (
                      <div
                        key={lecture.timetableId || idx}
                        className="p-3.5 rounded-xl border bg-muted/20 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold">
                            <Clock className="h-3 w-3" />
                            {formatTimeRange12h(lecture.startTime, lecture.endTime)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-background border">
                            <MapPin className="h-3 w-3 text-primary" />
                            {lecture.roomName || 'Room 1'}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-black text-base text-foreground">
                            {lecture.subjectName}
                          </h4>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <User className="h-3 w-3" /> Teacher: {lecture.teacherName}
                          </p>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t">
                          <span className="text-muted-foreground font-medium">
                            {lecture.batchName}{' '}
                            {lecture.divisionName ? `(Div ${lecture.divisionName})` : ''}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditLecture(lecture)}
                              className="h-7 px-2 text-xs font-bold"
                            >
                              Edit
                            </Button>
                            <DeleteDialog
                              title="Delete Lecture"
                              description={`Delete ${lecture.subjectName} on ${day}?`}
                              onDelete={() =>
                                handleDeleteLecture(lecture.timetableId, lecture.subjectName)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          );
        })}
      </div>

      {/* Add / Edit Lecture Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {editingLecture ? 'Edit Timetable Lecture' : `Add Lecture for ${formDay}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedBatch?.name} • Academic Year {selectedAcademicYear}
              {selectedDivision !== 'All' ? ` • Div ${selectedDivision}` : ''}
            </DialogDescription>
          </DialogHeader>

          {/* Validation Error Banner */}
          {validationError && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>{validationError}</div>
            </div>
          )}

          <div className="space-y-4 pt-2">
            {/* Day Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Day of Week
              </Label>
              <Select value={formDay} onValueChange={setFormDay}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map(d => (
                    <SelectItem key={d} value={d} className="font-semibold">
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time Configuration: Start & End Time */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/30 border">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" /> Start Time
                </Label>
                <Input
                  type="time"
                  value={formStartTime}
                  onChange={e => {
                    setFormStartTime(e.target.value);
                    setValidationError(null);
                  }}
                  className="h-10 rounded-lg bg-background font-semibold"
                  required
                />
                <span className="text-[10px] text-muted-foreground font-semibold">
                  Display: {formatTime12h(formStartTime)}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" /> End Time
                </Label>
                <Input
                  type="time"
                  value={formEndTime}
                  onChange={e => {
                    setFormEndTime(e.target.value);
                    setValidationError(null);
                  }}
                  className="h-10 rounded-lg bg-background font-semibold"
                  required
                />
                <span className="text-[10px] text-muted-foreground font-semibold">
                  Display: {formatTime12h(formEndTime)}
                </span>
              </div>
            </div>

            {/* Subject Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Subject</span>
                <span className="text-[10px] font-semibold text-primary">
                  {subjects.length} Subjects Registered
                </span>
              </Label>
              <Select value={formSubjectName} onValueChange={handleSubjectChange}>
                <SelectTrigger className="h-11 rounded-xl font-bold">
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.name} className="font-semibold">
                      {s.name}
                    </SelectItem>
                  ))}
                  {subjects.length === 0 && (
                    <SelectItem value="Mathematics">Mathematics</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Teacher Selection with Automatic Calculation */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Assigned Teacher</span>
                {eligibleTeachers.length === 1 && (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Auto-selected (Only 1 assigned)
                  </span>
                )}
                {eligibleTeachers.length > 1 && (
                  <span className="text-[10px] font-bold text-primary">
                    {eligibleTeachers.length} Teachers Assigned
                  </span>
                )}
              </Label>

              {eligibleTeachers.length === 0 ? (
                /* No Teacher Warning */
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4" />
                    <span>No Teacher Assigned</span>
                  </div>
                  <p>
                    No teacher is assigned to "{formSubjectName}". Please assign a teacher to this subject in the Teachers section first.
                  </p>
                </div>
              ) : eligibleTeachers.length === 1 ? (
                /* Exactly 1 Teacher -> Auto-Selected Readonly Display */
                <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/30 bg-emerald-50/20">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                      {eligibleTeachers[0].name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-extrabold text-sm text-foreground">
                        {eligibleTeachers[0].name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {eligibleTeachers[0].email}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5">
                    Assigned
                  </Badge>
                </div>
              ) : (
                /* Multiple Teachers -> Filtered Dropdown */
                <Select
                  value={formTeacherId}
                  onValueChange={val => {
                    setFormTeacherId(val);
                    setValidationError(null);
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl font-bold">
                    <SelectValue placeholder="Select Teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleTeachers.map(t => (
                      <SelectItem key={t.id} value={t.id} className="font-semibold">
                        {t.name} ({t.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Room / Classroom Configuration */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Classroom / Room
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select value={formRoomMode} onValueChange={setFormRoomMode}>
                  <SelectTrigger className="h-11 rounded-xl font-semibold">
                    <SelectValue placeholder="Select Room" />
                  </SelectTrigger>
                  <SelectContent>
                    {configuredRooms.map(r => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom Room / Other...</SelectItem>
                  </SelectContent>
                </Select>

                {formRoomMode === 'custom' && (
                  <Input
                    placeholder="e.g. Science Lab B, Seminar Hall"
                    value={formCustomRoom}
                    onChange={e => setFormCustomRoom(e.target.value)}
                    className="h-11 rounded-xl"
                    required
                  />
                )}
                <p className="text-[11px] text-muted-foreground col-span-full">
                  Manage standard rooms anytime in <span className="font-semibold text-primary">Settings → Classrooms & Room Numbers</span>.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveLecture}
              disabled={isSavingLecture || eligibleTeachers.length === 0}
              className="rounded-xl font-black bg-primary text-primary-foreground hover:bg-primary/90 min-w-[130px]"
            >
              {isSavingLecture ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : editingLecture ? (
                'Update Lecture'
              ) : (
                'Save Lecture'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTimetableBuilder;
