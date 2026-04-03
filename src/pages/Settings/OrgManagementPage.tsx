import React, { useState, useEffect } from 'react';
import { Building2, Info, Loader2 } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import styles from './OrgManagementPage.module.css';

interface Division {
  id: string;
  name: string;
  display_order: number;
}

interface Team {
  id: string;
  name: string;
  division_id: string;
  display_order: number;
}

interface Staff {
  id: string;
  name: string;
  team_id: string;
  display_order: number;
}

const OrgManagementPage: React.FC = () => {
  const { profile } = useAuth();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selection state
  const [selectedDivId, setSelectedDivId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [profile?.company_id]);

  const fetchData = async () => {
    if (!profile?.company_id) return;
    setIsLoading(true);
    try {
      const { data: divs } = await supabase.from('sales_divisions').select('*').eq('company_id', profile.company_id).order('display_order', { ascending: true });
      const { data: tms } = await supabase.from('sales_teams').select('*').eq('company_id', profile.company_id).order('display_order', { ascending: true });
      
      const teamIds = (tms || []).map(t => t.id);
      const { data: stf } = await supabase.from('sales_staff').select('*').in('team_id', teamIds.length > 0 ? teamIds : ['']).order('display_order', { ascending: true });

      setDivisions(divs || []);
      setTeams(tms || []);
      setStaff(stf || []);

      if (divs && divs.length > 0 && !selectedDivId) {
        setSelectedDivId(divs[0].id);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className={styles.loading}><Loader2 className={styles.animateSpin} /> 조직 현황을 불러오는 중...</div>;
  }

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><Building2 size={28} /></div>
          <div>
            <h1 className={styles.title}>사업부 및 인원 현황 (조회 전용)</h1>
            <p className={styles.subtitle}>조직 데이터는 '엑셀 업로드'를 통해서만 등록/수정됩니다.</p>
          </div>
        </div>
        <div className={styles.infoBanner}>
          <Info size={16} />
          <span>순서(정렬) 변경은 <b>전체 정렬 관리</b> 메뉴를 이용하세요. 수기 생성은 제한되어 있습니다.</span>
        </div>
      </header>

      <div className={styles.orgGrid}>
        {/* 1. Divisions Column */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <h3>사업부</h3>
          </div>
          <div className={styles.list}>
            {divisions.map(div => (
              <div 
                key={div.id} 
                className={`${styles.item} ${selectedDivId === div.id ? styles.active : ''}`}
                onClick={() => { setSelectedDivId(div.id); setSelectedTeamId(null); }}
              >
                <span>{div.name}</span>
                <span className={styles.orderLabel}>#{div.display_order + 1}</span>
              </div>
            ))}
            {divisions.length === 0 && <div className={styles.empty}>등록된 사업부가 없습니다.</div>}
          </div>
        </div>

        {/* 2. Teams Column */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <h3>영업팀</h3>
          </div>
          <div className={styles.list}>
            {teams.filter(t => t.division_id === selectedDivId).map(team => (
              <div 
                key={team.id} 
                className={`${styles.item} ${selectedTeamId === team.id ? styles.active : ''}`}
                onClick={() => setSelectedTeamId(team.id)}
              >
                <span>{team.name}</span>
                <span className={styles.orderLabel}>#{team.display_order + 1}</span>
              </div>
            ))}
            {!selectedDivId && <div className={styles.empty}>사업부를 먼저 선택하세요</div>}
            {selectedDivId && teams.filter(t => t.division_id === selectedDivId).length === 0 && <div className={styles.empty}>팀 데이터가 없습니다.</div>}
          </div>
        </div>

        {/* 3. Staff Column */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <h3>영업사원</h3>
          </div>
          <div className={styles.list}>
            {staff.filter(s => s.team_id === selectedTeamId).map(s => (
              <div key={s.id} className={`${styles.item} ${styles.staffItem}`}>
                <div className={styles.staffInfo}>
                  <div className={styles.staffAvatar}>{s.name[0]}</div>
                  <span>{s.name}</span>
                </div>
                <span className={styles.orderLabel}>#{s.display_order + 1}</span>
              </div>
            ))}
            {!selectedTeamId && <div className={styles.empty}>영업팀을 먼저 선택하세요</div>}
            {selectedTeamId && staff.filter(s => s.team_id === selectedTeamId).length === 0 && <div className={styles.empty}>사원 데이터가 없습니다.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrgManagementPage;
