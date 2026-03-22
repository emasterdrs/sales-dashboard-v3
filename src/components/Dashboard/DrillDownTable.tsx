import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import styles from './DrillDownTable.module.css';

interface Breadcrumb {
  id: string;
  name: string;
  level: number;
}

interface DrillDownTableProps {
  breadcrumbs: Breadcrumb[];
  onBreadcrumbClick: (level: number) => void;
  data: any[];
  onRowClick: (id: string, name: string) => void;
  columns: { key: string; label: string; width?: string }[];
  isExpectedClosingOn: boolean;
}

const DrillDownTable: React.FC<DrillDownTableProps> = ({
  breadcrumbs,
  onBreadcrumbClick,
  data,
  onRowClick,
  columns,
  isExpectedClosingOn
}) => {
  return (
    <div className={styles.container}>
      {/* Table Title and Breadcrumbs Area */}
      <div className={styles.tableHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.verticalBar}></div>
          <h3 className={styles.tableTitle}>전체 상세 실적</h3>
          <div className={styles.breadcrumbWrapper}>
            <button className={styles.breadcrumbHome} onClick={() => onBreadcrumbClick(-1)}>
              <Home size={14} />
            </button>
            {breadcrumbs.map((bc, idx) => (
              <React.Fragment key={bc.id}>
                <ChevronRight size={14} className={styles.separator} />
                <button 
                  className={styles.breadcrumbItem}
                  onClick={() => onBreadcrumbClick(idx)}
                >
                  {bc.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
        <button className={styles.viewAllBtn}>전체</button>
      </div>

      {/* Main Table Content */}
      <div className={styles.tableBody}>
        <table className={styles.mainTable}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} style={{ width: col.width }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <React.Fragment key={row.id}>
                <tr className={styles.row} onClick={() => onRowClick(row.id, row.name)}>
                  {columns.map(col => (
                    <td 
                      key={col.key} 
                      className={`${styles[col.key]} ${styles.cell}`}
                    >
                      {row[col.key]}
                    </td>
                  ))}
                </tr>
                {/* Expected Closing row if ON */}
                {isExpectedClosingOn && (
                  <tr className={styles.expectedRow}>
                    <td className={styles.expectedLabel}>↳ 예상 마감</td>
                    <td className={styles.expectedValue}>{row.expectedGoal || '-'}</td>
                    <td className={styles.expectedValue}>{row.expectedPerformance || '-'}</td>
                    <td className={styles.expectedPercent}>{row.expectedAchieve || '-'}%</td>
                    <td className={styles.expectedGap}>{row.expectedGap || '-'}</td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DrillDownTable;
