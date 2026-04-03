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
   * Calculates current elapsed working days.
   */
  static getElapsedWorkingDays(year: number, month: number, today: Date, customHolidays: Date[] = []): number {
    const start = startOfMonth(new Date(year, month - 1));
    const end = today < endOfMonth(start) ? today : endOfMonth(start);
    
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
   * Calculates current progress percentage.
   */
  static getProgressRate(total: number, current: number): number {
    if (total === 0) return 0;
    return Number(((current / total) * 100).toFixed(1));
  }

  /**
   * Enhanced Robust Date Parser.
   * Priority: Regex Match (Standard Dash) -> Excel Serial -> Date Object -> date-fns parsing.
   */
  static parseUserDate(dateValue: any): string | null {
    if (dateValue === null || dateValue === undefined) return null;

    // 1. Regex Fast-Path (YYYY-MM-DD or YYYY.MM.DD)
    const rawStr = String(dateValue).trim();
    const isoMatch = rawStr.match(/^(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
    if (isoMatch) {
      const y = isoMatch[1];
      const m = isoMatch[2].padStart(2, '0');
      const d = isoMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // 2. Excel Date/Object Path
    if (dateValue instanceof Date) {
      if (isValid(dateValue)) return format(dateValue, 'yyyy-MM-dd');
      return null;
    }

    // 3. Excel Serial Number Path
    if (typeof dateValue === 'number') {
      try {
        const dateObj = XLSX.SSF.parse_date_code(dateValue);
        return `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
      } catch (e) {
        // Fall through
      }
    }

    // 4. Compact formats (e.g. 20170101)
    const compactMatch = rawStr.replace(/\s/g, '').match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) {
        return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
    }

    // 5. date-fns parsing fallback (e.g. YY/MM/DD)
    const normalizedStr = rawStr.replace(/[./]/g, '-');
    const formats = [
      'yyyy-MM-dd',
      'yyyy-M-d',
      'yy-MM-dd',
      'yy-M-d',
      'M/d/yy',
      'MM/dd/yyyy'
    ];

    for (const f of formats) {
      try {
        const parsed = parse(normalizedStr, f, new Date());
        if (isValid(parsed) && parsed.getFullYear() > 1950 && parsed.getFullYear() < 2100) {
          return format(parsed, 'yyyy-MM-dd');
        }
      } catch (e) {}
    }

    return null;
  }
}
