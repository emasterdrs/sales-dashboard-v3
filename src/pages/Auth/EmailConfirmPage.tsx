import { useLocation, Link } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';
import styles from './LoginPage.module.css';

const EmailConfirmPage = () => {
  const location = useLocation();
  const email = location.state?.email || '가입하신 이메일';

  return (
    <div className={styles.container}>
      <div className={styles.loginCard} style={{ maxWidth: '450px', textAlign: 'center', padding: '40px' }}>
        <div className={styles.header}>
          <div className={`${styles.logoBadge} ${styles.successBadge}`} style={{ margin: '0 auto 24px' }}>
            <Mail size={48} color="#4F46E5" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1A202C', marginBottom: '12px' }}>
            이메일을 확인해주세요!
          </h1>
          <p style={{ color: '#4A5568', lineHeight: '1.6', marginBottom: '24px' }}>
            <strong>{email}</strong> 주소로 인증 메일을 발송했습니다.<br />
            메일함에서 버튼을 클릭하시면 가입이 완료됩니다.
          </p>
        </div>

        <div style={{ backgroundColor: '#F7FAFC', borderRadius: '12px', padding: '20px', marginBottom: '24px', textAlign: 'left' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#2D3748', marginBottom: '8px' }}>메일이 오지 않았나요?</h4>
          <ul style={{ fontSize: '13px', color: '#718096', paddingLeft: '18px', listStyleType: 'disc' }}>
            <li>스팸 메일함을 확인해 주세요.</li>
            <li>이메일 주소를 오타 없이 입력했는지 확인해 주세요.</li>
            <li>잠시 후 다시 가입을 시도해 보세요.</li>
          </ul>
        </div>

        <Link 
          to="/login" 
          className={styles.loginButton} 
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          로그인 화면으로 이동 <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
};

export default EmailConfirmPage;
