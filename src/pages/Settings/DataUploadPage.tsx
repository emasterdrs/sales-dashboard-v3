import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, Loader2, Download, AlertTriangle, Zap } from 'lucide-react';
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
  const { profile, fetchProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  
  // Advanced mapping for 3-level validation & provisioning
  const [orgMap, setOrgMap] = useState<any>({
    divisions: {}, // name -> id
    teams: {}, // divisionId_teamName -> id
    staff: {}, // teamId_staffName -> id
    categories: {} // name -> id
  });

  const [resetConfirmation, setResetConfirmation] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchOrgInfo();
  }, [profile?.company_id]);

  const fetchOrgInfo = async () => {
    if (!profile?.company_id) return;
    try {
      const { data: divisions } = await supabase.from('sales_divisions').select('id, name').eq('company_id', profile.company_id);
      const { data: teams } = await supabase.from('sales_teams').select('id, name, division_id').eq('company_id', profile.company_id);
      const { data: staff } = await supabase.from('sales_staff').select('id, name, team_id').in('team_id', teams?.map(t => t.id) || []);
      const { data: cats } = await supabase.from('product_categories').select('id, name').eq('company_id', profile.company_id);
      
      const divMap: any = {};
      divisions?.forEach(d => divMap[d.name.trim()] = d.id);

      const teamMap: any = {};
      teams?.forEach(t => teamMap[`${t.division_id}_${t.name.trim()}`] = t.id);

      const staffMap: any = {};
      staff?.forEach(s => staffMap[`${s.team_id}_${s.name.trim()}`] = s.id);

      const catMap: any = {};
      cats?.forEach(c => catMap[c.name.trim()] = c.id);

      setOrgMap({ divisions: divMap, teams: teamMap, staff: staffMap, categories: catMap });
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
        divisionName: row[1] ? String(row[1]).trim() : '',
        teamName: row[2] ? String(row[2]).trim() : '',
        name: row[3] ? String(row[3]).trim() : '',
        customer: row[4] ? String(row[4]).trim() : '',
        item: row[5] ? String(row[5]).trim() : '',
        amountStr: row[6] ? String(row[6]).trim() : ''
      };
    }).filter(row => row !== null);
  };

  const downloadXlsxTemplate = () => {
    const headers = ["날짜", "사업부", "팀명", "성명", "거래처명", "품목명", "매출액"];
    const today = format(new Date(), 'yyyy-MM-dd');
    const ws = XLSX.utils.aoa_to_sheet([headers, [today, "영업사업부", "영업1팀", "홍길동", "예시거래처", "예시품목", "1000000"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "양식");
    XLSX.writeFile(wb, `voda_upload_template.xlsx`);
  };

  const startUpload = async () => {
    if (!profile?.company_id && fetchProfile) await fetchProfile();
    if (!file) { alert('파일을 선택해 주세요.'); return; }
    if (!profile?.company_id) { alert('기업 정보가 확인되지 않습니다.'); return; }

    setIsUploading(true);
    setResult(null);
    setUploadProgress(0);
    
    try {
      const rows = await parseExcelOrCsv(file);
      if (rows.length === 0) {
        setResult({ total: 0, success: 0, failed: 0, errors: ["파일에 데이터가 없습니다."] });
        setIsUploading(false); return;
      }

      const errors: string[] = [];
      const validRecords: any[] = [];
      const currentOrg = { ...orgMap };

      // Ensure '미분류' (Uncategorized) exists
      if (!currentOrg.categories['미분류']) {
        const { data: newCat } = await supabase.from('product_categories').insert({ company_id: profile.company_id, name: '미분류', display_order: 999 }).select().single();
        if (newCat) currentOrg.categories['미분류'] = newCat.id;
      }

      for (let i = 0; i < rows.length; i++) {
        const row: any = rows[i];
        const rowNum = row._rowIndex;
        setUploadProgress(Math.round((i / rows.length) * 50)); // First 50% for analysis & provisioning

        if (!row.date || !row.divisionName || !row.teamName || !row.name) {
          errors.push(`${rowNum}행: 필수 정보 누락(날짜, 사업부, 팀, 성명)`);
          continue;
        }

        // 1. Division Provisioning
        let divisionId = currentOrg.divisions[row.divisionName];
        if (!divisionId) {
          const { data: newDiv } = await supabase.from('sales_divisions').insert({ company_id: profile.company_id, name: row.divisionName, display_order: Object.keys(currentOrg.divisions).length }).select().single();
          if (newDiv) {
            divisionId = newDiv.id;
            currentOrg.divisions[row.divisionName] = divisionId;
          } else { errors.push(`${rowNum}행: 사업부 생성 실패`); continue; }
        }

        // 2. Team Provisioning
        const teamKey = `${divisionId}_${row.teamName}`;
        let teamId = currentOrg.teams[teamKey];
        if (!teamId) {
          const { data: newTeam } = await supabase.from('sales_teams').insert({ company_id: profile.company_id, division_id: divisionId, name: row.teamName, display_order: Object.keys(currentOrg.teams).length }).select().single();
          if (newTeam) {
            teamId = newTeam.id;
            currentOrg.teams[teamKey] = teamId;
          } else { errors.push(`${rowNum}행: 팀 생성 실패`); continue; }
        }

        // 3. Staff Provisioning
        const staffKey = `${teamId}_${row.name}`;
        let staffId = currentOrg.staff[staffKey];
        if (!staffId) {
          const { data: newStaff } = await supabase.from('sales_staff').insert({ team_id: teamId, name: row.name, display_order: Object.keys(currentOrg.staff).length }).select().single();
          if (newStaff) {
            staffId = newStaff.id;
            currentOrg.staff[staffKey] = staffId;
          } else { errors.push(`${rowNum}행: 사원 생성 실패`); continue; }
        }

        const cleanAmount = parseInt(String(row.amountStr).replace(/[^0-9]/g, ''));
        if (isNaN(cleanAmount)) { errors.push(`${rowNum}행: 매출액 오류`); continue; }

        validRecords.push({
          company_id: profile.company_id,
          staff_id: staffId,
          team_id: teamId,
          category_id: currentOrg.categories['미분류'], // Default to '미분류' as requested
          customer_name: row.customer || '미지정',
          item_name: row.item || '미지정',
          amount: cleanAmount,
          sales_date: row.date
        });
      }

      setOrgMap(currentOrg); // Update local map with new entities

      let successCount = 0;
      if (validRecords.length > 0) {
        const { error } = await supabase.from('sales_records').upsert(validRecords, { onConflict: 'company_id, staff_id, customer_name, item_name, sales_date' });
        if (error) errors.push(`저장 오류: ${error.message}`);
        else successCount = validRecords.length;
      }

      setResult({ total: rows.length, success: successCount, failed: rows.length - successCount, errors });
      setUploadProgress(100);
      if (successCount > 0) { setFile(null); alert('업로드 및 조직 자동 생성이 완료되었습니다.'); }
    } catch (err) { alert('처리 중 오류 발생'); } finally { setIsUploading(false); }
  };

  const resetAllData = async () => {
    if (!profile?.company_id) return;
    if (resetConfirmation !== '데이터 초기화 확인') return alert('문구 확인 필요');
    if (!confirm('초기화하시겠습니까?')) return;
    setIsResetting(true);
    try {
      await supabase.from('sales_records').delete().eq('company_id', profile.company_id);
      await supabase.from('sales_targets').delete().eq('company_id', profile.company_id);
      alert('초기화 완료'); setResetConfirmation('');
    } catch (err: any) { alert(err.message); } finally { setIsResetting(false); }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><Zap size={28} className={styles.zapIcon} /></div>
          <div>
            <h1 className={styles.title}>인텔리전트 조직 자동 매핑 업로드</h1>
            <p className={styles.subtitle}>사업부, 팀, 사원이 없어도 엑셀만 올리면 자동으로 생성되고 매핑됩니다.</p>
          </div>
        </div>
      </header>

      <div className={styles.uploadCard}>
        {!file ? (
          <div className={styles.dropzone} onClick={() => fileInputRef.current?.click()}>
            <Upload size={48} className={styles.dropzoneIcon} />
            <div className={styles.dropzoneText}>
              <p>파일을 선택하거나 드래그하세요.</p>
              <span>Excel(.xlsx) 지원</span>
            </div>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
          </div>
        ) : (
          <div className={styles.fileInfo}>
            <div className={styles.fileName}><FileText size={20} color="#3b82f6" /> {file.name}</div>
            <button className={styles.removeBtn} onClick={() => setFile(null)}><X size={20} /></button>
          </div>
        )}

        <div className={styles.instructions}>
          <h3 className={styles.instructionTitle}>⚡ 자동 조직 생성 가이드 (Auto-Provisioning)</h3>
          <ul className={styles.instructionList}>
            <li className={styles.instructionItem}><b>사업부/팀/사원:</b> 존재하지 않는 조직은 업로드 시 자동으로 생성됩니다.</li>
            <li className={styles.instructionItem}><b>카테고리:</b> 모든 품목은 자동으로 '미분류' 카테고리에 할당됩니다.</li>
            <li className={styles.instructionItem}><b>날짜 인식:</b> YYYY.MM.DD 등 다양한 형식을 스마트하게 처리합니다.</li>
            <li className={styles.instructionItem}><b>순서:</b> 날짜, 사업부, 팀명, 성명, 거래처명, 품목명, 매출액 (7개 고정)</li>
          </ul>
          <button className={styles.downloadTemplate} onClick={downloadXlsxTemplate}>
            <Download size={14} /> 표준 엑셀 양식 다운로드 (.xlsx)
          </button>
        </div>

        <button className={styles.uploadBtn} disabled={!file || isUploading} onClick={startUpload}>
          {isUploading ? <Loader2 className={styles.animateSpin} size={20} /> : <CheckCircle2 size={20} />}
          {isUploading ? `조직 분석 및 생성 중... ${uploadProgress}%` : '엑셀 업로드 및 조직 자동 생성 시작'}
        </button>

        {isUploading && (
          <div style={{ marginTop: 12, height: 4, width: '100%', backgroundColor: '#E2E8F0', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: '#f6ad55' }} />
          </div>
        )}

        {result && (
          <div style={{ marginTop: 24, width: '100%' }}>
            <div className={styles.statsArea}>
              <div className={styles.statCard}><span className={styles.statLabel}>총 건수</span><span className={styles.statValue}>{result.total}</span></div>
              <div className={`${styles.statCard} ${styles.success}`}><span className={styles.statLabel}>저장 성공</span><span className={styles.statValue} style={{color: '#10B981'}}>{result.success}</span></div>
              <div className={styles.statCard}><span className={styles.statLabel}>분석 실패</span><span className={styles.statValue} style={{color: '#ef4444'}}>{result.failed}</span></div>
            </div>
            {result.errors.length > 0 && (
              <div className={styles.errorArea}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><AlertCircle size={18} color="#991B1B" /><h4>상세 내력</h4></div>
                <ul className={styles.errorList}>{result.errors.slice(0, 20).map((err, idx) => <li key={idx}>{err}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerHeader}><AlertTriangle size={24} color="#EF4444" /><h2 className={styles.dangerTitle}>데이터 초기화</h2></div>
        <div className={styles.resetControl}>
          <input type="text" className={styles.resetInput} placeholder='"데이터 초기화 확인" 입력' value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} />
          <button className={styles.resetBtn} disabled={resetConfirmation !== '데이터 초기화 확인' || isResetting} onClick={resetAllData}>삭제</button>
        </div>
      </div>
    </div>
  );
};

export default DataUploadPage;
