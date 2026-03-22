import React from 'react';
import { Settings, TrendingUp, Info } from 'lucide-react';
import styles from './DashboardHeader.module.css';

interface DashboardHeaderProps {
  title: string;
  subtitle: string;
  totalWorkingDays: number;
  currentWorkingDays: number;
  isExpectedClosingOn: boolean;
  onToggleExpectedClosing: () => void;
  unit: 'won' | 'million' | 'billion';
  onUnitChange: (unit: 'won' | 'million' | 'billion') => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  subtitle,
  totalWorkingDays,
  currentWorkingDays,
  isExpectedClosingOn,
  onToggleExpectedClosing,
  unit,
  onUnitChange
}) => {
  const progressRate = ((currentWorkingDays / totalWorkingDays) * 100).toFixed(1);
  const avgDailyTarget = (100 / totalWorkingDays).toFixed(1); // Placeholder for daily avg goal progress

  return (
    <div className={styles.header}>
      <div className={styles.titleSection}>
        <div className={styles.titleIcon}>
          <TrendingUp size={32} />
        </div>
        <div className={styles.titleContent}>
          <h1 className={styles.mainTitle}>{title}</h1>
          <h2 className={styles.subTitle}>({subtitle})</h2>
          <div className={styles.updateTime}>
            <Info size={14} />
            <span>UPDATE: 2026-03-21 18:00</span>
          </div>
        </div>
      </div>

      <div className={styles.statsSection}>
        <div className={styles.statsPanel}>
          <table className={styles.statsTable}>
            <thead>
              <tr>
                <th colSpan={2}>영업일수</th>
                <th>진도율</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.statLabel}>총</td>
                <td className={styles.statLabel}>현</td>
                <td className={styles.statLabel}>평균</td>
              </tr>
              <tr>
                <td className={styles.statValue}>{totalWorkingDays}</td>
                <td className={styles.statValue}>{currentWorkingDays}</td>
                <td className={styles.statValue}>{avgDailyTarget}%</td>
              </tr>
            </tbody>
          </table>
          <div className={styles.progressSummary}>
            <div className={styles.progressLabel}>현재 진도율</div>
            <div className={styles.progressValue}>{progressRate}%</div>
          </div>
        </div>

        <div className={styles.controlPanel}>
          <div className={styles.toggleWrapper}>
            <span className={styles.toggleLabel}>예상<br/>마감</span>
            <button 
              className={`${styles.toggleButton} ${isExpectedClosingOn ? styles.on : styles.off}`}
              onClick={onToggleExpectedClosing}
            >
              {isExpectedClosingOn ? 'ON' : 'OFF'}
            </button>
          </div>
          
          <div className={styles.unitSelector}>
            <button 
              className={`${styles.unitButton} ${unit === 'won' ? styles.active : ''}`}
              onClick={() => onUnitChange('won')}
            >원</button>
            <button 
              className={`${styles.unitButton} ${unit === 'million' ? styles.active : ''}`}
              onClick={() => onUnitChange('million')}
            >백만</button>
            <button 
              className={`${styles.unitButton} ${unit === 'billion' ? styles.active : ''}`}
              onClick={() => onUnitChange('billion')}
            >억</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
