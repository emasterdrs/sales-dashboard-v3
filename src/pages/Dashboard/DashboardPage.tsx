import React, { useState, useEffect, useMemo } from 'react';
import DashboardHeader from '../../components/Dashboard/DashboardHeader';
import SummaryGrid from '../../components/Dashboard/SummaryGrid';
import DrillDownTable from '../../components/Dashboard/DrillDownTable';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './DashboardPage.module.css';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { SalesCalendarService } from '../../services/SalesCalendarService';
import { parseISO } from 'date-fns';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area
} from 'recharts';

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
}

const DashboardPage: React.FC = () => {
  const { profile, effectiveRole, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isExpectedClosingOn, setIsExpectedClosingOn] = useState(false);
  const [unit, setUnit] = useState<'won' | 'million' | 'billion'>('billion');
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string; level: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0); // 0: Team List, 1: Staff List, 2: Client List, 3: Item List
  const [selectedIds, setSelectedIds] = useState<{ teamId?: string; staffId?: string; customerName?: string; categoryId?: string }>({});

  const [workingDays, setWorkingDays] = useState({ total: 21, current: 13 });
  const [summaryData, setSummaryData] = useState({ 
    goal: '0.0', 
    performance: '0.0', 
    achievementRate: '0.0', 
    progressGap: '0.0',
    originalGoalVal: 0,
    originalPerfVal: 0 
  });
  const [displayData, setDisplayData] = useState<DashboardData[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);

  const now = useMemo(() => new Date(), []);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Helper for unit conversion
  const formatValue = (val: number) => {
    if (unit === 'billion') return (val / 100000000).toFixed(1);
    if (unit === 'million') return (val / 1000000).toFixed(0);
    return val.toLocaleString();
  };

  const getUnitName = () => {
    if (unit === 'billion') return '억';
    if (unit === 'million') return '백만';
    return '원';
  };

  // Redirect Super Admin if not in simulation mode
  useEffect(() => {
    if (!authLoading && effectiveRole === 'SUPER_ADMIN') {
      navigate('/mng-voda-8a2b', { replace: true });
    }
  }, [authLoading, effectiveRole, navigate]);

  useEffect(() => {
    if (authLoading || effectiveRole === 'SUPER_ADMIN') return;
    if (!profile?.company_id) return;
    fetchDashboardInitialData();
  }, [profile?.company_id, unit, authLoading, effectiveRole]);

  useEffect(() => {
    if (authLoading || effectiveRole === 'SUPER_ADMIN') return;
    refreshDrillDownData();
  }, [currentLevel, selectedIds, authLoading, effectiveRole]);


  const fetchDashboardInitialData = async () => {
    try {
      // 1. Working Days
      const { data: wdData } = await supabase
        .from('working_days_config')
        .select('holidays')
        .eq('company_id', profile?.company_id)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      let holidays: Date[] = [];
      if (wdData && wdData.holidays) {
        holidays = (wdData.holidays as string[]).map(h => parseISO(h));
      }
      const totalDays = SalesCalendarService.getTotalWorkingDays(year, month, holidays);
      const currentDays = SalesCalendarService.getElapsedWorkingDays(year, month, now, holidays);
      setWorkingDays({ total: totalDays, current: currentDays });

      // 2. Summary (Company Total)
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;

      const [targetRes, perfRes] = await Promise.all([
        supabase.from('sales_targets').select('target_amount').eq('company_id', profile?.company_id).eq('entity_type', 'TEAM').eq('year', year).eq('month', month),
        supabase.from('sales_records').select('amount').eq('company_id', profile?.company_id).gte('sales_date', startDate).lte('sales_date', endDate)
      ]);
      
      const totalGoal = (targetRes.data || []).reduce((acc, t) => acc + Number(t.target_amount), 0);
      const totalPerf = (perfRes.data || []).reduce((acc, p) => acc + Number(p.amount), 0);
      
      const achievement = totalGoal > 0 ? (totalPerf / totalGoal) * 100 : 0;
      
      // Progress Gap: Performance - (Target * (Current Elapsed Days / Total Days))
      const progressRate = totalDays > 0 ? (currentDays / totalDays) : 0;
      const expectedGoalAtPoint = totalGoal * progressRate;
      const gapValue = totalPerf - expectedGoalAtPoint;

      setSummaryData({
        goal: formatValue(totalGoal),
        performance: formatValue(totalPerf),
        achievementRate: achievement.toFixed(1),
        progressGap: (gapValue >= 0 ? '+' : '') + formatValue(gapValue),
        originalGoalVal: totalGoal,
        originalPerfVal: totalPerf
      });

      // 3. Monthly Trend Data (This Year)
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      
      const { data: yearPerf } = await supabase
        .from('sales_records')
        .select('amount, sales_date')
        .eq('company_id', profile?.company_id)
        .gte('sales_date', yearStart)
        .lte('sales_date', yearEnd);

      const monthMap = new Array(12).fill(0).map((_, i) => ({
        month: `${i + 1}월`,
        performance: 0,
        goal: 0 // In a real app, fetch monthly targets too
      }));

      (yearPerf || []).forEach(p => {
        const m = new Date(p.sales_date).getMonth();
        monthMap[m].performance += Number(p.amount);
      });

      setTrendData(monthMap.map(m => ({
        ...m,
        performance: Number(formatValue(m.performance))
      })));

    } catch (err) {
      console.error('Data Init Error:', err);
    }
  };

  const refreshDrillDownData = async () => {
    if (!profile?.company_id) return;
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const progressLimit = workingDays.total > 0 ? (workingDays.current / workingDays.total) : 0;
    const isTypeMode = location.pathname.includes('type');
    
    try {
      let data: DashboardData[] = [];
      
      if (currentLevel === 0) {
        if (isTypeMode) {
          // Level 0: Product Categories
          const { data: categories } = await supabase.from('product_categories').select('*').eq('company_id', profile.company_id).is('parent_id', null);
          const { data: perf } = await supabase.from('sales_records').select('amount, category_id').eq('company_id', profile.company_id).gte('sales_date', startDate);
          
          data = (categories || []).map(cat => {
            const catPerf = (perf || []).filter(p => p.category_id === cat.id).reduce((acc, p) => acc + Number(p.amount), 0);
            return {
              id: cat.id,
              name: cat.name,
              goal: '-',
              performance: formatValue(catPerf),
              achieve: '0.0',
              gap: '0.0',
              expectedGoal: '-',
              expectedPerformance: formatValue(catPerf), // Logic can be more complex
              expectedAchieve: '0.0',
              expectedGap: '0.0'
            };
          });
        } else {
          // Level 0: Teams (Original logic)
          const { data: teams } = await supabase.from('sales_teams').select('*').eq('company_id', profile.company_id).order('display_order', { ascending: true });
          const { data: targets } = await supabase.from('sales_targets').select('*').eq('company_id', profile.company_id).eq('entity_type', 'TEAM').eq('year', year).eq('month', month);
          const { data: perf } = await supabase.from('sales_records').select('amount, team_id').eq('company_id', profile.company_id).gte('sales_date', startDate);

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

            return {
              id: t.id,
              name: t.name,
              goal: formatValue(Number(teamTarget)),
              performance: formatValue(teamPerf),
              achieve: achieve.toFixed(1),
              gap: (gap >= 0 ? '+' : '') + formatValue(gap),
              expectedGoal: formatValue(Number(teamTarget)),
              expectedPerformance: formatValue(expected),
              expectedAchieve: expectedAchieve.toFixed(1),
              expectedGap: (expectedGap >= 0 ? '+' : '') + formatValue(expectedGap)
            };
          });
        }
      } 
      else if (currentLevel === 1 && selectedIds.teamId) {
        // Level 1: Staff in Team
        const { data: staff } = await supabase.from('sales_staff').select('*').eq('team_id', selectedIds.teamId).order('display_order', { ascending: true });
        const { data: targets } = await supabase.from('sales_targets').select('*').eq('company_id', profile.company_id).eq('entity_type', 'STAFF').eq('year', year).eq('month', month);
        const { data: perf } = await supabase.from('sales_records').select('*').eq('company_id', profile.company_id).gte('sales_date', startDate);

        data = (staff || []).map(s => {
          const staffTarget = (targets || []).find(tg => tg.entity_id === s.id)?.target_amount || 0;
          const staffPerf = (perf || []).filter(p => p.staff_id === s.id).reduce((acc, p) => acc + Number(p.amount), 0);
          const achieve = staffTarget > 0 ? (staffPerf / Number(staffTarget)) * 100 : 0;

          // Gap calculation for row
          const expectedAtNow = Number(staffTarget) * progressLimit;
          const gap = staffPerf - expectedAtNow;

          // Expected Closing Logic
          const dailyAvg = workingDays.current > 0 ? staffPerf / workingDays.current : 0;
          const expected = dailyAvg * workingDays.total;
          const expectedAchieve = staffTarget > 0 ? (expected / Number(staffTarget)) * 100 : 0;
          const expectedGap = expected - Number(staffTarget);

          return {
            id: s.id,
            name: s.name,
            goal: formatValue(Number(staffTarget)),
            performance: formatValue(staffPerf),
            achieve: achieve.toFixed(1),
            gap: (gap >= 0 ? '+' : '') + formatValue(gap),
            expectedGoal: formatValue(Number(staffTarget)),
            expectedPerformance: formatValue(expected),
            expectedAchieve: expectedAchieve.toFixed(1),
            expectedGap: (expectedGap >= 0 ? '+' : '') + formatValue(expectedGap)
          };
        });
      }
      else if (currentLevel === 2 && selectedIds.staffId) {
        // Level 2: Customers for Staff
        const { data: perf } = await supabase.from('sales_records').select('*').eq('staff_id', selectedIds.staffId).gte('sales_date', startDate);
        
        const customerMap = new Map<string, number>();
        (perf || []).forEach(p => {
          const current = customerMap.get(p.customer_name) || 0;
          customerMap.set(p.customer_name, current + Number(p.amount));
        });

        data = Array.from(customerMap.entries()).map(([name, amount]) => ({
          id: name,
          name: name,
          goal: '-',
          performance: formatValue(amount),
          achieve: '100',
          gap: '-'
        }));
      }
      else if (currentLevel === 3 && selectedIds.staffId && selectedIds.customerName) {
        // Level 3: Items for Customer/Staff
        const { data: perf } = await supabase.from('sales_records').select('*').eq('staff_id', selectedIds.staffId).eq('customer_name', selectedIds.customerName).gte('sales_date', startDate);
        
        const itemMap = new Map<string, number>();
        (perf || []).forEach(p => {
          const current = itemMap.get(p.item_name) || 0;
          itemMap.set(p.item_name, current + Number(p.amount));
        });

        data = Array.from(itemMap.entries()).map(([name, amount]) => ({
          id: name,
          name: name,
          goal: '-',
          performance: formatValue(amount),
          achieve: '100',
          gap: '-'
        }));
      }

      setDisplayData(data);
    } catch (err) {
      console.error('DrillDown Refresh Error:', err);
    }
  };

  const getDashboardTitle = () => `${year}년 ${month}월 매출실적`;

  const getMenuTitle = () => {
    const path = location.pathname;
    const isTeam = path.includes('team');
    const base = isTeam ? '영업팀별' : '유형별';
    let sub = '';
    if (path.includes('goal')) sub = '목표대비';
    else if (path.includes('yoy')) sub = '전년대비';
    else if (path.includes('mom')) sub = '전월대비';
    else if (path.includes('acc')) sub = '누계 실적';
    return `${base} ${sub}`;
  };

  const getLabelByLevel = (level: number) => {
    switch(level) {
      case 0: return '영업팀';
      case 1: return '영업사원';
      case 2: return '거래처';
      case 3: return '품목';
      default: return '품목';
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
    const isTypeMode = location.pathname.includes('type');
    
    if (currentLevel < 3) {
      setBreadcrumbs([...breadcrumbs, { id, name, level: currentLevel }]);
      
      if (isTypeMode) {
        if (currentLevel === 0) setSelectedIds({ ...selectedIds, categoryId: id });
        // Add more type-based drilldown steps if needed
      } else {
        if (currentLevel === 0) setSelectedIds({ ...selectedIds, teamId: id });
        else if (currentLevel === 1) setSelectedIds({ ...selectedIds, staffId: id });
        else if (currentLevel === 2) setSelectedIds({ ...selectedIds, customerName: name });
      }
      
      setCurrentLevel(currentLevel + 1);
    }
  };

  const handleBreadcrumbClick = (idx: number) => {
    if (idx === -1) {
      setBreadcrumbs([]);
      setSelectedIds({});
      setCurrentLevel(0);
    } else {
      const newBcs = breadcrumbs.slice(0, idx + 1);
      setBreadcrumbs(newBcs);
      setCurrentLevel(idx + 1);
      // Update selected IDs based on breadcrumbs
      const newIds: any = {};
      if (idx >= 0) newIds.teamId = breadcrumbs[0].id;
      if (idx >= 1) newIds.staffId = breadcrumbs[1].id;
      if (idx >= 2) newIds.customerName = breadcrumbs[2].name;
      setSelectedIds(newIds);
    }
  };

  return (
    <div className={`${styles.page} fade-in`}>
      <DashboardHeader 
        title={getDashboardTitle()}
        subtitle={getMenuTitle()}
        totalWorkingDays={workingDays.total}
        currentWorkingDays={workingDays.current}
        isExpectedClosingOn={isExpectedClosingOn}
        onToggleExpectedClosing={() => setIsExpectedClosingOn(!isExpectedClosingOn)}
        unit={unit}
        onUnitChange={setUnit}
      />

      {/* Monthly Trend Chart */}
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <h3 className={styles.chartTitle}>월별 매출 추이 ({year}년)</h3>
          <span className={styles.chartUnit}>단위: {getUnitName()}</span>
        </div>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f6ad55" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f6ad55" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94A3B8', fontSize: 12}}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94A3B8', fontSize: 12}}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Area 
                type="monotone" 
                dataKey="performance" 
                stroke="#ed8936" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorPerf)" 
                name="실적"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

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

      <DrillDownTable 
        breadcrumbs={breadcrumbs}
        onBreadcrumbClick={handleBreadcrumbClick}
        data={displayData}
        onRowClick={handleRowClick}
        columns={columns}
        isExpectedClosingOn={isExpectedClosingOn}
      />
    </div>
  );
};

export default DashboardPage;
