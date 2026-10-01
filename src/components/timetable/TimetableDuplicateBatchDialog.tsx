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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Copy, Layers, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Batch,
  TimetableLecture,
  DAYS_OF_WEEK,
  DAY_ORDER_MAP,
  addTimetableLecture,
  validateTimetableLecture,
  formatTimeRange12h,
  getLectureTeacherIds,
  getLectureTeacherNames,
} from '@/lib/localStorage';
import { WeekInfo } from '@/lib/timetableUtils';

interface TimetableDuplicateBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceBatch: Batch;
  batches: Batch[];
  effectiveWeek: WeekInfo;
  allLectures: TimetableLecture[];
  showSunday?: boolean;
  onSuccess: () => void;
}

export const TimetableDuplicateBatchDialog = ({
  open,
  onOpenChange,
  sourceBatch,
  batches,
  effectiveWeek,
  allLectures,
  showSunday = false,
  onSuccess,
}: TimetableDuplicateBatchDialogProps) => {
  const otherBatches = batches.filter(b => b.id !== sourceBatch.id);
  const [targetBatchId, setTargetBatchId] = useState<string>(otherBatches[0]?.id || '');
  const [selectedDays, setSelectedDays] = useState<string[]>(
    showSunday ? [...DAYS_OF_WEEK] : DAYS_OF_WEEK.filter(d => d !== 'Sunday')
  );
  const [isDuplicating, setIsDuplicating] = useState<boolean>(false);

  const availableDays = showSunday ? DAYS_OF_WEEK : DAYS_OF_WEEK.filter(d => d !== 'Sunday');

  // Lectures of source batch
  const sourceLectures = allLectures.filter(l => l.batchId === sourceBatch.id);

  const handleToggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSelectAll = () => {
    setSelectedDays([...availableDays]);
  };

  const handleClear = () => {
    setSelectedDays([]);
  };

  const handleDuplicate = async () => {
    if (!targetBatchId) {
      toast.error('Please select a destination batch.');
      return;
    }

    if (selectedDays.length === 0) {
      toast.error('Please select at least one day to duplicate.');
      return;
    }

    const targetBatch = batches.find(b => b.id === targetBatchId);
    if (!targetBatch) {
      toast.error('Invalid destination batch.');
      return;
    }

    const lecturesToDuplicate = sourceLectures.filter(l =>
      selectedDays.some(d => d.toLowerCase() === l.day.toLowerCase())
    );

    if (lecturesToDuplicate.length === 0) {
      toast.error(`No lectures found in ${sourceBatch.name} on the selected days.`);
      return;
    }

    setIsDuplicating(true);
    let successCount = 0;
    const conflicts: string[] = [];
    const currentLectures = [...allLectures];

    try {
      for (const src of lecturesToDuplicate) {
        const candidate = {
          academicYear: src.academicYear || '2026-27',
          batchId: targetBatch.id,
          batchName: targetBatch.name,
          divisionId: src.divisionId,
          divisionName: src.divisionName,
          day: src.day,
          dayOrder: src.dayOrder || DAY_ORDER_MAP[src.day] || 1,
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
          conflicts.push(
            `${src.day} (${formatTimeRange12h(src.startTime, src.endTime)} ${src.subjectName}): ${validation.message}`
          );
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

      if (successCount > 0) {
        toast.success(`Successfully duplicated ${successCount} lecture(s) to ${targetBatch.name}!`);
      }

      if (conflicts.length > 0) {
        toast.warning(
          `Skipped ${conflicts.length} lecture(s) due to conflicts:\n${conflicts.slice(0, 3).join('\n')}${conflicts.length > 3 ? '\n...' : ''}`
        );
      }

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error('Failed to duplicate timetable:', err);
      toast.error('An error occurred during timetable duplication.');
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Duplicate Batch Timetable
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Copy weekly timetable structure from one batch to another.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Source & Destination Batches */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/30 border">
            <div>
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                Source Batch
              </Label>
              <div className="h-10 px-3 rounded-xl bg-background border flex items-center text-xs font-bold text-foreground truncate">
                {sourceBatch.name}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 block">
                {sourceLectures.length} total lecture(s)
              </span>
            </div>

            <div>
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                Destination Batch
              </Label>
              <Select value={targetBatchId} onValueChange={setTargetBatchId}>
                <SelectTrigger className="h-10 rounded-xl bg-background font-bold text-xs text-primary">
                  <SelectValue placeholder="Select Target Batch" />
                </SelectTrigger>
                <SelectContent>
                  {otherBatches.map(b => (
                    <SelectItem key={b.id} value={b.id} className="text-xs font-medium">
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Day selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Days to Duplicate:
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
                const count = sourceLectures.filter(l => l.day.toLowerCase() === day.toLowerCase()).length;
                const checked = selectedDays.includes(day);

                return (
                  <div
                    key={day}
                    onClick={() => handleToggleDay(day)}
                    className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      checked
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border/70 hover:border-primary/40 bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => handleToggleDay(day)}
                        className="rounded-md"
                      />
                      <span className="text-xs font-bold text-foreground select-none">{day}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] py-0 px-1 font-bold">
                      {count}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              All lectures will be validated for teacher availability and room occupancy before duplication.
            </span>
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
            onClick={handleDuplicate}
            disabled={isDuplicating || !targetBatchId || selectedDays.length === 0}
            className="rounded-xl font-black bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isDuplicating ? 'Duplicating...' : 'Duplicate Timetable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimetableDuplicateBatchDialog;
