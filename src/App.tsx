import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/Auth/LoginPage';
import SignUpPage from './pages/Auth/SignUpPage';
import AuthCallback from './pages/Auth/AuthCallback';
import EmailConfirmPage from './pages/Auth/EmailConfirmPage';
import RequestResetPassword from './pages/Auth/RequestResetPassword';
import UpdatePasswordPage from './pages/Auth/UpdatePasswordPage';
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

// Admin Protection (Only for Admin/SuperAdmin)
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, effectiveRole, isLoading } = useAuth();
  if (isLoading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  const isAdmin = effectiveRole === 'COMPANY_ADMIN' || effectiveRole === 'SUPER_ADMIN';
  if (!isAdmin) return <Navigate to="/" replace />;
  
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
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/confirm" element={<EmailConfirmPage />} />
      <Route path="/auth/reset" element={<RequestResetPassword />} />
      <Route path="/update-password" element={<UpdatePasswordPage />} />
      <Route path="/register-company" element={<RegisterCompanyPage />} />
      
      {/* Main Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          {effectiveRole === 'SUPER_ADMIN' ? <Navigate to="/mng-voda-8a2b" replace /> : <Navigate to="/team/goal" replace />}
        </ProtectedRoute>
      } />
      
      {/* Super Admin Dashboard (Platform Admin) */}
      <Route path="/mng-voda-8a2b" element={<ProtectedRoute>{effectiveRole === 'SUPER_ADMIN' ? <SuperAdminDashboard /> : <Navigate to="/" replace />}</ProtectedRoute>} />
      <Route path="/mng-voda-8a2b/companies" element={<ProtectedRoute>{effectiveRole === 'SUPER_ADMIN' ? <CompanyApprovalPage /> : <Navigate to="/" replace />}</ProtectedRoute>} />
      <Route path="/mng-voda-8a2b/users" element={<ProtectedRoute>{effectiveRole === 'SUPER_ADMIN' ? <UserManagementPage /> : <Navigate to="/" replace />}</ProtectedRoute>} />
      
      {/* Obfuscated Company Admin Routes (Company Management) */}
      <Route path="/adm-s-2s9k2/org" element={<AdminRoute><OrgManagementPage /></AdminRoute>} />
      <Route path="/adm-s-2s9k2/targets" element={<AdminRoute><TargetManagementPage /></AdminRoute>} />
      <Route path="/adm-s-2s9k2/upload" element={<AdminRoute><DataUploadPage /></AdminRoute>} />
      <Route path="/adm-s-2s9k2/days" element={<AdminRoute><WorkingDaysPage /></AdminRoute>} />
      <Route path="/adm-s-2s9k2/types" element={<AdminRoute><CategoryManagementPage /></AdminRoute>} />
      
      {/* Team Based Routes (Dashboard) */}
      <Route path="/team/goal" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/team/yoy" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/team/mom" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/team/acc" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      
      {/* Type Based Routes (Dashboard) */}
      <Route path="/type/goal" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/type/yoy" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/type/mom" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/type/acc" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      
      {/* Support Routes */}
      <Route path="/support/inquiry" element={<ProtectedRoute><InquiryPage /></ProtectedRoute>} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
