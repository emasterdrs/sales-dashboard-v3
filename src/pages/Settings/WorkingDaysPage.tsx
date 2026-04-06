import React, { useState, useEffect } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isWeekend, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, Save, Calendar as CalendarIcon, Info, Loader2 } from 'lucide-react';
import styles from './WorkingDaysPage.module.css';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';

const WorkingDaysPage: React.FC = () => {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holidays, setHolidays] = useState<Date[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Load config for the current month
  useEffect(() => {
    const fetchConfig = async () => {
      if (!profile?.company_id) return;
      
      setIsLoading(true);
      try {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;

        const { data: configList, error } = await supabase
          .from('working_days_config')
          .select('holidays')
          .eq('company_id', profile.company_id)
          .eq('year', year)
          .eq('month', month);

        const data = configList?.[0];

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
          console.error('Error fetching working days config:', error);
          return;
        }

        if (data && data.holidays) {
          const loadedHolidays = (data.holidays as string[]).map(h => parseISO(h));
          setHolidays(loadedHolidays);
        } else {
          setHolidays([]);
        }
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [currentDate, profile?.company_id]);

  // Calculate stats based on current month selection
  const totalDays = monthDays.length;
  const weekendDays = monthDays.filter(day => isWeekend(day)).length;
  const customHolidays = monthDays.filter(day => 
    holidays.some(h => isSameDay(h, day)) && !isWeekend(day)
  ).length;
  const workingDays = totalDays - weekendDays - customHolidays;

  const toggleHoliday = (day: Date) => {
    const exists = holidays.some(h => isSameDay(h, day));
    if (exists) {
      setHolidays(holidays.filter(h => !isSameDay(h, day)));
    } else {
      setHolidays([...holidays, day]);
    }
  };

  const saveConfig = async () => {
    if (!profile?.company_id) {
      // console.error('로그인이 필요하거나 회사 정보가 없습니다.');
      // (DataUploadPage와 통일된 Toast UI가 이 페이지에도 적용되도록 추후 확장 가능)
      return;
    }

    setIsSaving(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const holidayStrings = holidays.map(h => format(h, 'yyyy-MM-dd'));

      const { error } = await supabase
        .from('working_days_config')
        .upsert({
          company_id: profile.company_id,
          year,
          month,
          total_days: totalDays,
          holidays: holidayStrings
        }, {
          onConflict: 'company_id, year, month'
        });

      if (error) throw error;
      // console.log('영업일수 설정 저장 완료');
    } catch (err) {
      console.error('Error saving config:', err);
      // console.error('저장 중 오류 발생');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><CalendarIcon size={28} /></div>
          <div>
            <h1 className={styles.title}>영업일수 설정</h1>
            <p className={styles.subtitle}>달력에서 공휴일 및 추가 휴무일을 선택하세요.</p>
          </div>
        </div>
        
        <div className={styles.monthSelector}>
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft /></button>
          <span className={styles.currentMonth}>{format(currentDate, 'yyyy년 MM월')}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight /></button>
        </div>

        <button className={styles.saveBtn} onClick={saveConfig} disabled={isSaving || isLoading}>
          {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          {isSaving ? '저장 중...' : '설정 저장'}
        </button>
      </header>

      <div className={styles.mainLayout}>
        <div className={styles.calendarArea}>
          {isLoading ? (
            <div className={styles.loadingOverlay}>
              <Loader2 className="animate-spin" size={40} />
              <p>데이터를 불러오고 있습니다...</p>
            </div>
          ) : (
            <>
              <div className={styles.weekdayHeader}>
                {['일', '월', '화', '수', '목', '금', '토'].map(d => (
                  <div key={d} className={styles.weekday}>{d}</div>
                ))}
              </div>
              <div className={styles.calendarGrid}>
                {/* Blank days before the month starts */}
                {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                  <div key={`blank-${i}`} className={styles.calendarCellBlank} />
                ))}
                {monthDays.map(day => {
                  const weekend = isWeekend(day);
                  const holiday = holidays.some(h => isSameDay(h, day));
                  return (
                    <div 
                      key={day.toISOString()} 
                      className={`${styles.calendarCell} ${weekend ? styles.weekend : ''} ${holiday ? styles.holiday : ''}`}
                      onClick={() => toggleHoliday(day)}
                    >
                      <span className={styles.dayNum}>{day.getDate()}</span>
                      {(weekend || holiday) && <span className={styles.holidayBadge}>{weekend ? '주말' : '공휴일'}</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className={styles.statsCard}>
          <h3 className={styles.statsTitle}>영업일수 자동 계산</h3>
          <div className={styles.statRow}>
            <span>총 일수</span>
            <strong>{totalDays}일</strong>
          </div>
          <div className={styles.statRow}>
            <span>주말 (자동 제외)</span>
            <span className={styles.minusVal}>- {weekendDays}일</span>
          </div>
          <div className={styles.statRow}>
            <span>추가 공휴일</span>
            <span className={styles.minusVal}>- {customHolidays}일</span>
          </div>
          <div className={styles.statTotal}>
            <span>최종 영업일수</span>
            <span className={styles.totalVal}>{workingDays}일</span>
          </div>
          <div className={styles.infoBox}>
            <Info size={14} />
            <p>달력에서 선거일, 공휴일 등을 클릭하여 편집할 수 있습니다. 기본적으로 토, 일요일은 자동 제외됩니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkingDaysPage;

