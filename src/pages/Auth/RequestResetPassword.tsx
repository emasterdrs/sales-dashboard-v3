import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../api/supabase';
import { Mail, ArrowLeft, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import styles from './LoginPage.module.css';

const RequestResetPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleRequestReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/update-password`,
            });

            if (resetError) throw resetError;

            setSuccess(true);
        } catch (err: any) {
            setError(err.message || '재설정 메일 발송에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className={styles.container}>
                <div className={styles.loginCard}>
                    <div className={styles.header}>
                        <div className={`${styles.logoBadge} ${styles.successBadge}`}>
                            <CheckCircle size={48} color="#48bb78" />
                        </div>
                        <h1>메일 발송 완료!</h1>
                        <p>{email} 주소로 비밀번호 재설정 링크를 보냈습니다.</p>
                        <p style={{ marginTop: '10px', fontSize: '14px', color: '#718096' }}>메일함의 링크를 클릭하여 비밀번호를 변경해 주세요.</p>
                    </div>
                    <Link to="/login" className={styles.loginButton} style={{ textDecoration: 'none', textAlign: 'center', display: 'block', backgroundColor: '#4A5568' }}>
                        로그인 화면으로 돌아가기
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.loginCard}>
                <div className={styles.header}>
                    <h1 className={styles.mainLogoTitle}>비밀번호 찾기</h1>
                    <p className={styles.tagline}>가입하신 이메일 주소를 입력해 주세요.</p>
                </div>

                <form onSubmit={handleRequestReset} className={styles.form}>
                    {error && (
                        <div className={styles.errorAlert}>
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className={styles.inputGroup}>
                        <label>이메일 주소</label>
                        <div className={styles.inputWrapper}>
                            <Mail size={18} className={styles.icon} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="voda@company.com"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className={styles.loginButton} disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" size={18} /> : '재설정 메일 보내기'}
                    </button>

                    <Link to="/login" className={styles.backLink} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '20px', color: '#718096', textDecoration: 'none', fontSize: '14px' }}>
                        <ArrowLeft size={16} />
                        로그인으로 돌아가기
                    </Link>
                </form>
            </div>
        </div>
    );
};

export default RequestResetPassword;
