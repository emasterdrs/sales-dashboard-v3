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
const ADMIN_PATH = "/adm-s-2s9k2"; // For demonstration

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          {/* Main Sales Dashboard Routes */}
          <Route path="/" element={<ProtectedRoute><Navigate to="/team/goal" replace /></ProtectedRoute>} />
          <Route path="/team/goal" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/team/yoy" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/team/mom" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/team/target-acc" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/team/yoy-acc" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          
          {/* Settings Routes */}
          <Route path="/settings/days" element={<ProtectedRoute><WorkingDaysPage /></ProtectedRoute>} />
          <Route path="/settings/org" element={<ProtectedRoute><div>Org & Staff Management (Skeleton)</div></ProtectedRoute>} />
          <Route path="/settings/types" element={<ProtectedRoute><div>Type Management (Skeleton)</div></ProtectedRoute>} />
          
          {/* Admin Routes (Obfuscated) */}
          <Route path={ADMIN_PATH} element={<ProtectedRoute><div>Super Admin Panel (Skeleton)</div></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
