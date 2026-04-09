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
   * Universal Date Normalizer (v2.3)
   * Converts any raw input to YYYY-MM-DD.
   */
  static parseUserDate(dateValue: unknown): string | null {
    if (dateValue === null || dateValue === undefined || String(dateValue).trim() === '') return null;

    if (typeof dateValue === 'object' && dateValue instanceof Date) {
      if (isValid(dateValue)) return format(dateValue, 'yyyy-MM-dd');
      return null;
    }

    if (typeof dateValue === 'number' || (typeof dateValue === 'string' && /^\d{5}$/.test(dateValue))) {
      try {
        const serial = Number(dateValue);
        const dateObj = XLSX.SSF.parse_date_code(serial);
        return `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
      } catch {
        // Continue
      }
    }

    const rawStr = String(dateValue).trim().replace(/\s/g, '');
    
    if (/^\d{8}$/.test(rawStr)) {
      return `${rawStr.slice(0,4)}-${rawStr.slice(4,6)}-${rawStr.slice(6,8)}`;
    }

    const delimiters = rawStr.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (delimiters) {
      return `${delimiters[1]}-${delimiters[2].padStart(2, '0')}-${delimiters[3].padStart(2, '0')}`;
    }

    const shortMatch = rawStr.match(/^(\d{2})[./-](\d{1,2})[./-](\d{1,2})/);
    if (shortMatch) {
      const yearPrefix = parseInt(shortMatch[1]) > 50 ? '19' : '20';
      return `${yearPrefix}${shortMatch[1]}-${shortMatch[2].padStart(2, '0')}-${shortMatch[3].padStart(2, '0')}`;
    }

    const normalized = rawStr.replace(/[./]/g, '-');
    const formats = ['yyyy-MM-dd', 'yyyy-M-d', 'MM-dd-yyyy', 'M-d-yyyy'];
    for (const f of formats) {
      try {
        const parsed = parse(normalized, f, new Date());
        if (isValid(parsed) && parsed.getFullYear() > 1950 && parsed.getFullYear() < 2100) {
          return format(parsed, 'yyyy-MM-dd');
        }
      } catch {
          // Continue
      }
    }

    return null;
  }
}
