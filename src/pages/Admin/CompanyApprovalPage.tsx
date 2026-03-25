import React, { useState, useEffect } from 'react';
import { Building2, Check, Loader2, Search, ArrowLeft } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import styles from './CompanyApprovalPage.module.css';

interface Company {
  id: string;
  name: string;
  business_number: string;
  status: string; // Changed from is_approved: boolean
  created_at: string;
}

const CompanyApprovalPage: React.FC = () => {
  const { profile, effectiveRole } = useAuth(); // Added effectiveRole
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, [effectiveRole]); // Changed from profile?.role

  const fetchCompanies = async () => {
    if (effectiveRole !== 'SUPER_ADMIN') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, business_number, status, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCompanies(data || []);
    } catch (err) {
      console.error('Error fetching companies:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string, newStatus: string) => {
    try {
      // Update both column 'status' (new) and 'is_approved' (legacy) for full compatibility
      const { error } = await supabase
        .from('companies')
        .update({ 
          status: newStatus,
          is_approved: newStatus === 'APPROVED' 
        })
        .eq('id', id);
      
      if (error) throw error;
      setCompanies(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (err) {
      console.error('Error updating company status:', err);
      alert('상태 변경 중 오류가 발생했습니다. RLS 정책을 확인해 주세요.');
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.business_number && c.business_number.includes(searchTerm))
  );

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <div className={styles.iconWrapper}><Building2 size={28} /></div>
          <div>
            <h1 className={styles.title}>가입 기업 관리</h1>
            <p className={styles.subtitle}>VODA에 가입한 기업 리스트를 확인하고 서비스 이용을 승인하세요.</p>
          </div>
        </div>
      </header>

      <div className={styles.searchBar}>
        <Search size={20} color="#94A3B8" />
        <input 
          type="text" 
          placeholder="기업명 또는 사업자 번호로 검색" 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className={styles.card}>
        {isLoading ? (
          <div className={styles.loadingArea}>
            <Loader2 className={styles.animateSpin} size={40} />
            <p>데이터를 불러오는 중...</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>기업명</th>
                <th>사업자번호</th>
                <th>가입일</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map(c => (
                <tr key={c.id}>
                  <td className={styles.companyName}>{c.name}</td>
                  <td>{c.business_number || '정보없음'}</td>
                  <td>{format(new Date(c.created_at), 'yyyy-MM-dd')}</td>
                  <td>
                    <span className={`${styles.badge} ${c.status === 'APPROVED' ? styles.approved : styles.pending}`}>
                      {c.status === 'APPROVED' ? '승인완료' : '대기중'}
                    </span>
                  </td>
                  <td>
                    {c.status === 'APPROVED' ? (
                      <button className={styles.revokeBtn} onClick={() => handleApprove(c.id, 'PENDING_APPROVAL')}>승인 취소</button>
                    ) : (
                      <button className={styles.approveBtn} onClick={() => handleApprove(c.id, 'APPROVED')}>
                        <Check size={14} /> 승인하기
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredCompanies.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '60px', color: '#94A3B8' }}>
                    등록된 기업 정보가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CompanyApprovalPage;
