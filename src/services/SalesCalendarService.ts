import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameDay } from 'date-fns';

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
}
