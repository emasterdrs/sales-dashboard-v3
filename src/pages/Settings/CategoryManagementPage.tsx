import React, { useState, useEffect } from 'react';
import { Settings, Info, Loader2 } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import styles from './CategoryManagementPage.module.css';

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  display_order: number;
}

const CategoryManagementPage: React.FC = () => {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [selectedParent, setSelectedParent] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSub, setIsLoadingSub] = useState(false);

  useEffect(() => {
    fetchParents();
  }, [profile?.company_id]);

  useEffect(() => {
    if (selectedParent) {
      fetchSubs(selectedParent.id);
    } else {
      setSubCategories([]);
    }
  }, [selectedParent]);

  const fetchParents = async () => {
    if (!profile?.company_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('company_id', profile.company_id)
        .is('parent_id', null)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
      if (data && data.length > 0 && !selectedParent) {
          setSelectedParent(data[0]);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubs = async (parentId: string) => {
    setIsLoadingSub(true);
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('parent_id', parentId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setSubCategories(data || []);
    } catch (err) {
      console.error('Error fetching sub-categories:', err);
    } finally {
      setIsLoadingSub(false);
    }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><Settings size={28} /></div>
          <div>
            <h1 className={styles.title}>제품유형 설정 (조회 전용)</h1>
            <p className={styles.subtitle}>대분류 및 하위 상세 유형 현황입니다.</p>
          </div>
        </div>
        <div style={{ marginTop: '20px', background: '#F1F5F9', borderLeft: '4px solid #64748B', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '4px' }}>
          <Info size={18} color="#64748B" />
          <p style={{ fontSize: '14px', color: '#334155', fontWeight: '500' }}>유형 데이터는 '엑셀 업로드' 시 자동으로 등록됩니다. 수기 기능은 제한됩니다.</p>
        </div>
      </header>

      {isLoading ? (
        <div className={styles.loadingArea}>
          <Loader2 className={styles.animateSpin} size={40} />
          <p>데이터를 불러오는 중...</p>
        </div>
      ) : (
        <div className={styles.mainLayout}>
          <div className={styles.card}>
            <div className={styles.cardTitleArea}>
              <h2 className={styles.cardTitle}>대분류 현황</h2>
            </div>
            <div className={styles.itemList}>
              {categories.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>등록된 대분류가 없습니다.</p>
                </div>
              ) : (
                categories.map(cat => (
                  <div 
                    key={cat.id} 
                    className={`${styles.item} ${selectedParent?.id === cat.id ? styles.itemActive : ''}`}
                    onClick={() => setSelectedParent(cat)}
                  >
                    <span className={styles.itemName}>{cat.name}</span>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>#{cat.display_order}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitleArea}>
              <h2 className={styles.cardTitle}>
                {selectedParent ? `[${selectedParent.name}] 하위 유형` : '하위 유형 현황'}
              </h2>
            </div>
            <div className={styles.itemList}>
              {!selectedParent ? (
                <div className={styles.emptyState}>
                  <p>왼쪽에서 대분류를 먼저 선택하세요.</p>
                </div>
              ) : isLoadingSub ? (
                <div className={styles.emptyState}>
                  <Loader2 className={styles.animateSpin} size={24} />
                </div>
              ) : subCategories.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>등록된 하위 유형이 없습니다.</p>
                </div>
              ) : (
                subCategories.map(sub => (
                  <div key={sub.id} className={styles.item} style={{ cursor: 'default' }}>
                    <span className={styles.itemName}>{sub.name}</span>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>#{sub.display_order}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManagementPage;
