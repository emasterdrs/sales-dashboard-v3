import React from 'react';
import {
  Target,
  History,
  BarChart3,
  Calendar,
  Database,
  Settings,
  LayoutDashboard,
  Building2,
  Users,
  TrendingUp,
  LogOut,
  MessageSquare, // Added MessageSquare as it was used but not imported
  ShieldCheck, // Added from the instruction's implied changes
  Mail, // Added from the instruction's implied changes
  ArrowRight, // Added from the instruction's implied changes
  UserCircle, // Added from the instruction's implied changes
  CheckCircle2, // Added from the instruction's implied changes
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Sidebar.module.css';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  path: string;
  isActive: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, path, isActive }) => (
  <Link to={path} className={`${styles.sidebarItem} ${isActive ? styles.active : ''}`}>
    <Icon className={styles.sidebarIcon} size={20} />
    <span>{label}</span>
  </Link>
);

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { signOut, profile, effectiveRole, setSwitchedRole } = useAuth();

  // Define menus for each role
  const isSuper = effectiveRole === 'SUPER_ADMIN';
  const isCompanyAdmin = effectiveRole === 'COMPANY_ADMIN';
  const isUser = effectiveRole === 'USER';

  const menuSections = [];

  // 1. Dashboard Menus (For Company Admin and Regular Users)
  if (isCompanyAdmin || isUser) {
    menuSections.push({
      title: "영업팀별 실적",
      items: [
        { icon: Target, label: "목표 대비", path: "/team/goal" },
        { icon: History, label: "전년 대비", path: "/team/yoy" },
        { icon: BarChart3, label: "전월 대비", path: "/team/mom" },
        { icon: Calendar, label: "누계 실적", path: "/team/acc" },
      ]
    });
    menuSections.push({
      title: "제품유형별 실적",
      items: [
        { icon: Target, label: "목표 대비", path: "/type/goal" },
        { icon: History, label: "전년 대비", path: "/type/yoy" },
        { icon: BarChart3, label: "전월 대비", path: "/type/mom" },
      ]
    });
  }

  // 2. Settings Menus (Only for Company Admin)
  if (isCompanyAdmin) {
    menuSections.push({
      title: "설정 및 관리",
      items: [
        { icon: Calendar, label: "영업일수 설정", path: "/settings/days" },
        { icon: Users, label: "조직 및 인원", path: "/settings/org" },
        { icon: Target, label: "목표 실적 설정", path: "/settings/targets" },
        { icon: Settings, label: "유형명 설정", path: "/settings/types" },
        { icon: Database, label: "데이터 업로드", path: "/settings/upload" },
        { icon: MessageSquare, label: "문의 메시지", path: "/support/inquiry" },
      ]
    });
  }

  // 3. Super Admin Menus
  if (isSuper) {
    menuSections.push({
      title: "시스템 관리 (VODA)",
      items: [
        { icon: LayoutDashboard, label: "관리자 홈", path: "/mng-voda-8a2b" },
        { icon: Building2, label: "가입 기업 관리", path: "/mng-voda-8a2b/companies" },
        { icon: MessageSquare, label: "전체 문의 확인", path: "/mng-voda-8a2b/inquiries" },
      ]
    });
  }

  const getRoleLabel = (role: string | null) => {
    switch(role) {
      case 'SUPER_ADMIN': return '슈퍼 관리자';
      case 'COMPANY_ADMIN': return '기업 관리자';
      case 'USER': return '일반 사용자';
      default: return '영업팀원';
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <TrendingUp size={28} />
        </div>
        <div>
          <span className={styles.logoTextMain}>VODA</span>
          <span className={styles.logoTextSub}>영업의 답을 보다</span>
        </div>
      </div>

      <nav className={styles.nav}>
        {/* Role Switcher (Only for Real Super Admin) */}
        {profile?.role === 'SUPER_ADMIN' && (
          <div className={styles.roleSwitcher}>
            <label>권한 시뮬레이션</label>
            <div className={styles.switcherGroup}>
              <select 
                value={effectiveRole || ''} 
                onChange={(e) => {
                  setSwitchedRole(e.target.value as any);
                  window.location.href = '/'; 
                }}
              >
                <option value="SUPER_ADMIN">슈퍼 관리자 모드</option>
                <option value="COMPANY_ADMIN">기업 관리자 모드</option>
                <option value="USER">일반 사용자 모드</option>
              </select>
            </div>
          </div>
        )}

        {menuSections.map((section, idx) => (
          <div key={idx} className={styles.section}>
            <h3 className={styles.sectionTitle}>{section.title}</h3>
            {section.items.map((item, i) => (
              <SidebarItem 
                key={i}
                icon={item.icon}
                label={item.label}
                path={item.path}
                isActive={location.pathname === item.path}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.userProfile}>
          <div className={styles.userAvatar}>
            {profile?.nickname?.substring(0, 1) || 'V'}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{profile?.nickname || '사용자'}</span>
            <span className={styles.userRole}>{getRoleLabel(effectiveRole)}</span>
          </div>
        </div>
        <button className={styles.logoutButton} onClick={signOut}>
          <LogOut size={18} />
          <span>안전 로그아웃</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
