import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../api/supabase';
import { Lock, Mail, AlertCircle, ShieldCheck } from 'lucide-react';
import styles from './LoginPage.module.css';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loginAttempts, setLoginAttempts] = useState(0);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Basic Brute Force Protection (Frontend)
        if (loginAttempts >= 5) {
            setError('보안을 위해 로그인이 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                setLoginAttempts(prev => prev + 1);
                throw authError;
            }

            navigate('/');
        } catch (err: any) {
            setError(err.message || '로그인에 실패했습니다. 아이디와 비밀번호를 확인해 주세요.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.loginCard}>
                <div className={styles.header}>
                    <div className={styles.logoBadge}>
                        <ShieldCheck size={32} color="#f6ad55" />
                    </div>
                    <h1>Sales Performance Dashboard</h1>
                    <p>보안이 강화된 프리미엄 실적 관리 솔루션</p>
                </div>

                <form onSubmit={handleLogin} className={styles.form}>
                    {error && (
                        <div className={styles.errorAlert}>
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className={styles.inputGroup}>
                        <label>아이디 (이메일)</label>
                        <div className={styles.inputWrapper}>
                            <Mail size={18} className={styles.icon} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="example@company.com"
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>비밀번호</label>
                        <div className={styles.inputWrapper}>
                            <Lock size={18} className={styles.icon} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className={styles.loginButton} disabled={loading}>
                        {loading ? '로그인 중...' : '안전하게 로그인'}
                    </button>
                </form>

                <div className={styles.footer}>
                    <p>계정이 없으신가요? <Link to="/signup">일반 회원가입</Link></p>
                    <p>우리 기업을 등록하려면? <Link to="/register-company">신규 기업 등록 신청</Link></p>
                    <div className={styles.securityNote}>
                        <p>이 서비스는 256비트 암호화로 보호됩니다.</p>
                        <p>관리자 승인 후 대시보드 접근이 가능합니다.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
