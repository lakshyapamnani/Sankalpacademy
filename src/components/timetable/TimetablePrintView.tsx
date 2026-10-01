import { useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Download, Clock, MapPin, User, Calendar } from 'lucide-react';
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
  const settings = getInstituteSettings();
  const instituteLogo = settings.logo || './icons/sankalp_logo.jpeg';
  const instituteName = settings.name || 'Sankalp Academy';

  const activeDays = showSunday ? DAYS_OF_WEEK : DAYS_OF_WEEK.filter(d => d !== 'Sunday');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print Controls Bar (hidden during printing) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border shadow-xs">
        <div>
          <h4 className="font-black text-base text-foreground flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Printable Weekly Schedule
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Formatted for physical printing, official distribution, and PDF export.
          </p>
        </div>
        <Button
          onClick={handlePrint}
          className="rounded-xl font-black gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
        >
          <Printer className="h-4 w-4" />
          Print / Save PDF
        </Button>
      </div>

      {/* Official Printable Sheet */}
      <div
        ref={printRef}
        className="bg-white text-slate-900 p-6 sm:p-10 rounded-2xl border shadow-sm print:p-0 print:border-none print:shadow-none print:m-0"
      >
        {/* Printable Header */}
        <div className="pb-6 border-b-2 border-slate-900/80 mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 text-center sm:text-left">
            {instituteLogo && (
              <img
                src={instituteLogo}
                alt="Institute Logo"
                className="h-20 w-20 object-contain rounded-2xl border border-slate-200 shadow-xs shrink-0 bg-white p-1"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('sankalp_logo.jpeg')) {
                    target.src = './icons/sankalp_logo.jpeg';
                  }
                }}
              />
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-slate-900">
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
              <p className="text-xs font-black uppercase tracking-widest text-primary mt-1">
                Official Weekly Timetable
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center mt-3 pt-3 border-t border-slate-200">
            <div className="inline-flex items-center gap-3 px-4 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-black uppercase tracking-wider border border-slate-300">
              <span>Academic Year: {academicYear}</span>
              <span>•</span>
              <span>Effective: {effectiveWeek.label}</span>
            </div>
          </div>
        </div>

        {/* Batch-by-Batch Schedule */}
        <div className="space-y-8">
          {batches.map(batch => {
            const batchLectures = timetableLectures.filter(l => l.batchId === batch.id);
            if (batchLectures.length === 0) return null;

            return (
              <div key={batch.id} className="page-break-inside-avoid border border-slate-300 rounded-xl overflow-hidden">
                <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
                  <h3 className="text-base font-black tracking-wide uppercase">
                    {batch.name} {batch.year ? `(${batch.year})` : ''}
                  </h3>
                  <span className="text-xs font-bold text-slate-300">
                    {batchLectures.length} {batchLectures.length === 1 ? 'Lecture' : 'Lectures'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-black uppercase tracking-wider text-[10px] border-b border-slate-300">
                        <th className="py-2.5 px-3 w-[120px]">Day</th>
                        <th className="py-2.5 px-3 w-[150px]">Time</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3">Teacher(s)</th>
                        <th className="py-2.5 px-3 w-[100px]">Classroom</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {activeDays.flatMap(day => {
                        const dayLectures = batchLectures
                          .filter(l => l.day.toLowerCase() === day.toLowerCase())
                          .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

                        if (dayLectures.length === 0) return [];

                        return dayLectures.map((lecture, idx) => (
                          <tr key={lecture.timetableId} className="hover:bg-slate-50">
                            {idx === 0 ? (
                              <td
                                rowSpan={dayLectures.length}
                                className="py-2.5 px-3 font-black text-slate-900 align-top border-r border-slate-200 bg-slate-50/50"
                              >
                                {day}
                              </td>
                            ) : null}
                            <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                              {formatTimeRange12h(lecture.startTime, lecture.endTime)}
                            </td>
                            <td className="py-2.5 px-3 font-black text-slate-900">
                              {lecture.subjectName}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-700">
                              {formatLectureSubjectWithTeachers(lecture)}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-800">
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

        {/* Printable Footer */}
        <div className="mt-8 pt-4 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
          <span className="flex items-center gap-2">
            {instituteLogo && (
              <img
                src={instituteLogo}
                alt="Logo"
                className="h-4 w-4 object-contain rounded-xs"
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
  );
};

export default TimetablePrintView;
