import React, { useState, useEffect, useCallback } from 'react';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Layers, TrendingUp, Target, History, Calendar, Zap, Maximize2, Search, Building2
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

interface Notification {
  message: string;
  type: 'success' | 'error';
}

interface SummaryRow {
  performance?: number;
  goal?: number;
  ly_performance?: number;
  ytd_performance?: number;
  division_id?: string;
  team_id?: string;
  staff_id?: string;
  category_id?: string;
  customer_name?: string;
  item_name?: string;
  month?: number;
  expected_performance?: number;
  prev_performance?: number;
}

const DashboardPage: React.FC = () => {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<'TEAM' | 'TYPE'>('TEAM');
  const [analysisMode, setAnalysisMode] = useState<'GOAL' | 'YOY' | 'MOM' | 'YTD'>('GOAL');
  
  const [queryState, setQueryState] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    unit: 'billion' as 'won' | 'million' | 'billion'
  });

  const [tempState, setTempState] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    unit: 'billion' as 'won' | 'million' | 'billion'
  });

  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string; level: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0); 
  const [selectedIds, setSelectedIds] = useState<{ 
    divisionId?: string; 
    teamId?: string; 
    staffId?: string; 
    customerName?: string; 
    categoryId?: string 
  }>({});

  const [workingDays, setWorkingDays] = useState({ total: 20, current: 0 });
  const [summaryMetrics, setSummaryMetrics] = useState({
    achievement: 0, growthYoY: 0, progressGap: 0, expectedTotal: 0, ytdPerf: 0, totalGoal: 0, totalPerf: 0, totalLyPerf: 0
  });

  const [trendData, setTrendData] = useState<{ month: string; performance: number }[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [displayData, setDisplayData] = useState<DashboardData[]>([]);
  const [isExpectedClosingOn, setIsExpectedClosingOn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<Notification | null>(null);

  const showNotify = useCallback((message: string, type: 'success' | 'error' = 'error') => {
    setNotification({ message, type });
  }, []);

  const parseNum = (val: string | number | null | undefined): number => {
    if (val === undefined || val === null) return 0;
    const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : Number(val);
    return isNaN(num) ? 0 : num;
  };

  const formatValue = useCallback((val: number) => {
    const num = Number(val);
    if (queryState.unit === 'billion') return (num / 100000000).toFixed(1);
    if (queryState.unit === 'million') return (num / 1000000).toLocaleString();
    return num.toLocaleString();
  }, [queryState.unit]);

  const getUnitName = () => {
    if (queryState.unit === 'billion') return '억원';
    if (queryState.unit === 'million') return '백만원';
    return '원';
  };

  const loadMetrics = useCallback((summary: SummaryRow | null) => {
    const perf = parseNum(summary?.performance);
    const goal = parseNum(summary?.goal);
    const lyPerf = parseNum(summary?.ly_performance);
    const ytdPerf = parseNum(summary?.ytd_performance);
    const progressLimit = workingDays.total > 0 ? (workingDays.current / workingDays.total) : 0;

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
  }, [workingDays]);

  const refreshDrillDownData = useCallback(async () => {
    if (!profile?.company_id) return;
    try {
      let query = supabase.from('sales_summary')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('year', queryState.year)
        .eq('month', queryState.month);

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

      const { data, error } = await query;
      if (error) throw error;
      const rawList = data as SummaryRow[];

      let nameTable = 'sales_divisions';
      if (viewMode === 'TEAM') {
        if (currentLevel === 1) nameTable = 'sales_teams';
        else if (currentLevel === 2) nameTable = 'sales_staff';
      } else {
        if (currentLevel === 0) nameTable = 'product_categories';
        else if (currentLevel === 1) nameTable = 'sales_staff';
      }

      const { data: nameData } = await supabase.from(nameTable).select('id, name');
      const namesMap = new Map<string, string>();
      (nameData || []).forEach(n => namesMap.set(n.id, n.name));

      const progressLimit = workingDays.total > 0 ? (workingDays.current / workingDays.total) : 0;
      const formatted: DashboardData[] = rawList.map(s => {
        const perfVal = parseNum(s.performance);
        let compareVal = 0;
        if (analysisMode === 'GOAL') compareVal = parseNum(s.goal);
        else if (analysisMode === 'YOY') compareVal = parseNum(s.ly_performance);
        else if (analysisMode === 'MOM') compareVal = parseNum(s.prev_performance);
        else if (analysisMode === 'YTD') compareVal = parseNum(s.ytd_performance);
        
        let name = '미분류/누락';
        const targetId = viewMode === 'TEAM' 
          ? (currentLevel === 0 ? s.division_id : (currentLevel === 1 ? s.team_id : s.staff_id)) 
          : (currentLevel === 0 ? s.category_id : s.staff_id);
        
        if (currentLevel >= (viewMode === 'TEAM' ? 3 : 2)) name = s.customer_name || s.item_name || '알수없음';
        else if (targetId) name = namesMap.get(targetId) || '기준정보누락';

        const achieveRate = compareVal > 0 ? (perfVal / compareVal) * 100 : 0;
        let gapVal = perfVal - compareVal;
        if (analysisMode === 'GOAL') gapVal = perfVal - (compareVal * progressLimit);

        return {
          id: targetId || s.customer_name || s.item_name || Math.random().toString(),
          name,
          goal: formatValue(compareVal),
          performance: formatValue(perfVal),
          achieve: achieveRate.toFixed(1),
          gap: (gapVal >= 0 ? '+' : '') + formatValue(gapVal),
          expectedPerformance: formatValue(parseNum(s.expected_performance))
        };
      });

      setDisplayData(formatted);
      setPieData(formatted.slice(0, 10).map(d => ({ name: d.name, value: parseNum(d.performance) })));
    } catch (e: unknown) {
       const error = e as Error;
       showNotify(`연관 데이터 조회 실패: ${error.message}`, 'error');
    }
  }, [profile?.company_id, queryState.year, queryState.month, viewMode, currentLevel, selectedIds, analysisMode, workingDays, formatValue, showNotify]);

  const loadDashboardData = useCallback(async () => {
    if (!profile?.company_id) return;
    setIsLoading(true);
    try {
      const { data: summaryRows, error: summaryErr } = await supabase
        .from('sales_summary')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('year', queryState.year)
        .eq('month', queryState.month)
        .is('division_id', null)
        .is('category_id', null);

      if (summaryErr) throw summaryErr;
      
      const rows = summaryRows as SummaryRow[];
      if (!rows || rows.length === 0) {
        await supabase.rpc('refresh_sales_summary', { 
          p_company_id: profile.company_id, 
          p_year: queryState.year, 
          p_month: queryState.month 
        });
        
        const { data: retryRows } = await supabase.from('sales_summary').select('*').eq('company_id', profile.company_id).eq('year', queryState.year).eq('month', queryState.month).is('division_id', null).is('category_id', null);
        if (retryRows && retryRows.length > 0) {
          loadMetrics(retryRows[0] as SummaryRow);
        }
      } else {
        loadMetrics(rows[0]);
      }

      const { data: wdList } = await supabase.from('working_days_config').select('*').eq('company_id', profile.company_id).eq('year', queryState.year).eq('month', queryState.month);
      const wd = wdList?.[0];
      const holidaysObj = wd?.holidays || [];
      const parsedHolidays = Array.isArray(holidaysObj) ? holidaysObj.map((h: string) => new Date(h)).filter(d => !isNaN(d.valueOf())) : [];
      const totalWD = wd ? parseNum(wd.total_days) : SalesCalendarService.getTotalWorkingDays(queryState.year, queryState.month, parsedHolidays);
      const currentWD = SalesCalendarService.getElapsedWorkingDays(queryState.year, queryState.month, new Date(), parsedHolidays);
      setWorkingDays({ total: totalWD, current: currentWD }); 

      const { data: trendRowsResult } = await supabase
        .from('sales_summary')
        .select('month, performance')
        .eq('company_id', profile.company_id)
        .eq('year', queryState.year)
        .is('division_id', null)
        .is('category_id', null)
        .order('month', { ascending: true });

      const trendRows = (trendRowsResult || []) as SummaryRow[];
      const monthMap = new Array<{ month: string; performance: number }>(12).fill({ month: '', performance: 0 }).map((_, i) => ({ month: `${i + 1}월`, performance: 0 }));
      trendRows.forEach((t) => {
          if (t.month && t.month >= 1 && t.month <= 12) {
              monthMap[t.month - 1].performance = Number(formatValue(t.performance || 0));
          }
      });
      setTrendData(monthMap);

      await refreshDrillDownData();
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ [VODA 대시보드] 로딩 에러:', error);
      showNotify(`데이터 로딩 오류: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [profile?.company_id, queryState.year, queryState.month, formatValue, loadMetrics, showNotify, refreshDrillDownData]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleSearchCommit = () => {
    setQueryState({ ...tempState });
  };

  const handleRowClick = (id: string, name: string) => {
    const max = viewMode === 'TYPE' ? 3 : 4;
    if (currentLevel < max) {
      setBreadcrumbs([...breadcrumbs, { id, name, level: currentLevel }]);
      const newIds = { ...selectedIds };
      if (viewMode === 'TYPE') {
          if (currentLevel === 0) newIds.categoryId = id;
          else if (currentLevel === 1) newIds.staffId = id;
          else if (currentLevel === 2) newIds.customerName = name;
      } else {
          if (currentLevel === 0) newIds.divisionId = id;
          else if (currentLevel === 1) newIds.teamId = id;
          else if (currentLevel === 2) newIds.staffId = id;
          else if (currentLevel === 3) newIds.customerName = name;
      }
      setSelectedIds(newIds);
      setCurrentLevel(currentLevel + 1);
    }
  };

  const handleBreadcrumbClick = (idx: number) => {
    if (idx === -1) { setBreadcrumbs([]); setSelectedIds({}); setCurrentLevel(0); } 
    else {
      setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
      setCurrentLevel(idx + 1);
      const newIds: Record<string, string> = {};
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

  const getLabelByLevel = (l: number) => {
    if (viewMode === 'TYPE') return ['제품유형', '영업사원', '거래처', '품목'][l] || '분류';
    return ['사업부', '영업팀', '영업사원', '거래처', '품목'][l] || '조직';
  };

  const getCompareLabel = () => ({ GOAL:'목표액', YOY:'전년동월', MOM:'전월실적' , YTD:'연간누계' }[analysisMode] || '기준액');
  const columns = [
    { key: 'name', label: getLabelByLevel(currentLevel), width: '30%' },
    { key: 'goal', label: getCompareLabel(), width: '15%' },
    { key: 'performance', label: '당월실적', width: '15%' },
    { key: 'achieve', label: '달성/성장률', width: '15%' },
    { key: 'gap', label: 'GAP/성장액', width: '15%' },
  ];
  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#4f46e5', '#7c3aed'];

  return (
    <div className={`${styles.page} fade-in`}>
      {notification && (
        <div className={`${styles.toast} ${styles[notification.type]}`}>
          <Zap size={18} />
          <span>{notification.message}</span>
        </div>
      )}

      <header className={styles.controlTower}>
        <div className={styles.leftGroup}>
           <div className={styles.mainTitleArea}>
             <h1>Sales Intelligence <span className={styles.versionBadge}>v1.4.2</span></h1>
             <p>{queryState.year}년 {queryState.month}월 통합 분석 리포트</p>
           </div>
           <div className={styles.viewSwitcher}>
             <button className={`${styles.switchBtn} ${viewMode === 'TEAM' ? styles.active : ''}`} onClick={() => setViewMode('TEAM')}><Building2 size={16} /> <span>조직별</span></button>
             <button className={`${styles.switchBtn} ${viewMode === 'TYPE' ? styles.active : ''}`} onClick={() => setViewMode('TYPE')}><Layers size={16} /> <span>제품별</span></button>
           </div>
        </div>

        <div className={styles.rightGroup}>
           <div className={styles.analysisTabs}>
             {[ {id:'GOAL', label:'목표대비', icon:<Target size={14}/>}, {id:'YOY', label:'전년대비', icon:<History size={14}/>}, {id:'MOM', label:'전월대비', icon:<TrendingUp size={14}/>}, {id:'YTD', label:'연간누계', icon:<Calendar size={14}/>} ].map(t => (
               <button key={t.id} className={`${styles.tabBtn} ${analysisMode === t.id ? styles.active : ''}`} onClick={() => setAnalysisMode(t.id as any)}>{t.icon} <span>{t.label}</span></button>
             ))}
           </div>
           
           <div className={styles.filterSection}>
             <div className={styles.datePicker}>
                <select value={tempState.year} onChange={e => setTempState({...tempState, year: Number(e.target.value)})}>
                  {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}년</option>)}
                </select>
                <select value={tempState.month} onChange={e => setTempState({...tempState, month: Number(e.target.value)})}>
                  {Array.from({length: 12}, (_, i) => i+1).map(m => <option key={m} value={m}>{m}월</option>)}
                </select>
             </div>
             <div className={styles.unitToggle}>
                <select value={tempState.unit} onChange={e => setTempState({...tempState, unit: e.target.value as any})}>
                  <option value="billion">억원</option>
                  <option value="million">백만원</option>
                  <option value="won">원</option>
                </select>
             </div>
             <button className={styles.searchBtn} onClick={handleSearchCommit} disabled={isLoading}>
                {isLoading ? <LoaderSVG className={styles.spin} size={16}/> : <Search size={16}/>}
                <span>조회</span>
             </button>
           </div>
        </div>
      </header>

      <div className={styles.summaryGrid}>
         <div className={styles.sumCard}>
            <div className={styles.cardInfo}><span className={styles.cardLabel}>현재 달성률</span><h3 className={styles.cardValue}>{summaryMetrics.achievement.toFixed(1)}%</h3><p className={styles.cardSub}>목표: {formatValue(summaryMetrics.totalGoal)} {getUnitName()}</p></div>
            <div className={styles.cardIcon} style={{background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1'}}><Target size={24}/></div>
         </div>
         <div className={styles.sumCard}>
            <div className={styles.cardInfo}><span className={styles.cardLabel}>전년비 성장</span><h3 className={styles.cardValue} style={{color: summaryMetrics.growthYoY >= 0 ? '#10b981' : '#f43f5e'}}>{summaryMetrics.growthYoY >= 0 ? '+' : ''}{summaryMetrics.growthYoY.toFixed(1)}%</h3><p className={styles.cardSub}>전년: {formatValue(summaryMetrics.totalLyPerf)} {getUnitName()}</p></div>
            <div className={styles.cardIcon} style={{background: 'rgba(16, 185, 129, 0.1)', color: '#10b981'}}><TrendingUp size={24}/></div>
         </div>
         <div className={styles.sumCard}>
            <div className={styles.cardInfo}><span className={styles.cardLabel}>진도율 GAP</span><h3 className={styles.cardValue} style={{color: summaryMetrics.progressGap >= 0 ? '#10b981' : '#f43f5e'}}>{summaryMetrics.progressGap >= 0 ? '+' : ''}{formatValue(summaryMetrics.progressGap)}</h3><p className={styles.cardSub}>진도율: {((workingDays.current / (workingDays.total||1)) * 100).toFixed(1)}%</p></div>
            <div className={styles.cardIcon} style={{background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899'}}><Zap size={24}/></div>
         </div>
         <div className={styles.sumCard}>
            <div className={styles.cardInfo}><div style={{display:'flex', alignItems:'center', gap:8}}><span className={styles.cardLabel}>예상 마감액</span><button className={`${styles.expToggle} ${isExpectedClosingOn ? styles.on : ''}`} onClick={() => setIsExpectedClosingOn(!isExpectedClosingOn)}><Maximize2 size={12}/></button></div><h3 className={styles.cardValue}>{formatValue(summaryMetrics.expectedTotal)}</h3><p className={styles.cardSub}>잔여일수: {Math.max(0, workingDays.total - workingDays.current)}일</p></div>
            <div className={styles.cardIcon} style={{background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b'}}><Building2 size={24}/></div>
         </div>
      </div>

      <div className={styles.visualAnalysis}>
         <div className={styles.chartBox}>
            <div className={styles.chartHeader}><h3>{viewMode === 'TEAM' ? '사업부별 비중' : '제품유형별 비중'}</h3></div>
            <div className={styles.chartInner}>
               <ResponsiveContainer width="100%" height={300}>
                 <PieChart><Pie data={pieData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">{pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /><Legend verticalAlign="bottom" height={36}/></PieChart>
               </ResponsiveContainer>
            </div>
         </div>
         <div className={styles.chartBox} style={{flex: 1.5}}>
            <div className={styles.chartHeader}><h3>월별 실적 추이 ({queryState.year}년)</h3></div>
            <div className={styles.chartInner}>
               <ResponsiveContainer width="100%" height={300}>
                 <AreaChart data={trendData}><defs><linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} /><Tooltip /><Area type="monotone" dataKey="performance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPerf)" /></AreaChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>

      <div className={styles.gridSection}>
          <DrillDownTable breadcrumbs={breadcrumbs} onBreadcrumbClick={handleBreadcrumbClick} data={displayData} onRowClick={handleRowClick} columns={columns} isExpectedClosingOn={isExpectedClosingOn} />
          {isLoading && <div className={styles.loaderArea}><LoaderSVG className={styles.spin} /> 데이터 분석 중...</div>}
      </div>
    </div>
  );
};

const LoaderSVG: React.FC<{ className?: string; size?: number }> = ({ className, size = 20 }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
);

export default DashboardPage;
