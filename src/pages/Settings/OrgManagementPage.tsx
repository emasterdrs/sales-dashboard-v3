import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
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

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'DIVISION' | 'TEAM' | 'STAFF'>('DIVISION');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalName, setModalName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const { data: stf } = await supabase.from('sales_staff').select('*').in('team_id', teamIds.length > 0 ? teamIds : ['']);

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

  const handleOpenModal = (type: 'DIVISION' | 'TEAM' | 'STAFF', id: string | null = null, currentName: string = '') => {
    setModalType(type);
    setEditingId(id);
    setModalName(currentName);
    setIsModalOpen(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id || !modalName.trim()) return;

    setIsSubmitting(true);
    try {
      const commonData = { name: modalName.trim() };
      
      if (modalType === 'DIVISION') {
        if (editingId) {
          await supabase.from('sales_divisions').update(commonData).eq('id', editingId);
        } else {
          await supabase.from('sales_divisions').insert({ ...commonData, company_id: profile.company_id, display_order: divisions.length });
        }
      } else if (modalType === 'TEAM') {
        if (!selectedDivId) return;
        if (editingId) {
          await supabase.from('sales_teams').update(commonData).eq('id', editingId);
        } else {
          await supabase.from('sales_teams').insert({ ...commonData, company_id: profile.company_id, division_id: selectedDivId, display_order: teams.length });
        }
      } else if (modalType === 'STAFF') {
        if (!selectedTeamId) return;
        if (editingId) {
          await supabase.from('sales_staff').update(commonData).eq('id', editingId);
        } else {
          await supabase.from('sales_staff').insert({ ...commonData, team_id: selectedTeamId, display_order: staff.length });
        }
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (type: 'DIVISION' | 'TEAM' | 'STAFF', id: string) => {
    if (!confirm('정말로 삭제하시겠습니까? 관련 데이터가 모두 삭제될 수 있습니다.')) return;
    
    try {
      if (type === 'DIVISION') await supabase.from('sales_divisions').delete().eq('id', id);
      else if (type === 'TEAM') await supabase.from('sales_teams').delete().eq('id', id);
      else if (type === 'STAFF') await supabase.from('sales_staff').delete().eq('id', id);
      
      await fetchData();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  if (isLoading) {
    return <div className={styles.loading}><Loader2 className={styles.animateSpin} /> 조직도 데이터를 불러오는 중...</div>;
  }

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><Building2 size={28} /></div>
          <div>
            <h1 className={styles.title}>사업부 및 인원 관리</h1>
            <p className={styles.subtitle}>회사 조직도를 구축하고 인원을 배치합니다.</p>
          </div>
        </div>
      </header>

      <div className={styles.orgGrid}>
        {/* 1. Divisions Column */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <h3>사업부</h3>
            <button className={styles.addBtn} onClick={() => handleOpenModal('DIVISION')}><Plus size={16} /></button>
          </div>
          <div className={styles.list}>
            {divisions.map(div => (
              <div 
                key={div.id} 
                className={`${styles.item} ${selectedDivId === div.id ? styles.active : ''}`}
                onClick={() => { setSelectedDivId(div.id); setSelectedTeamId(null); }}
              >
                <span>{div.name}</span>
                <div className={styles.actions}>
                  <button onClick={(e) => { e.stopPropagation(); handleOpenModal('DIVISION', div.id, div.name); }}><Edit2 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete('DIVISION', div.id); }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Teams Column */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <h3>영업팀</h3>
            <button 
              className={styles.addBtn} 
              disabled={!selectedDivId}
              onClick={() => handleOpenModal('TEAM')}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className={styles.list}>
            {teams.filter(t => t.division_id === selectedDivId).map(team => (
              <div 
                key={team.id} 
                className={`${styles.item} ${selectedTeamId === team.id ? styles.active : ''}`}
                onClick={() => setSelectedTeamId(team.id)}
              >
                <span>{team.name}</span>
                <div className={styles.actions}>
                  <button onClick={(e) => { e.stopPropagation(); handleOpenModal('TEAM', team.id, team.name); }}><Edit2 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete('TEAM', team.id); }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {!selectedDivId && <div className={styles.empty}>사업부를 먼저 선택하세요</div>}
          </div>
        </div>

        {/* 3. Staff Column */}
        <div className={styles.column}>
          <div className={styles.columnHeader}>
            <h3>영업사원</h3>
            <button 
              className={styles.addBtn} 
              disabled={!selectedTeamId}
              onClick={() => handleOpenModal('STAFF')}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className={styles.list}>
            {staff.filter(s => s.team_id === selectedTeamId).map(s => (
              <div key={s.id} className={`${styles.item} ${styles.staffItem}`}>
                <div className={styles.staffInfo}>
                  <div className={styles.staffAvatar}>{s.name[0]}</div>
                  <span>{s.name}</span>
                </div>
                <div className={styles.actions}>
                  <button onClick={(e) => { e.stopPropagation(); handleOpenModal('STAFF', s.id, s.name); }}><Edit2 size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete('STAFF', s.id); }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {!selectedTeamId && <div className={styles.empty}>영업팀을 먼저 선택하세요</div>}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>{editingId ? '수정' : '신규 등록'} ({modalType === 'DIVISION' ? '사업부' : modalType === 'TEAM' ? '팀' : '사원'})</h2>
            <form onSubmit={handleSubmit}>
              <input 
                autoFocus
                className={styles.modalInput}
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                placeholder="이름을 입력하세요"
              />
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>취소</button>
                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className={styles.animateSpin} size={16} /> : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgManagementPage;
