import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  TrendingUp, 
  BarChart3, 
  LayoutDashboard, 
  Upload,
  Table as TableIcon
} from 'lucide-react';
import styles from './ExcelAnalysisPage.module.css';

interface ExcelSalesRecord {
  '사업부'?: string;
  '팀'?: string;
  '담당자'?: string;
  '매출처'?: string;
  '품목명'?: string;
  '매출금액'?: number;
  '판매금액'?: number;
  [key: string]: any;
}

const ExcelAnalysisPage: React.FC = () => {
  const [data, setData] = useState<ExcelSalesRecord[]>([]);
  const [summary, setSummary] = useState({
    totalAmount: 0,
    itemCount: 0,
    topCustomer: { name: '', amount: 0 },
    topStaff: { name: '', amount: 0 }
  });
  const [isLoading, setIsLoading] = useState(false);

  const processData = (raw: ExcelSalesRecord[]) => {
    let total = 0;
    const customerMap: Record<string, number> = {};
    const staffMap: Record<string, number> = {};

    raw.forEach(row => {
      const amount = Number(row['매출금액'] || row['판매금액'] || 0);
      total += amount;

      const cust = row['매출처'] || '기타';
      customerMap[cust] = (customerMap[cust] || 0) + amount;

      const staff = row['담당자'] || '미배정';
      staffMap[staff] = (staffMap[staff] || 0) + amount;
    });

    const topCust = Object.entries(customerMap).sort((a, b) => b[1] - a[1])[0] || ['', 0];
    const topStf = Object.entries(staffMap).sort((a, b) => b[1] - a[1])[0] || ['', 0];

    setData(raw);
    setSummary({
      totalAmount: total,
      itemCount: raw.length,
      topCustomer: { name: String(topCust[0]), amount: Number(topCust[1]) },
      topStaff: { name: String(topStf[0]), amount: Number(topStf[1]) }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rawData = XLSX.utils.sheet_to_json(ws) as ExcelSalesRecord[];
      
      processData(rawData);
      setIsLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const formatKrw = (val: number) => {
    return (val / 100000000).toFixed(1) + ' 억원';
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <FileSpreadsheet className={styles.titleIcon} strokeWidth={2.5} />
          <div>
            <h1>간편 엑셀 실적 분석 <span className={styles.version}>v1.0</span></h1>
            <p>서버 저장 없이 브라우저에서 즉시 실적을 확인하세요.</p>
          </div>
        </div>
        <div className={styles.actions}>
          <label className={styles.uploadBtn}>
            <Upload size={18} />
            엑셀 파일 불러오기
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} hidden />
          </label>
        </div>
      </header>

      {data.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconBox}>
            <LayoutDashboard size={48} className={styles.emptyIcon} />
          </div>
          <h2>분석할 엑셀 파일을 업로드 해주세요</h2>
          <p>매출금액, 매출처, 담당자 컬럼이 포함된 파일을 권장합니다.</p>
        </div>
      ) : (
        <div className={styles.dashboard}>
          <section className={styles.summaryGrid}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <TrendingUp size={20} className={styles.cardIcon} />
                <span>총 매출액</span>
              </div>
              <div className={styles.cardValue}>{formatKrw(summary.totalAmount)}</div>
              <div className={styles.cardSub}>전체 {summary.itemCount.toLocaleString()}건 합계</div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <LayoutDashboard size={20} className={styles.cardIcon} />
                <span>최대 거래처</span>
              </div>
              <div className={styles.cardTitle}>{summary.topCustomer.name}</div>
              <div className={styles.cardValueSmall}>{formatKrw(summary.topCustomer.amount)}</div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <BarChart3 size={20} className={styles.cardIcon} />
                <span>최고 퍼포먼스 담당자</span>
              </div>
              <div className={styles.cardTitle}>{summary.topStaff.name}</div>
              <div className={styles.cardValueSmall}>{formatKrw(summary.topStaff.amount)}</div>
            </div>
          </section>

          <section className={styles.tableArea}>
            <div className={styles.tableHeader}>
              <div className={styles.tableTitle}>
                <TableIcon size={20} />
                <h3>상세 데이터 리스트</h3>
              </div>
              <span className={styles.countBadge}>{data.length} Rows</span>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>사업부</th>
                    <th>팀</th>
                    <th>담당자</th>
                    <th>매출처</th>
                    <th>품목명</th>
                    <th className={styles.alignRight}>금액</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 100).map((row, idx) => (
                    <tr key={idx}>
                      <td>{row['사업부'] || '-'}</td>
                      <td>{row['팀'] || '-'}</td>
                      <td>{row['담당자'] || '-'}</td>
                      <td>{row['매출처'] || '-'}</td>
                      <td>{row['품목명'] || '-'}</td>
                      <td className={styles.alignRight}>{(Number(row['매출금액'] || row['판매금액'] || 0)).toLocaleString()}원</td>
                    </tr>
                  ))}
                  {data.length > 100 && (
                    <tr>
                      <td colSpan={6} className={styles.moreLabel}>외 {data.length - 100}건의 데이터가 더 있습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner}></div>
          <p>엑셀 데이터를 분석 중입니다...</p>
        </div>
      )}
    </div>
  );
};

export default ExcelAnalysisPage;
