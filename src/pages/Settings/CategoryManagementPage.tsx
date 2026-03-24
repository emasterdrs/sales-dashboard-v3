import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, Loader2 } from 'lucide-react';
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

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'PARENT' | 'SUB'>('PARENT');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleOpenModal = (type: 'PARENT' | 'SUB', category?: Category) => {
    setModalType(type);
    if (category) {
      setEditingCategory(category);
      setFormData({ name: category.name });
    } else {
      setEditingCategory(null);
      setFormData({ name: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id || !formData.name) return;

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('product_categories')
          .update({ name: formData.name })
          .eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const parentId = modalType === 'SUB' ? selectedParent?.id : null;
        const currentList = modalType === 'SUB' ? subCategories : categories;
        const maxOrder = currentList.length > 0 ? Math.max(...currentList.map(c => c.display_order)) : 0;
        
        const { error } = await supabase
          .from('product_categories')
          .insert({
            company_id: profile.company_id,
            name: formData.name,
            parent_id: parentId,
            display_order: maxOrder + 1
          });
        if (error) throw error;
      }
      setShowModal(false);
      if (modalType === 'PARENT') fetchParents();
      else if (selectedParent) fetchSubs(selectedParent.id);
    } catch (err) {
      console.error('Error saving:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까? 하위 유형이 있는 경우 함께 삭제되거나 데이터 무결성에 영향을 줄 수 있습니다.')) return;

    try {
      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
      
      if (selectedParent?.id === id) setSelectedParent(null);
      fetchParents();
      if (selectedParent) fetchSubs(selectedParent.id);
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><Settings size={28} /></div>
          <div>
            <h1 className={styles.title}>유형명 설정</h1>
            <p className={styles.subtitle}>대분류 및 하위 상세 유형을 관리하세요.</p>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className={styles.loadingArea}>
          <Loader2 className={styles.animateSpin} size={40} />
          <p>데이터를 불러오는 중...</p>
        </div>
      ) : (
        <div className={styles.mainLayout}>
          {/* Parent Categories */}
          <div className={styles.card}>
            <div className={styles.cardTitleArea}>
              <h2 className={styles.cardTitle}>대분류 설정</h2>
              <button className={styles.addBtn} onClick={() => handleOpenModal('PARENT')}>
                <Plus size={16} /> 분류 추가
              </button>
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
                    <div className={styles.itemActions}>
                      <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); handleOpenModal('PARENT', cat); }}>
                        <Edit2 size={14} />
                      </button>
                      <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sub Categories */}
          <div className={styles.card}>
            <div className={styles.cardTitleArea}>
              <h2 className={styles.cardTitle}>
                {selectedParent ? `[${selectedParent.name}] 하위 유형` : '하위 유형 설정'}
              </h2>
              {selectedParent && (
                <button className={styles.addBtn} onClick={() => handleOpenModal('SUB')}>
                  <Plus size={16} /> 유형 추가
                </button>
              )}
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
                  <div key={sub.id} className={styles.item}>
                    <span className={styles.itemName}>{sub.name}</span>
                    <div className={styles.itemActions}>
                      <button className={styles.actionBtn} onClick={() => handleOpenModal('SUB', sub)}>
                        <Edit2 size={14} />
                      </button>
                      <button className={styles.actionBtn} onClick={() => deleteCategory(sub.id)}>
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

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>
              {editingCategory ? '수정하기' : (modalType === 'PARENT' ? '대분류 추가' : '하위 유형 추가')}
            </h3>
            {modalType === 'SUB' && selectedParent && (
              <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                상위 분류: {selectedParent.name}
              </p>
            )}
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label}>명칭</label>
                <input 
                  className={styles.input}
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 카드, 보험, 기기판매 등"
                  autoFocus
                  required
                />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>취소</button>
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

export default CategoryManagementPage;
