import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/Auth/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import WorkingDaysPage from './pages/Settings/WorkingDaysPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './index.css';

// Protected Route Component for Auth and Company Verification
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="loading-screen">Loading...</div>;
  
  if (!user) return <Navigate to="/login" replace />;
  
  // Requirement: Ensure user is authorized to enter (Company must be approved)
  // if (profile?.status !== 'APPROVED') return <Navigate to="/approval-pending" />;

  return <MainLayout>{children}</MainLayout>;
};

// Obfuscated Admin Route Path (Requirement: Use random paths instead of /admin)
const ADMIN_PATH = "/mng-voda-8a2b"; 

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          {/* Main Sales Dashboard Routes */}
          <Route path="/" element={<ProtectedRoute><Navigate to="/team/goal" replace /></ProtectedRoute>} />
          
          {/* Team Based Routes */}
          <Route path="/team/goal" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/team/yoy" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/team/mom" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/team/acc" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          
          {/* Type Based Routes */}
          <Route path="/type/goal" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/type/yoy" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/type/mom" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/type/acc" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          
          {/* Settings Routes */}
          <Route path="/settings/days" element={<ProtectedRoute><WorkingDaysPage /></ProtectedRoute>} />
          <Route path="/settings/org" element={<ProtectedRoute><div>조직 및 인원 관리 (개발 예정)</div></ProtectedRoute>} />
          <Route path="/settings/types" element={<ProtectedRoute><div>유형명 설정 (개발 예정)</div></ProtectedRoute>} />
          <Route path="/settings/upload" element={<ProtectedRoute><div>데이터 업로드 (개발 예정)</div></ProtectedRoute>} />
          
          {/* Support Routes */}
          <Route path="/support/inquiry" element={<ProtectedRoute><div>문의 메시지 (개발 예정)</div></ProtectedRoute>} />
          
          {/* Admin Routes (Obfuscated) */}
          <Route path={ADMIN_PATH} element={<ProtectedRoute><div>VODA 본사 슈퍼 관리자 패널</div></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
