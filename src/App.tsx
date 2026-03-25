import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/Auth/LoginPage';
import SignUpPage from './pages/Auth/SignUpPage';
import RegisterCompanyPage from './pages/Auth/RegisterCompanyPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import WorkingDaysPage from './pages/Settings/WorkingDaysPage';
import OrgManagementPage from './pages/Settings/OrgManagementPage';
import CategoryManagementPage from './pages/Settings/CategoryManagementPage';
import DataUploadPage from './pages/Settings/DataUploadPage';
import TargetManagementPage from './pages/Settings/TargetManagementPage';
import InquiryPage from './pages/Support/InquiryPage';
import CompanyApprovalPage from './pages/Admin/CompanyApprovalPage';
import UserManagementPage from './pages/Admin/UserManagementPage';
import SuperAdminDashboard from './pages/Admin/SuperAdminDashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './index.css';

// Protected Route Component for Auth and Company Verification
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <MainLayout>{children}</MainLayout>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AuthWrapper />
      </BrowserRouter>
    </AuthProvider>
  );
};

const AuthWrapper: React.FC = () => {
  const { effectiveRole } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/register-company" element={<RegisterCompanyPage />} />
      
      {/* Main Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          {effectiveRole === 'SUPER_ADMIN' ? <Navigate to="/mng-voda-8a2b" replace /> : <Navigate to="/team/goal" replace />}
        </ProtectedRoute>
      } />
      
      {/* Super Admin Dashboard */}
      <Route path="/mng-voda-8a2b" element={<ProtectedRoute><SuperAdminDashboard /></ProtectedRoute>} />
      
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
      <Route path="/settings/org" element={<ProtectedRoute><OrgManagementPage /></ProtectedRoute>} />
      <Route path="/settings/targets" element={<ProtectedRoute><TargetManagementPage /></ProtectedRoute>} />
      <Route path="/settings/types" element={<ProtectedRoute><CategoryManagementPage /></ProtectedRoute>} />
      <Route path="/settings/upload" element={<ProtectedRoute><DataUploadPage /></ProtectedRoute>} />
      
      {/* Support Routes */}
      <Route path="/support/inquiry" element={<ProtectedRoute><InquiryPage /></ProtectedRoute>} />
      
      {/* Admin Routes (Obfuscated) */}
      <Route path="/mng-voda-8a2b/companies" element={<ProtectedRoute><CompanyApprovalPage /></ProtectedRoute>} />
      <Route path="/mng-voda-8a2b/users" element={<ProtectedRoute><UserManagementPage /></ProtectedRoute>} />
      <Route path="/mng-voda-8a2b/inquiries" element={<ProtectedRoute><InquiryPage /></ProtectedRoute>} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};


export default App;
