import React from 'react';
import styles from './SummaryGrid.module.css';

interface SummaryCardProps {
  label: string;
  value: string;
  unit: string;
  type?: 'default' | 'primary' | 'success' | 'danger';
  isWarning?: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, unit, type = 'default', isWarning }) => (
  <div className={`${styles.card} ${styles[type]} ${isWarning ? styles.warning : ''}`}>
    <div className={styles.label}>{label}</div>
    <div className={styles.valueContainer}>
      <span className={`${styles.value} ${isWarning ? styles.dangerText : ''}`}>{value}</span>
      <span className={styles.unit}>{unit}</span>
    </div>
  </div>
);

interface SummaryGridProps {
  goal: string;
  performance: string;
  achievementRate: string;
  progressGap: string;
  unit: string;
  isExpected?: boolean;
  isWarning?: boolean;
}

const SummaryGrid: React.FC<SummaryGridProps> = ({ goal, performance, achievementRate, progressGap, unit, isExpected, isWarning }) => {
  return (
    <div className={styles.grid}>
      <SummaryCard label="목표" value={goal} unit={unit} />
      <SummaryCard 
        label={isExpected ? "예상 마감 실적" : "실적"} 
        value={performance} 
        unit={unit} 
        type="primary" 
        isWarning={isWarning}
      />
      <SummaryCard 
        label={isExpected ? "최종 달성률(예측)" : "현재 달성률"} 
        value={achievementRate} 
        unit="%" 
        isWarning={isWarning}
      />
      <SummaryCard 
        label={isExpected ? "최종 과부족(예측)" : "진도율 GAP"} 
        value={`${progressGap}`} 
        unit={unit} 
        type={isWarning ? 'danger' : 'success'} 
      />
      {isExpected && (
        <div className={styles.trendLabel}>
           <span className={styles.pulse}></span>
           현 추세 유지 시 예상치입니다
        </div>
      )}
    </div>
  );
};

export default SummaryGrid;
