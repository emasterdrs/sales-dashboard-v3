import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabase';
import { Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import styles from './LoginPage.module.css';

const UpdatePasswordPage = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            });

            if (updateError) throw updateError;

            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            setError(err.message || '비밀번호 재설정에 실패했습니다.');
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
                        <h1>비밀번호 변경 성공!</h1>
                        <p>새로운 비밀번호로 로그인해 주세요.</p>
                        <p>3초 후 로그인 화면으로 이동합니다...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.loginCard}>
                <div className={styles.header}>
                    <h1 className={styles.mainLogoTitle}>새로운 비밀번호 설정</h1>
                    <p className={styles.tagline}>보안을 위해 강력한 비밀번호를 권장합니다.</p>
                </div>

                <form onSubmit={handleUpdatePassword} className={styles.form}>
                    {error && (
                        <div className={styles.errorAlert}>
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className={styles.inputGroup}>
                        <label>비밀번호</label>
                        <div className={styles.inputWrapper}>
                            <Lock size={18} className={styles.icon} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="8자 이상 입력"
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>비밀번호 확인</label>
                        <div className={styles.inputWrapper}>
                            <Lock size={18} className={styles.icon} />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="다시 한번 입력"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className={styles.loginButton} disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" size={18} /> : '비밀번호 업데이트'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default UpdatePasswordPage;
