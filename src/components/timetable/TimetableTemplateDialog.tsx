import { useState, useEffect, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Plus, Trash2, CheckCircle2, Clock, Layers, CheckSquare, Square } from 'lucide-react';
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
  batches: Batch[];
  currentBatch?: Batch;
  effectiveWeek: WeekInfo;
  academicYear: string;
  allLectures: TimetableLecture[];
  onSuccess: () => void;
}

export const TimetableTemplateDialog = ({
  open,
  onOpenChange,
  batches = [],
  currentBatch,
  effectiveWeek,
  academicYear,
  allLectures,
  onSuccess,
}: TimetableTemplateDialogProps) => {
  const [tab, setTab] = useState<'apply' | 'save' | 'manage'>('save');
  const [templates, setTemplates] = useState<TimetableTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateName, setTemplateName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Batches selected for saving
  const [selectedSaveBatchIds, setSelectedSaveBatchIds] = useState<string[]>([]);

  // Batches selected for applying
  const [selectedApplyBatchIds, setSelectedApplyBatchIds] = useState<string[]>([]);

  // Initialize/reset states when dialog opens
  useEffect(() => {
    if (open) {
      const list = getTimetableTemplates();
      setTemplates(list);
      if (list.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(list[0].id);
      }

      // Default: select batches that have lectures scheduled in current week, or currentBatch, or all batches
      const batchesWithLectures = batches
        .filter(b => allLectures.some(l => l.batchId === b.id))
        .map(b => b.id);

      if (batchesWithLectures.length > 0) {
        setSelectedSaveBatchIds(batchesWithLectures);
      } else if (currentBatch) {
        setSelectedSaveBatchIds([currentBatch.id]);
      } else {
        setSelectedSaveBatchIds(batches.map(b => b.id));
      }
    }
  }, [open, batches, allLectures, currentBatch]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  // Sync selectedApplyBatchIds when selectedTemplate changes
  useEffect(() => {
    if (selectedTemplate) {
      const tplBatchIds = Array.from(new Set(selectedTemplate.lectures.map(l => l.batchId)));
      // If template lectures map to batches in the system, select them
      const validSystemBatchIds = batches
        .filter(b => tplBatchIds.includes(b.id) || selectedTemplate.lectures.some(l => l.batchName === b.name))
        .map(b => b.id);

      if (validSystemBatchIds.length > 0) {
        setSelectedApplyBatchIds(validSystemBatchIds);
      } else if (currentBatch) {
        setSelectedApplyBatchIds([currentBatch.id]);
      } else if (batches.length > 0) {
        setSelectedApplyBatchIds([batches[0].id]);
      }
    }
  }, [selectedTemplate, batches, currentBatch]);

  // Total lectures to save across selected batches
  const lecturesToSave = useMemo(() => {
    return allLectures.filter(l => selectedSaveBatchIds.includes(l.batchId));
  }, [allLectures, selectedSaveBatchIds]);

  // Toggle batch selection in save tab
  const handleToggleSaveBatch = (batchId: string) => {
    setSelectedSaveBatchIds(prev =>
      prev.includes(batchId) ? prev.filter(id => id !== batchId) : [...prev, batchId]
    );
  };

  const handleSelectAllSave = () => {
    setSelectedSaveBatchIds(batches.map(b => b.id));
  };

  const handleDeselectAllSave = () => {
    setSelectedSaveBatchIds([]);
  };

  // Toggle batch selection in apply tab
  const handleToggleApplyBatch = (batchId: string) => {
    setSelectedApplyBatchIds(prev =>
      prev.includes(batchId) ? prev.filter(id => id !== batchId) : [...prev, batchId]
    );
  };

  const handleSelectAllApply = () => {
    if (!selectedTemplate) return;
    const tplBatchIds = Array.from(new Set(selectedTemplate.lectures.map(l => l.batchId)));
    const matchingIds = batches
      .filter(b => tplBatchIds.includes(b.id) || selectedTemplate.lectures.some(l => l.batchName === b.name))
      .map(b => b.id);
    setSelectedApplyBatchIds(matchingIds.length > 0 ? matchingIds : batches.map(b => b.id));
  };

  const handleDeselectAllApply = () => {
    setSelectedApplyBatchIds([]);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SAVE TEMPLATE (MULTI-BATCH SUPPORT)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name.');
      return;
    }

    if (selectedSaveBatchIds.length === 0) {
      toast.error('Please select at least one batch to include in the template.');
      return;
    }

    if (lecturesToSave.length === 0) {
      toast.error('The selected batch(es) have no scheduled lectures for the current week.');
      return;
    }

    setIsProcessing(true);
    try {
      const selectedBatches = batches.filter(b => selectedSaveBatchIds.includes(b.id));
      const batchNames = selectedBatches.map(b => b.name);

      const newTemplate: TimetableTemplate = {
        id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: templateName.trim(),
        description: `${selectedBatches.length} batch(es): ${batchNames.slice(0, 3).join(', ')}${batchNames.length > 3 ? '...' : ''} (${lecturesToSave.length} lectures)`,
        academicYear,
        batchName: batchNames.length === 1 ? batchNames[0] : `${selectedBatches.length} Batches`,
        lectures: lecturesToSave.map(l => ({
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
      toast.success(
        `Template "${templateName.trim()}" saved with ${lecturesToSave.length} lectures across ${selectedBatches.length} batch(es)!`
      );

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

  // ─────────────────────────────────────────────────────────────────────────────
  // APPLY TEMPLATE (MULTI-BATCH SUPPORT)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleApplyTemplate = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template to apply.');
      return;
    }

    if (selectedApplyBatchIds.length === 0) {
      toast.error('Please select at least one batch to apply the template to.');
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    const conflicts: string[] = [];
    const currentLectures = [...allLectures];

    try {
      // Filter template lectures for the selected target batches
      for (const targetBatchId of selectedApplyBatchIds) {
        const targetBatch = batches.find(b => b.id === targetBatchId);
        if (!targetBatch) continue;

        // Find lectures in template for this batch (by batchId or batchName, or all lectures if single-batch template applied to currentBatch)
        let batchTemplateLectures = selectedTemplate.lectures.filter(
          l => l.batchId === targetBatch.id || l.batchName?.toLowerCase() === targetBatch.name.toLowerCase()
        );

        // If template only contains 1 batch and target batches were manually checked, allow applying those lectures
        if (batchTemplateLectures.length === 0 && selectedTemplate.lectures.length > 0) {
          const tplBatchIds = Array.from(new Set(selectedTemplate.lectures.map(l => l.batchId)));
          if (tplBatchIds.length === 1) {
            batchTemplateLectures = selectedTemplate.lectures;
          }
        }

        for (const tplLecture of batchTemplateLectures) {
          const candidate = {
            academicYear,
            batchId: targetBatch.id,
            batchName: targetBatch.name,
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
              `[${targetBatch.name}] ${candidate.day} ${formatTimeRange12h(candidate.startTime, candidate.endTime)} (${candidate.subjectName}): ${validation.message}`
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
      }

      if (successCount > 0) {
        toast.success(
          `Applied template! Successfully scheduled ${successCount} lecture(s) across ${selectedApplyBatchIds.length} batch(es) for ${effectiveWeek.label}.`
        );
      }

      if (conflicts.length > 0) {
        toast.warning(
          `Skipped ${conflicts.length} lecture(s) due to timetable conflicts:\n${conflicts.slice(0, 3).join('\n')}${conflicts.length > 3 ? '\n...' : ''}`
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
      <DialogContent className="sm:max-w-[580px] rounded-3xl p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-primary" />
            Timetable Templates
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Save weekly schedules across one or all batches as reusable templates and apply them in one click.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-muted text-xs font-bold mt-2">
          <button
            type="button"
            onClick={() => setTab('save')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              tab === 'save'
                ? 'bg-background shadow-xs text-foreground font-black'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Save as Template
          </button>
          <button
            type="button"
            onClick={() => setTab('apply')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              tab === 'apply'
                ? 'bg-background shadow-xs text-foreground font-black'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Apply Template
          </button>
          <button
            type="button"
            onClick={() => setTab('manage')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              tab === 'manage'
                ? 'bg-background shadow-xs text-foreground font-black'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Manage ({templates.length})
          </button>
        </div>

        <div className="py-3">
          {/* ─────────────────────────────────────────────────────────────
              TAB 1: SAVE AS TEMPLATE (With All Batches & Checkboxes)
          ───────────────────────────────────────────────────────────── */}
          {tab === 'save' && (
            <div className="space-y-4">
              {/* Template Name Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Template Name *
                </Label>
                <Input
                  placeholder="e.g., Sankalp Regular Routine, Exam Prep Week"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  className="h-11 rounded-xl font-semibold"
                />
              </div>

              {/* Batch Checkboxes Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    Select Batches to Include
                  </Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllSave}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <CheckSquare className="h-3 w-3" /> Select All
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllSave}
                      className="text-[11px] font-bold text-muted-foreground hover:underline flex items-center gap-1"
                    >
                      <Square className="h-3 w-3" /> Clear
                    </button>
                  </div>
                </div>

                {/* Batches List with Lecture Counts */}
                <div className="border rounded-2xl p-2.5 max-h-[220px] overflow-y-auto space-y-1.5 bg-muted/20">
                  {batches.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No batches configured.</p>
                  ) : (
                    batches.map(batch => {
                      const batchLectureCount = allLectures.filter(l => l.batchId === batch.id).length;
                      const isChecked = selectedSaveBatchIds.includes(batch.id);

                      return (
                        <div
                          key={batch.id}
                          onClick={() => handleToggleSaveBatch(batch.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-primary/5 border-primary/40 text-foreground font-semibold shadow-xs'
                              : 'bg-background border-border/60 text-muted-foreground hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => handleToggleSaveBatch(batch.id)}
                              className="rounded-md"
                            />
                            <div>
                              <span className="font-bold text-foreground">
                                {batch.name}
                              </span>
                              {batch.year && (
                                <span className="text-[11px] text-muted-foreground ml-1.5">
                                  ({batch.year})
                                </span>
                              )}
                            </div>
                          </div>

                          <Badge
                            variant={batchLectureCount > 0 ? (isChecked ? 'default' : 'secondary') : 'outline'}
                            className="text-[10px] font-black shrink-0"
                          >
                            {batchLectureCount} {batchLectureCount === 1 ? 'Lecture' : 'Lectures'}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Summary Card */}
              <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-foreground">
                  <span>Current Week: {effectiveWeek.label}</span>
                  <Badge variant="outline" className="text-primary font-black text-[11px]">
                    {lecturesToSave.length} Lectures Total
                  </Badge>
                </div>
                <p className="text-muted-foreground text-[11px]">
                  {selectedSaveBatchIds.length} batch(es) selected. All {lecturesToSave.length} scheduled lecture(s) for the selected batch(es) in this week will be saved into the template.
                </p>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: APPLY TEMPLATE (With Multi-Batch Support)
          ───────────────────────────────────────────────────────────── */}
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
                    Save current weekly schedule as your first template &rarr;
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Select Template to Apply
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
                    <div className="p-4 rounded-2xl bg-muted/30 border space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-foreground text-sm">{selectedTemplate.name}</span>
                        <Badge variant="secondary" className="font-bold text-[10px]">
                          {selectedTemplate.lectures.length} Total Lectures
                        </Badge>
                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        {selectedTemplate.description || 'Saved timetable schedule routine.'}
                      </p>

                      {/* Batches in template to apply */}
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                            Apply to Batches:
                          </Label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleSelectAllApply}
                              className="text-[10px] font-bold text-primary hover:underline"
                            >
                              Select All
                            </button>
                            <span className="text-muted-foreground text-[10px]">•</span>
                            <button
                              type="button"
                              onClick={handleDeselectAllApply}
                              className="text-[10px] font-bold text-muted-foreground hover:underline"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                          {batches.map(batch => {
                            const isIncludedInTemplate = selectedTemplate.lectures.some(
                              l => l.batchId === batch.id || l.batchName?.toLowerCase() === batch.name.toLowerCase()
                            );
                            const tplLecturesForBatch = selectedTemplate.lectures.filter(
                              l => l.batchId === batch.id || l.batchName?.toLowerCase() === batch.name.toLowerCase()
                            );
                            const count = tplLecturesForBatch.length;
                            const isChecked = selectedApplyBatchIds.includes(batch.id);

                            return (
                              <div
                                key={batch.id}
                                onClick={() => handleToggleApplyBatch(batch.id)}
                                className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                                  isChecked
                                    ? 'bg-background border-primary/40 text-foreground font-semibold shadow-xs'
                                    : 'bg-muted/40 border-transparent text-muted-foreground'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => handleToggleApplyBatch(batch.id)}
                                  />
                                  <span>{batch.name}</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">
                                  {count > 0 ? `${count} lectures in template` : '0 lectures in template'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-background border text-[11px] text-muted-foreground">
                        Target Week: <strong className="text-foreground">{effectiveWeek.label}</strong> (Academic Year: {academicYear})
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: MANAGE TEMPLATES
          ───────────────────────────────────────────────────────────── */}
          {tab === 'manage' && (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center italic">No templates saved yet.</p>
              ) : (
                templates.map(t => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-xl border bg-card flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-0.5">
                      <h5 className="font-extrabold text-xs text-foreground">{t.name}</h5>
                      <p className="text-[11px] text-muted-foreground">
                        {t.lectures.length} lectures • {t.batchName || 'Multiple Batches'}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        Created {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTemplate(t.id, t.name)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
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

          {tab === 'save' && (
            <Button
              type="button"
              onClick={handleSaveTemplate}
              disabled={isProcessing || !templateName.trim() || selectedSaveBatchIds.length === 0 || lecturesToSave.length === 0}
              className="rounded-xl font-black bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isProcessing ? 'Saving...' : `Save Template (${lecturesToSave.length} Lectures)`}
            </Button>
          )}

          {tab === 'apply' && (
            <Button
              type="button"
              onClick={handleApplyTemplate}
              disabled={isProcessing || !selectedTemplate || selectedApplyBatchIds.length === 0}
              className="rounded-xl font-black bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isProcessing ? 'Applying...' : `Apply Template (${selectedApplyBatchIds.length} Batches)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimetableTemplateDialog;
