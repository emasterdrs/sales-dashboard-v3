import React, { useState } from 'react';
import Sidebar from '../components/Sidebar/Sidebar';
import styles from './MainLayout.module.css';
import { Menu, X } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className={styles.layout}>
      {/* Mobile Header */}
      <header className={styles.mobileHeader}>
        <button 
          className={styles.menuButton} 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className={styles.mobileLogo}>VODA</div>
      </header>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className={styles.overlay} 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className={`${styles.sidebarWrapper} ${isSidebarOpen ? styles.show : ''}`}>
        <Sidebar onPathChange={() => setIsSidebarOpen(false)} />
      </div>

      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
