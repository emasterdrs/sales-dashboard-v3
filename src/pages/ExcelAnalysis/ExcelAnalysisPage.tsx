import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  TrendingUp, 
  BarChart3, 
  LayoutDashboard,
  Upload,
  Table as TableIcon,
  Save,
} from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import styles from './ExcelAnalysisPage.module.css';

interface Notification {
  message: string;
  type: 'success' | 'error';
}

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
  const { profile } = useAuth();
  const [queryState] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  const [notification, setNotification] = useState<Notification | null>(null);

  const showNotify = (message: string, type: 'success' | 'error' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const [data, setData] = useState<ExcelSalesRecord[]>([]);
  const [summary, setSummary] = useState({
    totalAmount: 0,
    itemCount: 0,
    topCustomer: { name: '', amount: 0 },
    topStaff: { name: '', amount: 0 }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const parseNumLocal = (val: any): number => {
    if (val === undefined || val === null) return 0;
    const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : Number(val);
    return isNaN(num) ? 0 : num;
  };

  const processData = (raw: ExcelSalesRecord[]) => {
    let total = 0;
    const customerMap: Record<string, number> = {};
    const staffMap: Record<string, number> = {};

    raw.forEach(row => {
      const amount = parseNumLocal(row['매출금액'] || row['판매금액'] || 0);
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

  const handleSaveToServer = async () => {
    if (!profile?.company_id || data.length === 0) return;
    
    setIsSaving(true);
    setUploadProgress(0);
    
    try {
      const chunkSize = 10000;
      const totalChunks = Math.ceil(data.length / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize).map(row => ({
          company_id: profile.company_id,
          division_name: String(row['사업부'] || ''),
          team_name: String(row['팀'] || ''),
          staff_name: String(row['담당자'] || ''),
          customer_name: String(row['매출처'] || ''),
          item_name: String(row['품목명'] || ''),
          amount: parseNumLocal(row['매출금액'] || row['판매금액'] || 0),
          sales_date: `${queryState.year}-${String(queryState.month).padStart(2, '0')}-01`,
          category_name: '미분류'
        }));

        const { error } = await supabase.from('sales_records').insert(chunk);
        if (error) throw error;
        
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      await supabase.rpc('refresh_sales_summary', { 
        p_company_id: profile.company_id, 
        p_year: queryState.year, 
        p_month: queryState.month 
      });

      showNotify(`${data.length.toLocaleString()}건의 데이터가 서버에 안전하게 저장되었습니다.`, 'success');
    } catch (err: any) {
      console.error(err);
      showNotify(`서버 저장 실패: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
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
            <h1>간편 엑셀 실적 분석 <span className={styles.version}>v1.1</span></h1>
            <p>서버에 저장하여 대시보드 통계에 즉시 반영하세요.</p>
          </div>
        </div>
        {notification && (
          <div className={`${styles.toast} ${styles[notification.type]}`}>
            {notification.message}
          </div>
        )}
        <div className={styles.actions}>
          {data.length > 0 && (
            <button 
              className={styles.saveBtn} 
              onClick={handleSaveToServer}
              disabled={isSaving}
            >
              <Save size={18} />
              {isSaving ? `저장 중 (${uploadProgress}%)` : '서버에 그대로 저장하기'}
            </button>
          )}
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
