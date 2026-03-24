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
  const [selectedIds, setSelectedIds] = useState<{ teamId?: string; staffId?: string; customerName?: string }>({});

  const [workingDays, setWorkingDays] = useState({ total: 21, current: 13 });
  const [summaryData, setSummaryData] = useState({ goal: '0.0', performance: '0.0', achievementRate: '0.0', progressGap: '0.0' });
  const [displayData, setDisplayData] = useState<DashboardData[]>([]);

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
        .single();

      let holidays: Date[] = [];
      if (wdData && wdData.holidays) {
        holidays = (wdData.holidays as string[]).map(h => parseISO(h));
      }
      const totalDays = SalesCalendarService.getTotalWorkingDays(year, month, holidays);
      const currentDays = SalesCalendarService.getElapsedWorkingDays(year, month, now, holidays);
      setWorkingDays({ total: totalDays, current: currentDays });

      // 2. Summary (Company Total)
      // Get all targets for teams
      const { data: targets } = await supabase
        .from('sales_targets')
        .select('target_amount')
        .eq('company_id', profile?.company_id)
        .eq('entity_type', 'TEAM')
        .eq('year', year)
        .eq('month', month);
      
      const totalGoal = (targets || []).reduce((acc, t) => acc + Number(t.target_amount), 0);

      // Get all performance for this month
      const { data: performance } = await supabase
        .from('sales_performance')
        .select('amount')
        .eq('company_id', profile?.company_id)
        .gte('sales_date', `${year}-${month.toString().padStart(2, '0')}-01`)
        .lte('sales_date', `${year}-${month.toString().padStart(2, '0')}-31`);
      
      const totalPerf = (performance || []).reduce((acc, p) => acc + Number(p.amount), 0);
      const achievement = totalGoal > 0 ? (totalPerf / totalGoal) * 100 : 0;
      
      // Progress Gap calculation: (Achieve Rate - (Current Working Days / Total Working Days * 100))
      const progressRate = totalDays > 0 ? (currentDays / totalDays) * 100 : 0;
      const gapValue = totalPerf - (totalGoal * (progressRate / 100));

      setSummaryData({
        goal: formatValue(totalGoal),
        performance: formatValue(totalPerf),
        achievementRate: achievement.toFixed(1),
        progressGap: (gapValue >= 0 ? '+' : '') + formatValue(gapValue)
      });

    } catch (err) {
      console.error('Data Init Error:', err);
    }
  };

  const refreshDrillDownData = async () => {
    if (!profile?.company_id) return;
    
    try {
      let data: DashboardData[] = [];
      
      if (currentLevel === 0) {
        // Level 0: Teams
        const { data: teams } = await supabase.from('sales_teams').select('*').eq('company_id', profile.company_id);
        const { data: targets } = await supabase.from('sales_targets').select('*').eq('company_id', profile.company_id).eq('entity_type', 'TEAM').eq('year', year).eq('month', month);
        const { data: perf } = await supabase.from('sales_performance').select('amount, staff:sales_staff(team_id)').eq('company_id', profile.company_id).gte('sales_date', `${year}-${month.toString().padStart(2, '0')}-01`);

        data = (teams || []).map(t => {
          const teamTarget = (targets || []).find(tg => tg.entity_id === t.id)?.target_amount || 0;
          const teamPerf = (perf || []).filter(p => (p.staff as any)?.team_id === t.id).reduce((acc, p) => acc + Number(p.amount), 0);
          const achieve = teamTarget > 0 ? (teamPerf / Number(teamTarget)) * 100 : 0;
          
          // Expected Closing Logic
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
            gap: '0.0',
            expectedGoal: formatValue(Number(teamTarget)),
            expectedPerformance: formatValue(expected),
            expectedAchieve: expectedAchieve.toFixed(1),
            expectedGap: (expectedGap >= 0 ? '+' : '') + formatValue(expectedGap)
          };
        });
      } 
      else if (currentLevel === 1 && selectedIds.teamId) {
        // Level 1: Staff in Team
        const { data: staff } = await supabase.from('sales_staff').select('*').eq('team_id', selectedIds.teamId);
        const { data: targets } = await supabase.from('sales_targets').select('*').eq('company_id', profile.company_id).eq('entity_type', 'STAFF').eq('year', year).eq('month', month);
        const { data: perf } = await supabase.from('sales_performance').select('*').eq('company_id', profile.company_id).gte('sales_date', `${year}-${month.toString().padStart(2, '0')}-01`);

        data = (staff || []).map(s => {
          const staffTarget = (targets || []).find(tg => tg.entity_id === s.id)?.target_amount || 0;
          const staffPerf = (perf || []).filter(p => p.staff_id === s.id).reduce((acc, p) => acc + Number(p.amount), 0);
          const achieve = staffTarget > 0 ? (staffPerf / Number(staffTarget)) * 100 : 0;

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
            gap: '0.0',
            expectedGoal: formatValue(Number(staffTarget)),
            expectedPerformance: formatValue(expected),
            expectedAchieve: expectedAchieve.toFixed(1),
            expectedGap: (expectedGap >= 0 ? '+' : '') + formatValue(expectedGap)
          };
        });
      }
      else if (currentLevel === 2 && selectedIds.staffId) {
        // Level 2: Customers for Staff
        const { data: perf } = await supabase.from('sales_performance').select('*').eq('staff_id', selectedIds.staffId).gte('sales_date', `${year}-${month.toString().padStart(2, '0')}-01`);
        
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
        const { data: perf } = await supabase.from('sales_performance').select('*').eq('staff_id', selectedIds.staffId).eq('customer_name', selectedIds.customerName).gte('sales_date', `${year}-${month.toString().padStart(2, '0')}-01`);
        
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
    if (currentLevel < 3) {
      setBreadcrumbs([...breadcrumbs, { id, name, level: currentLevel }]);
      if (currentLevel === 0) setSelectedIds({ ...selectedIds, teamId: id });
      else if (currentLevel === 1) setSelectedIds({ ...selectedIds, staffId: id });
      else if (currentLevel === 2) setSelectedIds({ ...selectedIds, customerName: name });
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

      <SummaryGrid 
        goal={summaryData.goal}
        performance={summaryData.performance}
        achievementRate={summaryData.achievementRate}
        progressGap={summaryData.progressGap}
        unit={getUnitName()}
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
