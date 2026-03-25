import React, { useState, useEffect } from 'react';
import { Users, Building2, ShieldCheck, Mail, ArrowRight, UserCircle, Settings, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../api/supabase';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import styles from './SuperAdminDashboard.module.css';

interface DashboardStats {
    totalCompanies: number;
    pendingCompanies: number;
    totalUsers: number;
    openInquiries: number;
}

interface Company {
    id: string;
    name: string;
    status: string;
    created_at: string;
}

const SuperAdminDashboard: React.FC = () => {
    const { effectiveRole, setSwitchedRole } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats>({
        totalCompanies: 0,
        pendingCompanies: 0,
        totalUsers: 0,
        openInquiries: 0
    });
    const [recentCompanies, setRecentCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            // Fetch Stats in parallel
            const [
                { count: totalCount },
                { count: pendingCount },
                { count: userCount },
                { count: inquiryCount },
                { data: recentData }
            ] = await Promise.all([
                supabase.from('companies').select('*', { count: 'exact', head: true }),
                supabase.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'PENDING_APPROVAL'),
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('status', 'OPEN'),
                supabase.from('companies').select('id, name, status, created_at').order('created_at', { ascending: false }).limit(5)
            ]);

            setStats({
                totalCompanies: totalCount || 0,
                pendingCompanies: pendingCount || 0,
                totalUsers: userCount || 0,
                openInquiries: inquiryCount || 0
            });
            setRecentCompanies(recentData || []);
        } catch (err) {
            console.error('Error fetching admin dashboard data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoleSwitch = (role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'USER' | null) => {
        setSwitchedRole(role);
        alert(`${role || '기존'} 권한으로 전환되었습니다.`);
        navigate('/', { replace: true }); 
    };

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <Loader2 className={styles.animateSpin} size={48} />
                <p>시스템 정보를 불러오는 중입니다...</p>
            </div>
        );
    }

    return (
        <div className={`${styles.container} fade-in`}>
            <header className={styles.header}>
                <div className={styles.titleArea}>
                    <div className={styles.iconWrapper}><ShieldCheck size={32} /></div>
                    <div>
                        <h1 className={styles.title}>VODA 시스템 통합 관리자</h1>
                        <p className={styles.subtitle}>플랫폼 전체 현황 파악 및 서비스 운영 권한을 관리합니다.</p>
                    </div>
                </div>
            </header>

            {/* Role Simulation Switcher */}
            <section className={styles.switcherSection}>
                <h2 className={styles.sectionTitle}>
                    <Settings size={20} /> 권한 시뮬레이션
                </h2>
                <div className={styles.roleGrid}>
                    <div 
                        className={`${styles.roleCard} ${effectiveRole === 'SUPER_ADMIN' ? styles.activeRole : ''}`}
                        onClick={() => handleRoleSwitch(null)}
                    >
                        {effectiveRole === 'SUPER_ADMIN' && <CheckCircle2 className={styles.checkIcon} size={20} />}
                        <div className={styles.roleIcon} style={{ background: '#FEE2E2', color: '#EF4444' }}><ShieldCheck size={24} /></div>
                        <h3 className={styles.roleName}>슈퍼 관리자 (기본)</h3>
                        <p className={styles.roleDesc}>전체 기업 승인, 시스템 설정, 모든 데이터에 대한 조회 및 관리 권한을 가집니다.</p>
                    </div>

                    <div 
                        className={`${styles.roleCard} ${effectiveRole === 'COMPANY_ADMIN' ? styles.activeRole : ''}`}
                        onClick={() => handleRoleSwitch('COMPANY_ADMIN')}
                    >
                        {effectiveRole === 'COMPANY_ADMIN' && <CheckCircle2 className={styles.checkIcon} size={20} />}
                        <div className={styles.roleIcon} style={{ background: '#DBEAFE', color: '#3B82F6' }}><Building2 size={24} /></div>
                        <h3 className={styles.roleName}>기업 관리자 (시뮬레이션)</h3>
                        <p className={styles.roleDesc}>개별 기업의 마스터 권한입니다. 소속 직원의 목표 설정 및 기초 데이터 업로드 권한을 가집니다.</p>
                    </div>

                    <div 
                        className={`${styles.roleCard} ${effectiveRole === 'USER' ? styles.activeRole : ''}`}
                        onClick={() => handleRoleSwitch('USER')}
                    >
                        {effectiveRole === 'USER' && <CheckCircle2 className={styles.checkIcon} size={20} />}
                        <div className={styles.roleIcon} style={{ background: '#DCFCE7', color: '#22C55E' }}><UserCircle size={24} /></div>
                        <h3 className={styles.roleName}>일반 사용자 (시뮬레이션)</h3>
                        <p className={styles.roleDesc}>영업 팀원 권한입니다. 본인 및 소속 팀의 실적 현황 조회 및 드릴다운 분석만 가능합니다.</p>
                    </div>
                </div>
            </section>

            {/* Quick Stats Grid */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard} onClick={() => navigate('/mng-voda-8a2b/companies')} style={{ cursor: 'pointer' }}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>총 가입 기업</span>
                        <div className={styles.statIcon}><Building2 size={18} /></div>
                    </div>
                    <span className={styles.statValue}>{stats.totalCompanies}개</span>
                </div>
                <div className={styles.statCard} onClick={() => navigate('/mng-voda-8a2b/companies')} style={{ cursor: 'pointer' }}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>대기 중인 승인</span>
                        <div className={styles.statIcon}><ArrowRight size={18} /></div>
                    </div>
                    <span className={styles.statValue} style={{ color: stats.pendingCompanies > 0 ? '#EF4444' : 'inherit' }}>{stats.pendingCompanies}건</span>
                </div>
                <div className={styles.statCard} onClick={() => navigate('/mng-voda-8a2b/users')} style={{ cursor: 'pointer' }}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>전체 활성 사용자</span>
                        <div className={styles.statIcon}><Users size={18} /></div>
                    </div>
                    <span className={styles.statValue}>{stats.totalUsers}명</span>
                </div>
                <div className={styles.statCard} onClick={() => navigate('/mng-voda-8a2b/inquiries')} style={{ cursor: 'pointer' }}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>미처리 문의</span>
                        <div className={styles.statIcon}><Mail size={18} /></div>
                    </div>
                    <span className={styles.statValue} style={{ color: stats.openInquiries > 0 ? '#F59E0B' : 'inherit' }}>{stats.openInquiries}건</span>
                </div>
            </div>

            {/* Recent Activities Mini Table */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <h3 style={{ fontSize: 18, fontWeight: 800 }}>최근 기업 가입 현황</h3>
                </div>
                <table className={styles.recentTable}>
                    <thead>
                        <tr>
                            <th>기업명</th>
                            <th>가입일</th>
                            <th>상태</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentCompanies.map(comp => (
                            <tr key={comp.id}>
                                <td style={{ fontWeight: 700 }}>{comp.name}</td>
                                <td>{format(new Date(comp.created_at), 'yyyy-MM-dd')}</td>
                                <td>
                                    <span className={comp.status === 'APPROVED' ? styles.statusApproved : styles.statusPending}>
                                        {comp.status === 'APPROVED' ? '승인완료' : '승인대기'}
                                    </span>
                                </td>
                                <td>
                                    <button className={styles.tableActionBtn} onClick={() => navigate('/mng-voda-8a2b/companies')}>관리</button>
                                </td>
                            </tr>
                        ))}
                        {recentCompanies.length === 0 && (
                            <tr>
                                <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>가입 기록이 없습니다.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
