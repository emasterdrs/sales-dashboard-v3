import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import DashboardPage from './pages/Dashboard/DashboardPage';
import OrgManagementPage from './pages/Settings/OrgManagementPage';
import TargetManagementPage from './pages/Settings/TargetManagementPage';
import DataUploadPage from './pages/Settings/DataUploadPage';
import WorkingDaysPage from './pages/Settings/WorkingDaysPage';
import SortManagementPage from './pages/Settings/SortManagementPage';
import CategoryManagementPage from './pages/Settings/CategoryManagementPage';
import LoginPage from './pages/Auth/LoginPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import AdminRoute from './components/Auth/AdminRoute';
import InquiryPage from './pages/Support/InquiryPage';
import UserManagementPage from './pages/Admin/UserManagementPage';
import ExcelAnalysisPage from './pages/ExcelAnalysis/ExcelAnalysisPage';
import SalesRecordsPage from './pages/SalesRecords/SalesRecordsPage';
import styles from './App.module.css';

const App: React.FC = () => {
  return (
    <div className={styles.appContainer}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className={styles.layout}>
                <Sidebar />
                <main className={styles.mainContent}>
                  <Header />
                  <div className={styles.pageContent}>
                    <Routes>
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/excel-analysis" element={<ExcelAnalysisPage />} />
                      <Route path="/sales-records" element={<SalesRecordsPage />} />
                      
                      {/* Admin Routes */}
                      <Route path="/adm-s-2s9k2/days" element={<AdminRoute><WorkingDaysPage /></AdminRoute>} />
                      <Route path="/adm-s-2s9k2/org" element={<AdminRoute><OrgManagementPage /></AdminRoute>} />
                      <Route path="/adm-s-2s9k2/sort" element={<AdminRoute><SortManagementPage /></AdminRoute>} />
                      <Route path="/adm-s-2s9k2/targets" element={<AdminRoute><TargetManagementPage /></AdminRoute>} />
                      <Route path="/adm-s-2s9k2/upload" element={<AdminRoute><DataUploadPage /></AdminRoute>} />
                      <Route path="/adm-s-2s9k2/types" element={<AdminRoute><CategoryManagementPage /></AdminRoute>} />
                      
                      {/* Super Admin Routes */}
                      <Route path="/mng-voda-8a2b/users" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
                      
                      {/* Support */}
                      <Route path="/support/inquiry" element={<InquiryPage />} />
                      
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </div>
                </main>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
};

export default App;
