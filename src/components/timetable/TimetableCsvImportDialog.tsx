import { useState, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  FileSpreadsheet,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Download,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Batch,
  Subject,
  Teacher,
  TimetableLecture,
  DAY_ORDER_MAP,
  DAYS_OF_WEEK,
  addTimetableLecture,
  validateTimetableLecture,
  getTeachersForSubject,
  timeToMinutes,
} from '@/lib/localStorage';
import { WeekInfo } from '@/lib/timetableUtils';

// Helper to split CSV lines respecting quotes
const splitCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
};

interface ParsedImportRow {
  rowIndex: number;
  batchName: string;
  batchId?: string;
  day: string;
  startTime: string;
  endTime: string;
  subjectName: string;
  teacherName?: string;
  teacherId?: string;
  additionalTeacherName?: string;
  additionalTeacherId?: string;
  roomName: string;
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

interface TimetableCsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batches: Batch[];
  subjects: Subject[];
  teachers: Teacher[];
  effectiveWeek: WeekInfo;
  academicYear: string;
  allLectures: TimetableLecture[];
  onSuccess: () => void;
}

export const TimetableCsvImportDialog = ({
  open,
  onOpenChange,
  batches,
  subjects,
  teachers,
  effectiveWeek,
  academicYear,
  allLectures,
  onSuccess,
}: TimetableCsvImportDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // Dynamically generate sample CSV fetching all batches and all days
  const sampleCsvContent = useMemo(() => {
    const headers = 'Batch,Day,Start Time,End Time,Subject,Teacher,Additional Teacher,Room';
    const rows: string[] = [];

    // 1. Fetch all active batches
    const targetBatches =
      batches && batches.length > 0
        ? batches
        : [
            { id: 'b1', name: 'Class 7 & 8', year: academicYear },
            { id: 'b2', name: 'Class 9', year: academicYear },
            { id: 'b3', name: 'Class 10', year: academicYear },
          ];

    // 2. Fetch all days of the week (Monday through Sunday)
    const targetDays = DAYS_OF_WEEK;

    // 3. Available subjects
    const availableSubjects =
      subjects && subjects.length > 0
        ? subjects
        : [
            { id: 's1', name: 'Mathematics' },
            { id: 's2', name: 'Science' },
            { id: 's3', name: 'English' },
            { id: 's4', name: 'Physics' },
          ];

    let subjectCounter = 0;

    targetBatches.forEach((batch, bIdx) => {
      targetDays.forEach(day => {
        const subjectObj = availableSubjects[subjectCounter % availableSubjects.length];
        subjectCounter++;
        const subjectName = subjectObj?.name || 'Mathematics';

        // Fetch eligible teacher for this subject
        const eligible = getTeachersForSubject(subjectName, teachers);
        const primaryTeacher =
          eligible[0]?.name || teachers[bIdx % (teachers.length || 1)]?.name || '';
        const additionalTeacher = eligible.length > 1 ? eligible[1]?.name : '';

        // Standard schedule timing:
        // Weekdays: 16:00 to 18:00 (after-school coaching slot)
        // Sunday: 10:00 to 12:00 (morning test / doubt slot)
        const isSunday = day.toLowerCase() === 'sunday';
        const startTime = isSunday ? '10:00' : '16:00';
        const endTime = isSunday ? '12:00' : '18:00';

        const room = `Room ${(bIdx % 4) + 1}`;

        // Escape fields if they contain commas
        const esc = (val: string) => (val && val.includes(',') ? `"${val}"` : val || '');

        rows.push(
          `${esc(batch.name)},${day},${startTime},${endTime},${esc(subjectName)},${esc(primaryTeacher)},${esc(additionalTeacher)},${room}`
        );
      });
    });

    return [headers, ...rows].join('\n');
  }, [batches, subjects, teachers, academicYear]);

  const handleDownloadSample = () => {
    const blob = new Blob([sampleCsvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_timetable_all_batches_and_days.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(
      `Sample CSV downloaded with ${batches.length} batches across all 7 days (${DAYS_OF_WEEK.length * (batches.length || 1)} entries)!`
    );
  };

  const handleFillTemplateInEditor = () => {
    setCsvText(sampleCsvContent);
    parseCsv(sampleCsvContent);
    toast.info(`Loaded timetable template for all ${batches.length} batches & days into editor.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target?.result as string;
      if (text) {
        setCsvText(text);
        parseCsv(text);
      }
    };
    reader.readAsText(file);
  };

  const parseCsv = (content: string) => {
    const lines = content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length < 2) {
      toast.error('CSV must contain a header row and at least one data row.');
      return;
    }

    const header = splitCsvLine(lines[0]).map(h => h.toLowerCase());
    const batchIdx = header.findIndex(h => h.includes('batch') || h.includes('class'));
    const dayIdx = header.findIndex(h => h.includes('day'));
    const startIdx = header.findIndex(h => h.includes('start'));
    const endIdx = header.findIndex(h => h.includes('end'));
    const subjectIdx = header.findIndex(h => h.includes('subject'));
    const teacherIdx = header.findIndex(h => h === 'teacher' || h.includes('primary'));
    const addTeacherIdx = header.findIndex(
      h => h.includes('additional') || h.includes('co-teacher') || h.includes('second')
    );
    const roomIdx = header.findIndex(h => h.includes('room'));

    if (dayIdx === -1 || startIdx === -1 || endIdx === -1 || subjectIdx === -1) {
      toast.error('CSV missing required columns (Day, Start Time, End Time, Subject).');
      return;
    }

    const rows: ParsedImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const cols = splitCsvLine(line);

      const rawBatch = (batchIdx !== -1 ? cols[batchIdx] : '') || batches[0]?.name || 'Batch';
      const rawDay = (cols[dayIdx] || '').trim();
      const rawStart = (cols[startIdx] || '').trim();
      const rawEnd = (cols[endIdx] || '').trim();
      const rawSubject = (cols[subjectIdx] || '').trim();
      const rawTeacher = teacherIdx !== -1 ? (cols[teacherIdx] || '').trim() : '';
      const rawAddTeacher = addTeacherIdx !== -1 ? (cols[addTeacherIdx] || '').trim() : '';
      const rawRoom = (roomIdx !== -1 ? cols[roomIdx] : '') || 'Room 1';

      const errors: string[] = [];
      const warnings: string[] = [];

      // 1. Match Batch
      const matchedBatch = batches.find(
        b => b.name.toLowerCase() === rawBatch.toLowerCase() || b.id === rawBatch
      );
      if (!matchedBatch) {
        errors.push(`Unknown batch: "${rawBatch}"`);
      }

      // 2. Validate Day
      const matchedDay = DAYS_OF_WEEK.find(d => d.toLowerCase() === rawDay.toLowerCase());
      if (!matchedDay) {
        errors.push(`Invalid day: "${rawDay}". Expected Monday..Sunday.`);
      }

      // 3. Time format validation
      const startMin = timeToMinutes(rawStart);
      const endMin = timeToMinutes(rawEnd);
      if (endMin <= startMin) {
        errors.push(`Invalid time range: ${rawStart} to ${rawEnd}. End must be after start.`);
      }

      // 4. Match Subject
      const matchedSubject = subjects.find(
        s => s.name.toLowerCase() === rawSubject.toLowerCase()
      );
      const finalSubjectName = matchedSubject ? matchedSubject.name : rawSubject;
      if (!matchedSubject && !rawSubject) {
        errors.push('Subject is required.');
      }

      // 5. Match Teacher & Auto-Selection Rule (Requirement 7 & 21)
      let matchedPrimaryTeacher: Teacher | undefined;
      let matchedAddTeacher: Teacher | undefined;
      const eligible = getTeachersForSubject(finalSubjectName, teachers);

      if (rawTeacher) {
        matchedPrimaryTeacher = eligible.find(
          t => t.name.toLowerCase() === rawTeacher.toLowerCase() || t.id === rawTeacher
        );
        if (!matchedPrimaryTeacher) {
          // Check if teacher exists in academy overall
          const generalTeacher = teachers.find(
            t => t.name.toLowerCase() === rawTeacher.toLowerCase() || t.id === rawTeacher
          );
          if (generalTeacher) {
            warnings.push(
              `"${generalTeacher.name}" is not assigned to "${finalSubjectName}" in master records.`
            );
            matchedPrimaryTeacher = generalTeacher;
          } else {
            errors.push(`Teacher "${rawTeacher}" not found.`);
          }
        }
      } else {
        // Teacher not supplied in CSV
        if (eligible.length === 1) {
          matchedPrimaryTeacher = eligible[0];
          warnings.push(`Auto-assigned "${eligible[0].name}" (Only 1 teacher for this subject).`);
        } else if (eligible.length > 1) {
          errors.push(
            `Subject "${finalSubjectName}" has ${eligible.length} teachers. Teacher must be specified.`
          );
        } else {
          errors.push(`No teacher assigned to "${finalSubjectName}".`);
        }
      }

      // Additional Teacher
      if (rawAddTeacher && matchedPrimaryTeacher) {
        matchedAddTeacher = eligible.find(
          t =>
            (t.name.toLowerCase() === rawAddTeacher.toLowerCase() || t.id === rawAddTeacher) &&
            t.id !== matchedPrimaryTeacher?.id
        );
        if (!matchedAddTeacher) {
          const generalTeacher = teachers.find(
            t =>
              (t.name.toLowerCase() === rawAddTeacher.toLowerCase() || t.id === rawAddTeacher) &&
              t.id !== matchedPrimaryTeacher?.id
          );
          if (generalTeacher) {
            warnings.push(
              `Co-teacher "${generalTeacher.name}" is not assigned to "${finalSubjectName}".`
            );
            matchedAddTeacher = generalTeacher;
          } else {
            errors.push(`Additional teacher "${rawAddTeacher}" not found.`);
          }
        }
      }

      rows.push({
        rowIndex: i + 1,
        batchName: matchedBatch ? matchedBatch.name : rawBatch,
        batchId: matchedBatch?.id,
        day: matchedDay || rawDay,
        startTime: rawStart,
        endTime: rawEnd,
        subjectName: finalSubjectName,
        teacherName: matchedPrimaryTeacher?.name,
        teacherId: matchedPrimaryTeacher?.id,
        additionalTeacherName: matchedAddTeacher?.name,
        additionalTeacherId: matchedAddTeacher?.id,
        roomName: rawRoom || 'Room 1',
        isValid: errors.length === 0,
        errors,
        warnings,
      });
    }

    setParsedRows(rows);
    setStep('preview');
  };

  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid && r.batchId && r.teacherId);
    if (validRows.length === 0) {
      toast.error('No valid rows available to import.');
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    const conflicts: string[] = [];
    const currentLectures = [...allLectures];

    try {
      for (const row of validRows) {
        const teacherIds: string[] = [row.teacherId!];
        const teacherNames: string[] = [row.teacherName!];
        if (row.additionalTeacherId && row.additionalTeacherName) {
          teacherIds.push(row.additionalTeacherId);
          teacherNames.push(row.additionalTeacherName);
        }

        const candidate = {
          academicYear,
          batchId: row.batchId!,
          batchName: row.batchName,
          day: row.day,
          dayOrder: DAY_ORDER_MAP[row.day] || 1,
          startTime: row.startTime,
          endTime: row.endTime,
          subjectName: row.subjectName,
          teacherId: row.teacherId!,
          teacherName: row.teacherName!,
          teacherIds,
          teacherNames,
          roomId: row.roomName.toLowerCase().replace(/\s+/g, '_'),
          roomName: row.roomName,
          effectiveFrom: effectiveWeek.startDate,
          effectiveTo: effectiveWeek.endDate,
        };

        const validation = validateTimetableLecture(candidate, currentLectures);
        if (!validation.isValid) {
          conflicts.push(
            `Row ${row.rowIndex} (${row.batchName}, ${row.day} ${row.startTime}): ${validation.message}`
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
        toast.success(`Successfully imported ${successCount} lecture(s) from CSV!`);
      }

      if (conflicts.length > 0) {
        toast.warning(
          `Skipped ${conflicts.length} row(s) due to timetable conflicts:\n${conflicts.slice(0, 3).join('\n')}${conflicts.length > 3 ? '\n...' : ''}`
        );
      }

      setStep('upload');
      setCsvText('');
      setParsedRows([]);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error('CSV import failed:', err);
      toast.error('An error occurred during CSV import.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Timetable from CSV / Excel
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Bulk import lectures across batches with teacher matching and conflict validation.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' ? (
          <div className="space-y-4 pt-2">
            {/* Download Sample & Prefill Template */}
            <div className="p-3.5 rounded-2xl bg-muted/40 border space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span className="font-extrabold text-xs text-foreground flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                    Auto-Generated Timetable Template ({batches.length} Batches × 7 Days)
                  </span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    Pre-populated with all batches ({batches.map(b => b.name).join(', ') || 'Active batches'}) across all days (Monday–Sunday) with subjects and teachers.
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleFillTemplateInEditor}
                    className="gap-1 rounded-xl font-bold text-xs h-8"
                  >
                    <FileText className="h-3.5 w-3.5" /> Fill In Editor
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadSample}
                    className="gap-1 rounded-xl font-bold text-xs h-8 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Download className="h-3.5 w-3.5" /> Download Sample CSV
                  </Button>
                </div>
              </div>
            </div>

            {/* File Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 border-2 border-dashed rounded-2xl text-center hover:border-primary/50 cursor-pointer bg-accent/5 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-bold text-sm text-foreground">Click to upload CSV file</p>
              <p className="text-xs text-muted-foreground mt-0.5">Supports standard comma-separated .csv files</p>
            </div>

            {/* Direct Paste Option */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                Or Paste CSV Content
              </Label>
              <Textarea
                placeholder="Paste CSV rows here..."
                rows={5}
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                className="font-mono text-xs rounded-xl"
              />
            </div>
          </div>
        ) : (
          /* Preview Step (Requirement 21: Never immediately import without preview) */
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-extrabold text-sm text-foreground">
                  Validation Preview ({parsedRows.length} rows)
                </span>
                <p className="text-[11px] text-muted-foreground">
                  {parsedRows.filter(r => r.isValid).length} ready to import •{' '}
                  {parsedRows.filter(r => !r.isValid).length} with errors
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('upload')}
                className="text-xs font-bold text-primary"
              >
                &larr; Back to Upload
              </Button>
            </div>

            <div className="max-h-[300px] overflow-y-auto rounded-xl border divide-y text-xs">
              {parsedRows.map((r, idx) => (
                <div
                  key={idx}
                  className={`p-3 space-y-1 ${
                    r.isValid ? 'bg-card hover:bg-muted/10' : 'bg-destructive/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-foreground">
                        {r.batchName} • {r.day}
                      </span>
                      <Badge
                        variant={r.isValid ? 'secondary' : 'destructive'}
                        className="text-[10px] font-bold py-0 px-1.5"
                      >
                        {r.isValid ? 'Valid' : 'Error'}
                      </Badge>
                    </div>
                    <span className="font-bold text-primary">
                      {r.startTime} – {r.endTime}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span>
                      Subject: <strong className="text-foreground">{r.subjectName}</strong>
                    </span>
                    <span>
                      Teacher(s):{' '}
                      <strong className="text-foreground">
                        {[r.teacherName, r.additionalTeacherName].filter(Boolean).join(' + ') || 'Unassigned'}
                      </strong>
                    </span>
                    <span>Room: {r.roomName}</span>
                  </div>

                  {r.errors.length > 0 && (
                    <div className="text-[11px] text-destructive font-semibold flex items-center gap-1 pt-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {r.errors.join('; ')}
                    </div>
                  )}

                  {r.warnings.length > 0 && (
                    <div className="text-[11px] text-amber-600 font-semibold flex items-center gap-1 pt-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {r.warnings.join('; ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold"
          >
            Cancel
          </Button>

          {step === 'upload' ? (
            <Button
              type="button"
              onClick={() => parseCsv(csvText)}
              disabled={!csvText.trim()}
              className="rounded-xl font-black bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Parse & Preview
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleConfirmImport}
              disabled={isImporting || parsedRows.filter(r => r.isValid).length === 0}
              className="rounded-xl font-black bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isImporting
                ? 'Importing...'
                : `Confirm & Import (${parsedRows.filter(r => r.isValid).length} Lectures)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimetableCsvImportDialog;
