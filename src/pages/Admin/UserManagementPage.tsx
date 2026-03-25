import React, { useState, useEffect } from 'react';
import { Users, Search, Loader2, ArrowLeft, Building } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import styles from './UserManagementPage.module.css';

interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  role: string;
  company_id: string | null;
  tel: string | null;
  is_active: boolean;
  created_at: string;
  company?: {
    name: string;
  };
}

const UserManagementPage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [profile?.role]);

  const fetchUsers = async () => {
    if (profile?.role !== 'SUPER_ADMIN') return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, company:companies(name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: !currentStatus } : u));
    } catch (err) {
      console.error('Error toggling user status:', err);
      alert('상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', id);
      
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u));
      alert('권한이 성공적으로 변경되었습니다.');
    } catch (err) {
      console.error('Error changing user role:', err);
      alert('권한 변경 중 오류가 발생했습니다.');
    }
  };

  const filteredUsers = users.filter(u => 
    u.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.company?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'SUPER_ADMIN': return <span className={`${styles.roleBadge} ${styles.super}`}>슈퍼 관리자</span>;
      case 'COMPANY_ADMIN': return <span className={`${styles.roleBadge} ${styles.company}`}>기업 관리자</span>;
      default: return <span className={`${styles.roleBadge} ${styles.user}`}>사원</span>;
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingArea}>
        <Loader2 className="animate-spin" size={48} />
        <p>전체 사용자 정보를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <div className={styles.iconWrapper}><Users size={28} /></div>
          <div>
            <h1 className={styles.title}>전체 사용자 관리</h1>
            <p className={styles.subtitle}>플랫폼의 모든 가입자 리스트를 확인하고 권한 및 상태를 관리할 수 있습니다.</p>
          </div>
        </div>
      </header>

      <section className={styles.controls}>
        <div className={styles.searchBar}>
          <Search size={18} color="#94A3B8" />
          <input 
            type="text" 
            placeholder="이름, 이메일, 또는 소속 기업명으로 검색..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.statsSummary}>
            총 <strong>{filteredUsers.length}</strong>명의 사용자가 검색되었습니다.
        </div>
      </section>

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>사용자 정보</th>
              <th>소속 기업</th>
              <th>권한</th>
              <th>상태</th>
              <th>가입일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className={styles.userInfo}>
                    <div className={styles.avatar}>
                      {user.nickname?.substring(0, 1) || 'U'}
                    </div>
                    <div>
                      <div className={styles.userName}>{user.nickname}</div>
                      <div className={styles.userEmail}>{user.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className={styles.companyInfo}>
                    {user.company_id ? (
                        <>
                            <Building size={14} />
                            <span>{user.company?.name || '정보 없음'}</span>
                        </>
                    ) : (
                        <span className={styles.noCompany}>개인/무소속</span>
                    )}
                  </div>
                </td>
                <td>{getRoleBadge(user.role)}</td>
                <td>
                  <span className={`${styles.statusDot} ${user.is_active ? styles.active : styles.inactive}`}></span>
                  {user.is_active ? '활성' : '관리 중지'}
                </td>
                <td>
                  <div className={styles.dateInfo}>
                    {format(new Date(user.created_at), 'yyyy-MM-dd')}
                  </div>
                </td>
                <td>
                  <div className={styles.actions}>
                    <select 
                      className={styles.roleSelect}
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    >
                      <option value="SUPER_ADMIN">슈퍼 관리자</option>
                      <option value="COMPANY_ADMIN">기업 관리자</option>
                      <option value="USER">사원</option>
                    </select>
                    <button 
                      className={`${styles.actionBtn} ${user.is_active ? styles.suspendBtn : styles.activeBtn}`}
                      onClick={() => toggleUserActive(user.id, user.is_active)}
                    >
                      {user.is_active ? '비활성화' : '활성화'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagementPage;
