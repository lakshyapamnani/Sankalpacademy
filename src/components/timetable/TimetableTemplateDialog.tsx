import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { Bookmark, Plus, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  Batch,
  TimetableLecture,
  TimetableTemplate,
  getTimetableTemplates,
  saveTimetableTemplate,
  deleteTimetableTemplate,
  addTimetableLecture,
  validateTimetableLecture,
  formatTimeRange12h,
  formatLectureTeachers,
  getLectureTeacherIds,
  getLectureTeacherNames,
} from '@/lib/localStorage';
import { WeekInfo } from '@/lib/timetableUtils';

interface TimetableTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBatch: Batch;
  effectiveWeek: WeekInfo;
  academicYear: string;
  allLectures: TimetableLecture[];
  onSuccess: () => void;
}

export const TimetableTemplateDialog = ({
  open,
  onOpenChange,
  currentBatch,
  effectiveWeek,
  academicYear,
  allLectures,
  onSuccess,
}: TimetableTemplateDialogProps) => {
  const [tab, setTab] = useState<'apply' | 'save' | 'manage'>('apply');
  const [templates, setTemplates] = useState<TimetableTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      const list = getTimetableTemplates();
      setTemplates(list);
      if (list.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(list[0].id);
      }
    }
  }, [open, selectedTemplateId]);

  const currentBatchLectures = allLectures.filter(l => l.batchId === currentBatch.id);
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name.');
      return;
    }

    if (currentBatchLectures.length === 0) {
      toast.error(`No lectures scheduled for ${currentBatch.name} to save as template.`);
      return;
    }

    setIsProcessing(true);
    try {
      const newTemplate: TimetableTemplate = {
        id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: templateName.trim(),
        description: `Schedule for ${currentBatch.name} (${currentBatchLectures.length} lectures)`,
        academicYear,
        batchName: currentBatch.name,
        lectures: currentBatchLectures.map(l => ({
          academicYear: l.academicYear,
          batchId: l.batchId,
          batchName: l.batchName,
          divisionId: l.divisionId,
          divisionName: l.divisionName,
          day: l.day,
          dayOrder: l.dayOrder,
          startTime: l.startTime,
          endTime: l.endTime,
          subjectId: l.subjectId,
          subjectName: l.subjectName,
          teacherId: l.teacherId,
          teacherName: l.teacherName,
          teacherIds: getLectureTeacherIds(l),
          teacherNames: getLectureTeacherNames(l),
          roomId: l.roomId,
          roomName: l.roomName,
        })),
        createdAt: new Date().toISOString(),
      };

      await saveTimetableTemplate(newTemplate);
      toast.success(`Template "${templateName}" saved successfully!`);
      const updated = getTimetableTemplates();
      setTemplates(updated);
      setSelectedTemplateId(newTemplate.id);
      setTemplateName('');
      setTab('apply');
    } catch (e) {
      console.error('Failed to save template:', e);
      toast.error('Failed to save template.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template to apply.');
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    const conflicts: string[] = [];
    const currentLectures = [...allLectures];

    try {
      for (const tplLecture of selectedTemplate.lectures) {
        const candidate = {
          academicYear,
          batchId: currentBatch.id,
          batchName: currentBatch.name,
          divisionId: tplLecture.divisionId,
          divisionName: tplLecture.divisionName,
          day: tplLecture.day,
          dayOrder: tplLecture.dayOrder,
          startTime: tplLecture.startTime,
          endTime: tplLecture.endTime,
          subjectId: tplLecture.subjectId,
          subjectName: tplLecture.subjectName,
          teacherId: tplLecture.teacherId,
          teacherName: tplLecture.teacherName,
          teacherIds: getLectureTeacherIds(tplLecture),
          teacherNames: getLectureTeacherNames(tplLecture),
          roomId: tplLecture.roomId,
          roomName: tplLecture.roomName,
          effectiveFrom: effectiveWeek.startDate,
          effectiveTo: effectiveWeek.endDate,
        };

        const validation = validateTimetableLecture(candidate, currentLectures);
        if (!validation.isValid) {
          conflicts.push(
            `${candidate.day} ${formatTimeRange12h(candidate.startTime, candidate.endTime)} (${candidate.subjectName}): ${validation.message}`
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
        toast.success(`Applied template! Added ${successCount} lecture(s) to ${currentBatch.name}.`);
      }

      if (conflicts.length > 0) {
        toast.warning(
          `Skipped ${conflicts.length} lecture(s) due to conflicts:\n${conflicts.slice(0, 3).join('\n')}${conflicts.length > 3 ? '\n...' : ''}`
        );
      }

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      console.error('Failed to apply template:', err);
      toast.error('An error occurred while applying template.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string, name: string) => {
    const ok = await deleteTimetableTemplate(templateId);
    if (ok) {
      toast.success(`Template "${name}" deleted.`);
      const updated = getTimetableTemplates();
      setTemplates(updated);
      if (selectedTemplateId === templateId) {
        setSelectedTemplateId(updated[0]?.id || '');
      }
    } else {
      toast.error('Failed to delete template.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" />
            Timetable Templates
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Save recurring weekly schedules as reusable templates and apply them in one click.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted text-xs font-bold mt-2">
          <button
            type="button"
            onClick={() => setTab('apply')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              tab === 'apply' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Apply Template
          </button>
          <button
            type="button"
            onClick={() => setTab('save')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              tab === 'save' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Save as Template
          </button>
          <button
            type="button"
            onClick={() => setTab('manage')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              tab === 'manage' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Manage ({templates.length})
          </button>
        </div>

        <div className="py-3">
          {tab === 'apply' && (
            <div className="space-y-4">
              {templates.length === 0 ? (
                <div className="p-8 text-center border border-dashed rounded-2xl bg-accent/5">
                  <Bookmark className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-muted-foreground">No templates saved yet.</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setTab('save')}
                    className="text-primary font-bold text-xs mt-1"
                  >
                    Save current schedule as your first template &rarr;
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Select Template
                    </Label>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger className="h-11 rounded-xl font-bold">
                        <SelectValue placeholder="Choose a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(t => (
                          <SelectItem key={t.id} value={t.id} className="text-xs font-semibold">
                            {t.name} ({t.lectures.length} lectures)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTemplate && (
                    <div className="p-3.5 rounded-2xl bg-muted/30 border space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-foreground">{selectedTemplate.name}</span>
                        <Badge variant="secondary" className="font-bold text-[10px]">
                          {selectedTemplate.lectures.length} Lectures
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Will be applied to <strong className="text-foreground">{currentBatch.name}</strong> for week{' '}
                        {effectiveWeek.label}.
                      </p>

                      <div className="space-y-1 max-h-[140px] overflow-y-auto pr-1 pt-1 border-t">
                        {selectedTemplate.lectures.map((l, idx) => (
                          <div
                            key={idx}
                            className="p-1.5 rounded-lg bg-background border text-[11px] flex items-center justify-between"
                          >
                            <span className="font-semibold text-foreground">
                              {l.day}: {l.subjectName} ({formatTimeRange12h(l.startTime, l.endTime)})
                            </span>
                            <span className="text-muted-foreground">{formatLectureTeachers(l)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'save' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Template Name
                </Label>
                <Input
                  placeholder="e.g., Sankalp Standard Regular Week"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  className="h-11 rounded-xl font-semibold"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs space-y-1">
                <div className="font-bold text-foreground">
                  Source: {currentBatch.name}
                </div>
                <div className="text-muted-foreground">
                  {currentBatchLectures.length} lecture(s) currently scheduled for this batch will be saved in the template.
                </div>
              </div>
            </div>
          )}

          {tab === 'manage' && (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center italic">No templates saved.</p>
              ) : (
                templates.map(t => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl border bg-card flex items-center justify-between gap-2"
                  >
                    <div>
                      <h5 className="font-extrabold text-xs text-foreground">{t.name}</h5>
                      <span className="text-[11px] text-muted-foreground">
                        {t.lectures.length} lectures • Created {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTemplate(t.id, t.name)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                      title="Delete template"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold"
          >
            Close
          </Button>

          {tab === 'apply' && (
            <Button
              type="button"
              onClick={handleApplyTemplate}
              disabled={isProcessing || !selectedTemplate}
              className="rounded-xl font-black bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isProcessing ? 'Applying...' : 'Apply Template to Batch'}
            </Button>
          )}

          {tab === 'save' && (
            <Button
              type="button"
              onClick={handleSaveTemplate}
              disabled={isProcessing || !templateName.trim() || currentBatchLectures.length === 0}
              className="rounded-xl font-black bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isProcessing ? 'Saving...' : 'Save Template'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimetableTemplateDialog;
