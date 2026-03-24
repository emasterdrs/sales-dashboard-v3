import React from 'react';
import { Users, Building2, ShieldCheck, Mail, ArrowRight, UserCircle, Settings, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './SuperAdminDashboard.module.css';

const SuperAdminDashboard: React.FC = () => {
    const { effectiveRole, setSwitchedRole } = useAuth();

    const handleRoleSwitch = (role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'USER' | null) => {
        setSwitchedRole(role);
        alert(`${role || '기존'} 권한으로 전환되었습니다.`);
        window.location.href = '/'; 
    };

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
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>총 가입 기업</span>
                        <div className={styles.statIcon}><Building2 size={18} /></div>
                    </div>
                    <span className={styles.statValue}>12개</span>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>대기 중인 승인</span>
                        <div className={styles.statIcon}><ArrowRight size={18} /></div>
                    </div>
                    <span className={styles.statValue} style={{ color: '#EF4444' }}>3건</span>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>전체 활성 사용자</span>
                        <div className={styles.statIcon}><Users size={18} /></div>
                    </div>
                    <span className={styles.statValue}>156명</span>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <span className={styles.statLabel}>미처리 문의</span>
                        <div className={styles.statIcon}><Mail size={18} /></div>
                    </div>
                    <span className={styles.statValue}>5건</span>
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
                            <th>대표자</th>
                            <th>가입일</th>
                            <th>상태</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={{ fontWeight: 700 }}>코리아 테크놀로지</td>
                            <td>홍길동</td>
                            <td>2026-03-24</td>
                            <td style={{ color: '#F59E0B', fontWeight: 700 }}>승인대기</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 700 }}>미래 유통</td>
                            <td>이영희</td>
                            <td>2026-03-23</td>
                            <td style={{ color: '#10B981', fontWeight: 700 }}>승인완료</td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 700 }}>글로벌 서비스</td>
                            <td>김철수</td>
                            <td>2026-03-22</td>
                            <td style={{ color: '#10B981', fontWeight: 700 }}>승인완료</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
