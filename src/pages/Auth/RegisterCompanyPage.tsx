import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../api/supabase';
import { Building2, Mail, Lock, User, AlertCircle, CheckCircle, FileUp } from 'lucide-react';
import styles from './LoginPage.module.css'; // Reuse login styles for consistency

const RegisterCompanyPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [username, setUsername] = useState('');
    const [tel, setTel] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [businessRegDoc, setBusinessRegDoc] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Sign up user
            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nickname,
                        username,
                        tel,
                        role: 'COMPANY_ADMIN',
                    }
                }
            });

            if (signUpError) throw signUpError;
            if (!authData.user) throw new Error('회원가입 중 오류가 발생했습니다.');

            // 2. Upload Business Reg Doc (Simplified Mock for now)
            if (businessRegDoc) {
                console.log('Uploading business registration doc:', businessRegDoc.name);
            }
            
            // 3. Create Company (Pending Approval)
            const { data: companyData, error: companyError } = await supabase
                .from('companies')
                .insert([{
                    name: companyName,
                    status: 'PENDING_APPROVAL',
                }])
                .select()
                .single();

            if (companyError) throw companyError;

            // 4. Update Profile with role and company_id
            const { error: profileUpdateError } = await supabase
                .from('profiles')
                .update({ 
                    role: 'COMPANY_ADMIN', 
                    company_id: companyData.id 
                })
                .eq('id', authData.user.id);

            if (profileUpdateError) throw profileUpdateError;

            setSuccess(true);
        } catch (err: any) {
            setError(err.message || '기업 등록에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className={styles.container}>
                <div className={styles.loginCard}>
                    <div className={styles.header}>
                        <div className={styles.logoBadge} style={{ background: '#48bb78' }}>
                            <CheckCircle size={48} color="white" />
                        </div>
                        <h1>기업 등록 신청 완료!</h1>
                        <p>본사(슈퍼관리자)에서 서류 검토 후 최종 승인을 거쳐 서비스가 활성화됩니다.</p>
                        <p>승인 결과는 이메일로 안내됩니다.</p>
                        <button onClick={() => navigate('/login')} className={styles.loginButton} style={{ marginTop: '20px' }}>
                            로그인 화면으로 이동
                        </button>
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
                        <Building2 size={32} color="#f6ad55" />
                    </div>
                    <h1>VODA 신규 기업 등록</h1>
                    <p>우리 기업만의 스마트한 매출 대시보드</p>
                </div>

                <form onSubmit={handleRegister} className={styles.form}>
                    {error && (
                        <div className={styles.errorAlert}>
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className={styles.inputGroup}>
                        <label>기업명 (회사명)</label>
                        <div className={styles.inputWrapper}>
                            <Building2 size={18} className={styles.icon} />
                            <input
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder="(주) 보나 솔루션"
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>대표 관리자 이름</label>
                        <div className={styles.inputWrapper}>
                            <User size={18} className={styles.icon} />
                            <input
                                type="text"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                placeholder="관리자 본인 이름"
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>관리자 아이디 (ID)</label>
                        <div className={styles.inputWrapper}>
                            <User size={18} className={styles.icon} />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="voda_admin"
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>관리자 이메일</label>
                        <div className={styles.inputWrapper}>
                            <Mail size={18} className={styles.icon} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@company.com"
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>관리자 전화번호</label>
                        <div className={styles.inputWrapper}>
                            <Mail size={18} className={styles.icon} />
                            <input
                                type="tel"
                                value={tel}
                                onChange={(e) => setTel(e.target.value)}
                                placeholder="010-0000-0000"
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

                    <div className={styles.inputGroup}>
                        <label>사업자등록증 첨부</label>
                        <div className={styles.inputWrapper}>
                            <FileUp size={18} className={styles.icon} />
                            <input
                                type="file"
                                onChange={(e) => setBusinessRegDoc(e.target.files?.[0] || null)}
                                className={styles.fileInput}
                            />
                        </div>
                    </div>

                    <button type="submit" className={styles.loginButton} disabled={loading}>
                        {loading ? '등록 신청 중...' : '기업 등록 신청하기'}
                    </button>
                </form>

                <div className={styles.footer}>
                    <p>계정이 이미 있으신가요? <Link to="/login">로그인</Link></p>
                </div>
            </div>
        </div>
    );
};

export default RegisterCompanyPage;
