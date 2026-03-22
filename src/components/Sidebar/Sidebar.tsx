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
  ChevronRight,
  TrendingDown,
  LayoutDashboard
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
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

  const menuSections = [
    {
      title: "영업팀별",
      items: [
        { icon: Target, label: "목표 대비", path: "/team/goal" },
        { icon: History, label: "전년 대비", path: "/team/yoy" },
        { icon: BarChart3, label: "전월 대비", path: "/team/mom" },
        { icon: Calendar, label: "누계 (목표)", path: "/team/target-acc" },
        { icon: Database, label: "누계 (전년)", path: "/team/yoy-acc" },
      ]
    },
    {
      title: "유형별",
      items: [
        { icon: Target, label: "목표 대비", path: "/type/goal" },
        { icon: History, label: "전년 대비", path: "/type/yoy" },
        { icon: BarChart3, label: "전월 대비", path: "/type/mom" },
        { icon: Calendar, label: "누계 (목표)", path: "/type/target-acc" },
        { icon: Database, label: "누계 (전년)", path: "/type/yoy-acc" },
      ]
    },
    {
      title: "설정 및 관리",
      items: [
        { icon: Calendar, label: "영업일수 설정", path: "/settings/days" },
        { icon: Users, label: "조직 및 인원", path: "/settings/org" },
        { icon: Settings, label: "유형명 설정", path: "/settings/types" },
        { icon: LayoutDashboard, label: "데이터 업로드", path: "/settings/upload" },
        { icon: MessageSquare, label: "문의하기", path: "/support/inquiry" },
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
          <span className={styles.logoTextMain}>BNN BI</span>
          <span className={styles.logoTextSub}>SALES PERFORMANCE</span>
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
          <div className={styles.userAvatar}>JD</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>홍길동</span>
            <span className={styles.userRole}>관리자</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
