import React, { useState, useEffect } from 'react';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Building2, 
  Layers,
  TrendingUp,
  Target,
  History,
  Calendar,
  Zap,
  Maximize2
} from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import DrillDownTable from '../../components/Dashboard/DrillDownTable';
import { SalesCalendarService } from '../../services/SalesCalendarService';
import styles from './DashboardPage.module.css';

interface DashboardData {
  id: string;
  name: string;
  goal: string;
  performance: string;
  achieve: string;
  gap: string;
  expectedPerformance?: string;
}

const DashboardPage: React.FC = () => {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<'TEAM' | 'TYPE'>('TEAM');
  const [analysisMode, setAnalysisMode] = useState<'GOAL' | 'YOY' | 'MOM' | 'YTD'>('GOAL');
  
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
  const [summaryMetrics, setSummaryMetrics] = useState({
    achievement: 0,
    growthYoY: 0,
    progressGap: 0,
    expectedTotal: 0,
    ytdPerf: 0,
    totalGoal: 0,
    totalPerf: 0,
    totalLyPerf: 0
  });

  const [trendData, setTrendData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
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
    setCurrentLevel(0);
    setBreadcrumbs([]);
    setSelectedIds({});
  }, [viewMode, year, month]);

  useEffect(() => {
    let isMounted = true;
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([
        initDashboard(),
        refreshDrillDownData()
      ]);
      if (isMounted) setIsLoading(false);
    };
    loadAll();
    return () => { isMounted = false; };
  }, [currentLevel, selectedIds, profile?.company_id, year, month, unit, viewMode, analysisMode]);

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
      // 1. Fetch Company Total Summary
      const { data: summaryRows } = await supabase
        .from('sales_summary')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('year', year)
        .eq('month', month)
        .is('division_id', null)
        .is('category_id', null);

      const summary = summaryRows?.[0];

      // 2. Load Working Days Context
      const { data: wd } = await supabase.from('working_days_config').select('*').eq('company_id', profile.company_id).eq('year', year).eq('month', month).single();
      const holidaysObj = wd?.holidays || [];
      const parsedHolidays = Array.isArray(holidaysObj) ? holidaysObj.map((h: string) => new Date(h)).filter(d => !isNaN(d.valueOf())) : [];
      const totalWD = wd ? parseNum(wd.total_days) : SalesCalendarService.getTotalWorkingDays(year, month, parsedHolidays);
      const currentWD = SalesCalendarService.getElapsedWorkingDays(year, month, new Date(), parsedHolidays);
      setWorkingDays({ total: totalWD, current: currentWD }); 
      const progressLimit = totalWD > 0 ? (currentWD / totalWD) : 0;

      // 3. Set Global Summary Metrics
      const perf = parseNum(summary?.performance || 0);
      const goal = parseNum(summary?.goal || 0);
      const lyPerf = parseNum(summary?.ly_performance || 0);
      const ytdPerf = parseNum(summary?.ytd_performance || 0);

      setSummaryMetrics({
        achievement: goal > 0 ? (perf / goal) * 100 : 0,
        growthYoY: lyPerf > 0 ? ((perf - lyPerf) / lyPerf) * 100 : 0,
        progressGap: perf - (goal * progressLimit),
        expectedTotal: progressLimit > 0 ? (perf / progressLimit) : 0,
        ytdPerf: ytdPerf,
        totalGoal: goal,
        totalPerf: perf,
        totalLyPerf: lyPerf
      });

      // 4. Trend Data
      const { data: yTrend } = await supabase
        .from('sales_summary')
        .select('month, performance')
        .eq('company_id', profile.company_id)
        .eq('year', year)
        .is('division_id', null)
        .is('category_id', null)
        .order('month', { ascending: true });

      const monthMap = new Array(12).fill(0).map((_, i) => ({ month: `${i + 1}월`, performance: 0 }));
      (yTrend || []).forEach((t: any) => {
          if (t.month >= 1 && t.month <= 12) {
              monthMap[t.month - 1].performance = Number(formatValue(t.performance));
          }
      });
      setTrendData(monthMap);

    } catch (err) { console.error('Init Error:', err); }
  };

  const refreshDrillDownData = async () => {
    if (!profile?.company_id) return;
    try {
      let query = supabase.from('sales_summary')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('year', year)
        .eq('month', month);

      if (viewMode === 'TEAM') {
        if (currentLevel === 0) query = query.not('division_id', 'is', null).is('team_id', null);
        else if (currentLevel === 1) query = query.eq('division_id', selectedIds.divisionId).not('team_id', 'is', null).is('staff_id', null);
        else if (currentLevel === 2) query = query.eq('team_id', selectedIds.teamId).not('staff_id', 'is', null).is('customer_name', null);
        else if (currentLevel === 3) query = query.eq('staff_id', selectedIds.staffId).not('customer_name', 'is', null).is('item_name', null);
        else if (currentLevel === 4) query = query.eq('staff_id', selectedIds.staffId).eq('customer_name', selectedIds.customerName).not('item_name', 'is', null);
      } else {
        if (currentLevel === 0) query = query.not('category_id', 'is', null).is('staff_id', null);
        else if (currentLevel === 1) query = query.eq('category_id', selectedIds.categoryId).not('staff_id', 'is', null).is('customer_name', null);
        else if (currentLevel === 2) query = query.eq('staff_id', selectedIds.staffId).eq('category_id', selectedIds.categoryId).not('customer_name', 'is', null).is('item_name', null);
        else if (currentLevel === 3) query = query.eq('staff_id', selectedIds.staffId).eq('category_id', selectedIds.categoryId).eq('customer_name', selectedIds.customerName).not('item_name', 'is', null);
      }

      const { data: summaryDataList, error } = await query;
      if (error) throw error;

      // Fetch Names for Display
      const namesMap = new Map<string, string>();
      if (viewMode === 'TEAM') {
        if (currentLevel === 0) {
          const { data } = await supabase.from('sales_divisions').select('id, name');
          data?.forEach(d => namesMap.set(d.id, d.name));
        } else if (currentLevel === 1) {
          const { data } = await supabase.from('sales_teams').select('id, name');
          data?.forEach(t => namesMap.set(t.id, t.name));
        } else if (currentLevel === 2) {
          const { data } = await supabase.from('sales_staff').select('id, name');
          data?.forEach(s => namesMap.set(s.id, s.name));
        }
      } else {
         if (currentLevel === 0) {
           const { data } = await supabase.from('product_categories').select('id, name');
           data?.forEach(c => namesMap.set(c.id, c.name));
         } else if (currentLevel === 1) {
           const { data } = await supabase.from('sales_staff').select('id, name');
           data?.forEach(s => namesMap.set(s.id, s.name));
         }
      }

      const progressLimit = workingDays.total > 0 ? (workingDays.current / workingDays.total) : 0;

      const formattedData: DashboardData[] = (summaryDataList || []).map(s => {
        const perfVal = parseNum(s.performance);
        let compareVal = 0;
        if (analysisMode === 'GOAL') compareVal = parseNum(s.goal);
        else if (analysisMode === 'YOY') compareVal = parseNum(s.ly_performance);
        else if (analysisMode === 'MOM') compareVal = parseNum(s.prev_performance);
        else if (analysisMode === 'YTD') compareVal = parseNum(s.ytd_performance);
        
        let name = '';
        if (viewMode === 'TEAM') {
          if (currentLevel === 0) name = namesMap.get(s.division_id) || '알수없음';
          else if (currentLevel === 1) name = namesMap.get(s.team_id) || '알수없음';
          else if (currentLevel === 2) name = namesMap.get(s.staff_id) || '알수없음';
          else if (currentLevel === 3) name = s.customer_name || '알수없음';
          else if (currentLevel === 4) name = s.item_name || '알수없음';
        } else {
            if (currentLevel === 0) name = namesMap.get(s.category_id) || '알수없음';
            else if (currentLevel === 1) name = namesMap.get(s.staff_id) || '알수없음';
            else if (currentLevel === 2) name = s.customer_name || '알수없음';
            else if (currentLevel === 3) name = s.item_name || '알수없음';
        }

        const metrics = { achieve: compareVal > 0 ? (perfVal / compareVal) * 100 : 0, gap: perfVal - compareVal };
        if (analysisMode === 'GOAL') metrics.gap = perfVal - (compareVal * progressLimit);

        const expected = parseNum(s.expected_performance);

        return {
          id: s.division_id || s.team_id || s.staff_id || s.customer_name || s.item_name,
          name,
          goal: formatValue(compareVal),
          performance: formatValue(perfVal),
          achieve: metrics.achieve.toFixed(1),
          gap: (metrics.gap >= 0 ? '+' : '') + formatValue(metrics.gap),
          expectedPerformance: formatValue(expected)
        };
      });

      setDisplayData(formattedData);
      setPieData(formattedData.slice(0, 10).map(d => ({ name: d.name, value: parseNum(d.performance) })));

    } catch (err) { console.error('Refresh Error:', err); }
  };

  const getLabelByLevel = (level: number) => {
    if (viewMode === 'TYPE') {
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

  const getCompareLabel = () => {
    switch(analysisMode) {
      case 'GOAL': return '목표액';
      case 'YOY': return '전년동월';
      case 'MOM': return '전월실적';
      case 'YTD': return '연간누계';
      default: return '기준액';
    }
  };

  const columns = [
    { key: 'name', label: getLabelByLevel(currentLevel), width: '30%' },
    { key: 'goal', label: getCompareLabel(), width: '15%' },
    { key: 'performance', label: '당월실적', width: '15%' },
    { key: 'achieve', label: '달성/성장률', width: '15%' },
    { key: 'gap', label: 'GAP/성장액', width: '15%' },
  ];

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#4f46e5', '#7c3aed'];

  const handleRowClick = (id: string, name: string) => {
    const maxLevel = viewMode === 'TYPE' ? 3 : 4;
    if (currentLevel < maxLevel) {
      setBreadcrumbs([...breadcrumbs, { id, name, level: currentLevel }]);
      if (viewMode === 'TYPE') {
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
      if (viewMode === 'TYPE') {
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
      {/* 🚀 Unified Control Tower */}
      <header className={styles.controlTower}>
        <div className={styles.leftGroup}>
           <div className={styles.mainTitleArea}>
             <h1>Sales Intelligence</h1>
             <p>{year}년 {month}월 통합 분석 리포트</p>
           </div>
           
           <div className={styles.viewSwitcher}>
             <button className={`${styles.switchBtn} ${viewMode === 'TEAM' ? styles.active : ''}`} onClick={() => setViewMode('TEAM')}>
               <Building2 size={16} /> <span>조직별</span>
             </button>
             <button className={`${styles.switchBtn} ${viewMode === 'TYPE' ? styles.active : ''}`} onClick={() => setViewMode('TYPE')}>
               <Layers size={16} /> <span>제품별</span>
             </button>
           </div>
        </div>

        <div className={styles.rightGroup}>
           <div className={styles.analysisTabs}>
             {[
               { id: 'GOAL', label: '목표대비', icon: <Target size={14}/> },
               { id: 'YOY', label: '전년대비', icon: <History size={14}/> },
               { id: 'MOM', label: '전월대비', icon: <TrendingUp size={14}/> },
               { id: 'YTD', label: '연간누계', icon: <Calendar size={14}/> }
             ].map(t => (
               <button key={t.id} className={`${styles.tabBtn} ${analysisMode === t.id ? styles.active : ''}`} onClick={() => setAnalysisMode(t.id as any)}>
                 {t.icon} <span>{t.label}</span>
               </button>
             ))}
           </div>

           <div className={styles.datePicker}>
              <select value={year} onChange={e => setYear(Number(e.target.value))}>
                {[2026, 2025, 2024, 2023, 2022].map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <select value={month} onChange={e => setMonth(Number(e.target.value))}>
                {Array.from({length: 12}, (_, i) => i+1).map(m => <option key={m} value={m}>{m}월</option>)}
              </select>
           </div>
           
           <div className={styles.unitToggle}>
              <select value={unit} onChange={e => setUnit(e.target.value as any)}>
                <option value="billion">억원</option>
                <option value="million">백만원</option>
                <option value="won">원</option>
              </select>
           </div>
        </div>
      </header>

      {/* 📊 Summary Cards (Always 4 Fixed) */}
      <div className={styles.summaryGrid}>
         <div className={styles.sumCard}>
            <div className={styles.cardInfo}>
              <span className={styles.cardLabel}>현재 달성률</span>
              <h3 className={styles.cardValue}>{summaryMetrics.achievement.toFixed(1)}%</h3>
              <p className={styles.cardSub}>목표: {formatValue(summaryMetrics.totalGoal)} {getUnitName()}</p>
            </div>
            <div className={styles.cardIcon} style={{background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1'}}><Target size={24}/></div>
         </div>
         <div className={styles.sumCard}>
            <div className={styles.cardInfo}>
              <span className={styles.cardLabel}>성장률 (YoY)</span>
              <h3 className={styles.cardValue} style={{color: summaryMetrics.growthYoY >= 0 ? '#10b981' : '#f43f5e'}}>
                {summaryMetrics.growthYoY >= 0 ? '+' : ''}{summaryMetrics.growthYoY.toFixed(1)}%
              </h3>
              <p className={styles.cardSub}>전년: {formatValue(summaryMetrics.totalLyPerf)} {getUnitName()}</p>
            </div>
            <div className={styles.cardIcon} style={{background: 'rgba(16, 185, 129, 0.1)', color: '#10b981'}}><TrendingUp size={24}/></div>
         </div>
         <div className={styles.sumCard}>
            <div className={styles.cardInfo}>
              <span className={styles.cardLabel}>진도율 GAP</span>
              <h3 className={styles.cardValue} style={{color: summaryMetrics.progressGap >= 0 ? '#10b981' : '#f43f5e'}}>
                {summaryMetrics.progressGap >= 0 ? '+' : ''}{formatValue(summaryMetrics.progressGap)}
              </h3>
              <p className={styles.cardSub}>진도율: {((workingDays.current / workingDays.total) * 100).toFixed(1)}%</p>
            </div>
            <div className={styles.cardIcon} style={{background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899'}}><Zap size={24}/></div>
         </div>
         <div className={styles.sumCard}>
            <div className={styles.cardInfo}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span className={styles.cardLabel}>예상 마감액</span>
                <button className={`${styles.expToggle} ${isExpectedClosingOn ? styles.on : ''}`} onClick={() => setIsExpectedClosingOn(!isExpectedClosingOn)}><Maximize2 size={12}/></button>
              </div>
              <h3 className={styles.cardValue}>{formatValue(summaryMetrics.expectedTotal)}</h3>
              <p className={styles.cardSub}>잔여일수: {workingDays.total - workingDays.current}일</p>
            </div>
            <div className={styles.cardIcon} style={{background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b'}}><Building2 size={24}/></div>
         </div>
      </div>

      {/* 📈 Hybrid Visual Analysis */}
      <div className={styles.visualAnalysis}>
         <div className={styles.chartBox}>
            <div className={styles.chartHeader}><h3>{viewMode === 'TEAM' ? '사업부별 비중' : '제품유형별 비중'}</h3></div>
            <div className={styles.chartInner}>
               <ResponsiveContainer width="100%" height={300}>
                 <PieChart>
                   <Pie data={pieData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                     {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                   </Pie>
                   <Tooltip />
                   <Legend verticalAlign="bottom" height={36}/>
                 </PieChart>
               </ResponsiveContainer>
            </div>
         </div>
         <div className={styles.chartBox} style={{flex: 1.5}}>
            <div className={styles.chartHeader}><h3>월별 실적 추이</h3></div>
            <div className={styles.chartInner}>
               <ResponsiveContainer width="100%" height={300}>
                 <AreaChart data={trendData}>
                   <defs>
                     <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                   </defs>
                   <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                   <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                   <Tooltip />
                   <Area type="monotone" dataKey="performance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPerf)" />
                 </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>

      {/* 📋 Detail Grid */}
      <div className={styles.gridSection}>
          <DrillDownTable 
            breadcrumbs={breadcrumbs}
            onBreadcrumbClick={handleBreadcrumbClick}
            data={displayData}
            onRowClick={handleRowClick}
            columns={columns}
            isExpectedClosingOn={isExpectedClosingOn}
          />
          {isLoading && <div className={styles.loader}>데이터 동기화 중...</div>}
      </div>
    </div>
  );
};

export default DashboardPage;
