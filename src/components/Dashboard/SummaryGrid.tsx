import React from 'react';
import styles from './SummaryGrid.module.css';

interface SummaryCardProps {
  label: string;
  value: string;
  unit: string;
  type?: 'default' | 'primary' | 'success' | 'danger';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, unit, type = 'default' }) => (
  <div className={`${styles.card} ${styles[type]}`}>
    <div className={styles.label}>{label}</div>
    <div className={styles.valueContainer}>
      <span className={styles.value}>{value}</span>
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
}

const SummaryGrid: React.FC<SummaryGridProps> = ({ goal, performance, achievementRate, progressGap, unit }) => {
  return (
    <div className={styles.grid}>
      <SummaryCard label="목표" value={goal} unit={unit} />
      <SummaryCard label="실적" value={performance} unit={unit} type="primary" />
      <SummaryCard label="현재 달성률" value={achievementRate} unit="%" />
      <SummaryCard label="진도율 GAP" value={`${progressGap}`} unit={unit} type="danger" />
    </div>
  );
};

export default SummaryGrid;
