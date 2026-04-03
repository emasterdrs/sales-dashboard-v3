import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Loader2, CheckCircle2, X } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import styles from './InquiryPage.module.css';

interface Inquiry {
  id: string;
  user_id: string;
  company_id: string;
  subject: string;
  content: string;
  answer_content: string | null;
  status: 'OPEN' | 'CLOSED';
  created_at: string;
  profiles: { full_name: string; email: string };
}

const InquiryPage: React.FC = () => {
  const { profile } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  
  // Form states
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';

  const fetchInquiries = React.useCallback(async () => {
    if (!profile?.id) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('inquiries')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });

      if (!isSuperAdmin) {
        query = query.eq('user_id', profile.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInquiries(data as Inquiry[] || []);
    } catch (err) {
      console.error('Error fetching inquiries:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id, isSuperAdmin]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);


  const handleCreate = async () => {
    if (!subject || !content || !profile?.company_id) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('inquiries').insert([{
        user_id: profile.id,
        company_id: profile.company_id,
        subject,
        content,
        status: 'OPEN'
      }]);
      if (error) throw error;
      setSubject('');
      setContent('');
      setShowModal(false);
      fetchInquiries();
    } catch (err) {
      console.error('Error creating inquiry:', err);
      alert('문의 제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAnswer = async () => {
    if (!selectedInquiry || !answer) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('inquiries')
        .update({ 
          answer_content: answer,
          status: 'CLOSED'
        })
        .eq('id', selectedInquiry.id);
      
      if (error) throw error;
      setSelectedInquiry(null);
      setAnswer('');
      fetchInquiries();
    } catch (err) {
      console.error('Error updating answer:', err);
      alert('답변 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDetail = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setAnswer(inquiry.answer_content || '');
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><MessageSquare size={28} /></div>
          <div>
            <h1 className={styles.title}>{isSuperAdmin ? '전체 문의 관리' : '문의 게시판'}</h1>
            <p className={styles.subtitle}>{isSuperAdmin ? '사용자들이 제출한 모든 문의사항을 확인하고 답변하세요.' : 'VODA 서비스 이용 중 발생한 궁금한 사항을 남겨주시면 관리자가 답변해 드립니다.'}</p>
          </div>
        </div>
        {!isSuperAdmin && (
          <button className={styles.addBtn} onClick={() => setShowModal(true)}>
            <Plus size={20} /> 문의하기
          </button>
        )}
      </header>

      <div className={styles.listCard}>
        {isLoading ? (
          <div className={styles.emptyState}>
            <Loader2 className={styles.animateSpin} size={40} />
            <p style={{ marginTop: 16 }}>데이터를 불러오는 중...</p>
          </div>
        ) : (
          <table className={styles.inquiryList}>
            <thead>
              <tr>
                <th style={{ width: '10%' }}>상태</th>
                <th style={{ width: '40%' }}>제목</th>
                {isSuperAdmin && <th style={{ width: '20%' }}>작성자</th>}
                <th style={{ width: '20%' }}>작성일</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map(item => (
                <tr key={item.id} className={styles.row} onClick={() => openDetail(item)}>
                  <td>
                    <span className={`${styles.statusBadge} ${item.status === 'OPEN' ? styles.statusOpen : styles.statusClosed}`}>
                      {item.status === 'OPEN' ? '검토 중' : '답변 완료'}
                    </span>
                  </td>
                  <td className={styles.subject}>{item.subject}</td>
                  {isSuperAdmin && <td>{item.profiles?.full_name} ({item.profiles?.email})</td>}
                  <td>{format(new Date(item.created_at), 'yyyy-MM-dd HH:mm')}</td>
                </tr>
              ))}
              {inquiries.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 4 : 3} className={styles.emptyState}>
                    등록된 문의 내역이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Inquiry Modal (New) */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>새로운 문의 등록</h2>
            <div className={styles.formGroup}>
              <label className={styles.label}>제목</label>
              <input 
                className={styles.input} 
                value={subject} 
                onChange={e => setSubject(e.target.value)}
                placeholder="간결한 문의 제목을 입력해주세요."
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>상세 내용</label>
              <textarea 
                className={styles.textarea} 
                value={content} 
                onChange={e => setContent(e.target.value)}
                placeholder="궁금하신 내용을 입력해주세요."
              />
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>취소</button>
              <button 
                className={styles.submitBtn} 
                onClick={handleCreate}
                disabled={isSubmitting || !subject || !content}
              >
                {isSubmitting ? <Loader2 className={styles.animateSpin} size={18} /> : '문의 제출하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal (View/Answer) */}
      {selectedInquiry && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <span className={`${styles.statusBadge} ${selectedInquiry.status === 'OPEN' ? styles.statusOpen : styles.statusClosed}`}>
                {selectedInquiry.status === 'OPEN' ? '검토 중' : '답변 완료'}
              </span>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setSelectedInquiry(null)}>
                <X size={24} color="#94A3B8" />
              </button>
            </div>
            <h2 className={styles.modalTitle}>{selectedInquiry.subject}</h2>
            <div className={styles.contentView}>{selectedInquiry.content}</div>

            {(selectedInquiry.answer_content || isSuperAdmin) && (
              <div className={styles.answerArea}>
                <div className={styles.answerTitle}>
                  <CheckCircle2 size={18} /> VODA 관리자 답변
                </div>
                {isSuperAdmin && selectedInquiry.status === 'OPEN' ? (
                  <>
                    <textarea 
                      className={styles.adminAnswerInput}
                      value={answer}
                      onChange={e => setAnswer(e.target.value)}
                      placeholder="답변 내용을 입력해주세요."
                    />
                    <div className={styles.modalFooter}>
                      <button 
                        className={styles.submitBtn}
                        onClick={handleUpdateAnswer}
                        disabled={isSubmitting || !answer}
                      >
                        {isSubmitting ? <Loader2 className={styles.animateSpin} size={18} /> : '답변 등록 및 종결'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className={styles.answerView}>
                    {selectedInquiry.answer_content || '아직 답변이 등록되지 않았습니다.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InquiryPage;
