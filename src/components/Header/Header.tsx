import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, Bell } from 'lucide-react';

const Header: React.FC = () => {
  const { profile } = useAuth();
  
  return (
    <header style={{ 
      height: '64px', 
      background: 'white', 
      borderBottom: '1px solid #f1f5f9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: '0 32px',
      gap: '24px'
    }}>
      <div style={{ position: 'relative', color: '#64748b', cursor: 'pointer' }}>
        <Bell size={20} />
        <span style={{ 
          position: 'absolute', 
          top: '-2px', 
          right: '-2px', 
          width: '8px', 
          height: '8px', 
          background: '#ef4444', 
          borderRadius: '50%',
          border: '2px solid white'
        }}></span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
            {profile?.nickname || '사용자'}님
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {profile?.role === 'SUPER_ADMIN' ? '마스터 관리자' : '일반 사용자'}
          </div>
        </div>
        <div style={{ 
          width: '36px', 
          height: '36px', 
          background: '#eff6ff', 
          color: '#2563eb', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <User size={20} />
        </div>
      </div>
    </header>
  );
};

export default Header;
