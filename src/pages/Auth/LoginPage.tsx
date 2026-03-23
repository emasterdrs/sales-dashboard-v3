import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../api/supabase';
import { Lock, Mail, AlertCircle, TrendingUp } from 'lucide-react';
import styles from './LoginPage.module.css';

const LoginPage: React.FC = () => {
    const [loginId, setLoginId] = useState(''); // Use Login ID instead of email
    const [password, setPassword] = useState('');
    const [rememberId, setRememberId] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loginAttempts, setLoginAttempts] = useState(0);
    const navigate = useNavigate();

    // Check for saved ID on mount
    React.useEffect(() => {
        const savedId = localStorage.getItem('voda_saved_id');
        if (savedId) {
            setLoginId(savedId);
            setRememberId(true);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (loginAttempts >= 5) {
            setError('보안을 위해 로그인이 일시적으로 제한되었습니다. 잠시 후 다시 시도해 주세요.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let emailToUse = loginId;

            // Step 1: Check if input is a Username/LoginID (not email format)
            if (!loginId.includes('@')) {
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('username', loginId)
                    .single();
                
                if (profileError || !profileData) {
                    throw new Error('등록되지 않은 아이디입니다.');
                }
                emailToUse = profileData.email;
            }

            // Step 2: Perform Login
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: emailToUse,
                password,
            });

            if (authError) throw authError;

            // Step 3: Remember ID if checked
            if (rememberId) {
                localStorage.setItem('voda_saved_id', loginId);
            } else {
                localStorage.removeItem('voda_saved_id');
            }

            navigate('/');
        } catch (err: any) {
            setLoginAttempts(prev => prev + 1);
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
                        <TrendingUp size={32} color="#f6ad55" />
                    </div>
                    <h1>스마트 매출실적 대시보드 VODA</h1>
                    <p>한눈에 들어오는 우리 회사의 스마트한 성적표</p>
                </div>

                <form onSubmit={handleLogin} className={styles.form}>
                    {error && (
                        <div className={styles.errorAlert}>
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className={styles.inputGroup}>
                        <label>아이디 (ID)</label>
                        <div className={styles.inputWrapper}>
                            <Mail size={18} className={styles.icon} />
                            <input
                                type="text"
                                value={loginId}
                                onChange={(e) => setLoginId(e.target.value)}
                                placeholder="아이디를 입력하세요"
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
                                placeholder="비밀번호를 입력하세요"
                                required
                            />
                        </div>
                    </div>

                    <label className={styles.rememberMe}>
                        <input 
                            type="checkbox" 
                            checked={rememberId} 
                            onChange={(e) => setRememberId(e.target.checked)} 
                        />
                        아이디 저장
                    </label>

                    <button type="submit" className={styles.loginButton} disabled={loading}>
                        {loading ? '로그인 중...' : '안전하게 로그인'}
                    </button>
                </form>

                <div className={styles.footer}>
                    <p>계정이 없으신가요? <Link to="/signup">일반 회원가입</Link></p>
                    <p>우리 기업을 등록하려면? <Link to="/register-company">신규 기업 등록 신청</Link></p>
                    <div className={styles.securityNote}>
                        <p>VODA는 소중한 데이터를 안전하게 보호하고 있습니다.</p>
                        <p>가입 후 승인 절차가 완료되면 바로 이용하실 수 있습니다.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
