import React, { useState, useEffect } from 'react';
import { Target, ChevronLeft, ChevronRight, Save, Info, Loader2 } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format, addMonths, subMonths } from 'date-fns';
import styles from './TargetManagementPage.module.css';

interface TargetEntry {
  entity_id: string;
  name: string;
  target_amount: string;
  isStaff: boolean;
}

const TargetManagementPage: React.FC = () => {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'TEAM' | 'STAFF'>('TEAM');
  const [data, setData] = useState<TargetEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [currentDate, activeTab, profile?.company_id]);

  const fetchData = async () => {
    if (!profile?.company_id) return;
    setIsLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;

      // 1. Get Entities (Teams or Staff)
      let entities: any[] = [];
      if (activeTab === 'TEAM') {
        const { data: teams } = await supabase.from('sales_teams').select('id, name').eq('company_id', profile.company_id);
        entities = teams || [];
      } else {
        // Staff lookup requires team join
        const { data: teams } = await supabase.from('sales_teams').select('id').eq('company_id', profile.company_id);
        const teamIds = teams?.map(t => t.id) || [];
        const { data: staff } = await supabase.from('sales_staff').select('id, name, sales_teams(name)').in('team_id', teamIds);
        entities = (staff || []).map(s => ({
            id: s.id,
            name: `${(s.sales_teams as any)?.name} - ${s.name}`
        }));
      }

      // 2. Get Targets
      const { data: targets } = await supabase
        .from('sales_targets')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('entity_type', activeTab)
        .eq('year', year)
        .eq('month', month);

      const combined: TargetEntry[] = entities.map(e => {
        const t = targets?.find(tg => tg.entity_id === e.id);
        return {
          entity_id: e.id,
          name: e.name,
          target_amount: t ? (Number(t.target_amount) / 100000000).toString() : '0',
          isStaff: activeTab === 'STAFF'
        };
      });

      setData(combined);
    } catch (err) {
      console.error('Error fetching target data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (id: string, value: string) => {
    // Only allow numbers and decimal
    const cleanValue = value.replace(/[^0-9.]/g, '');
    setData(prev => prev.map(item => 
      item.entity_id === id ? { ...item, target_amount: cleanValue } : item
    ));
  };

  const handleSave = async () => {
    if (!profile?.company_id) return;
    setIsSaving(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      const upserts = data.map(item => ({
        company_id: profile.company_id,
        entity_type: activeTab,
        entity_id: item.entity_id,
        year,
        month,
        target_amount: Math.round(Number(item.target_amount) * 100000000) // Convert back to KRW
      }));

      const { error } = await supabase
        .from('sales_targets')
        .upsert(upserts, { onConflict: 'company_id, entity_type, entity_id, year, month' });

      if (error) throw error;
      alert('목표 실적 설정이 저장되었습니다.');
    } catch (err) {
      console.error('Error saving targets:', err);
      alert('저장 도중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><Target size={28} /></div>
          <div>
            <h1 className={styles.title}>목표 실적 설정</h1>
            <p className={styles.subtitle}>팀 및 개인별 월간 영업 목표를 관리하세요.</p>
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.monthSelector}>
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} style={{border: 'none', background: 'transparent', cursor: 'pointer'}}><ChevronLeft size={20}/></button>
            <span className={styles.currentMonth}>{format(currentDate, 'yyyy년 MM월')}</span>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} style={{border: 'none', background: 'transparent', cursor: 'pointer'}}><ChevronRight size={20}/></button>
          </div>
          <button className={styles.saveBtn} onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? <Loader2 className={styles.animateSpin} size={18} /> : <Save size={18} />}
            {isSaving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </header>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'TEAM' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('TEAM')}
        >
          영업팀별 목표
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'STAFF' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('STAFF')}
        >
          영업사원별 목표
        </button>
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
                <th style={{ width: '50%' }}>{activeTab === 'TEAM' ? '영업팀 명칭' : '소속팀 및 성함'}</th>
                <th>목표 매출액</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => (
                <tr key={item.entity_id}>
                  <td>
                    <span className={styles.entityName}>{item.name}</span>
                  </td>
                  <td>
                    <div className={styles.inputGroup}>
                      <input 
                        className={styles.input}
                        type="text" 
                        value={item.target_amount}
                        onChange={(e) => handleInputChange(item.entity_id, e.target.value)}
                        placeholder="0.0"
                      />
                      <span className={styles.unitLabel}>억원</span>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                    등록된 {activeTab === 'TEAM' ? '팀' : '팀원'}이 없습니다. 먼저 조직 관리를 진행해주세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.infoBox}>
        <Info size={24} color="#3b82f6" />
        <p>
          매달 첫 번째 영업활동 전 목표를 설정하시기 바랍니다. <br />
          설정된 목표액은 대시보드에서 실시간 실적과 비교되어 달성률(%) 및 성과 지표 산출에 사용됩니다.
        </p>
      </div>
    </div>
  );
};

export default TargetManagementPage;
