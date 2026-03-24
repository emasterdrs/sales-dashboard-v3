import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import styles from './OrgManagementPage.module.css';

interface Team {
  id: string;
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
  const [teams, setTeams] = useState<Team[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  // Modal states
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, [profile?.company_id]);

  useEffect(() => {
    if (selectedTeam) {
      fetchStaff(selectedTeam.id);
    } else {
      setStaff([]);
    }
  }, [selectedTeam]);

  const fetchTeams = async () => {
    if (!profile?.company_id) return;
    setIsLoadingTeams(true);
    try {
      const { data, error } = await supabase
        .from('sales_teams')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setTeams(data || []);
      if (data && data.length > 0 && !selectedTeam) {
        setSelectedTeam(data[0]);
      }
    } catch (err) {
      console.error('Error fetching teams:', err);
    } finally {
      setIsLoadingTeams(false);
    }
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
    } catch (err) {
      console.error('Error fetching staff:', err);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  const handleOpenTeamModal = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setFormData({ name: team.name });
    } else {
      setEditingTeam(null);
      setFormData({ name: '' });
    }
    setShowTeamModal(true);
  };

  const handleOpenStaffModal = (staffMember?: Staff) => {
    if (!selectedTeam) return;
    if (staffMember) {
      setEditingStaff(staffMember);
      setFormData({ name: staffMember.name });
    } else {
      setEditingStaff(null);
      setFormData({ name: '' });
    }
    setShowStaffModal(true);
  };

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id || !formData.name) return;

    setIsSubmitting(true);
    try {
      if (editingTeam) {
        const { error } = await supabase
          .from('sales_teams')
          .update({ name: formData.name })
          .eq('id', editingTeam.id);
        if (error) throw error;
      } else {
        const maxOrder = teams.length > 0 ? Math.max(...teams.map(t => t.display_order)) : 0;
        const { error } = await supabase
          .from('sales_teams')
          .insert({
            company_id: profile.company_id,
            name: formData.name,
            display_order: maxOrder + 1
          });
        if (error) throw error;
      }
      setShowTeamModal(false);
      fetchTeams();
    } catch (err) {
      console.error('Error saving team:', err);
      alert('팀 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !formData.name) return;

    setIsSubmitting(true);
    try {
      if (editingStaff) {
        const { error } = await supabase
          .from('sales_staff')
          .update({ name: formData.name })
          .eq('id', editingStaff.id);
        if (error) throw error;
      } else {
        const maxOrder = staff.length > 0 ? Math.max(...staff.map(s => s.display_order)) : 0;
        const { error } = await supabase
          .from('sales_staff')
          .insert({
            team_id: selectedTeam.id,
            name: formData.name,
            display_order: maxOrder + 1
          });
        if (error) throw error;
      }
      setShowStaffModal(false);
      fetchStaff(selectedTeam.id);
    } catch (err) {
      console.error('Error saving staff:', err);
      alert('인원 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteTeam = async (id: string) => {
    if (!window.confirm('팀을 삭제하시겠습니까? 팀에 속한 모든 인원 데이터도 함께 삭제됩니다.')) return;
    
    try {
      const { error } = await supabase
        .from('sales_teams')
        .delete()
        .eq('id', id);
      if (error) throw error;
      if (selectedTeam?.id === id) setSelectedTeam(null);
      fetchTeams();
    } catch (err) {
      console.error('Error deleting team:', err);
    }
  };

  const deleteStaff = async (id: string) => {
    if (!window.confirm('인원을 삭제하시겠습니까?')) return;
    
    try {
      const { error } = await supabase
        .from('sales_staff')
        .delete()
        .eq('id', id);
      if (error) throw error;
      if (selectedTeam) fetchStaff(selectedTeam.id);
    } catch (err) {
      console.error('Error deleting staff:', err);
    }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><Users size={28} /></div>
          <div>
            <h1 className={styles.title}>조직 및 인원 관리</h1>
            <p className={styles.subtitle}>영업팀을 구성하고 소속 인원을 관리하세요.</p>
          </div>
        </div>
      </header>

      {isLoadingTeams ? (
        <div className={styles.loadingArea}>
          <Loader2 className={styles.animateSpin} size={40} />
          <p>데이터를 불러오는 중...</p>
        </div>
      ) : (
        <div className={styles.mainLayout}>
          {/* Teams Column */}
          <div className={styles.card}>
            <div className={styles.cardTitleArea}>
              <h2 className={styles.cardTitle}>영업팀 목록</h2>
              <button className={styles.addBtn} onClick={() => handleOpenTeamModal()}>
                <Plus size={16} /> 추가
              </button>
            </div>
            <div className={styles.itemList}>
              {teams.length === 0 ? (
                <div className={styles.emptyState}>
                  <Users size={32} />
                  <p>등록된 팀이 없습니다.</p>
                </div>
              ) : (
                teams.map(team => (
                  <div 
                    key={team.id} 
                    className={`${styles.item} ${selectedTeam?.id === team.id ? styles.itemActive : ''}`}
                    onClick={() => setSelectedTeam(team)}
                  >
                    <span className={styles.itemName}>{team.name}</span>
                    <div className={styles.itemActions}>
                      <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); handleOpenTeamModal(team); }}>
                        <Edit2 size={14} />
                      </button>
                      <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); deleteTeam(team.id); }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Staff Column */}
          <div className={styles.card}>
            <div className={styles.cardTitleArea}>
              <h2 className={styles.cardTitle}>
                {selectedTeam ? `[${selectedTeam.name}] 소속 인원` : '인원 관리'}
              </h2>
              {selectedTeam && (
                <button className={styles.addBtn} onClick={() => handleOpenStaffModal()}>
                  <Plus size={16} /> 인원 추가
                </button>
              )}
            </div>
            <div className={styles.itemList}>
              {!selectedTeam ? (
                <div className={styles.emptyState}>
                  <p>왼쪽에서 팀을 먼저 선택하세요.</p>
                </div>
              ) : isLoadingStaff ? (
                <div className={styles.emptyState}>
                  <Loader2 className={styles.animateSpin} size={24} />
                </div>
              ) : staff.length === 0 ? (
                <div className={styles.emptyState}>
                  <Users size={32} />
                  <p>해당 팀에 등록된 인원이 없습니다.</p>
                </div>
              ) : (
                staff.map(member => (
                  <div key={member.id} className={styles.item}>
                    <span className={styles.itemName}>{member.name}</span>
                    <div className={styles.itemActions}>
                      <button className={styles.actionBtn} onClick={() => handleOpenStaffModal(member)}>
                        <Edit2 size={14} />
                      </button>
                      <button className={styles.actionBtn} onClick={() => deleteStaff(member.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>{editingTeam ? '팀 수정' : '새 팀 추가'}</h3>
            <form onSubmit={handleTeamSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label}>팀 명칭</label>
                <input 
                  className={styles.input}
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 영업1팀, 경기본부 등"
                  autoFocus
                  required
                />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowTeamModal(false)}>취소</button>
                <button type="submit" className={styles.confirmBtn} disabled={isSubmitting}>
                  {isSubmitting ? '처리 중...' : '저장하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Modal */}
      {showStaffModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>{editingStaff ? '인원 정보 수정' : '팀원 추가'}</h3>
            <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>현재 팀: {selectedTeam?.name}</p>
            <form onSubmit={handleStaffSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label}>성명 / 닉네임</label>
                <input 
                  className={styles.input}
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 홍길동, 박관리 등"
                  autoFocus
                  required
                />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowStaffModal(false)}>취소</button>
                <button type="submit" className={styles.confirmBtn} disabled={isSubmitting}>
                  {isSubmitting ? '처리 중...' : '저장하기'}
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
