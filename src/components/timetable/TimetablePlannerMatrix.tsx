import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  MapPin,
  User,
  Search,
  Users,
} from 'lucide-react';
import {
  Batch,
  TimetableLecture,
  DAYS_OF_WEEK,
  DAY_ORDER_MAP,
  formatTimeRange12h,
  formatLectureTeachers,
  formatLectureSubjectWithTeachers,
  timeToMinutes,
} from '@/lib/localStorage';
import { WeekInfo } from '@/lib/timetableUtils';

interface TimetablePlannerMatrixProps {
  batches: Batch[];
  timetableLectures: TimetableLecture[];
  effectiveWeek: WeekInfo;
  showSunday?: boolean;
  onAddLecture: (batch: Batch, day: string) => void;
  onEditLecture: (lecture: TimetableLecture) => void;
  onDeleteLecture: (timetableId: string, lectureName: string) => void;
}

export const TimetablePlannerMatrix = ({
  batches,
  timetableLectures,
  effectiveWeek,
  showSunday = false,
  onAddLecture,
  onEditLecture,
  onDeleteLecture,
}: TimetablePlannerMatrixProps) => {
  const [batchSearch, setBatchSearch] = useState<string>('');
  const [mobileSelectedBatchId, setMobileSelectedBatchId] = useState<string>(
    batches[0]?.id || ''
  );
  const [mobileSelectedDay, setMobileSelectedDay] = useState<string>('Monday');

  const activeDays = showSunday ? DAYS_OF_WEEK : DAYS_OF_WEEK.filter(d => d !== 'Sunday');

  // Filter batches by search keyword
  const filteredBatches = useMemo(() => {
    if (!batchSearch.trim()) return batches;
    const term = batchSearch.toLowerCase();
    return batches.filter(
      b => b.name.toLowerCase().includes(term) || (b.year && b.year.toLowerCase().includes(term))
    );
  }, [batches, batchSearch]);

  // Lookup map: `${batchId}__${day.toLowerCase()}` -> sorted lectures
  const cellLecturesMap = useMemo(() => {
    const map = new Map<string, TimetableLecture[]>();

    timetableLectures.forEach(l => {
      const key = `${l.batchId}__${l.day.toLowerCase()}`;
      const list = map.get(key) || [];
      list.push(l);
      map.set(key, list);
    });

    // Sort every cell's lectures by start time
    map.forEach(list => {
      list.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    });

    return map;
  }, [timetableLectures]);

  // Mobile selected batch
  const mobileBatch = batches.find(b => b.id === mobileSelectedBatchId) || batches[0];
  const mobileCellKey = mobileBatch ? `${mobileBatch.id}__${mobileSelectedDay.toLowerCase()}` : '';
  const mobileLectures = cellLecturesMap.get(mobileCellKey) || [];

  return (
    <div className="space-y-4">
      {/* Search & Bulk Overview Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border shadow-xs">
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-[260px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search batches..."
              value={batchSearch}
              onChange={e => setBatchSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-background text-xs font-semibold"
            />
          </div>
          {batchSearch && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBatchSearch('')}
              className="text-xs font-bold text-muted-foreground h-10"
            >
              Clear
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filteredBatches.length}</strong> of{' '}
            {batches.length} Batches
          </span>
          <span>•</span>
          <span className="text-primary">
            {timetableLectures.length} Total Lecture(s)
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          DESKTOP MATRIX VIEW (Visible on >= lg screens)
          Row = Batch, Column = Day, Cell = Multiple Lectures + Add Button
      ───────────────────────────────────────────────────────────── */}
      <div className="hidden lg:block overflow-x-auto rounded-2xl border-2 bg-card shadow-sm">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead>
            <tr className="border-b bg-muted/40 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              <th className="py-3.5 px-4 w-[180px] sticky left-0 z-20 bg-muted/80 backdrop-blur-sm border-r">
                Batch / Class
              </th>
              {activeDays.map(day => (
                <th key={day} className="py-3.5 px-3 min-w-[170px] text-center border-r last:border-r-0">
                  <div className="font-extrabold text-foreground text-xs">{day}</div>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    {effectiveWeek.days.find(d => d.dayName === day)?.displayDate || ''}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredBatches.length === 0 ? (
              <tr>
                <td colSpan={activeDays.length + 1} className="py-12 text-center text-muted-foreground text-xs font-semibold">
                  No batches found matching "{batchSearch}".
                </td>
              </tr>
            ) : (
              filteredBatches.map(batch => (
                <tr key={batch.id} className="hover:bg-accent/[0.02] transition-colors">
                  {/* Sticky Batch Column */}
                  <td className="py-3 px-4 font-black text-xs text-foreground align-top sticky left-0 z-10 bg-card border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-col gap-1">
                      <span className="text-primary font-black text-sm">{batch.name}</span>
                      {batch.year && (
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          Year {batch.year}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground font-medium mt-1">
                        {timetableLectures.filter(l => l.batchId === batch.id).length} lectures/wk
                      </span>
                    </div>
                  </td>

                  {/* Day Cells */}
                  {activeDays.map(day => {
                    const cellKey = `${batch.id}__${day.toLowerCase()}`;
                    const lectures = cellLecturesMap.get(cellKey) || [];

                    return (
                      <td
                        key={day}
                        className="py-2.5 px-2.5 align-top border-r last:border-r-0 hover:bg-primary/[0.02] transition-colors"
                      >
                        <div className="space-y-2 min-h-[120px] flex flex-col justify-between">
                          {/* Lectures list for this cell */}
                          <div className="space-y-2">
                            {lectures.map(lecture => (
                              <div
                                key={lecture.timetableId}
                                className="group relative p-2 rounded-xl border bg-background hover:border-primary/50 hover:shadow-xs transition-all text-xs space-y-1"
                              >
                                {/* Time & Room Header */}
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-black">
                                    <Clock className="h-2.5 w-2.5" />
                                    {formatTimeRange12h(lecture.startTime, lecture.endTime)}
                                  </span>
                                  <span className="text-muted-foreground font-semibold truncate max-w-[70px]">
                                    {lecture.roomName || 'Room 1'}
                                  </span>
                                </div>

                                {/* Subject Name */}
                                <div className="font-extrabold text-foreground text-xs truncate">
                                  {lecture.subjectName}
                                </div>

                                {/* Teachers (Requirement 10: Multi-teacher formatted) */}
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                                  <User className="h-2.5 w-2.5 shrink-0 text-primary" />
                                  <span className="truncate font-medium">
                                    {formatLectureSubjectWithTeachers(lecture)}
                                  </span>
                                </div>

                                {/* Action Buttons on Hover */}
                                <div className="flex items-center justify-end gap-1 pt-1 border-t border-border/40 opacity-70 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={() => onEditLecture(lecture)}
                                    className="p-1 rounded-md hover:bg-primary/10 text-primary transition-colors"
                                    title="Edit Lecture"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                  <DeleteDialog
                                    title="Delete Lecture"
                                    description={`Remove ${lecture.subjectName} (${formatTimeRange12h(lecture.startTime, lecture.endTime)}) from ${batch.name} on ${day}?`}
                                    onDelete={() =>
                                      onDeleteLecture(lecture.timetableId, lecture.subjectName)
                                    }
                                    trigger={
                                      <button
                                        type="button"
                                        className="p-1 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                                        title="Delete Lecture"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    }
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* + Add Lecture Button for this Cell (Batch & Day pre-known!) */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAddLecture(batch, day)}
                            className="w-full h-8 text-[11px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl border border-dashed border-border/70 hover:border-primary/50 gap-1 transition-all mt-1"
                          >
                            <Plus className="h-3 w-3" /> Add Lecture
                          </Button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MOBILE RESPONSIVE VIEW (Requirement 36: Mobile Design)
          Batch selector -> Day tabs -> Stacked lecture cards + Add button
      ───────────────────────────────────────────────────────────── */}
      <div className="block lg:hidden space-y-4">
        {/* Batch Selection on Mobile */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            Select Batch
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {batches.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => setMobileSelectedBatchId(b.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  mobileSelectedBatchId === b.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card border text-foreground hover:border-primary/40'
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {/* Day Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-xl bg-muted/60">
          {activeDays.map(day => (
            <button
              key={day}
              type="button"
              onClick={() => setMobileSelectedDay(day)}
              className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-lg text-xs font-extrabold text-center transition-all ${
                mobileSelectedDay === day
                  ? 'bg-background text-primary shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {day.substring(0, 3)}
            </button>
          ))}
        </div>

        {/* Selected Batch & Day Card */}
        {mobileBatch && (
          <Card className="p-4 rounded-2xl border-2 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h4 className="font-black text-base text-foreground">
                  {mobileBatch.name} • {mobileSelectedDay}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {mobileLectures.length} lecture(s) scheduled
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => onAddLecture(mobileBatch, mobileSelectedDay)}
                className="rounded-xl font-bold text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" /> + Add Lecture
              </Button>
            </div>

            {/* Mobile lectures list */}
            {mobileLectures.length === 0 ? (
              <div className="py-8 text-center border border-dashed rounded-xl bg-accent/5">
                <Clock className="h-7 w-7 text-muted-foreground/40 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-muted-foreground">
                  No lectures for {mobileBatch.name} on {mobileSelectedDay}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => onAddLecture(mobileBatch, mobileSelectedDay)}
                  className="text-primary font-bold text-xs mt-1"
                >
                  + Add first lecture
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {mobileLectures.map(lecture => (
                  <div
                    key={lecture.timetableId}
                    className="p-3.5 rounded-xl border bg-muted/20 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold">
                        <Clock className="h-3 w-3" />
                        {formatTimeRange12h(lecture.startTime, lecture.endTime)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-background border">
                        <MapPin className="h-3 w-3 text-primary" />
                        {lecture.roomName || 'Room 1'}
                      </span>
                    </div>

                    <div>
                      <h5 className="font-black text-sm text-foreground">{lecture.subjectName}</h5>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <User className="h-3 w-3 text-primary" />
                        {formatLectureSubjectWithTeachers(lecture)}
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditLecture(lecture)}
                        className="h-7 px-2.5 text-xs font-bold rounded-lg"
                      >
                        <Edit2 className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <DeleteDialog
                        title="Delete Lecture"
                        description={`Delete ${lecture.subjectName} for ${mobileBatch.name} on ${mobileSelectedDay}?`}
                        onDelete={() =>
                          onDeleteLecture(lecture.timetableId, lecture.subjectName)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default TimetablePlannerMatrix;
