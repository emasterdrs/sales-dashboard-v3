import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabase';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      // The Supabase client automatically handles the code/session from the URL
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth callback error:', error.message);
        navigate('/login?error=auth_callback_failed');
      } else if (data.session) {
        // Successfully verified and logged in
        navigate('/');
      } else {
        // No session found, might be a malformed link or expired
        navigate('/login');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
      <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #f6ad55', borderRadius: '50%' }}></div>
      <p style={{ marginTop: '20px', color: '#4A5568' }}>인증 처리 중입니다. 잠시만 기다려 주세요...</p>
    </div>
  );
};

export default AuthCallback;
