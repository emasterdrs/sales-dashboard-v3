import React, { useState, useEffect, useCallback } from 'react';
import { 
  Database, 
  Search, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import styles from './SalesRecordsPage.module.css';

interface SalesRecord {
  id: string;
  division_name: string;
  team_name: string;
  staff_name: string;
  customer_name: string;
  item_name: string;
  amount: number;
  sales_date: string;
}

const SalesRecordsPage: React.FC = () => {
  const { profile } = useAuth();
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [queryState, setQueryState] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    search: '',
    page: 1,
    pageSize: 50
  });

  const fetchRecords = useCallback(async () => {
    if (!profile?.company_id) return;
    setIsLoading(true);

    try {
      const startDate = `${queryState.year}-${String(queryState.month).padStart(2, '0')}-01`;
      const endDate = `${queryState.year}-${String(queryState.month).padStart(2, '0')}-31`;

      let query = supabase
        .from('sales_records')
        .select('*', { count: 'exact' })
        .eq('company_id', profile.company_id)
        .gte('sales_date', startDate)
        .lte('sales_date', endDate);

      if (queryState.search) {
        query = query.or(`staff_name.ilike.%${queryState.search}%,customer_name.ilike.%${queryState.search}%,item_name.ilike.%${queryState.search}%`);
      }

      const { data, count, error } = await query
        .order('sales_date', { ascending: false })
        .range((queryState.page - 1) * queryState.pageSize, queryState.page * queryState.pageSize - 1);

      if (error) throw error;
      
      setRecords(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [profile, queryState]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const formatKrw = (val: number) => val.toLocaleString() + '원';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <Database className={styles.titleIcon} />
          <div>
            <h1>업로드 실적 데이터 현황</h1>
            <p>서버에 저장된 실제 판매 실적 데이터를 조회합니다.</p>
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.searchBar}>
            <Search size={18} />
            <input 
              type="text" 
              placeholder="담당자, 거래처, 품목 검색..." 
              value={queryState.search}
              onChange={(e) => setQueryState(prev => ({ ...prev, search: e.target.value, page: 1 }))}
            />
          </div>
          <div className={styles.dateSelector}>
            <Calendar size={18} />
            <select 
              value={queryState.year} 
              onChange={(e) => setQueryState(prev => ({ ...prev, year: parseInt(e.target.value), page: 1 }))}
            >
              {[2023, 2024, 2025].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select 
              value={queryState.month} 
              onChange={(e) => setQueryState(prev => ({ ...prev, month: parseInt(e.target.value), page: 1 }))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.tableHeader}>
           <div className={styles.summary}>
             <TrendingUp size={18} />
             <span>검색 결과: <strong>{totalCount.toLocaleString()}</strong>건</span>
           </div>
           <div className={styles.pagination}>
             <button 
               onClick={() => setQueryState(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
               disabled={queryState.page === 1}
             >
               <ChevronLeft size={20} />
             </button>
             <span>페이지 {queryState.page}</span>
             <button 
               onClick={() => setQueryState(prev => ({ ...prev, page: prev.page + 1 }))}
               disabled={queryState.page * queryState.pageSize >= totalCount}
             >
               <ChevronRight size={20} />
             </button>
           </div>
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
              {isLoading ? (
                <tr><td colSpan={6} className={styles.empty}>데이터를 불러오는 중...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className={styles.empty}>조회된 데이터가 없습니다.</td></tr>
              ) : (
                records.map(r => (
                  <tr key={r.id}>
                    <td>{r.division_name || '-'}</td>
                    <td>{r.team_name || '-'}</td>
                    <td>{r.staff_name || '-'}</td>
                    <td>{r.customer_name || '-'}</td>
                    <td>{r.item_name || '-'}</td>
                    <td className={styles.alignRight}>{formatKrw(r.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalesRecordsPage;
