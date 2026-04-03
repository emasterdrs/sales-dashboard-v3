import { startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay, parse, format, isValid } from 'date-fns';
import * as XLSX from 'xlsx';

export interface WorkingDayConfig {
  year: number;
  month: number;
  holidays: Date[];
}

export class SalesCalendarService {
  /**
   * Calculates total working days in a month.
   * Excludes weekends and static holidays by default.
   */
  static getTotalWorkingDays(year: number, month: number, customHolidays: Date[] = []): number {
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);
    const allDays = eachDayOfInterval({ start, end });

    return allDays.filter(day => {
      const isWeekEnd = isWeekend(day);
      const isHoliday = customHolidays.some(h => isSameDay(h, day));
      return !isWeekEnd && !isHoliday;
    }).length;
  }

  /**
   * Calculates current elapsed working days from start of month to today.
   */
  static getElapsedWorkingDays(year: number, month: number, today: Date, customHolidays: Date[] = []): number {
    const start = startOfMonth(new Date(year, month - 1));
    const end = today < endOfMonth(start) ? today : endOfMonth(start);
    
    // If today is in another month
    if (today.getMonth() + 1 !== month || today.getFullYear() !== year) {
        return this.getTotalWorkingDays(year, month, customHolidays);
    }

    const intervalDays = eachDayOfInterval({ start, end });
    return intervalDays.filter(day => {
      const isWeekEnd = isWeekend(day);
      const isHoliday = customHolidays.some(h => isSameDay(h, day));
      return !isWeekEnd && !isHoliday;
    }).length;
  }

  /**
   * Calculates current progress percentage in terms of working days.
   */
  static getProgressRate(total: number, current: number): number {
    if (total === 0) return 0;
    return Number(((current / total) * 100).toFixed(1));
  }

  /**
   * Robust date parser for various user input formats.
   * Core formats: YYYY-MM-DD, YYYY.MM.DD, YYYYMMDD, YY/MM/DD, Excel serial numbers.
   * Special handles for Korean space-dot styles.
   */
  static parseUserDate(dateValue: any): string | null {
    if (dateValue === null || dateValue === undefined) return null;

    // Handle Excel Date Objects (if parse_dates: true was used)
    if (dateValue instanceof Date) {
      if (isValid(dateValue)) return format(dateValue, 'yyyy-MM-dd');
      return null;
    }

    // Handle Excel Serial Number
    if (typeof dateValue === 'number') {
      try {
        const dateObj = XLSX.SSF.parse_date_code(dateValue);
        return `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
      } catch (e) {
        // Not a valid serial number? Treat as string below
      }
    }

    // Clean string input: remove extra spaces and unify separators
    // Handle formats like "2017 . 1 . 1" -> "2017-1-1"
    let rawStr = String(dateValue).trim();
    let dateStr = rawStr.replace(/\s/g, '').replace(/[./]/g, '-');

    // Try various formats via date-fns
    const formats = [
      'yyyy-MM-dd',
      'yyyy-M-d',
      'yyyyMMdd',
      'yy-MM-dd',
      'yy-M-d',
      'yyyy-MM-dd HH:mm:ss',
      'M-d-yyyy',
      'MM-dd-yyyy'
    ];

    for (const f of formats) {
      // For dense formats like yyyyMMdd, use original string without spaces
      let targetStr = (f === 'yyyyMMdd') ? rawStr.replace(/\s/g, '') : dateStr;

      try {
        const parsed = parse(targetStr, f, new Date());
        // Relaxing year limit to support historical data (e.g. 2017 shown in screenshot)
        if (isValid(parsed) && parsed.getFullYear() > 1950 && parsed.getFullYear() < 2100) {
          return format(parsed, 'yyyy-MM-dd');
        }
      } catch (e) {
        // Continue to next format
      }
    }

    // Fallback regex attempt for YYYYMMDD if formatting failed (e.g. 20170101)
    const yyyymmddMatch = rawStr.replace(/\s/g, '').match(/^(\d{4})(\d{2})(\d{2})$/);
    if (yyyymmddMatch) {
        return `${yyyymmddMatch[1]}-${yyyymmddMatch[2]}-${yyyymmddMatch[3]}`;
    }

    return null;
  }
}
