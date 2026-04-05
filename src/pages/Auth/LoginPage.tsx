import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../api/supabase';
import { Lock, Mail, AlertCircle, Loader2, BarChart2, ShieldCheck, Zap } from 'lucide-react';
import styles from './LoginPage.module.css';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const targetUrl = import.meta.env.VITE_SITE_URL || window.location.origin;

    // Load saved email if rememberMe was on
    useEffect(() => {
        const savedEmail = localStorage.getItem('rememberedEmail');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
    }, []);

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

            // Handle Remember Me
            if (rememberMe) {
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberedEmail');
            }

            navigate('/');
        } catch (err: any) {
            setError(translateError(err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = async (provider: 'google' | 'azure' | 'kakao' | 'naver' | 'apple') => {
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
                {/* 🎨 Left Visual Section (Image will be chosen from samples) */}
                <div className={styles.imageSection}>
                    <img src="/login-bg.png" alt="VODA Identity Vision" className={styles.bgImg} />
                    <div className={styles.overlay}></div>
                    <div className={styles.imageContent}>
                        <h2 className={styles.premiumTitle}>Data with Vision</h2>
                        <p className={styles.subText}>비즈니스의 미래를 명확하게 시각화합니다</p>
                        
                        <ul className={styles.featureList}>
                            <li><BarChart2 size={22} className={styles.featureIcon} /><span>신속한 영업 실적 인사이트</span></li>
                            <li><Zap size={22} className={styles.featureIcon} /><span>서버 사이드 실적 자동 집계</span></li>
                            <li><ShieldCheck size={22} className={styles.featureIcon} /><span>안전한 클라우드 보안 시스템</span></li>
                        </ul>
                    </div>
                </div>

                <div className={styles.formSection}>
                    <div className={styles.loginCard}>
                        {/* 🏢 Header */}
                        <div className={styles.header}>
                            <span className={styles.titleSub}>Intelligent Sales Platform</span>
                            <h1 className={styles.mainLogoTitle}>VODA</h1>
                            <p className={styles.tagline}>성공적인 비즈니스를 위한 최적의 파트너</p>
                        </div>

                        {/* 1️⃣ Priority: Email Login Section */}
                        <div className={styles.sectionHeading}>
                            <span className={styles.headingLine}></span>
                            <span className={styles.headingText}>이메일로 바로 로그인</span>
                            <span className={styles.headingLine}></span>
                        </div>

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
                                    <input 
                                        type="email" 
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)} 
                                        placeholder="이메일 주소" 
                                        required 
                                    />
                                </div>
                            </div>
                            <div className={styles.inputGroup}>
                                <div className={styles.inputWrapper}>
                                    <Lock size={18} className={styles.icon} />
                                    <input 
                                        type="password" 
                                        value={password} 
                                        onChange={(e) => setPassword(e.target.value)} 
                                        placeholder="비밀번호" 
                                        required 
                                    />
                                </div>
                            </div>

                            <div className={styles.formOptions}>
                                <label className={styles.rememberMe}>
                                    <input 
                                        type="checkbox" 
                                        checked={rememberMe} 
                                        onChange={(e) => setRememberMe(e.target.checked)} 
                                    />
                                    <span>아이디 저장</span>
                                </label>
                                <Link to="/auth/reset" className={styles.forgotPass}>
                                    비밀번호 찾기
                                </Link>
                            </div>

                            <button type="submit" className={styles.loginButton} disabled={loading}>
                                {loading ? <Loader2 className={styles.spinner} size={20} /> : 'VODA 시작하기'}
                            </button>
                        </form>

                        {/* 2️⃣ Secondary: Social Login Section (Smaller) */}
                        <div className={styles.sectionHeading}>
                            <span className={styles.headingLine}></span>
                            <span className={styles.headingText}>다음 계정으로 간편 로그인</span>
                            <span className={styles.headingLine}></span>
                        </div>

                        <div className={styles.socialGrid}>
                            <button onClick={() => handleSocialLogin('google')} title="Google" className={`${styles.miniSocialBtn} ${styles.google}`}>
                                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                            </button>
                            <button onClick={() => handleSocialLogin('azure')} title="Microsoft" className={`${styles.miniSocialBtn} ${styles.microsoft}`}>
                                <svg width="18" height="18" viewBox="0 0 23 23"><path fill="#f3f3f3" d="M0 0h23v23H0z"/><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>
                            </button>
                            <button onClick={() => handleSocialLogin('kakao')} title="Kakao" className={`${styles.miniSocialBtn} ${styles.kakao}`}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#3c1e1e"><path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.558 1.707 4.8 4.33 6.091l-.828 3.003c-.049.18.055.365.228.414.054.015.111.018.166.009l3.541-2.358c.184.025.372.04.563.04 4.97 0 9-3.186 9-7.115S16.97 3 12 3z"/></svg>
                            </button>
                            <button onClick={() => handleSocialLogin('naver')} title="Naver" className={`${styles.miniSocialBtn} ${styles.naver}`}>
                                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#fff" d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z"/></svg>
                            </button>
                            <button onClick={() => handleSocialLogin('apple')} title="Apple" className={`${styles.miniSocialBtn} ${styles.apple}`}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M17.05 20.28c-.96.95-2.04 1.43-3.23 1.43-1.16 0-2.03-.43-2.61-.43-.58 0-1.4.38-2.43.38-1.57 0-2.92-.93-3.72-2.19-1.29-2.03-1.29-5.1-.38-6.9.59-1.15 1.57-1.84 2.59-1.84.95 0 1.63.45 2.14.45s1.3-.45 2.54-.45c1.16 0 2.12.5 2.76 1.43-2.45 1.43-2.04 4.54.49 5.86-.48 1.2-.99 2.06-1.65 2.26zM13.68 3c0 1.35-.91 2.57-2.14 2.57-.1 0-.17 0-.27-.01-.06-1.35.85-2.58 2.05-2.58.12 0 .23 0 .36.02z"/></svg>
                            </button>
                        </div>

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
