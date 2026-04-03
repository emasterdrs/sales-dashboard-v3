import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../api/supabase';
import { Lock, Mail, AlertCircle, Loader2, BarChart2, ShieldCheck, Zap } from 'lucide-react';
import styles from './LoginPage.module.css';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const targetUrl = import.meta.env.VITE_SITE_URL || window.location.origin;

    const translateError = (message: string) => {
        if (message.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 일치하지 않습니다.';
        if (message.includes('Email not confirmed')) return '이메일 인증이 완료되지 않았습니다.';
        return '로그인에 실패했습니다. 다시 시도해 주세요.';
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
            if (authError) throw authError;
            navigate('/');
        } catch (err: any) {
            setError(translateError(err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider: 'google' | 'azure' | 'kakao' | 'naver') => {
        setLoading(true);
        setError(null);
        try {
            const options: any = { redirectTo: `${targetUrl}/auth/callback` };
            if (provider === 'azure') options.scopes = 'openid profile email offline_access';

            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider as any,
                options
            });
            if (error) throw error;
        } catch (err: any) {
            setError('인증 요청 중 오류가 발생했습니다.');
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.loginWrapper}>
                {/* 왼쪽 상세 비주얼 섹션 */}
                <div className={styles.imageSection}>
                    <div className={styles.overlay}></div>
                    <img src="/voda-brand-v1.png" alt="VODA Brand Visual" />
                    <div className={styles.imageContent}>
                        <h2 className={styles.premiumTitle}>Data with Vision</h2>
                        <p className={styles.subText}>비즈니스의 미래를 명확하게 시각화합니다</p>
                        
                        <ul className={styles.featureList}>
                            <li><BarChart2 size={24} color="#f6ad55" /><span>실시간 실적 대시보드</span></li>
                            <li><Zap size={24} color="#f6ad55" /><span>스마트 데이터 분석 솔루션</span></li>
                            <li><ShieldCheck size={24} color="#f6ad55" /><span>안전한 기업 데이터 보안</span></li>
                        </ul>
                    </div>
                </div>

                <div className={styles.formSection}>
                    <div className={styles.loginCard}>
                        {/* 1. 상단 로고 & 타이틀 */}
                        <div className={styles.header}>
                            <span className={styles.titleSub}>스마트 매출실적 대시보드</span>
                            <h1 className={styles.mainLogoTitle}>VODA</h1>
                            <p className={styles.tagline}>간편하게 로그인하고 핵심 지표를 확인하세요</p>
                        </div>

                        {/* 2. 소셜 로그인 섹션 (2x2 그리드 항상 노출) */}
                        <div className={styles.socialGrid}>
                            <button onClick={() => handleSocialLogin('google')} className={`${styles.socialBtn} ${styles.google}`} disabled={loading}>
                                <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                Google
                            </button>
                            <button onClick={() => handleSocialLogin('azure')} className={`${styles.socialBtn} ${styles.microsoft}`} disabled={loading}>
                                <svg width="20" height="20" viewBox="0 0 23 23"><path fill="#f3f3f3" d="M0 0h23v23H0z"/><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
                                Microsoft
                            </button>
                            <button onClick={() => handleSocialLogin('kakao')} className={`${styles.socialBtn} ${styles.kakao}`} disabled={loading}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="#3c1e1e"><path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.558 1.707 4.8 4.33 6.091l-.828 3.003c-.049.18.055.365.228.414.054.015.111.018.166.009l3.541-2.358c.184.025.372.04.563.04 4.97 0 9-3.186 9-7.115S16.97 3 12 3z"/></svg>
                                Kakao
                            </button>
                            <button onClick={() => handleSocialLogin('naver')} className={`${styles.socialBtn} ${styles.naver}`} disabled={loading}>
                                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#fff" d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z"/></svg>
                                Naver
                            </button>
                        </div>

                        {/* 3. 구분선 (Divider) */}
                        <div className={styles.divider}>
                            <span>또는 이메일로 로그인</span>
                        </div>

                        {/* 4. 이메일 로그인 폼 (항상 노출) */}
                        <form onSubmit={handleEmailLogin} className={styles.form}>
                            {error && (
                                <div className={styles.errorAlert}>
                                    <AlertCircle size={18} />
                                    <span>{error}</span>
                                </div>
                            )}
                            <div className={styles.inputGroup}>
                                <div className={styles.inputWrapper}>
                                    <Mail size={18} className={styles.icon} />
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일 주소" required />
                                </div>
                            </div>
                            <div className={styles.inputGroup}>
                                <div className={styles.inputWrapper}>
                                    <Lock size={18} className={styles.icon} />
                                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" required />
                                </div>
                            </div>
                            <button type="submit" className={styles.loginButton} disabled={loading}>
                                {loading ? <Loader2 className="animate-spin" size={18} /> : '안전하게 로그인'}
                            </button>
                            <div style={{ textAlign: 'center', marginTop: '-12px' }}>
                                <Link to="/auth/reset" style={{ fontSize: '13px', color: '#718096', textDecoration: 'none' }}>
                                    비밀번호를 잊으셨나요?
                                </Link>
                            </div>
                        </form>

                        <div className={styles.footer}>
                            <p>계정이 없으신가요? <Link to="/signup">회원가입</Link></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
