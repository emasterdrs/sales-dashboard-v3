import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../api/supabase';
import { UserPlus, Mail, Lock, User, Phone, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './LoginPage.module.css';

const SignUpPage: React.FC = () => {
    const [nickname, setNickname] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [tel, setTel] = useState('');
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const targetUrl = import.meta.env.VITE_SITE_URL || window.location.origin;

    const handleSocialSignUp = async (provider: 'google' | 'azure' | 'kakao' | 'naver') => {
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: provider as any,
                options: { redirectTo: `${targetUrl}/auth/callback` }
            });
            if (error) throw error;
        } catch (err: any) {
            setError('소셜 가입 도중 오류가 발생했습니다.');
            setLoading(false);
        }
    };

    const handleEmailSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${targetUrl}/auth/callback`,
                    data: { nickname, tel, role: 'USER' }
                }
            });
            if (signUpError) throw signUpError;
            navigate('/auth/confirm', { state: { email } });
        } catch (err: any) {
            setError(err.message || '가입에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.loginCard}>
                <div className={styles.header}>
                    <div className={styles.logoBadge}>
                        <UserPlus size={32} color="#f6ad55" />
                    </div>
                    <h1>VODA 회원가입</h1>
                    <p>간편하게 소셜 계정으로 시작하거나 이메일로 가입하세요</p>
                </div>

                <div className={styles.socialGrid}>
                    <button onClick={() => handleSocialSignUp('google')} className={`${styles.socialBtn} ${styles.google}`} disabled={loading}>
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" />
                        Google
                    </button>
                    <button onClick={() => handleSocialSignUp('azure')} className={`${styles.socialBtn} ${styles.microsoft}`} disabled={loading}>
                        <img src="https://authjs.dev/img/providers/microsoft.svg" alt="M" />
                        Microsoft
                    </button>
                    <button onClick={() => handleSocialSignUp('kakao')} className={`${styles.socialBtn} ${styles.kakao}`} disabled={loading}>
                        <img src="https://cdn.kginicis.com/html/v5.0/release/resource/img/payment/kakaotalk.png" alt="K" />
                        Kakao
                    </button>
                    <button onClick={() => handleSocialSignUp('naver')} className={`${styles.socialBtn} ${styles.naver}`} disabled={loading}>
                        <img src="https://clova-phinf.pstatic.net/MjAxODAzMjlfMTY3/MDAxNTIyMjg3MzM3OTAy.57_reidS8q_jsh9i08id9XpX9AnrXnuo9oH0U0SmtXcg._8RBy9tX9_o4T-Taqo7Ysy8wX70KIdS6Y7j-y_G_pGYg.PNG/service_icon_naver.png" alt="N" />
                        Naver
                    </button>
                </div>

                <div className={styles.toggleSection}>
                    <div className={styles.divider}><span>또는</span></div>
                    <button className={styles.toggleBtn} onClick={() => setShowEmailForm(!showEmailForm)}>
                        {showEmailForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        이메일 주소로 회원가입
                    </button>
                </div>

                {showEmailForm && (
                    <form onSubmit={handleEmailSignUp} className={styles.form}>
                        {error && <div className={styles.errorAlert}><AlertCircle size={18} /><span>{error}</span></div>}
                        <div className={styles.inputGroup}>
                            <div className={styles.inputWrapper}>
                                <User size={18} className={styles.icon} /><input type="text" value={nickname} onChange={(e)=>setNickname(e.target.value)} placeholder="성명" required />
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <div className={styles.inputWrapper}>
                                <Mail size={18} className={styles.icon} /><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="이메일" required />
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <div className={styles.inputWrapper}>
                                <Lock size={18} className={styles.icon} /><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="비밀번호" required />
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <div className={styles.inputWrapper}>
                                <Lock size={18} className={styles.icon} /><input type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} placeholder="비밀번호 확인" required />
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <div className={styles.inputWrapper}>
                                <Phone size={18} className={styles.icon} /><input type="tel" value={tel} onChange={(e)=>setTel(e.target.value)} placeholder="전화번호" required />
                            </div>
                        </div>
                        <p style={{ fontSize: '12px', color: '#718096', marginBottom: '20px' }}>
                        가입 완료 후 이메일 인증이 진행됩니다.
                    </p>

                    <button 
                        type="submit" 
                        className={styles.loginButton} 
                        disabled={loading || !email || !password || password !== confirmPassword || !nickname}
                        style={{
                            opacity: (loading || password !== confirmPassword || !password) ? 0.6 : 1,
                            cursor: (loading || password !== confirmPassword || !password) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={18}/> : '가입하기 (정보 확인 완료)'}
                    </button>
                    </form>
                )}

                <div className={styles.footer}><p>이미 계정이 있으신가요? <Link to="/login">로그인</Link></p></div>
            </div>
        </div>
    );
};

export default SignUpPage;
