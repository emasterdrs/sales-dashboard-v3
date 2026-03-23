import React from 'react';
import { 
  Target, 
  History, 
  BarChart3, 
  Calendar, 
  Database, 
  Settings, 
  MessageSquare,
  Users,
  TrendingDown,
  LogOut,
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
  const { signOut, profile } = useAuth();

  const menuSections = [
    {
      title: "영업팀별",
      items: [
        { icon: Target, label: "목표 대비", path: "/team/goal" },
        { icon: History, label: "전년 대비", path: "/team/yoy" },
        { icon: BarChart3, label: "전월 대비", path: "/team/mom" },
        { icon: Calendar, label: "누계 실적", path: "/team/acc" },
      ]
    },
    {
      title: "유형별",
      items: [
        { icon: Target, label: "목표 대비", path: "/type/goal" },
        { icon: History, label: "전년 대비", path: "/type/yoy" },
        { icon: BarChart3, label: "전월 대비", path: "/type/mom" },
        { icon: Calendar, label: "누계 실적", path: "/type/acc" },
      ]
    },
    {
      title: "설정 및 관리",
      items: [
        { icon: Calendar, label: "영업일수 설정", path: "/settings/days" },
        { icon: Users, label: "조직 및 인원", path: "/settings/org" },
        { icon: Settings, label: "유형명 설정", path: "/settings/types" },
        { icon: Database, label: "데이터 업로드", path: "/settings/upload" },
        { icon: MessageSquare, label: "문의 메시지", path: "/support/inquiry" },
      ]
    }
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <TrendingDown size={28} />
        </div>
        <div>
          <span className={styles.logoTextMain}>VODA</span>
          <span className={styles.logoTextSub}>영업의 답을 보다</span>
        </div>
      </div>

      <nav className={styles.nav}>
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
            {profile?.nickname?.substring(0, 1) || 'U'}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{profile?.nickname || '사용자'}</span>
            <span className={styles.userRole}>{profile?.role === 'SUPER_ADMIN' ? '슈퍼 관리자' : '영업팀원'}</span>
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
