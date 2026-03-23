import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../api/supabase';
import { UserPlus, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import styles from './LoginPage.module.css'; // Reuse login styles for consistency

const SignUpPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nickname,
                    }
                }
            });

            if (signUpError) throw signUpError;

            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            setError(err.message || '회원가입에 실패했습니다.');
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
                        <h1>가입 신청 완료!</h1>
                        <p>이메일 인증을 확인하시거나 잠시 후 로그인해 주세요.</p>
                        <p>3초 후 로그인 페이지로 이동합니다...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.loginCard}>
                <div className={styles.header}>
                    <div className={styles.logoBadge}>
                        <UserPlus size={32} color="#f6ad55" />
                    </div>
                    <h1>VODA 회원가입</h1>
                    <p>영업의 답을 보는 첫 걸음</p>
                </div>

                <form onSubmit={handleSignUp} className={styles.form}>
                    {error && (
                        <div className={styles.errorAlert}>
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className={styles.inputGroup}>
                        <label>이름 / 닉네임</label>
                        <div className={styles.inputWrapper}>
                            <User size={18} className={styles.icon} />
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                placeholder="홍길동"
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>이메일 (아이디)</label>
                        <div className={styles.inputWrapper}>
                            <Mail size={18} className={styles.icon} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@company.com"
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
                                placeholder="8자 이상 입력"
                                required
                                minLength={8}
                            />
                        </div>
                    </div>

                    <button type="submit" className={styles.loginButton} disabled={loading}>
                        {loading ? '처리 중...' : '회원가입 하기'}
                    </button>
                </form>

                <div className={styles.footer}>
                    <p>이미 계정이 있으신가요? <Link to="/login">로그인하기</Link></p>
                </div>
            </div>
        </div>
    );
};

export default SignUpPage;
