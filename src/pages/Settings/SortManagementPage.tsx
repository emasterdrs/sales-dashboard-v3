import React, { useState, useEffect } from 'react';
import { Reorder, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Users, 
  User, 
  Layers, 
  GripVertical, 
  Save, 
  Loader2, 
  Info 
} from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import styles from './SortManagementPage.module.css';

type TabType = 'DIVISION' | 'TEAM' | 'STAFF' | 'CATEGORY';

const SortManagementPage: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('DIVISION');
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [profile?.company_id, activeTab]);

  const fetchItems = async () => {
    if (!profile?.company_id) return;
    setIsLoading(true);
    try {
      let query: any;
      if (activeTab === 'DIVISION') {
        query = supabase.from('sales_divisions').select('id, name, display_order').eq('company_id', profile.company_id);
      } else if (activeTab === 'TEAM') {
        query = supabase.from('sales_teams').select('id, name, display_order').eq('company_id', profile.company_id);
      } else if (activeTab === 'STAFF') {
        // For staff, we might want to filter by team, but for "Global Sort" we just show all
        const { data: teams } = await supabase.from('sales_teams').select('id').eq('company_id', profile.company_id);
        const teamIds = teams?.map(t => t.id) || [];
        query = supabase.from('sales_staff').select('id, name, display_order').in('team_id', teamIds.length > 0 ? teamIds : ['']);
      } else if (activeTab === 'CATEGORY') {
        query = supabase.from('product_categories').select('id, name, display_order').eq('company_id', profile.company_id);
      }

      const { data, error } = await query.order('display_order', { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReorder = (newOrder: any[]) => {
    setItems(newOrder);
  };

  const saveOrder = async () => {
    if (items.length === 0) return;
    setIsSaving(true);
    try {
      const tableMap: Record<TabType, string> = {
        DIVISION: 'sales_divisions',
        TEAM: 'sales_teams',
        STAFF: 'sales_staff',
        CATEGORY: 'product_categories'
      };

      const table = tableMap[activeTab];
      const updates = items.map((item, index) => ({
        id: item.id,
        display_order: index
      }));

      // In Supabase, upsert for multiple rows requires a unique key (id) 
      const { error } = await supabase.from(table).upsert(updates, { onConflict: 'id' });
      if (error) throw error;
      
      alert('정렬 순서가 저장되었습니다.');
    } catch (err: any) {
      alert(`저장 중 오류: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: { type: TabType; label: string; icon: any }[] = [
    { type: 'DIVISION', label: '사업부', icon: Building2 },
    { type: 'TEAM', label: '팀', icon: Users },
    { type: 'STAFF', label: '사원', icon: User },
    { type: 'CATEGORY', label: '제품유형', icon: Layers },
  ];

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><GripVertical size={28} /></div>
          <div>
            <h1 className={styles.title}>전체 정렬 관리</h1>
            <p className={styles.subtitle}>드래그 앤 드롭으로 대시보드 및 리스트 노출 순서를 변경하세요.</p>
          </div>
        </div>
        <button 
          className={styles.saveBtn} 
          onClick={saveOrder} 
          disabled={isSaving || items.length === 0}
        >
          {isSaving ? <Loader2 className={styles.animateSpin} size={20} /> : <Save size={20} />}
          {isSaving ? '저장 중...' : '변경사항 저장'}
        </button>
      </header>

      <div className={styles.tabBar}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.type}
              className={`${styles.tab} ${activeTab === tab.type ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.type)}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.sortCard}>
        <div className={styles.infoBox}>
          <Info size={16} />
          <span>항목을 위아래로 끌어서 순서를 조정한 후 상단의 저장 버튼을 눌러주세요.</span>
        </div>

        {isLoading ? (
          <div className={styles.loadingArea}>
            <Loader2 className={styles.animateSpin} size={32} />
            <p>데이터를 가져오고 있습니다...</p>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.emptyArea}>
            <p>정렬할 항목이 없습니다.</p>
          </div>
        ) : (
          <Reorder.Group axis="y" values={items} onReorder={handleReorder} className={styles.list}>
            <AnimatePresence>
              {items.map((item) => (
                <Reorder.Item 
                  key={item.id} 
                  value={item}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={styles.item}
                >
                  <div className={styles.itemContent}>
                    <div className={styles.grip}>
                      <GripVertical size={18} />
                    </div>
                    <span className={styles.index}>{items.indexOf(item) + 1}</span>
                    <span className={styles.name}>{item.name}</span>
                  </div>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </div>
    </div>
  );
};

export default SortManagementPage;
