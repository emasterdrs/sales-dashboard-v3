import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';
import { 
  Building2, 
  Layers,
  TrendingUp
} from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import DashboardHeader from '../../components/Dashboard/DashboardHeader';
import SummaryGrid from '../../components/Dashboard/SummaryGrid';
import DrillDownTable from '../../components/Dashboard/DrillDownTable';
import styles from './DashboardPage.module.css';

interface DashboardData {
  id: string;
  name: string;
  goal: string;
  performance: string;
  achieve: string;
  gap: string;
  expectedGoal?: string;
  expectedPerformance?: string;
  expectedAchieve?: string;
  expectedGap?: string;
  originalGoalVal?: number;
  originalPerfVal?: number;
}

const DashboardPage: React.FC = () => {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isTypeMode = location.pathname.startsWith('/type');
  const isYoyMode = location.pathname.endsWith('/yoy');

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [unit, setUnit] = useState<'won' | 'million' | 'billion'>('billion');
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string; level: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0); 
  const [selectedIds, setSelectedIds] = useState<{ 
    divisionId?: string; 
    teamId?: string; 
    staffId?: string; 
    customerName?: string; 
    categoryId?: string 
  }>({});

  const [workingDays, setWorkingDays] = useState({ total: 21, current: 13 });
  const [summaryData, setSummaryData] = useState({ 
    goal: '0', 
    performance: '0', 
    achievementRate: '0', 
    progressGap: '0',
    originalGoalVal: 0,
    originalPerfVal: 0
  });

  const [trendData, setTrendData] = useState<any[]>([]);
  const [displayData, setDisplayData] = useState<DashboardData[]>([]);
  const [isExpectedClosingOn, setIsExpectedClosingOn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const parseNum = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'string') {
      const num = parseFloat(val.replace(/,/g, ''));
      return isNaN(num) ? 0 : num;
    }
    return isNaN(Number(val)) ? 0 : Number(val);
  };

  useEffect(() => {
    initDashboard();
  }, [profile?.company_id, year, month, unit, isTypeMode]);

  useEffect(() => {
    refreshDrillDownData();
  }, [currentLevel, selectedIds, profile?.company_id, year, month, unit, isTypeMode]);

  useEffect(() => {
    setCurrentLevel(0);
    setBreadcrumbs([]);
    setSelectedIds({});
  }, [isTypeMode]);

  const formatValue = (val: number) => {
    const num = Number(val);
    if (unit === 'billion') return (num / 100000000).toFixed(1);
    if (unit === 'million') return (num / 1000000).toLocaleString();
    return num.toLocaleString();
  };

  const getUnitName = () => {
    if (unit === 'billion') return '억원';
    if (unit === 'million') return '백만원';
    return '원';
  };

  const fetchAll = async (query: any) => {
    let all: any[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
        const { data, error } = await query.range(from, from + step - 1);
        if (error) { console.error('fetchAll Error:', error); break; }
        if (!data || data.length === 0) break;
        all = [...all, ...data];
        if (data.length < step) break;
        from += step;
    }
    return all;
  };

  const fetchTargets = async (entityType: string, ids: string[], groupType: string, filterCol?: string, filterVal?: string) => {
    if (!profile?.company_id) return [];
    if (isYoyMode) {
      const lyStart = format(new Date(year - 1, month - 1, 1), 'yyyy-MM-dd');
      const lyEnd = format(new Date(year - 1, month, 0), 'yyyy-MM-dd');
      const { data: lyPerf } = await supabase.rpc('get_group_perf_summary', { p_company_id: profile.company_id, p_start: lyStart, p_end: lyEnd, p_group_type: groupType, p_filter_col: filterCol, p_filter_val: filterVal });
      return (lyPerf || []).map((p: any) => ({ entity_id: p.id, target_amount: parseNum(p.total) }));
    }
    return ids.length > 0 ? await fetchAll(supabase.from('sales_targets').select('*').eq('company_id', profile.company_id).eq('entity_type', entityType).eq('year', year).eq('month', month).in('entity_id', ids)) : [];
  };

  const initDashboard = async () => {
    if (!profile?.company_id) return;
    setIsLoading(true);
    try {
      const { data: wd } = await supabase.from('working_days_config').select('*').eq('company_id', profile.company_id).eq('year', year).eq('month', month).single();
      if (wd) setWorkingDays({ total: parseNum(wd.total_days), current: Math.min(parseNum(wd.total_days), 15) }); 

      const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
      const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd');
      
      let totalPerf = 0;
      if (isTypeMode) {
        const { data: cats } = await supabase.from('product_categories').select('id, name').eq('company_id', profile.company_id);
        const validCatIds = cats?.filter(c => c.name && c.name !== '미분류').map(c => c.id) || [];
        const { data: catPerf } = await supabase.rpc('get_group_perf_summary', { p_company_id: profile.company_id, p_start: startDate, p_end: endDate, p_group_type: 'category_id' });
        totalPerf = (catPerf || []).filter((p: any) => validCatIds.includes(p.id)).reduce((acc: number, p: any) => acc + parseNum(p.total), 0);
      } else {
        const { data: sumData } = await supabase.rpc('get_group_perf_summary', { p_company_id: profile.company_id, p_start: startDate, p_end: endDate, p_group_type: 'total' });
        totalPerf = parseNum(sumData?.[0]?.total || 0);
      }

      let targets: any[] = [];
      if (isYoyMode) {
        const lyStart = format(new Date(year - 1, month - 1, 1), 'yyyy-MM-dd');
        const lyEnd = format(new Date(year - 1, month, 0), 'yyyy-MM-dd');
        const { data: lyPerf } = await supabase.rpc('get_group_perf_summary', { p_company_id: profile.company_id, p_start: lyStart, p_end: lyEnd, p_group_type: 'total' });
        targets = [{ target_amount: parseNum(lyPerf?.[0]?.total || 0) }];
      } else {
        targets = await fetchAll(supabase.from('sales_targets')
          .select('target_amount')
          .eq('company_id', profile.company_id)
          .eq('entity_type', isTypeMode ? 'CATEGORY' : 'DIVISION')
          .eq('year', year)
          .eq('month', month));
      }

      const totalGoal = (targets || []).reduce((acc: any, t: any) => acc + parseNum(t.target_amount), 0);
      
      const progressLimit = workingDays.total > 0 ? (workingDays.current / workingDays.total) : 0;
      const expectedAtNow = totalGoal * progressLimit;
      const gap = totalPerf - expectedAtNow;

      setSummaryData({
        goal: formatValue(totalGoal),
        performance: formatValue(totalPerf),
        achievementRate: totalGoal > 0 ? ((totalPerf / totalGoal) * 100).toFixed(1) : '0',
        progressGap: (gap >= 0 ? '+' : '') + formatValue(gap),
        originalGoalVal: totalGoal,
        originalPerfVal: totalPerf
      });

      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      const monthMap = new Array(12).fill(0).map((_, i) => ({ month: `${i + 1}월`, performance: 0 }));
      
      if (isTypeMode) {
         const { data: cats } = await supabase.from('product_categories').select('id, name').eq('company_id', profile.company_id);
         const validCatIds = cats?.filter(c => c.name && c.name !== '미분류').map(c => c.id) || [];
         if (validCatIds.length > 0) {
             const yearPerf = await fetchAll(supabase.from('sales_records').select('amount, sales_date').eq('company_id', profile.company_id).gte('sales_date', yearStart).lte('sales_date', yearEnd).in('category_id', validCatIds));
             yearPerf.forEach(p => {
               const m = new Date(p.sales_date).getMonth();
               monthMap[m].performance += parseNum(p.amount);
             });
         }
      } else {
         const { data: yTrend } = await supabase.rpc('get_yearly_trend', { p_company_id: profile.company_id, p_year: year });
         (yTrend || []).forEach((t: any) => {
             if (t.month >= 1 && t.month <= 12) {
                 monthMap[t.month - 1].performance = parseNum(t.total);
             }
         });
      }

      setTrendData(monthMap.map(m => ({ ...m, performance: Number(formatValue(m.performance)) })));
    } catch (err) {
      console.error('Init Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshDrillDownData = async () => {
    if (!profile?.company_id) return;
    setIsLoading(true);
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd');
    const progressLimit = workingDays.total > 0 ? (workingDays.current / workingDays.total) : 0;
    
    try {
      let data: DashboardData[] = [];
      
      if (!isTypeMode) {
        if (currentLevel === 0) {
          const { data: divisions } = await supabase.from('sales_divisions').select('*').eq('company_id', profile.company_id).order('display_order', { ascending: true });
          const ids = (divisions || []).map(d => d.id);
          const targets = await fetchTargets('DIVISION', ids, 'division_id');
          
          const { data: perfData } = await supabase.rpc('get_group_perf_summary', { p_company_id: profile.company_id, p_start: startDate, p_end: endDate, p_group_type: 'division_id' });
          const perfMap = new Map((perfData || []).map((p: any) => [p.id, parseNum(p.total)]));

          data = (divisions || []).map(d => {
            const target = parseNum((targets || []).find((tg: any) => tg.entity_id === d.id)?.target_amount || 0);
            const divisionPerf = Number(perfMap.get(d.id) || 0);
            
            const achieve = target > 0 ? (divisionPerf / target) * 100 : 0;
            const expectedAtNow = target * progressLimit;
            const gap = divisionPerf - expectedAtNow;

            const dailyAvg = workingDays.current > 0 ? divisionPerf / workingDays.current : 0;
            const expected = dailyAvg * workingDays.total;
            const expectedAchieve = target > 0 ? (expected / target) * 100 : 0;
            const expectedGap = expected - target;

            return {
              id: d.id, name: d.name,
              goal: formatValue(target), performance: formatValue(divisionPerf), achieve: achieve.toFixed(1),
              gap: (gap >= 0 ? '+' : '') + formatValue(gap),
              expectedGoal: formatValue(target), expectedPerformance: formatValue(expected),
              expectedAchieve: expectedAchieve.toFixed(1), expectedGap: (expectedGap >= 0 ? '+' : '') + formatValue(expectedGap)
            };
          });
        } 
        else if (currentLevel === 1 && selectedIds.divisionId) {
          const { data: teams } = await supabase.from('sales_teams').select('*').eq('division_id', selectedIds.divisionId).order('display_order', { ascending: true });
          const ids = (teams || []).map(t => t.id);
          const targets = await fetchTargets('TEAM', ids, 'team_id');
          
          const { data: perfData } = await supabase.rpc('get_group_perf_summary', { p_company_id: profile.company_id, p_start: startDate, p_end: endDate, p_group_type: 'team_id' });
          const perfMap = new Map((perfData || []).map((p: any) => [p.id, parseNum(p.total)]));

          data = (teams || []).map(t => {
            const teamTarget = parseNum((targets || []).find((tg: any) => tg.entity_id === t.id)?.target_amount || 0);
            const teamPerf = Number(perfMap.get(t.id) || 0);
            const achieve = teamTarget > 0 ? (teamPerf / teamTarget) * 100 : 0;
            const expectedAtNow = teamTarget * progressLimit;
            const gap = teamPerf - expectedAtNow;

            const dailyAvg = workingDays.current > 0 ? teamPerf / workingDays.current : 0;
            const expected = dailyAvg * workingDays.total;
            const expectedAchieve = teamTarget > 0 ? (expected / teamTarget) * 100 : 0;
            const expectedGap = expected - teamTarget;

            return { id: t.id, name: t.name, goal: formatValue(teamTarget), performance: formatValue(teamPerf), achieve: achieve.toFixed(1), gap: (gap >= 0 ? '+' : '') + formatValue(gap), expectedGoal: formatValue(teamTarget), expectedPerformance: formatValue(expected), expectedAchieve: expectedAchieve.toFixed(1), expectedGap: (expectedGap >= 0 ? '+' : '') + formatValue(expectedGap) };
          });
        }
        else if (currentLevel === 2 && selectedIds.teamId) {
          const { data: staff } = await supabase.from('sales_staff').select('*').eq('team_id', selectedIds.teamId).order('display_order', { ascending: true });
          const ids = (staff || []).map(s => s.id);
          const targets = await fetchTargets('STAFF', ids, 'staff_id', 'team_id', selectedIds.teamId);
          
          const { data: perfData } = await supabase.rpc('get_group_perf_summary', { p_company_id: profile.company_id, p_start: startDate, p_end: endDate, p_group_type: 'staff_id', p_filter_col: 'team_id', p_filter_val: selectedIds.teamId });
          const perfMap = new Map((perfData || []).map((p: any) => [p.id, parseNum(p.total)]));

          data = (staff || []).map(s => {
            const staffTarget = parseNum((targets || []).find((tg: any) => tg.entity_id === s.id)?.target_amount || 0);
            const staffPerf = Number(perfMap.get(s.id) || 0);
            const achieve = staffTarget > 0 ? (staffPerf / staffTarget) * 100 : 0;
            const expectedAtNow = staffTarget * progressLimit;
            const gap = staffPerf - expectedAtNow;

            const dailyAvg = workingDays.current > 0 ? staffPerf / workingDays.current : 0;
            const expected = dailyAvg * workingDays.total;
            const expectedAchieve = staffTarget > 0 ? (expected / staffTarget) * 100 : 0;
            const expectedGap = expected - staffTarget;

            return { id: s.id, name: s.name, goal: formatValue(staffTarget), performance: formatValue(staffPerf), achieve: achieve.toFixed(1), gap: (gap >= 0 ? '+' : '') + formatValue(gap), expectedGoal: formatValue(staffTarget), expectedPerformance: formatValue(expected), expectedAchieve: expectedAchieve.toFixed(1), expectedGap: (expectedGap >= 0 ? '+' : '') + formatValue(expectedGap) };
          });
        }
        else if (currentLevel === 3 && selectedIds.staffId) {
          const { data: perfData } = await supabase.rpc('get_group_perf_summary', { p_company_id: profile.company_id, p_start: startDate, p_end: endDate, p_group_type: 'customer_name', p_filter_col: 'staff_id', p_filter_val: selectedIds.staffId });
          data = (perfData || []).map((p: any) => ({ id: p.id, name: p.id, goal: '-', performance: formatValue(parseNum(p.total)), achieve: '100', gap: '-' }));
        }
        else if (currentLevel === 4 && selectedIds.staffId && selectedIds.customerName) {
          const { data: perfData } = await supabase.rpc('get_group_perf_summary', { p_company_id: profile.company_id, p_start: startDate, p_end: endDate, p_group_type: 'item_name', p_filter_col: 'staff_id', p_filter_val: selectedIds.staffId, p_filter_col2: 'customer_name', p_filter_val2: selectedIds.customerName });
          data = (perfData || []).map((p: any) => ({ id: p.id, name: p.id, goal: '-', performance: formatValue(parseNum(p.total)), achieve: '100', gap: '-' }));
        }
      } else {
        // --- TYPE BASED MODE ---
        if (currentLevel === 0) {
          const { data: cats } = await supabase.from('product_categories').select('*').eq('company_id', profile.company_id).order('display_order', { ascending: true });
          const ids = (cats || []).map(c => c.id);
          const targets = await fetchTargets('CATEGORY', ids, 'category_id');
          
          const { data: perfData } = await supabase.rpc('get_group_perf_summary', { p_company_id: profile.company_id, p_start: startDate, p_end: endDate, p_group_type: 'category_id' });
          const perfMap = new Map((perfData || []).map((p: any) => [p.id, parseNum(p.total)]));

          data = (cats || []).filter(c => c.name && c.name !== '미분류').map(c => {
            const target = parseNum((targets || []).find((tg: any) => tg.entity_id === c.id)?.target_amount || 0);
            const catPerf = Number(perfMap.get(c.id) || 0);
            
            const achieve = target > 0 ? (catPerf / target) * 100 : 0;
            const expectedAtNow = target * progressLimit;
            const gap = catPerf - expectedAtNow;

            const dailyAvg = workingDays.current > 0 ? catPerf / workingDays.current : 0;
            const expected = dailyAvg * workingDays.total;
            const expectedAchieve = target > 0 ? (expected / target) * 100 : 0;
            const expectedGap = expected - target;

            return { id: c.id, name: c.name, goal: formatValue(target), performance: formatValue(catPerf), achieve: achieve.toFixed(1), gap: (gap >= 0 ? '+' : '') + formatValue(gap), expectedGoal: formatValue(target), expectedPerformance: formatValue(expected), expectedAchieve: expectedAchieve.toFixed(1), expectedGap: (expectedGap >= 0 ? '+' : '') + formatValue(expectedGap) };
          });
        }
        else if (currentLevel === 1 && selectedIds.categoryId) {
          const { data: perfData } = await supabase.rpc('get_group_perf_summary', { p_company_id: profile.company_id, p_start: startDate, p_end: endDate, p_group_type: 'staff_id', p_filter_col: 'category_id', p_filter_val: selectedIds.categoryId });
          const { data: staffList } = await supabase.from('sales_staff').select('id, name').order('display_order', { ascending: true });
          
          const perfMap = new Map((perfData || []).map((p: any) => [p.id, parseNum(p.total)]));
          data = (staffList || []).filter(s => perfMap.has(s.id)).map(s => ({ id: s.id, name: s.name, goal: '-', performance: formatValue(Number(perfMap.get(s.id) || 0)), achieve: '100', gap: '-' }));
        }
        else if (currentLevel === 2 && selectedIds.staffId && selectedIds.categoryId) {
          const { data: perfData } = await supabase.rpc('get_group_perf_summary', { p_company_id: profile.company_id, p_start: startDate, p_end: endDate, p_group_type: 'customer_name', p_filter_col: 'staff_id', p_filter_val: selectedIds.staffId, p_filter_col2: 'category_id', p_filter_val2: selectedIds.categoryId });
          data = (perfData || []).map((p: any) => ({ id: p.id, name: p.id, goal: '-', performance: formatValue(parseNum(p.total)), achieve: '100', gap: '-' }));
        }
        else if (currentLevel === 3 && selectedIds.staffId && selectedIds.categoryId && selectedIds.customerName) {
            const { data: perf } = await supabase.from('sales_records').select('amount, item_name').eq('staff_id', selectedIds.staffId).eq('category_id', selectedIds.categoryId).eq('customer_name', selectedIds.customerName).gte('sales_date', startDate).lte('sales_date', endDate);
            const map = new Map<string, number>();
            (perf || []).forEach(p => map.set(p.item_name, (map.get(p.item_name) || 0) + parseNum(p.amount)));
            data = Array.from(map.entries()).map(([name, amount]) => ({ id: name, name, goal: '-', performance: formatValue(amount), achieve: '100', gap: '-' }));
        }
      }

      setDisplayData(data);
    } catch (err) {
      console.error('Refresh Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getLabelByLevel = (level: number) => {
    if (isTypeMode) {
        switch(level) {
            case 0: return '제품유형';
            case 1: return '영업사원';
            case 2: return '거래처';
            case 3: return '품목';
            default: return '제품유형';
        }
    }
    switch(level) {
      case 0: return '사업부';
      case 1: return '영업팀';
      case 2: return '영업사원';
      case 3: return '거래처';
      case 4: return '품목';
      default: return '사업부';
    }
  };

  const columns = [
    { key: 'name', label: getLabelByLevel(currentLevel), width: '30%' },
    { key: 'goal', label: isYoyMode ? '전년 동월' : '목표', width: '15%' },
    { key: 'performance', label: '실적', width: '15%' },
    { key: 'achieve', label: isYoyMode ? '전년대비(% )' : '달성률', width: '15%' },
    { key: 'gap', label: isYoyMode ? '전년대비(액)' : '진도율 GAP', width: '15%' },
  ];

  const handleRowClick = (id: string, name: string) => {
    const maxLevel = isTypeMode ? 3 : 4;
    if (currentLevel < maxLevel) {
      setBreadcrumbs([...breadcrumbs, { id, name, level: currentLevel }]);
      if (isTypeMode) {
          if (currentLevel === 0) setSelectedIds({ ...selectedIds, categoryId: id });
          else if (currentLevel === 1) setSelectedIds({ ...selectedIds, staffId: id });
          else if (currentLevel === 2) setSelectedIds({ ...selectedIds, customerName: name });
      } else {
          if (currentLevel === 0) setSelectedIds({ ...selectedIds, divisionId: id });
          else if (currentLevel === 1) setSelectedIds({ ...selectedIds, teamId: id });
          else if (currentLevel === 2) setSelectedIds({ ...selectedIds, staffId: id });
          else if (currentLevel === 3) setSelectedIds({ ...selectedIds, customerName: name });
      }
      setCurrentLevel(currentLevel + 1);
    }
  };

  const handleBreadcrumbClick = (idx: number) => {
    if (idx === -1) { setBreadcrumbs([]); setSelectedIds({}); setCurrentLevel(0); } 
    else {
      const targetBcs = breadcrumbs.slice(0, idx + 1);
      setBreadcrumbs(targetBcs);
      setCurrentLevel(idx + 1);
      const newIds: any = {};
      if (isTypeMode) {
          if (idx >= 0) newIds.categoryId = breadcrumbs[0].id;
          if (idx >= 1) newIds.staffId = breadcrumbs[1].id;
          if (idx >= 2) newIds.customerName = breadcrumbs[2].name;
      } else {
          if (idx >= 0) newIds.divisionId = breadcrumbs[0].id;
          if (idx >= 1) newIds.teamId = breadcrumbs[1].id;
          if (idx >= 2) newIds.staffId = breadcrumbs[2].id;
          if (idx >= 3) newIds.customerName = breadcrumbs[3].name;
      }
      setSelectedIds(newIds);
    }
  };

  return (
    <div className={`${styles.page} fade-in`}>
      <header className={styles.topControl}>
        <div className={styles.titleArea}>
          <h1>Dashboard</h1>
          <p>{year}년 {month}월 분석 리포트</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className={styles.periodSelector}>
            <select 
              className={styles.dateSelect} 
              value={year} 
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className={styles.dateLabel}>년</span>
            <select 
              className={styles.dateSelect} 
              value={month} 
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className={styles.dateLabel}>월</span>
          </div>

          <div className={styles.modeSwitcher}>
            <button 
              className={`${styles.modeBtn} ${!isTypeMode ? styles.activeMode : ''}`}
              onClick={() => navigate('/team/goal')}
            >
              <Building2 size={16} /> <span>조직별 실적</span>
            </button>
            <button 
              className={`${styles.modeBtn} ${isTypeMode ? styles.activeMode : ''}`}
              onClick={() => navigate('/type/goal')}
            >
              <Layers size={16} /> <span>제품유형별</span>
            </button>
          </div>
        </div>
      </header>

      <DashboardHeader 
        title={`${isTypeMode ? '제품유형별' : '사업부별'} 분석 현황`}
        subtitle="실시간 매출 달성률 및 실적 분석"
        totalWorkingDays={workingDays.total}
        currentWorkingDays={workingDays.current}
        isExpectedClosingOn={isExpectedClosingOn}
        onToggleExpectedClosing={() => setIsExpectedClosingOn(!isExpectedClosingOn)}
        unit={unit}
        onUnitChange={setUnit}
      />

      <div className={styles.dashboardGrid}>
        <div className={`${styles.chartCard} ${styles.fullWidth}`}>
          <div className={styles.chartHeader}>
            <div className={styles.titleGroup}>
              <div className={styles.titleIcon}><TrendingUp size={24} /></div>
              <div>
                <h3 className={styles.chartTitle}>{isTypeMode ? '유형별 분석 추이' : '사업부별 분석 추이'}</h3>
                <p className={styles.chartUnit}>{year}년 월별 누적 실적</p>
              </div>
            </div>
            <div className={styles.unitBadge}>단위: {getUnitName()}</div>
          </div>
          
          <div className={styles.chartWrapper} style={{ opacity: isLoading ? 0.3 : 1, transition: '0.2s', position: 'relative' }}>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorIndigo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: 'var(--text-dim)', fontSize: 12, fontWeight: 700}} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: 'var(--text-dim)', fontSize: 12, fontWeight: 700}} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: 'var(--radius-lg)', 
                    border: '1px solid var(--border-subtle)', 
                    boxShadow: 'var(--shadow-xl)',
                    fontWeight: 700
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="performance" 
                  stroke="var(--primary)" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorIndigo)" 
                  name="실적" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
            {isLoading && (
               <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 'bold' }}>
                 로딩중...
               </div>
            )}
          </div>
        </div>

        <div className={styles.fullWidth}>
          <SummaryGrid 
            goal={summaryData.goal}
            performance={isExpectedClosingOn ? formatValue((summaryData.originalPerfVal / (workingDays.current > 0 ? workingDays.current : 1)) * workingDays.total) : summaryData.performance}
            achievementRate={isExpectedClosingOn 
              ? (((summaryData.originalPerfVal / (workingDays.current > 0 ? workingDays.current : 1)) * workingDays.total) / (summaryData.originalGoalVal || 1) * 100).toFixed(1)
              : summaryData.achievementRate
            }
            progressGap={isExpectedClosingOn
              ? ((((summaryData.originalPerfVal / (workingDays.current > 0 ? workingDays.current : 1)) * workingDays.total) - summaryData.originalGoalVal) >= 0 ? '+' : '') + 
                 formatValue((((summaryData.originalPerfVal / (workingDays.current > 0 ? workingDays.current : 1)) * workingDays.total) - summaryData.originalGoalVal))
              : summaryData.progressGap
            }
            unit={getUnitName()}
            isExpected={isExpectedClosingOn}
            isWarning={isExpectedClosingOn && ((summaryData.originalPerfVal / (workingDays.current > 0 ? workingDays.current : 1)) * workingDays.total) < summaryData.originalGoalVal}
            labelOverrides={isYoyMode ? { goal: '전년 동월', achievementRate: '전년대비', progressGap: '전년대비(액)' } : undefined}
          />
        </div>

        <div className={styles.fullWidth} style={{ opacity: isLoading ? 0.3 : 1, transition: '0.2s', position: 'relative' }}>
          <DrillDownTable 
            breadcrumbs={breadcrumbs}
            onBreadcrumbClick={handleBreadcrumbClick}
            data={displayData}
            onRowClick={handleRowClick}
            columns={columns}
            isExpectedClosingOn={isExpectedClosingOn}
          />
          {isLoading && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 'bold' }}>
              동기화중...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
