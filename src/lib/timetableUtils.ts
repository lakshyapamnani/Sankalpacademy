import { DAYS_OF_WEEK, DAY_ORDER_MAP, formatTime12h, formatTimeRange12h } from './localStorage';

export { DAYS_OF_WEEK, DAY_ORDER_MAP, formatTime12h, formatTimeRange12h };

export const DEFAULT_ROOMS = [
  'Room 1',
  'Room 2',
  'Room 3',
  'Room 4',
  'Room 5',
  'Lab 1',
  'Lab 2',
  'Auditorium',
];

export const DEFAULT_DIVISIONS = ['All', 'A', 'B', 'C', 'D'];

/**
 * Returns YYYY-MM-DD for a local Date object without timezone shift.
 */
export const toLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse YYYY-MM-DD into a local Date object.
 */
export const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
};

/**
 * Formats a Date object to "21 Sep 2026".
 */
export const formatDisplayDate = (d: Date): string => {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Formats date range: "21 Sep 2026 – 27 Sep 2026"
 */
export const formatDisplayDateRange = (startDateStr: string, endDateStr: string): string => {
  if (!startDateStr || !endDateStr) return '';
  const s = parseLocalDate(startDateStr);
  const e = parseLocalDate(endDateStr);
  return `${formatDisplayDate(s)} → ${formatDisplayDate(e)}`;
};

export interface WeekInfo {
  startDate: string; // YYYY-MM-DD (Monday)
  endDate: string;   // YYYY-MM-DD (Sunday)
  label: string;     // e.g. "21 Sep 2026 → 27 Sep 2026"
  days: {
    dayName: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
    date: string;    // YYYY-MM-DD
    displayDate: string; // "21 Sep"
  }[];
}

/**
 * Calculates the Monday-Sunday week range for a given date.
 */
export const getWeekInfo = (targetDate: Date = new Date()): WeekInfo => {
  const d = new Date(targetDate);
  const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday, ...
  // Distance from Monday
  const distanceToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - distanceToMonday);

  const days: WeekInfo['days'] = [];
  const dayNames: WeekInfo['days'][number]['dayName'][] = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  for (let i = 0; i < 7; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    days.push({
      dayName: dayNames[i],
      date: toLocalDateString(current),
      displayDate: current.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    });
  }

  const startDate = days[0].date;
  const endDate = days[6].date;

  return {
    startDate,
    endDate,
    label: formatDisplayDateRange(startDate, endDate),
    days,
  };
};

/**
 * Get current day name in local time: e.g. "Monday", "Tuesday", etc.
 */
export const getCurrentLocalDayName = (): 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday' => {
  const dayIndex = new Date().getDay();
  const map: ('Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday')[] = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return map[dayIndex] as any;
};

/**
 * Given a day of the week, returns the corresponding date (YYYY-MM-DD) in the active week.
 */
export const getDateForDayInWeek = (
  dayName: string,
  weekStartDateStr: string
): string => {
  const monday = parseLocalDate(weekStartDateStr);
  const dayOrder = DAY_ORDER_MAP[dayName] || 1;
  const targetDate = new Date(monday);
  targetDate.setDate(monday.getDate() + (dayOrder - 1));
  return toLocalDateString(targetDate);
};
