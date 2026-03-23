import React, { useState } from 'react';
import DashboardHeader from '../../components/Dashboard/DashboardHeader';
import SummaryGrid from '../../components/Dashboard/SummaryGrid';
import DrillDownTable from '../../components/Dashboard/DrillDownTable';
import { useLocation } from 'react-router-dom';
import styles from './DashboardPage.module.css';

const DashboardPage: React.FC = () => {
  const location = useLocation();
  const [isExpectedClosingOn, setIsExpectedClosingOn] = useState(false);
  const [unit, setUnit] = useState<'won' | 'million' | 'billion'>('billion');
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string; level: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(0); // 0: Team List (전체), 1: Staff List, 2: Client List, 3: Item List

  // Dynamic titles based on requirements: [연도]년 [월]월 매출실적 ([메뉴명])
  const getDashboardTitle = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return `${year}년 ${month}월 매출실적`;
  };

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

  // Mock data for drill-down (5 levels: 전체 -> 팀 -> 사원 -> 거래처 -> 품목)
  const mockTeamData = [
    { id: 'team1', name: '영업 1팀', goal: '15.0', performance: '12.5', achieve: '83.3', gap: '+3.2', expectedGoal: '16.2', expectedPerformance: '14.8', expectedAchieve: '91.4', expectedGap: '+1.4' },
    { id: 'team2', name: '영업 2팀', goal: '15.0', performance: '12.9', achieve: '85.7', gap: '+3.6', expectedGoal: '15.8', expectedPerformance: '15.2', expectedAchieve: '96.2', expectedGap: '+0.6' },
    { id: 'etc', name: '기타', goal: '0.0', performance: '0.0', achieve: '0.0', gap: '0.0' },
  ];

  const mockStaffData = (teamName: string) => [
    { id: 'staff1', name: `${teamName} 홍길동`, goal: '5.0', performance: '4.2', achieve: '84.0', gap: '+1.1' },
    { id: 'staff2', name: `${teamName} 김철수`, goal: '5.0', performance: '4.5', achieve: '90.0', gap: '+0.8' },
    { id: 'staff3', name: `${teamName} 이영희`, goal: '5.0', performance: '3.8', achieve: '76.0', gap: '+1.3' },
  ];

  const mockClientData = (staffName: string) => [
    { id: 'client1', name: `(주) 삼성테크 [${staffName}]`, goal: '2.0', performance: '1.8', achieve: '90.0', gap: '+0.4' },
    { id: 'client2', name: `LG 이노텍 [${staffName}]`, goal: '1.5', performance: '1.2', achieve: '80.0', gap: '+0.3' },
  ];

  const mockItemData = (clientName: string) => [
    { id: 'item1', name: `반도체 A형 [${clientName}]`, goal: '0.8', performance: '0.7', achieve: '87.5', gap: '+0.1' },
    { id: 'item2', name: `부품 B형 [${clientName}]`, goal: '0.7', performance: '0.5', achieve: '71.4', gap: '+0.2' },
  ];

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

  const [displayData, setDisplayData] = useState<DashboardData[]>(mockTeamData);

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
      const nextLevel = currentLevel + 1;
      setBreadcrumbs([...breadcrumbs, { id, name, level: currentLevel }]);
      setCurrentLevel(nextLevel);
      
      if (nextLevel === 1) setDisplayData(mockStaffData(name));
      else if (nextLevel === 2) setDisplayData(mockClientData(name));
      else if (nextLevel === 3) setDisplayData(mockItemData(name));
    }
  };

  const handleBreadcrumbClick = (idx: number) => {
    if (idx === -1) {
      setBreadcrumbs([]);
      setCurrentLevel(0);
      setDisplayData(mockTeamData);
    } else {
      const newBcs = breadcrumbs.slice(0, idx + 1);
      const clickedItem = breadcrumbs[idx];
      setBreadcrumbs(newBcs);
      setCurrentLevel(idx + 1);
      
      const level = idx + 1;
      if (level === 1) setDisplayData(mockStaffData(clickedItem.name));
      else if (level === 2) setDisplayData(mockClientData(clickedItem.name));
      else if (level === 3) setDisplayData(mockItemData(clickedItem.name));
    }
  };

  return (
    <div className={`${styles.page} fade-in`}>
      <DashboardHeader 
        title={getDashboardTitle()}
        subtitle={getMenuTitle()}
        totalWorkingDays={21}
        currentWorkingDays={13}
        isExpectedClosingOn={isExpectedClosingOn}
        onToggleExpectedClosing={() => setIsExpectedClosingOn(!isExpectedClosingOn)}
        unit={unit}
        onUnitChange={setUnit}
      />

      <SummaryGrid 
        goal="30.0"
        performance="25.4"
        achievementRate="84.5"
        progressGap="+6.8"
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
