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

  const [year] = useState(new Date().getFullYear());
  const [month] = useState(new Date().getMonth() + 1);
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

  const initDashboard = async () => {
    if (!profile?.company_id) return;
    try {
      const { data: wd } = await supabase.from('working_days_config').select('*').eq('company_id', profile.company_id).eq('year', year).eq('month', month).single();
      if (wd) setWorkingDays({ total: wd.total_days, current: Math.min(wd.total_days, 15) }); 

      const startDate = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
      const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd');
      
      const { data: records } = await supabase.from('sales_records').select('amount, category_id').eq('company_id', profile.company_id).gte('sales_date', startDate).lte('sales_date', endDate);
      
      let filteredRecords = records || [];
      if (isTypeMode) {
        const { data: cats } = await supabase.from('product_categories').select('id, name').eq('company_id', profile.company_id);
        const validCatIds = cats?.filter(c => c.name && c.name !== '미분류').map(c => c.id) || [];
        filteredRecords = filteredRecords.filter(r => r.category_id && validCatIds.includes(r.category_id));
      }

      const { data: targets } = await supabase.from('sales_targets')
        .select('target_amount')
        .eq('company_id', profile.company_id)
        .eq('entity_type', isTypeMode ? 'CATEGORY' : 'DIVISION')
        .eq('year', year)
        .eq('month', month);

      const totalPerf = filteredRecords.reduce((acc, r) => acc + Number(r.amount), 0);
      const totalGoal = (targets || []).reduce((acc, t) => acc + Number(t.target_amount), 0);
      
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
      const { data: yearPerf } = await supabase.from('sales_records').select('amount, sales_date, category_id').eq('company_id', profile.company_id).gte('sales_date', yearStart).lte('sales_date', yearEnd);
      
      let trendRecs = yearPerf || [];
      if (isTypeMode) {
         const { data: cats } = await supabase.from('product_categories').select('id, name').eq('company_id', profile.company_id);
         const validCatIds = cats?.filter(c => c.name && c.name !== '미분류').map(c => c.id) || [];
         trendRecs = trendRecs.filter(r => r.category_id && validCatIds.includes(r.category_id));
      }

      const monthMap = new Array(12).fill(0).map((_, i) => ({ month: `${i + 1}월`, performance: 0 }));
      trendRecs.forEach(p => {
        const m = new Date(p.sales_date).getMonth();
        monthMap[m].performance += Number(p.amount);
      });

      setTrendData(monthMap.map(m => ({ ...m, performance: Number(formatValue(m.performance)) })));
    } catch (err) {
      console.error('Init Error:', err);
    }
  };

  const refreshDrillDownData = async () => {
    if (!profile?.company_id) return;
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = format(new Date(year, month, 0), 'yyyy-MM-dd');
    const progressLimit = workingDays.total > 0 ? (workingDays.current / workingDays.total) : 0;
    
    try {
      let data: DashboardData[] = [];
      
      if (!isTypeMode) {
        if (currentLevel === 0) {
          const { data: divisions } = await supabase.from('sales_divisions').select('*').eq('company_id', profile.company_id).order('display_order', { ascending: true });
          const { data: targets } = await supabase.from('sales_targets').select('*').eq('company_id', profile.company_id).eq('entity_type', 'DIVISION').eq('year', year).eq('month', month);
          const { data: perf } = await supabase.from('sales_records').select('amount, team_id').eq('company_id', profile.company_id).gte('sales_date', startDate).lte('sales_date', endDate);
          const { data: teamList } = await supabase.from('sales_teams').select('id, division_id').eq('company_id', profile.company_id);

          data = (divisions || []).map(d => {
            const target = (targets || []).find(tg => tg.entity_id === d.id)?.target_amount || 0;
            const divTeamIds = (teamList || []).filter(t => t.division_id === d.id).map(t => t.id);
            const divisionPerf = (perf || []).filter(p => divTeamIds.includes(p.team_id || '')).reduce((acc, p) => acc + Number(p.amount), 0);
            
            const achieve = target > 0 ? (divisionPerf / Number(target)) * 100 : 0;
            const expectedAtNow = Number(target) * progressLimit;
            const gap = divisionPerf - expectedAtNow;

            const dailyAvg = workingDays.current > 0 ? divisionPerf / workingDays.current : 0;
            const expected = dailyAvg * workingDays.total;
            const expectedAchieve = target > 0 ? (expected / Number(target)) * 100 : 0;
            const expectedGap = expected - Number(target);

            return {
              id: d.id, name: d.name,
              goal: formatValue(Number(target)), performance: formatValue(divisionPerf), achieve: achieve.toFixed(1),
              gap: (gap >= 0 ? '+' : '') + formatValue(gap),
              expectedGoal: formatValue(Number(target)), expectedPerformance: formatValue(expected),
              expectedAchieve: expectedAchieve.toFixed(1), expectedGap: (expectedGap >= 0 ? '+' : '') + formatValue(expectedGap)
            };
          });
        } 
        else if (currentLevel === 1 && selectedIds.divisionId) {
          const { data: teams } = await supabase.from('sales_teams').select('*').eq('division_id', selectedIds.divisionId).order('display_order', { ascending: true });
          const { data: targets } = await supabase.from('sales_targets').select('*').eq('company_id', profile.company_id).eq('entity_type', 'TEAM').eq('year', year).eq('month', month);
          const { data: perf } = await supabase.from('sales_records').select('amount, team_id').eq('company_id', profile.company_id).gte('sales_date', startDate).lte('sales_date', endDate);

          data = (teams || []).map(t => {
            const teamTarget = (targets || []).find(tg => tg.entity_id === t.id)?.target_amount || 0;
            const teamPerf = (perf || []).filter(p => p.team_id === t.id).reduce((acc, p) => acc + Number(p.amount), 0);
            const achieve = teamTarget > 0 ? (teamPerf / Number(teamTarget)) * 100 : 0;
            const expectedAtNow = Number(teamTarget) * progressLimit;
            const gap = teamPerf - expectedAtNow;

            const dailyAvg = workingDays.current > 0 ? teamPerf / workingDays.current : 0;
            const expected = dailyAvg * workingDays.total;
            const expectedAchieve = teamTarget > 0 ? (expected / Number(teamTarget)) * 100 : 0;
            const expectedGap = expected - Number(teamTarget);

            return { id: t.id, name: t.name, goal: formatValue(Number(teamTarget)), performance: formatValue(teamPerf), achieve: achieve.toFixed(1), gap: (gap >= 0 ? '+' : '') + formatValue(gap), expectedGoal: formatValue(Number(teamTarget)), expectedPerformance: formatValue(expected), expectedAchieve: expectedAchieve.toFixed(1), expectedGap: (expectedGap >= 0 ? '+' : '') + formatValue(expectedGap) };
          });
        }
        else if (currentLevel === 2 && selectedIds.teamId) {
          const { data: staff } = await supabase.from('sales_staff').select('*').eq('team_id', selectedIds.teamId).order('display_order', { ascending: true });
          const { data: targets } = await supabase.from('sales_targets').select('*').eq('company_id', profile.company_id).eq('entity_type', 'STAFF').eq('year', year).eq('month', month);
          const { data: perf } = await supabase.from('sales_records').select('*').eq('company_id', profile.company_id).gte('sales_date', startDate).lte('sales_date', endDate);

          data = (staff || []).map(s => {
            const staffTarget = (targets || []).find(tg => tg.entity_id === s.id)?.target_amount || 0;
            const staffPerf = (perf || []).filter(p => p.staff_id === s.id).reduce((acc, p) => acc + Number(p.amount), 0);
            const achieve = staffTarget > 0 ? (staffPerf / Number(staffTarget)) * 100 : 0;
            const expectedAtNow = Number(staffTarget) * progressLimit;
            const gap = staffPerf - expectedAtNow;

            const dailyAvg = workingDays.current > 0 ? staffPerf / workingDays.current : 0;
            const expected = dailyAvg * workingDays.total;
            const expectedAchieve = staffTarget > 0 ? (expected / Number(staffTarget)) * 100 : 0;
            const expectedGap = expected - Number(staffTarget);

            return { id: s.id, name: s.name, goal: formatValue(Number(staffTarget)), performance: formatValue(staffPerf), achieve: achieve.toFixed(1), gap: (gap >= 0 ? '+' : '') + formatValue(gap), expectedGoal: formatValue(Number(staffTarget)), expectedPerformance: formatValue(expected), expectedAchieve: expectedAchieve.toFixed(1), expectedGap: (expectedGap >= 0 ? '+' : '') + formatValue(expectedGap) };
          });
        }
        else if (currentLevel === 3 && selectedIds.staffId) {
          const { data: perf } = await supabase.from('sales_records').select('*').eq('staff_id', selectedIds.staffId).gte('sales_date', startDate).lte('sales_date', endDate);
          const map = new Map<string, number>();
          (perf || []).forEach(p => map.set(p.customer_name, (map.get(p.customer_name) || 0) + Number(p.amount)));
          data = Array.from(map.entries()).map(([name, amount]) => ({ id: name, name, goal: '-', performance: formatValue(amount), achieve: '100', gap: '-' }));
        }
        else if (currentLevel === 4 && selectedIds.staffId && selectedIds.customerName) {
          const { data: perf } = await supabase.from('sales_records').select('*').eq('staff_id', selectedIds.staffId).eq('customer_name', selectedIds.customerName).gte('sales_date', startDate).lte('sales_date', endDate);
          const map = new Map<string, number>();
          (perf || []).forEach(p => map.set(p.item_name, (map.get(p.item_name) || 0) + Number(p.amount)));
          data = Array.from(map.entries()).map(([name, amount]) => ({ id: name, name, goal: '-', performance: formatValue(amount), achieve: '100', gap: '-' }));
        }
      } else {
        // --- TYPE BASED MODE ---
        if (currentLevel === 0) {
          const { data: cats } = await supabase.from('product_categories').select('*').eq('company_id', profile.company_id).order('display_order', { ascending: true });
          const { data: targets } = await supabase.from('sales_targets').select('*').eq('company_id', profile.company_id).eq('entity_type', 'CATEGORY').eq('year', year).eq('month', month);
          const { data: perf } = await supabase.from('sales_records').select('amount, category_id').eq('company_id', profile.company_id).gte('sales_date', startDate).lte('sales_date', endDate);

          data = (cats || []).filter(c => c.name && c.name !== '미분류').map(c => {
            const target = (targets || []).find(tg => tg.entity_id === c.id)?.target_amount || 0;
            const catPerf = (perf || []).filter(p => p.category_id === c.id).reduce((acc, p) => acc + Number(p.amount), 0);
            
            const achieve = target > 0 ? (catPerf / Number(target)) * 100 : 0;
            const expectedAtNow = Number(target) * progressLimit;
            const gap = catPerf - expectedAtNow;

            const dailyAvg = workingDays.current > 0 ? catPerf / workingDays.current : 0;
            const expected = dailyAvg * workingDays.total;
            const expectedAchieve = target > 0 ? (expected / Number(target)) * 100 : 0;
            const expectedGap = expected - Number(target);

            return { id: c.id, name: c.name, goal: formatValue(Number(target)), performance: formatValue(catPerf), achieve: achieve.toFixed(1), gap: (gap >= 0 ? '+' : '') + formatValue(gap), expectedGoal: formatValue(Number(target)), expectedPerformance: formatValue(expected), expectedAchieve: expectedAchieve.toFixed(1), expectedGap: (expectedGap >= 0 ? '+' : '') + formatValue(expectedGap) };
          });
        }
        else if (currentLevel === 1 && selectedIds.categoryId) {
          const { data: perf } = await supabase.from('sales_records').select('amount, staff_id').eq('category_id', selectedIds.categoryId).gte('sales_date', startDate).lte('sales_date', endDate);
          const { data: staffList } = await supabase.from('sales_staff').select('id, name').order('display_order', { ascending: true });
          const map = new Map<string, number>();
          (perf || []).forEach(p => map.set(p.staff_id, (map.get(p.staff_id) || 0) + Number(p.amount)));
          data = (staffList || []).filter(s => map.has(s.id)).map(s => ({ id: s.id, name: s.name, goal: '-', performance: formatValue(map.get(s.id) || 0), achieve: '100', gap: '-' }));
        }
        else if (currentLevel === 2 && selectedIds.staffId && selectedIds.categoryId) {
          const { data: perf } = await supabase.from('sales_records').select('amount, customer_name').eq('staff_id', selectedIds.staffId).eq('category_id', selectedIds.categoryId).gte('sales_date', startDate).lte('sales_date', endDate);
          const map = new Map<string, number>();
          (perf || []).forEach(p => map.set(p.customer_name, (map.get(p.customer_name) || 0) + Number(p.amount)));
          data = Array.from(map.entries()).map(([name, amount]) => ({ id: name, name, goal: '-', performance: formatValue(amount), achieve: '100', gap: '-' }));
        }
        else if (currentLevel === 3 && selectedIds.staffId && selectedIds.categoryId && selectedIds.customerName) {
            const { data: perf } = await supabase.from('sales_records').select('amount, item_name').eq('staff_id', selectedIds.staffId).eq('category_id', selectedIds.categoryId).eq('customer_name', selectedIds.customerName).gte('sales_date', startDate).lte('sales_date', endDate);
            const map = new Map<string, number>();
            (perf || []).forEach(p => map.set(p.item_name, (map.get(p.item_name) || 0) + Number(p.amount)));
            data = Array.from(map.entries()).map(([name, amount]) => ({ id: name, name, goal: '-', performance: formatValue(amount), achieve: '100', gap: '-' }));
        }
      }

      setDisplayData(data);
    } catch (err) {
      console.error('Refresh Error:', err);
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
    { key: 'goal', label: '목표', width: '15%' },
    { key: 'performance', label: '실적', width: '15%' },
    { key: 'achieve', label: '달성률', width: '15%' },
    { key: 'gap', label: '진도율 GAP', width: '15%' },
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
          
          <div className={styles.chartWrapper}>
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
              ? ((((summaryData.originalPerfVal / (workingDays.current > 0 ? workingDays.current : 1)) * workingDays.total) - summaryData.originalGoalVal) >= 0 ? '+' : '-') + 
                 formatValue(Math.abs(((summaryData.originalPerfVal / (workingDays.current > 0 ? workingDays.current : 1)) * workingDays.total) - summaryData.originalGoalVal))
              : summaryData.progressGap
            }
            unit={getUnitName()}
            isExpected={isExpectedClosingOn}
            isWarning={isExpectedClosingOn && ((summaryData.originalPerfVal / (workingDays.current > 0 ? workingDays.current : 1)) * workingDays.total) < summaryData.originalGoalVal}
          />
        </div>

        <div className={styles.fullWidth}>
          <DrillDownTable 
            breadcrumbs={breadcrumbs}
            onBreadcrumbClick={handleBreadcrumbClick}
            data={displayData}
            onRowClick={handleRowClick}
            columns={columns}
            isExpectedClosingOn={isExpectedClosingOn}
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
