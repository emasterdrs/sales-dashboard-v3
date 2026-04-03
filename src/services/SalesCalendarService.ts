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
   * Supports YYYY-MM-DD, YYYY.MM.DD, YYYYMMDD, YY/MM/DD, Excel serial numbers, etc.
   */
  static parseUserDate(dateValue: any): string | null {
    if (!dateValue) return null;

    // Handle Excel Serial Number
    if (typeof dateValue === 'number') {
      const dateObj = XLSX.SSF.parse_date_code(dateValue);
      return `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
    }

    // Clean string input
    let dateStr = String(dateValue).trim().replace(/[./]/g, '-');

    // Try various formats
    const formats = [
      'yyyy-MM-dd',
      'yyyy-M-d',
      'yyyyMMdd',
      'yy-MM-dd',
      'yy-M-d',
      'M-d-yyyy',
      'MM-dd-yyyy'
    ];

    for (const f of formats) {
      // For yyyyMMdd, we shouldn't have replaced separators with '-'
      let targetStr = dateStr;
      if (f === 'yyyyMMdd') targetStr = String(dateValue).trim();

      try {
        const parsed = parse(targetStr, f, new Date());
        if (isValid(parsed) && parsed.getFullYear() > 2000) {
          return format(parsed, 'yyyy-MM-dd');
        }
      } catch (e) {
        // Continue to next format
      }
    }

    // Fallback regex attempt for YYYYMMDD if formatting failed
    const yyyymmddRegex = /^(\d{4})(\d{2})(\d{2})$/;
    const match = String(dateValue).trim().match(yyyymmddRegex);
    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }

    return null;
  }
}
