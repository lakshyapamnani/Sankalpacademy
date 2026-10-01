import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Copy, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  Batch,
  TimetableLecture,
  DAYS_OF_WEEK,
  DAY_ORDER_MAP,
  addTimetableLecture,
  validateTimetableLecture,
  formatTimeRange12h,
  formatLectureTeachers,
  getLectureTeacherIds,
  getLectureTeacherNames,
} from '@/lib/localStorage';
import { WeekInfo } from '@/lib/timetableUtils';

interface TimetableCopyDayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceBatch: Batch;
  sourceDay: string;
  effectiveWeek: WeekInfo;
  allLectures: TimetableLecture[];
  showSunday?: boolean;
  onSuccess: () => void;
}

export const TimetableCopyDayDialog = ({
  open,
  onOpenChange,
  sourceBatch,
  sourceDay,
  effectiveWeek,
  allLectures,
  showSunday = false,
  onSuccess,
}: TimetableCopyDayDialogProps) => {
  const [selectedDestDays, setSelectedDestDays] = useState<string[]>([]);
  const [isCopying, setIsCopying] = useState<boolean>(false);

  const availableDays = (showSunday ? DAYS_OF_WEEK : DAYS_OF_WEEK.filter(d => d !== 'Sunday'))
    .filter(d => d.toLowerCase() !== sourceDay.toLowerCase());

  // Lectures on the source day for this batch
  const sourceLectures = allLectures.filter(
    l => l.batchId === sourceBatch.id && l.day.toLowerCase() === sourceDay.toLowerCase()
  );

  const handleToggleDay = (day: string) => {
    setSelectedDestDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSelectAll = () => {
    setSelectedDestDays([...availableDays]);
  };

  const handleClear = () => {
    setSelectedDestDays([]);
  };

  const handleCopy = async () => {
    if (selectedDestDays.length === 0) {
      toast.error('Please select at least one destination day.');
      return;
    }

    if (sourceLectures.length === 0) {
      toast.error(`No lectures found on ${sourceDay} to copy.`);
      return;
    }

    setIsCopying(true);
    let successCount = 0;
    const conflicts: string[] = [];
    const currentLectures = [...allLectures];

    try {
      for (const destDay of selectedDestDays) {
        const destDayOrder = DAY_ORDER_MAP[destDay] || 1;

        for (const src of sourceLectures) {
          const candidate = {
            academicYear: src.academicYear || '2026-27',
            batchId: sourceBatch.id,
            batchName: sourceBatch.name,
            divisionId: src.divisionId,
            divisionName: src.divisionName,
            day: destDay,
            dayOrder: destDayOrder,
            startTime: src.startTime,
            endTime: src.endTime,
            subjectId: src.subjectId,
            subjectName: src.subjectName,
            teacherId: src.teacherId,
            teacherName: src.teacherName,
            teacherIds: getLectureTeacherIds(src),
            teacherNames: getLectureTeacherNames(src),
            roomId: src.roomId,
            roomName: src.roomName,
            effectiveFrom: effectiveWeek.startDate,
            effectiveTo: effectiveWeek.endDate,
          };

          const validation = validateTimetableLecture(candidate, currentLectures);
          if (!validation.isValid) {
            conflicts.push(`${destDay} (${formatTimeRange12h(src.startTime, src.endTime)} ${src.subjectName}): ${validation.message}`);
            continue;
          }

          const newId = `tt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const newLecture: TimetableLecture = {
            ...candidate,
            timetableId: newId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await addTimetableLecture(newLecture);
          currentLectures.push(newLecture);
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully copied ${successCount} lecture(s) across selected day(s)!`);
      }

      if (conflicts.length > 0) {
        toast.warning(
          `Skipped ${conflicts.length} lecture(s) due to conflicts:\n${conflicts.slice(0, 3).join('\n')}${conflicts.length > 3 ? '\n...' : ''}`
        );
      }

      setSelectedDestDays([]);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error('Failed to copy day schedule:', err);
      toast.error('An error occurred while copying lectures.');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Copy Schedule for {sourceDay}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Batch: <strong className="text-foreground">{sourceBatch.name}</strong> • Week: {effectiveWeek.label}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Source lectures summary */}
          <div className="p-3.5 rounded-2xl bg-muted/30 border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground">Lectures on {sourceDay}:</span>
              <Badge variant="secondary" className="font-black text-[10px]">
                {sourceLectures.length} {sourceLectures.length === 1 ? 'Lecture' : 'Lectures'}
              </Badge>
            </div>
            {sourceLectures.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No lectures scheduled on {sourceDay}.</p>
            ) : (
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                {sourceLectures.map(l => (
                  <div
                    key={l.timetableId}
                    className="p-2 rounded-lg bg-background border text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-extrabold text-foreground">{l.subjectName}</span>
                      <span className="text-muted-foreground text-[11px] block">
                        {formatLectureTeachers(l)} • {l.roomName}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 font-bold text-primary text-[11px] shrink-0">
                      <Clock className="h-3 w-3" />
                      {formatTimeRange12h(l.startTime, l.endTime)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Destination days selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Copy To Days:
              </Label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-primary font-bold hover:underline text-[11px]"
                >
                  Select All
                </button>
                <span className="text-muted-foreground/60">•</span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-muted-foreground hover:underline text-[11px]"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {availableDays.map(day => {
                const checked = selectedDestDays.includes(day);
                return (
                  <div
                    key={day}
                    onClick={() => handleToggleDay(day)}
                    className={`p-3 rounded-xl border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                      checked
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border/70 hover:border-primary/40 bg-card'
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => handleToggleDay(day)}
                      className="rounded-md"
                    />
                    <span className="text-xs font-bold text-foreground select-none">{day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCopy}
            disabled={isCopying || selectedDestDays.length === 0 || sourceLectures.length === 0}
            className="rounded-xl font-black bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isCopying ? 'Copying...' : `Copy to ${selectedDestDays.length} Day(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimetableCopyDayDialog;
