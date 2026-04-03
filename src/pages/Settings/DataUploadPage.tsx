import React, { useState, useRef, useEffect } from 'react';
import { Database, Upload, FileText, CheckCircle2, AlertCircle, X, Loader2, Download, Trash2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parse, format, isValid } from 'date-fns';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import styles from './DataUploadPage.module.css';

interface UploadResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

const DataUploadPage: React.FC = () => {
  const { profile, effectiveRole, fetchProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  
  // Advanced mapping for 3-level validation
  const [orgMap, setOrgMap] = useState<{
    branches: Set<string>;
    teamsByBranch: Record<string, Set<string>>;
    staffByBranchTeam: Record<string, { id: string; teamId: string }>;
  }>({
    branches: new Set(),
    teamsByBranch: {},
    staffByBranchTeam: {}
  });

  const [resetConfirmation, setResetConfirmation] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchOrgInfo();
  }, [profile?.company_id]);

  const fetchOrgInfo = async () => {
    if (!profile?.company_id) return;
    try {
      const { data: branches } = await supabase.from('sales_branches').select('id, name').eq('company_id', profile.company_id);
      const { data: teams } = await supabase.from('sales_teams').select('id, name, branch_id').eq('company_id', profile.company_id);
      const { data: staff } = await supabase.from('sales_staff').select('id, name, team_id').in('team_id', teams?.map(t => t.id) || []);
      
      const bSet = new Set<string>();
      const tMap: Record<string, Set<string>> = {};
      const sMap: Record<string, { id: string; teamId: string }> = {};

      const branchIdToName: Record<string, string> = {};
      branches?.forEach(b => {
        const bName = b.name.trim();
        bSet.add(bName);
        branchIdToName[b.id] = bName;
      });

      const teamIdToInfo: Record<string, { name: string; branchName: string }> = {};
      teams?.forEach(t => {
        const branchName = branchIdToName[t.branch_id || ''] || '미지정';
        const teamName = t.name.trim();
        if (!tMap[branchName]) tMap[branchName] = new Set();
        tMap[branchName].add(teamName);
        teamIdToInfo[t.id] = { name: teamName, branchName };
      });

      staff?.forEach(s => {
        const info = teamIdToInfo[s.team_id];
        if (info) {
          const key = `${info.branchName}_${info.name}_${s.name.trim()}`;
          sMap[key] = { id: s.id, teamId: s.team_id };
        }
      });

      setOrgMap({ branches: bSet, teamsByBranch: tMap, staffByBranchTeam: sMap });
    } catch (err) {
      console.error('Error fetching org info:', err);
    }
  };

  const parseExcelOrCsv = async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    if (rawData.length < 2) return [];

    return rawData.slice(1).map((row, index) => {
      if (!row || row.length === 0) return null;
      
      let dateValue = row[0];
      let cleanDate = '';

      // 1. Flexible Date Parsing
      if (typeof dateValue === 'number') {
        const dateObj = XLSX.SSF.parse_date_code(dateValue);
        cleanDate = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
      } else if (dateValue) {
        let dateStr = String(dateValue).trim().replace(/\./g, '-').replace(/\//g, '-');
        const formats = ['yyyy-MM-dd', 'yyyy-M-d', 'yyyyMMdd'];
        for (const f of formats) {
          const parsed = parse(dateStr, f, new Date());
          if (isValid(parsed)) {
            cleanDate = format(parsed, 'yyyy-MM-dd');
            break;
          }
        }
      }

      return {
        _rowIndex: index + 2,
        date: cleanDate,
        branchName: row[1] ? String(row[1]).trim() : '',
        teamName: row[2] ? String(row[2]).trim() : '',
        name: row[3] ? String(row[3]).trim() : '',
        customer: row[4] ? String(row[4]).trim() : '',
        item: row[5] ? String(row[5]).trim() : '',
        amountStr: row[6] ? String(row[6]).trim() : ''
      };
    }).filter(row => row !== null);
  };

  const downloadXlsxTemplate = () => {
    const headers = ["날짜", "지점명", "팀명", "성명", "거래처명", "품목명", "매출액"];
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const samples: any[][] = [];
    Object.keys(orgMap.staffByBranchTeam).slice(0, 5).forEach(key => {
      const parts = key.split('_');
      samples.push([today, parts[0], parts[1], parts[2], "예시_거래처", "예시_품목", "1000000"]);
    });

    if (samples.length === 0) {
      samples.push([today, "본사", "영업1팀", "홍길동", "삼성전자", "반도체수주", "50000000"]);
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...samples]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "양식");
    XLSX.writeFile(wb, `voda_upload_template_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const startUpload = async () => {
    if (!profile?.company_id && fetchProfile) await fetchProfile();
    if (!file) { alert('파일을 선택해 주세요.'); return; }

    const canUpload = profile?.company_id || effectiveRole === 'SUPER_ADMIN';
    if (!canUpload) { alert('기업 정보가 확인되지 않습니다.'); return; }

    setIsUploading(true);
    setResult(null);
    setUploadProgress(0);
    
    try {
      const rows = await parseExcelOrCsv(file);
      if (rows.length === 0) {
        setResult({ total: 0, success: 0, failed: 0, errors: ["파일에 데이터가 없거나 형식이 잘못되었습니다."] });
        setIsUploading(false); return;
      }

      const errors: string[] = [];
      const validRecords: any[] = [];
      const currentCompanyId = profile?.company_id;

      for (const row of rows as any[]) {
        const rowNum = (row as any)._rowIndex;
        
        if (!row.date) { errors.push(`${rowNum}행: 날짜 형식이 올바르지 않습니다.`); continue; }
        if (!row.branchName || !row.teamName || !row.name) { errors.push(`${rowNum}행: 지점, 팀, 사원명은 필수입니다.`); continue; }

        if (!orgMap.branches.has(row.branchName)) {
          errors.push(`${rowNum}행: 존재하지 않는 지점(${row.branchName})`);
          continue;
        }

        const branchTeams = orgMap.teamsByBranch[row.branchName];
        if (!branchTeams || !branchTeams.has(row.teamName)) {
          errors.push(`${rowNum}행: ${row.branchName} 지점에 ${row.teamName} 팀이 존재하지 않음`);
          continue;
        }

        const lookupKey = `${row.branchName}_${row.teamName}_${row.name}`;
        const staffMapping = orgMap.staffByBranchTeam[lookupKey];
        if (!staffMapping) {
          errors.push(`${rowNum}행: ${row.teamName} 팀에 ${row.name} 사원이 존재하지 않음`);
          continue;
        }

        const cleanAmount = parseInt(String(row.amountStr).replace(/[^0-9]/g, ''));
        if (isNaN(cleanAmount) || cleanAmount === 0) {
          errors.push(`${rowNum}행: 매출액 확인 필요`);
          continue;
        }

        validRecords.push({
          company_id: currentCompanyId,
          staff_id: staffMapping.id,
          team_id: staffMapping.teamId,
          customer_name: row.customer || '미지정',
          item_name: row.item || '미지정',
          amount: cleanAmount,
          sales_date: row.date
        });
      }

      let successCount = 0;
      if (validRecords.length > 0) {
        const CHUNK_SIZE = 500;
        for (let i = 0; i < validRecords.length; i += CHUNK_SIZE) {
          const chunk = validRecords.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase.from('sales_records').upsert(chunk, { onConflict: 'company_id, staff_id, customer_name, item_name, sales_date' });
          if (error) errors.push(`저장 오류: ${error.message}`);
          else successCount += chunk.length;
          setUploadProgress(Math.round(((i + chunk.length) / validRecords.length) * 100));
        }
      }

      setResult({ total: rows.length, success: successCount, failed: rows.length - successCount, errors });
      if (successCount > 0) { setFile(null); alert(`${successCount}건 처리 완료`); }
    } catch (err) { alert('업로드 중 오류 발생'); } finally { setIsUploading(false); setUploadProgress(0); }
  };

  const resetAllData = async () => {
    if (!profile?.company_id) return;
    if (resetConfirmation !== '데이터 초기화 확인') return alert('문구를 다시 확인해주세요.');
    if (!confirm('초기화하시겠습니까?')) return;
    setIsResetting(true);
    try {
      await supabase.from('sales_records').delete().eq('company_id', profile.company_id);
      await supabase.from('sales_targets').delete().eq('company_id', profile.company_id);
      alert('완료'); setResetConfirmation('');
    } catch (err: any) { alert(err.message); } finally { setIsResetting(false); }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><Database size={28} /></div>
          <div>
            <h1 className={styles.title}>데이터 인텔리전트 업로드</h1>
            <p className={styles.subtitle}>계층 구조(지점-팀-사원) 교차 검증을 지원합니다.</p>
          </div>
        </div>
      </header>

      <div className={styles.uploadCard}>
        {!file ? (
          <div className={styles.dropzone} 
               onDragOver={(e) => e.preventDefault()} 
               onDrop={(e) => { e.preventDefault(); if(e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]); }} 
               onClick={() => fileInputRef.current?.click()}>
            <Upload size={48} className={styles.dropzoneIcon} />
            <div className={styles.dropzoneText}>
              <p>파일을 끌어다 놓거나 클릭하여 선택하세요.</p>
              <span>Excel(.xlsx) 및 CSV 지원</span>
            </div>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".csv, .xlsx" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
          </div>
        ) : (
          <div className={styles.fileInfo}>
            <div className={styles.fileName}><FileText size={20} color="#3b82f6" /> {file.name}</div>
            <button className={styles.removeBtn} onClick={() => setFile(null)}><X size={20} /></button>
          </div>
        )}

        <div className={styles.instructions}>
          <h3 className={styles.instructionTitle}>업로드 가이드</h3>
          <ul className={styles.instructionList}>
            <li className={styles.instructionItem}><b>1. 공백 제거:</b> 모든 정보의 앞뒤 공백은 자동 제거됩니다.</li>
            <li className={styles.instructionItem}><b>2. 교차 검증:</b> 지점-팀-사원 관계가 설정과 맞아야 업로드됩니다.</li>
            <li className={styles.instructionItem}><b>3. 날짜 형식:</b> YYYY-MM-DD, YYYY.MM.DD 등 스마트 인식을 지원합니다.</li>
            <li className={styles.instructionItem}><b>4. 순서:</b> 날짜, 지점, 팀, 성명, 거래처, 품목, 금액 (7개)</li>
          </ul>
          <button className={styles.downloadTemplate} onClick={downloadXlsxTemplate}>
            <Download size={14} /> 시스템 맞춤 템플릿 다운로드 (.xlsx)
          </button>
        </div>

        <button className={styles.uploadBtn} disabled={!file || isUploading} onClick={startUpload}>
          {isUploading ? <Loader2 className={styles.animateSpin} size={20} /> : <CheckCircle2 size={20} />}
          {isUploading ? `업로드 중... ${uploadProgress}%` : '데이터 분석 및 업로드'}
        </button>

        {isUploading && (
          <div style={{ marginTop: 12, height: 4, width: '100%', backgroundColor: '#E2E8F0', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: '#f6ad55' }} />
          </div>
        )}

        {result && (
          <div style={{ marginTop: 24 }}>
            <div className={styles.statsArea}>
              <div className={styles.statCard}><span className={styles.statLabel}>총 건수</span><span className={styles.statValue}>{result.total}</span></div>
              <div className={`${styles.statCard} ${styles.success}`}><span className={styles.statLabel}>성공</span><span className={styles.statValue} style={{color: '#10B981'}}>{result.success}</span></div>
              <div className={styles.statCard}><span className={styles.statLabel}>실패</span><span className={styles.statValue} style={{color: '#ef4444'}}>{result.failed}</span></div>
            </div>
            {result.errors.length > 0 && (
              <div className={styles.errorArea}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><AlertCircle size={18} color="#991B1B" /><h4>오류 내역</h4></div>
                <ul className={styles.errorList}>{result.errors.slice(0, 30).map((err, idx) => <li key={idx}>{err}</li>)}</ul>
                {result.errors.length > 30 && <p className={styles.moreErrors}>외 {result.errors.length - 30}건 더 있음...</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerHeader}><AlertTriangle size={24} color="#EF4444" /><h2 className={styles.dangerTitle}>위험 구역</h2></div>
        <div className={styles.resetControl}>
          <input type="text" className={styles.resetInput} placeholder='"데이터 초기화 확인" 입력 시에만 활성화' value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} />
          <button className={styles.resetBtn} disabled={resetConfirmation !== '데이터 초기화 확인' || isResetting} onClick={resetAllData}>
            {isResetting ? <Loader2 className={styles.animateSpin} size={18} /> : <Trash2 size={18} />} 초기화
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataUploadPage;
