import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Printer,
  Download,
  Clock,
  MapPin,
  User,
  Calendar,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  Filter,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Batch,
  TimetableLecture,
  DAYS_OF_WEEK,
  DAY_ORDER_MAP,
  formatTimeRange12h,
  formatLectureTeachers,
  formatLectureSubjectWithTeachers,
  timeToMinutes,
  getInstituteSettings,
} from '@/lib/localStorage';
import { WeekInfo } from '@/lib/timetableUtils';

interface TimetablePrintViewProps {
  batches: Batch[];
  timetableLectures: TimetableLecture[];
  effectiveWeek: WeekInfo;
  academicYear: string;
  showSunday?: boolean;
}

export const TimetablePrintView = ({
  batches,
  timetableLectures,
  effectiveWeek,
  academicYear,
  showSunday = false,
}: TimetablePrintViewProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [isGeneratingPNG, setIsGeneratingPNG] = useState<boolean>(false);

  const settings = getInstituteSettings();
  const instituteLogo = settings.logo || './icons/sankalp_logo.jpeg';
  const instituteName = settings.name || 'Sankalp Academy';

  const activeDays = showSunday ? DAYS_OF_WEEK : DAYS_OF_WEEK.filter(d => d !== 'Sunday');

  // Filter batches based on batch selector
  const displayBatches = selectedBatchFilter === 'all'
    ? batches
    : batches.filter(b => b.id === selectedBatchFilter);

  // Total scheduled lectures for visible batches
  const totalVisibleLectures = displayBatches.reduce((acc, b) => {
    return acc + timetableLectures.filter(l => l.batchId === b.id).length;
  }, 0);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. ISOLATED IFRAME PRINTING (NATIVE BROWSER ENGINE WITH PROPER PAGE BREAKS)
  // ─────────────────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!printRef.current) {
      window.print();
      return;
    }

    try {
      const existingIframe = document.getElementById('timetable-print-frame');
      if (existingIframe) {
        document.body.removeChild(existingIframe);
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'timetable-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        window.print();
        return;
      }

      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => el.outerHTML)
        .join('\n');

      const printContent = printRef.current.innerHTML;

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${instituteName} - Timetable (${effectiveWeek.label})</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            ${styles}
            <style>
              @page {
                size: A4 portrait;
                margin: 8mm;
              }
              html, body {
                background: #ffffff !important;
                color: #0f172a !important;
                margin: 0 !important;
                padding: 4mm !important;
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
              }
              thead {
                display: table-header-group !important;
              }
              tr {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
              }
              .batch-schedule-card {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
                margin-bottom: 18px !important;
              }
              th, td {
                border-color: #cbd5e1 !important;
              }
            </style>
          </head>
          <body>
            <div>${printContent}</div>
          </body>
        </html>
      `);
      iframeDoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (printErr) {
          console.warn('Iframe print error, falling back to window.print():', printErr);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 2000);
        }
      }, 400);
    } catch (err) {
      console.error('Print failed:', err);
      window.print();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. DIRECT PDF GENERATION WITH INTELLIGENT ELEMENT-AWARE PAGE BREAKS
  // ─────────────────────────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPDF(true);
    const toastId = toast.loading('Generating high-resolution timetable PDF...');

    try {
      const element = printRef.current;

      // Capture at crisp scale
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: element.scrollWidth,
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const printWidth = pageWidth - margin * 2; // 194 mm printable width

      // Canvas height that corresponds to one printable A4 page
      const maxPageCanvasHeight = (pageHeight - margin * 2) * (canvas.width / printWidth);

      // If the entire timetable fits on a single page, render it directly
      if (canvas.height <= maxPageCanvasHeight) {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const printHeight = (canvas.height * printWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', margin, margin, printWidth, printHeight, undefined, 'FAST');
      } else {
        // Multi-page document: determine intelligent, clean cut points between elements
        // (Never cut through a table row or card banner)
        const rootRect = element.getBoundingClientRect();
        const scaleY = canvas.height / rootRect.height;

        // Collect DOM boundaries where a page break is natural and clean
        const boundaryElements = Array.from(
          element.querySelectorAll<HTMLElement>('.batch-schedule-card, tbody tr, .printable-footer')
        );

        const safeCutPoints = boundaryElements
          .map(el => {
            const rect = el.getBoundingClientRect();
            return Math.round((rect.top - rootRect.top) * scaleY);
          })
          .filter(y => y > 30 && y < canvas.height - 30);

        // Sort ascending and remove duplicates
        const uniqueCuts = Array.from(new Set(safeCutPoints)).sort((a, b) => a - b);

        let currentY = 0;
        let pageCount = 0;

        while (currentY < canvas.height) {
          if (pageCount > 0) {
            pdf.addPage();
          }
          pageCount++;

          const remainingHeight = canvas.height - currentY;
          let sliceHeight = Math.min(remainingHeight, maxPageCanvasHeight);

          // If remaining height exceeds one page, find the best cut boundary
          if (remainingHeight > maxPageCanvasHeight) {
            const pageBottomLimit = currentY + maxPageCanvasHeight;

            // Find all safe cut points within this page's viewport (leave at least 100px progress)
            const candidateCuts = uniqueCuts.filter(
              cut => cut > currentY + 100 && cut <= pageBottomLimit
            );

            if (candidateCuts.length > 0) {
              // Cut at the latest candidate boundary before the page bottom
              sliceHeight = candidateCuts[candidateCuts.length - 1] - currentY;
            }
          }

          // Create slice canvas for this page
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeight;

          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(
              canvas,
              0,
              currentY,
              canvas.width,
              sliceHeight,
              0,
              0,
              canvas.width,
              sliceHeight
            );

            const sliceImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
            const slicePrintHeight = (sliceHeight * printWidth) / canvas.width;
            pdf.addImage(sliceImgData, 'JPEG', margin, margin, printWidth, slicePrintHeight, undefined, 'FAST');
          }

          currentY += sliceHeight;
        }
      }

      const safeBatchName = selectedBatchFilter === 'all'
        ? 'All_Batches'
        : (batches.find(b => b.id === selectedBatchFilter)?.name || 'Batch').replace(/\s+/g, '_');
      const safeWeekLabel = (effectiveWeek.label || 'Weekly').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Timetable_${safeBatchName}_${safeWeekLabel}.pdf`;

      pdf.save(filename);
      toast.success('Timetable PDF downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Could not generate PDF directly. Opening print dialog...', { id: toastId });
      handlePrint();
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. IMAGE (PNG) DOWNLOAD
  // ─────────────────────────────────────────────────────────────────────────────
  const handleDownloadPNG = async () => {
    if (!printRef.current) return;
    setIsGeneratingPNG(true);
    const toastId = toast.loading('Generating timetable image...');

    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const link = document.createElement('a');
      const safeBatchName = selectedBatchFilter === 'all'
        ? 'All_Batches'
        : (batches.find(b => b.id === selectedBatchFilter)?.name || 'Batch').replace(/\s+/g, '_');
      const safeWeekLabel = (effectiveWeek.label || 'Weekly').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Timetable_${safeBatchName}_${safeWeekLabel}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Timetable image downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error('Image export failed:', err);
      toast.error('Failed to generate timetable image', { id: toastId });
    } finally {
      setIsGeneratingPNG(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. CSV EXPORT
  // ─────────────────────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const lecturesToExport = displayBatches.flatMap(batch => {
      const batchLectures = timetableLectures.filter(l => l.batchId === batch.id);
      return activeDays.flatMap(day => {
        const dayLectures = batchLectures
          .filter(l => l.day.toLowerCase() === day.toLowerCase())
          .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        return dayLectures.map(l => ({
          batchName: batch.name,
          academicYear,
          week: effectiveWeek.label,
          day,
          time: formatTimeRange12h(l.startTime, l.endTime),
          startTime: l.startTime,
          endTime: l.endTime,
          subject: l.subjectName,
          teachers: formatLectureSubjectWithTeachers(l),
          classroom: l.roomName || 'Room 1',
        }));
      });
    });

    if (lecturesToExport.length === 0) {
      toast.error('No scheduled lectures found to export for selected view.');
      return;
    }

    const headers = ['Batch', 'Academic Year', 'Effective Week', 'Day', 'Time Slot', 'Start Time', 'End Time', 'Subject', 'Teacher(s)', 'Classroom'];
    const rows = lecturesToExport.map(r => [
      `"${r.batchName.replace(/"/g, '""')}"`,
      `"${r.academicYear.replace(/"/g, '""')}"`,
      `"${r.week.replace(/"/g, '""')}"`,
      `"${r.day}"`,
      `"${r.time}"`,
      `"${r.startTime}"`,
      `"${r.endTime}"`,
      `"${r.subject.replace(/"/g, '""')}"`,
      `"${r.teachers.replace(/"/g, '""')}"`,
      `"${r.classroom.replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeBatchName = selectedBatchFilter === 'all'
      ? 'All_Batches'
      : (batches.find(b => b.id === selectedBatchFilter)?.name || 'Batch').replace(/\s+/g, '_');
    link.download = `Timetable_${safeBatchName}_${effectiveWeek.label.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Timetable CSV exported successfully!');
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          PRINT & EXPORT CONTROLS BAR (hidden during printing)
      ───────────────────────────────────────────────────────────── */}
      <div className="print:hidden flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 rounded-3xl bg-card border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Printer className="h-5 w-5" />
            </span>
            <div>
              <h4 className="font-black text-base text-foreground flex items-center gap-2">
                Print & Export Timetable
                <Badge variant="outline" className="text-xs font-bold">
                  {totalVisibleLectures} {totalVisibleLectures === 1 ? 'Lecture' : 'Lectures'}
                </Badge>
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clean, isolated layout formatted for official physical printing, direct PDF download, PNG image, and CSV.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Batch Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Batch Filter Dropdown */}
          <div className="w-full sm:w-auto min-w-[190px]">
            <Select value={selectedBatchFilter} onValueChange={setSelectedBatchFilter}>
              <SelectTrigger className="h-10 rounded-xl bg-background border font-bold text-xs">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Batches" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all" className="text-xs font-black">
                  All Batches (Full Institute)
                </SelectItem>
                {batches.map(b => {
                  const count = timetableLectures.filter(l => l.batchId === b.id).length;
                  return (
                    <SelectItem key={b.id} value={b.id} className="text-xs font-semibold">
                      {b.name} ({count})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Download PDF Button */}
          <Button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF || totalVisibleLectures === 0}
            className="rounded-xl font-bold text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            {isGeneratingPDF ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </>
            )}
          </Button>

          {/* Print Timetable Button */}
          <Button
            onClick={handlePrint}
            disabled={totalVisibleLectures === 0}
            variant="outline"
            className="rounded-xl font-bold text-xs gap-1.5 shadow-xs"
          >
            <Printer className="h-3.5 w-3.5 text-primary" />
            Print Timetable
          </Button>

          {/* Download PNG Image */}
          <Button
            onClick={handleDownloadPNG}
            disabled={isGeneratingPNG || totalVisibleLectures === 0}
            variant="outline"
            className="rounded-xl font-bold text-xs gap-1.5 shadow-xs hidden sm:inline-flex"
            title="Download crisp PNG image for WhatsApp / Notice Board"
          >
            {isGeneratingPNG ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5 text-accent" />
            )}
            Save Image
          </Button>

          {/* Export CSV */}
          <Button
            onClick={handleExportCSV}
            disabled={totalVisibleLectures === 0}
            variant="ghost"
            className="rounded-xl font-bold text-xs gap-1.5 text-muted-foreground hover:text-foreground hidden md:inline-flex"
            title="Export lectures to spreadsheet"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          OFFICIAL PRINTABLE SHEET (Proportional A4 Layout)
      ───────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto">
        <div
          ref={printRef}
          id="printable-timetable-sheet"
          className="bg-white text-slate-900 p-6 sm:p-8 rounded-3xl border shadow-sm print:p-0 print:border-none print:shadow-none print:m-0"
        >
          {/* Printable Header */}
          <div className="printable-header pb-4 border-b-2 border-slate-900 mb-5">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
              {instituteLogo && (
                <img
                  src={instituteLogo}
                  alt="Institute Logo"
                  className="h-16 w-16 object-contain rounded-xl border border-slate-200 shadow-xs shrink-0 bg-white p-1"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('sankalp_logo.jpeg')) {
                      target.src = './icons/sankalp_logo.jpeg';
                    }
                  }}
                />
              )}
              <div>
                <h1 className="text-2xl font-black uppercase tracking-wider text-slate-900">
                  {instituteName}
                </h1>
                {settings.address && (
                  <p className="text-xs text-slate-600 font-medium mt-0.5 max-w-xl">
                    {settings.address}
                  </p>
                )}
                {(settings.phone || settings.email) && (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-1 text-[11px] text-slate-500 font-semibold">
                    {settings.phone && <span>Phone: {settings.phone}</span>}
                    {settings.email && <span>Email: {settings.email}</span>}
                  </div>
                )}
                <p className="text-xs font-black uppercase tracking-widest text-indigo-600 mt-1">
                  Official Weekly Timetable
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center mt-3 pt-2.5 border-t border-slate-200">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1 rounded-full bg-slate-100 text-slate-800 text-[11px] font-black uppercase tracking-wider border border-slate-300">
                <span>Academic Year: {academicYear}</span>
                <span>•</span>
                <span>Effective: {effectiveWeek.label}</span>
                {selectedBatchFilter !== 'all' && (
                  <>
                    <span>•</span>
                    <span>Batch: {batches.find(b => b.id === selectedBatchFilter)?.name}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Empty Schedule Notice */}
          {totalVisibleLectures === 0 ? (
            <div className="py-14 text-center space-y-3 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <AlertCircle className="h-9 w-9 text-slate-400 mx-auto" />
              <h5 className="font-bold text-sm text-slate-700">No lectures scheduled</h5>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                There are no lectures scheduled for {selectedBatchFilter === 'all' ? 'any batch' : 'the selected batch'} for {effectiveWeek.label}.
                Switch to Planner Matrix to schedule lectures or run Auto Generate.
              </p>
            </div>
          ) : (
            /* Batch-by-Batch Schedule */
            <div className="space-y-6">
              {displayBatches.map(batch => {
                const batchLectures = timetableLectures.filter(l => l.batchId === batch.id);
                if (batchLectures.length === 0) return null;

                return (
                  <div
                    key={batch.id}
                    className="batch-schedule-card page-break-inside-avoid border border-slate-300 rounded-xl overflow-visible shadow-xs"
                  >
                    <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between rounded-t-xl">
                      <h3 className="text-sm font-black tracking-wide uppercase">
                        {batch.name} {batch.year ? `(${batch.year})` : ''}
                      </h3>
                      <span className="text-xs font-bold text-slate-300">
                        {batchLectures.length} {batchLectures.length === 1 ? 'Lecture' : 'Lectures'}
                      </span>
                    </div>

                    <div className="overflow-x-auto print:overflow-visible">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-black uppercase tracking-wider text-[10px] border-b border-slate-300">
                            <th className="py-2 px-3 w-[120px]">Day</th>
                            <th className="py-2 px-3 w-[150px]">Time Slot</th>
                            <th className="py-2 px-3">Subject</th>
                            <th className="py-2 px-3">Teacher(s)</th>
                            <th className="py-2 px-3 w-[110px]">Classroom</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {activeDays.flatMap(day => {
                            const dayLectures = batchLectures
                              .filter(l => l.day.toLowerCase() === day.toLowerCase())
                              .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

                            if (dayLectures.length === 0) return [];

                            return dayLectures.map((lecture, idx) => (
                              <tr key={lecture.timetableId} className="hover:bg-slate-50 break-inside-avoid">
                                {idx === 0 ? (
                                  <td
                                    rowSpan={dayLectures.length}
                                    className="py-2 px-3 font-black text-slate-900 align-top border-r border-slate-200 bg-slate-50/50"
                                  >
                                    <div className="font-black text-slate-900 leading-tight">{day}</div>
                                    {(() => {
                                      const dayObj = effectiveWeek?.days?.find(
                                        d => d.dayName.toLowerCase() === day.toLowerCase()
                                      );
                                      return dayObj?.displayDate ? (
                                        <div className="text-[10px] font-semibold text-slate-500 leading-tight mt-0.5">
                                          {dayObj.displayDate}
                                        </div>
                                      ) : null;
                                    })()}
                                  </td>
                                ) : null}
                                <td className="py-2 px-3 font-bold text-slate-800 whitespace-nowrap">
                                  {formatTimeRange12h(lecture.startTime, lecture.endTime)}
                                </td>
                                <td className="py-2 px-3 font-black text-slate-900">
                                  {lecture.subjectName}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-700">
                                  {formatLectureSubjectWithTeachers(lecture)}
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-800">
                                  {lecture.roomName || 'Room 1'}
                                </td>
                              </tr>
                            ));
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Printable Footer */}
          <div className="printable-footer mt-6 pt-3.5 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
            <span className="flex items-center gap-2">
              {instituteLogo && (
                <img
                  src={instituteLogo}
                  alt="Logo"
                  className="h-3.5 w-3.5 object-contain rounded-xs"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              )}
              <strong className="text-slate-700">{instituteName}</strong>
            </span>
            <span>Printed on {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimetablePrintView;
