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
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
  const [isSuccess, setIsSuccess] = useState(false);

  const parseNumLocal = (val: any): number => {
    if (val === undefined || val === null) return 0;
    const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : Number(val);
    return isNaN(num) ? 0 : num;
  };

  const [orgMap, setOrgMap] = useState({
    divisions: {} as Record<string, string>,
    teams: {} as Record<string, string>,
    staff: {} as Record<string, string>,
    categories: {} as Record<string, string>
  });

  const fetchOrgMaps = async () => {
    if (!profile?.company_id) return;
    try {
      const [divs, teams, cats] = await Promise.all([
        supabase.from('sales_divisions').select('id, name').eq('company_id', profile.company_id),
        supabase.from('sales_teams').select('id, name, division_id').eq('company_id', profile.company_id),
        supabase.from('product_categories').select('id, name').eq('company_id', profile.company_id)
      ]);
      const staff = await supabase.from('sales_staff').select('id, name, team_id');
      
      const dMap: Record<string, string> = {}; 
      divs.data?.forEach(d => dMap[d.name.trim()] = d.id);
      
      const tMap: Record<string, string> = {}; 
      teams.data?.forEach(t => tMap[`${t.division_id}_${t.name.trim()}`] = t.id);
      
      const sMap: Record<string, string> = {}; 
      staff.data?.forEach(s => sMap[`${s.team_id}_${s.name.trim()}`] = s.id);
      
      const cMap: Record<string, string> = {}; 
      cats.data?.forEach(c => cMap[c.name.trim()] = c.id);

      setOrgMap({ divisions: dMap, teams: tMap, staff: sMap, categories: cMap });
    } catch (e) {
      console.error('Org Map Fetch Error:', e);
    }
  };

  React.useEffect(() => {
    fetchOrgMaps();
  }, [profile?.company_id]);

  const processData = (raw: ExcelSalesRecord[]) => {
    let total = 0;
    const customerMap: Record<string, number> = {};
    const staffMap: Record<string, number> = {};

    // 엑셀 헤더 유연한 매칭을 위한 도우미 함수
    const getVal = (row: any, keys: string[]) => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
      }
      return '';
    };

    const formatted = raw.map(row => {
      const amount = parseNumLocal(getVal(row, ['매출액', '매출금액', '판매금액', '금액', '실적', '판매가', 'Amount', 'Price']));
      const cust = String(getVal(row, ['거래처', '매출처', '고객사', 'Customer', 'Client']) || '기타');
      const staff = String(getVal(row, ['성명', '담당자', '이름', 'Staff', 'Salesperson']) || '미배정');
      const salesDateRaw = getVal(row, ['날짜', '매출일자', 'Date']);
      
      total += amount;
      customerMap[cust] = (customerMap[cust] || 0) + amount;
      staffMap[staff] = (staffMap[staff] || 0) + amount;

      return {
        ...row,
        _processedAmount: amount,
        _processedCust: cust,
        _processedStaff: staff,
        _processedDiv: String(getVal(row, ['사업부', '본부', 'Division', 'Dept']) || '-'),
        _processedTeam: String(getVal(row, ['팀', '부서', 'Team', 'Group']) || '-'),
        _processedItem: String(getVal(row, ['품목', '품목명', '제품명', '상품명', 'Item', 'Product']) || '-'),
        _processedDate: salesDateRaw || `${queryState.year}-${String(queryState.month).padStart(2, '0')}-01`
      };
    });

    const topCust = Object.entries(customerMap).sort((a, b) => b[1] - a[1])[0] || ['', 0];
    const topStf = Object.entries(staffMap).sort((a, b) => b[1] - a[1])[0] || ['', 0];

    setData(formatted);
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
      // 1. 해당 월에 이미 데이터가 있는지 확인하고 삭제 (덮어쓰기 로직)
      const startDate = `${queryState.year}-${String(queryState.month).padStart(2, '0')}-01`;
      const lastDay = new Date(queryState.year, queryState.month, 0).getDate();
      const endDate = `${queryState.year}-${String(queryState.month).padStart(2, '0')}-${lastDay}`;
      
      const { error: deleteError } = await supabase
        .from('sales_records')
        .delete()
        .eq('company_id', profile.company_id)
        .gte('sales_date', startDate)
        .lte('sales_date', endDate);
        
      if (deleteError) throw deleteError;

      const chunkSize = 5000;
      const totalChunks = Math.ceil(data.length / chunkSize);
      const localMap = { ...orgMap };

      for (let i = 0; i < totalChunks; i++) {
        const chunkRaw = data.slice(i * chunkSize, (i + 1) * chunkSize);
        const chunkToInsert = [];

        for (const row of chunkRaw) {
          // 이름 -> ID 매핑 및 부재시 자동 생성
          let divId = localMap.divisions[row._processedDiv];
          if (!divId && row._processedDiv && row._processedDiv !== '-') {
            const { data: nDiv } = await supabase.from('sales_divisions').insert({ company_id: profile.company_id, name: row._processedDiv }).select();
            if (nDiv?.[0]) { divId = nDiv[0].id; localMap.divisions[row._processedDiv] = divId; }
          }

          let teamId = localMap.teams[`${divId}_${row._processedTeam}`];
          if (!teamId && divId && row._processedTeam && row._processedTeam !== '-') {
            const { data: nTeam } = await supabase.from('sales_teams').insert({ company_id: profile.company_id, division_id: divId, name: row._processedTeam }).select();
            if (nTeam?.[0]) { teamId = nTeam[0].id; localMap.teams[`${divId}_${row._processedTeam}`] = teamId; }
          }

          let staffId = localMap.staff[`${teamId}_${row._processedStaff}`];
          if (!staffId && teamId && row._processedStaff && row._processedStaff !== '미배정') {
            const { data: nStaff } = await supabase.from('sales_staff').insert({ team_id: teamId, name: row._processedStaff }).select();
            if (nStaff?.[0]) { staffId = nStaff[0].id; localMap.staff[`${teamId}_${row._processedStaff}`] = staffId; }
          }

          let catId = localMap.categories[String(row['카테고리'] || '미분류')];
          if (!catId && row['카테고리']) {
             const { data: nCat } = await supabase.from('product_categories').insert({ company_id: profile.company_id, name: String(row['카테고리']) }).select();
             if (nCat?.[0]) { catId = nCat[0].id; localMap.categories[String(row['카테고리'])] = catId; }
          }

          chunkToInsert.push({
            company_id: profile.company_id,
            team_id: teamId || null,
            staff_id: staffId || null,
            category_id: catId || null,
            customer_name: String(row._processedCust || ''),
            item_name: String(row._processedItem || ''),
            amount: Number(row._processedAmount || 0),
            sales_date: row._processedDate
          });
        }

        const { error } = await supabase.from('sales_records').insert(chunkToInsert);
        if (error) throw error;
        
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      // 서버측 캐시 및 요약 데이터 강제 갱신
      await supabase.rpc('refresh_sales_summary', { 
        p_company_id: profile.company_id, 
        p_year: queryState.year, 
        p_month: queryState.month 
      });

      showNotify(`${data.length.toLocaleString()}건의 데이터가 저장되었습니다. 대시보드에서 즉시 확인 가능합니다.`, 'success');
      setIsSuccess(true);
    } catch (err: any) {
      console.error(err);
      showNotify(`서버 저장 실패: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
      setOrgMap(localMap);
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
            {data.length > 0 && (
              <div className={styles.actionGroup}>
                {isSuccess ? (
                  <button 
                    className={styles.dashboardBtn} 
                    onClick={() => navigate('/dashboard')}
                  >
                    데이터 확인하러 가기
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button 
                    className={styles.saveBtn} 
                    onClick={handleSaveToServer}
                    disabled={isSaving}
                  >
                    <Save size={18} />
                    {isSaving ? `저장 중 (${uploadProgress}%)` : '서버에 그대로 저장하기'}
                  </button>
                )}
              </div>
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
                      <td>{row._processedDiv}</td>
                      <td>{row._processedTeam}</td>
                      <td>{row._processedStaff}</td>
                      <td>{row._processedCust}</td>
                      <td>{row._processedItem}</td>
                      <td className={styles.alignRight}>{(Number(row._processedAmount)).toLocaleString()}원</td>
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
