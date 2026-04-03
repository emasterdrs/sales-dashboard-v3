import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import styles from './OrgManagementPage.module.css';

interface Branch {
  id: string;
  name: string;
  display_order: number;
}

interface Team {
  id: string;
  branch_id: string;
  name: string;
  display_order: number;
}

interface Staff {
  id: string;
  team_id: string;
  name: string;
  display_order: number;
}

const OrgManagementPage: React.FC = () => {
  const { profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'BRANCH' | 'TEAM' | 'STAFF'>('BRANCH');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, [profile?.company_id]);

  useEffect(() => {
    if (selectedBranch) {
      fetchTeams(selectedBranch.id);
    } else {
      setTeams([]);
      setSelectedTeam(null);
    }
  }, [selectedBranch]);

  useEffect(() => {
    if (selectedTeam) {
      fetchStaff(selectedTeam.id);
    } else {
      setStaff([]);
    }
  }, [selectedTeam]);

  const fetchBranches = async () => {
    if (!profile?.company_id) return;
    setIsLoadingBranches(true);
    try {
      const { data, error } = await supabase
        .from('sales_branches')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('display_order', { ascending: true });
      if (error) throw error;
      setBranches(data || []);
      if (data && data.length > 0 && !selectedBranch) setSelectedBranch(data[0]);
    } catch (err) { console.error(err); } finally { setIsLoadingBranches(false); }
  };

  const fetchTeams = async (branchId: string) => {
    setIsLoadingTeams(true);
    try {
      const { data, error } = await supabase
        .from('sales_teams')
        .select('*')
        .eq('branch_id', branchId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      setTeams(data || []);
      if (data && data.length > 0) setSelectedTeam(data[0]);
      else setSelectedTeam(null);
    } catch (err) { console.error(err); } finally { setIsLoadingTeams(false); }
  };

  const fetchStaff = async (teamId: string) => {
    setIsLoadingStaff(true);
    try {
      const { data, error } = await supabase
        .from('sales_staff')
        .select('*')
        .eq('team_id', teamId)
        .order('display_order', { ascending: true });
      if (error) throw error;
      setStaff(data || []);
    } catch (err) { console.error(err); } finally { setIsLoadingStaff(false); }
  };

  const handleOpenModal = (type: 'BRANCH' | 'TEAM' | 'STAFF', item?: any) => {
    setModalType(type);
    setEditingItem(item || null);
    setFormData({ name: item ? item.name : '' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id || !formData.name) return;
    setIsSubmitting(true);
    try {
      if (modalType === 'BRANCH') {
        if (editingItem) {
          await supabase.from('sales_branches').update({ name: formData.name }).eq('id', editingItem.id);
        } else {
          const maxOrder = branches.length > 0 ? Math.max(...branches.map(b => b.display_order)) : 0;
          await supabase.from('sales_branches').insert({ company_id: profile.company_id, name: formData.name, display_order: maxOrder + 1 });
        }
        fetchBranches();
      } else if (modalType === 'TEAM' && selectedBranch) {
        if (editingItem) {
          await supabase.from('sales_teams').update({ name: formData.name }).eq('id', editingItem.id);
        } else {
          const maxOrder = teams.length > 0 ? Math.max(...teams.map(t => t.display_order)) : 0;
          await supabase.from('sales_teams').insert({ company_id: profile.company_id, branch_id: selectedBranch.id, name: formData.name, display_order: maxOrder + 1 });
        }
        fetchTeams(selectedBranch.id);
      } else if (modalType === 'STAFF' && selectedTeam) {
        if (editingItem) {
          await supabase.from('sales_staff').update({ name: formData.name }).eq('id', editingItem.id);
        } else {
          const maxOrder = staff.length > 0 ? Math.max(...staff.map(s => s.display_order)) : 0;
          await supabase.from('sales_staff').insert({ team_id: selectedTeam.id, name: formData.name, display_order: maxOrder + 1 });
        }
        fetchStaff(selectedTeam.id);
      }
      setShowModal(false);
    } catch (err) { console.error(err); alert('저장 중 오류가 발생했습니다.'); } finally { setIsSubmitting(false); }
  };

  const handleDelete = async (type: 'BRANCH' | 'TEAM' | 'STAFF', id: string) => {
    if (!window.confirm('삭제하시겠습니까? 하위 단계 데이터도 함께 삭제될 수 있습니다.')) return;
    try {
      const table = type === 'BRANCH' ? 'sales_branches' : type === 'TEAM' ? 'sales_teams' : 'sales_staff';
      await supabase.from(table).delete().eq('id', id);
      if (type === 'BRANCH') { if (selectedBranch?.id === id) setSelectedBranch(null); fetchBranches(); }
      else if (type === 'TEAM') { if (selectedTeam?.id === id) setSelectedTeam(null); if (selectedBranch) fetchTeams(selectedBranch.id); }
      else if (selectedTeam) fetchStaff(selectedTeam.id);
    } catch (err) { console.error(err); }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><Users size={28} /></div>
          <div>
            <h1 className={styles.title}>조직 및 인원 관리 (3단계)</h1>
            <p className={styles.subtitle}>지점 → 팀 → 사원 체계로 조직을 관리하세요.</p>
          </div>
        </div>
      </header>

      {isLoadingBranches ? (
        <div className={styles.loadingArea}><Loader2 className={styles.animateSpin} size={40} /><p>데이터 로딩 중...</p></div>
      ) : (
        <div className={styles.mainLayout}>
          {/* Branches Column */}
          <div className={styles.card}>
            <div className={styles.cardTitleArea}>
              <h2 className={styles.cardTitle}>지점 목록</h2>
              <button className={styles.addBtn} onClick={() => handleOpenModal('BRANCH')}><Plus size={16} /> 추가</button>
            </div>
            <div className={styles.itemList}>
              {branches.map(branch => (
                <div key={branch.id} className={`${styles.item} ${selectedBranch?.id === branch.id ? styles.itemActive : ''}`} onClick={() => setSelectedBranch(branch)}>
                  <span className={styles.itemName}>{branch.name}</span>
                  <div className={styles.itemActions}>
                    <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); handleOpenModal('BRANCH', branch); }}><Edit2 size={14} /></button>
                    <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); handleDelete('BRANCH', branch.id); }}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Teams Column */}
          <div className={styles.card}>
            <div className={styles.cardTitleArea}>
              <h2 className={styles.cardTitle}>{selectedBranch ? `[${selectedBranch.name}] 소속 팀` : '팀 관리'}</h2>
              {selectedBranch && <button className={styles.addBtn} onClick={() => handleOpenModal('TEAM')}><Plus size={16} /> 추가</button>}
            </div>
            <div className={styles.itemList}>
              {!selectedBranch ? <p className={styles.emptyState}>지점을 선택하세요.</p> :
                isLoadingTeams ? <Loader2 className={styles.animateSpin} size={24} /> :
                teams.map(team => (
                  <div key={team.id} className={`${styles.item} ${selectedTeam?.id === team.id ? styles.itemActive : ''}`} onClick={() => setSelectedTeam(team)}>
                    <span className={styles.itemName}>{team.name}</span>
                    <div className={styles.itemActions}>
                      <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); handleOpenModal('TEAM', team); }}><Edit2 size={14} /></button>
                      <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); handleDelete('TEAM', team.id); }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Staff Column */}
          <div className={styles.card}>
            <div className={styles.cardTitleArea}>
              <h2 className={styles.cardTitle}>{selectedTeam ? `[${selectedTeam.name}] 인원` : '인원 관리'}</h2>
              {selectedTeam && <button className={styles.addBtn} onClick={() => handleOpenModal('STAFF')}><Plus size={16} /> 추가</button>}
            </div>
            <div className={styles.itemList}>
              {!selectedTeam ? <p className={styles.emptyState}>팀을 선택하세요.</p> :
                isLoadingStaff ? <Loader2 className={styles.animateSpin} size={24} /> :
                staff.map(member => (
                  <div key={member.id} className={styles.item}>
                    <span className={styles.itemName}>{member.name}</span>
                    <div className={styles.itemActions}>
                      <button className={styles.actionBtn} onClick={() => handleOpenModal('STAFF', member)}><Edit2 size={14} /></button>
                      <button className={styles.actionBtn} onClick={() => handleDelete('STAFF', member.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Unified Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>{editingItem ? '수정하기' : '새로 추가'}</h3>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label}>명칭</label>
                <input className={styles.input} type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} autoFocus required />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>취소</button>
                <button type="submit" className={styles.confirmBtn} disabled={isSubmitting}>{isSubmitting ? '처리 중...' : '저장하기'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgManagementPage;
