import React from 'react';
import {
  Target,
  Calendar,
  Settings,
  LayoutDashboard,
  Building2,
  Users,
  TrendingUp,
  LogOut,
  MessageSquare,
  Database as DatabaseIcon,
  GripVertical,
  Zap,
  FileSpreadsheet,
} from 'lucide-react';

import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Sidebar.module.css';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  path: string;
  isActive: boolean;
  onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, path, isActive, onClick }) => (
  <Link 
    to={path} 
    className={`${styles.navItem} ${isActive ? styles.active : ''}`}
    onClick={onClick}
  >
    <Icon size={20} />
    <span>{label}</span>
  </Link>
);

interface SidebarProps {
  onPathChange?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onPathChange }) => {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const isSuper = profile?.role === 'SUPER_ADMIN';
  const isCompanyAdmin = profile?.role === 'COMPANY_ADMIN';
  const isUser = profile?.role === 'USER';

  const menuSections = [];

  // 1. Dashboard Menus (Available to ALL roles)
  if (isSuper || isCompanyAdmin || isUser) {
    menuSections.push({
      title: "데이터 분석",
      items: [
        { icon: LayoutDashboard, label: "통합 대시보드", path: "/dashboard" },
        { icon: FileSpreadsheet, label: "간편 엑셀 분석", path: "/excel-analysis" },
        { icon: DatabaseIcon, label: "업로드 데이터 현황", path: "/sales-records" },
      ]
    });
  }

  // 2. Company Admin Menus
  if (isCompanyAdmin) {
    menuSections.push({
      title: "설정 및 관리",
      items: [
        { icon: Calendar, label: "영업일수 설정", path: "/adm-s-2s9k2/days" },
        { icon: Users, label: "조직 및 인원", path: "/adm-s-2s9k2/org" },
        { icon: GripVertical, label: "정렬 순서 관리", path: "/adm-s-2s9k2/sort" },
        { icon: Target, label: "목표 실적 설정", path: "/adm-s-2s9k2/targets" },
        { icon: Settings, label: "유형명 설정", path: "/adm-s-2s9k2/types" },
        { icon: DatabaseIcon, label: "데이터 업로드", path: "/adm-s-2s9k2/upload" },
        { icon: MessageSquare, label: "문의 메시지", path: "/support/inquiry" },
      ]
    });
  }

  // 3. Super Admin Menus
  if (isSuper) {
    menuSections.push({
      title: "시스템 관리 (VODA)",
      items: [
        { icon: LayoutDashboard, label: "시스템 현황", path: "/mng-voda-8a2b/dashboard" },
        { icon: Building2, label: "고객사 일람", path: "/mng-voda-8a2b/companies" },
        { icon: Users, label: "사용자 관리", path: "/mng-voda-8a2b/users" },
        { icon: MessageSquare, label: "시스템 문의", path: "/mng-voda-8a2b/support" },
      ]
    });
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <TrendingUp size={28} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={styles.logoTextMain}>VODA</span>
            <span className={styles.versionBadgeTop}>v1.8.1</span>
          </div>
          <span className={styles.logoTextSub}>영업의 답을 보다</span>
        </div>
      </div>

      <nav className={styles.nav}>
        {menuSections.map((section, idx) => (
          <div key={idx} className={styles.navSection}>
            <h3 className={styles.sectionTitle}>{section.title}</h3>
            {section.items.map((item, itemIdx) => (
              <SidebarItem
                key={itemIdx}
                icon={item.icon}
                label={item.label}
                path={item.path}
                isActive={location.pathname === item.path}
                onClick={onPathChange}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.bottomSection}>
        <div className={styles.userCard}>
          <div className={styles.userAvatar}>
            {isSuper ? 'S' : profile?.nickname?.[0] || 'U'}
          </div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{profile?.nickname || '사용자'}</div>
            <div className={styles.userRole}>
              {profile?.role === 'SUPER_ADMIN' ? 'VODA 센터' : '기업 사용자'}
              <DatabaseIcon size={12} style={{ marginLeft: 4 }} />
            </div>
          </div>
        </div>
        
        <button 
          className={styles.refreshBtn}
          onClick={() => window.location.reload()}
        >
          <Zap size={14} />
          시스템 즉시 새로고침
        </button>

        <button className={styles.logoutBtn} onClick={() => signOut()}>
          <LogOut size={18} />
          <span>안전 로그아웃</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
