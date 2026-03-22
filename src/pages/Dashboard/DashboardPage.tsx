import React, { useState, useEffect } from 'react';
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
  const [currentLevel, setCurrentLevel] = useState(0); // 0: Team, 1: Staff, 2: Client, 3: Item

  // Dynamic titles based on current month (Mocking March 2026)
  const dashboardTitle = "2026년 3월 매출실적";
  const getSubTitle = () => {
    if (location.pathname.includes('team')) return "영업팀 목표 대비";
    if (location.pathname.includes('type')) return "유형별 목표 대비";
    return "영업팀 목표 대비";
  };

  // Mock data for drill-down demonstration
  const mockTeamData = [
    { id: 'team1', name: '영업 1팀', goal: '15.0', performance: '12.5', achieve: '83.3', gap: '+3.2', expectedGoal: '16.2', expectedPerformance: '14.8', expectedAchieve: '91.4', expectedGap: '+1.4' },
    { id: 'team2', name: '영업 2팀', goal: '15.0', performance: '12.9', achieve: '85.7', gap: '+3.6', expectedGoal: '15.8', expectedPerformance: '15.2', expectedAchieve: '96.2', expectedGap: '+0.6' },
  ];

  const mockStaffData = [
    { id: 'staff1', name: '홍길동 차장', goal: '5.0', performance: '4.2', achieve: '84.0', gap: '+1.1' },
    { id: 'staff2', name: '김철수 과장', goal: '5.0', performance: '4.5', achieve: '90.0', gap: '+0.8' },
    { id: 'staff3', name: '이영희 대리', goal: '5.0', performance: '3.8', achieve: '76.0', gap: '+1.3' },
  ];

  const mockClientData = [
    { id: 'client1', name: '(주) 삼성테크', goal: '2.0', performance: '1.8', achieve: '90.0', gap: '+0.4' },
    { id: 'client2', name: 'LG 이노텍', goal: '1.5', performance: '1.2', achieve: '80.0', gap: '+0.3' },
  ];

  const [displayData, setDisplayData] = useState(mockTeamData);

  const columns = [
    { key: 'name', label: currentLevel === 0 ? '영업팀' : currentLevel === 1 ? '영업사원' : currentLevel === 2 ? '거래처' : '품목', width: '30%' },
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
      
      // Update data based on next level (Demonstration mocking)
      if (nextLevel === 1) setDisplayData(mockStaffData);
      else if (nextLevel === 2) setDisplayData(mockClientData);
      else setDisplayData([{ id: 'item1', name: '주력 반도체 A형', goal: '0.8', performance: '0.7', achieve: '87.5', gap: '+0.1' }]);
    }
  };

  const handleBreadcrumbClick = (idx: number) => {
    if (idx === -1) {
      setBreadcrumbs([]);
      setCurrentLevel(0);
      setDisplayData(mockTeamData);
    } else {
      const newBcs = breadcrumbs.slice(0, idx + 1);
      setBreadcrumbs(newBcs);
      setCurrentLevel(idx + 1);
      // Logic for updating display data based on level
      if (idx === 0) setDisplayData(mockStaffData);
      else if (idx === 1) setDisplayData(mockClientData);
    }
  };

  return (
    <div className={`${styles.page} fade-in`}>
      <DashboardHeader 
        title={dashboardTitle}
        subtitle={getSubTitle()}
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
