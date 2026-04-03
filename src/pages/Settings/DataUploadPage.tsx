import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, Loader2, Download, AlertTriangle, Zap } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { SalesCalendarService } from '../../services/SalesCalendarService';
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
      
      const cleanDate = SalesCalendarService.parseUserDate(row[0]);

      return {
        _rowIndex: index + 2,
        date: cleanDate,
        divisionName: row[1] ? String(row[1]).trim() : '',
        teamName: row[2] ? String(row[2]).trim() : '',
        name: row[3] ? String(row[3]).trim() : '',
        customer: row[4] ? String(row[4]).trim() : '',
        item: row[5] ? String(row[5]).trim() : '',
        amountStr: row[6] ? String(row[6]).trim() : '',
        categoryName: row[7] ? String(row[7]).trim() : ''
      };
    }).filter(row => row !== null);
  };

  const downloadXlsxTemplate = () => {
    const headers = ["날짜", "사업부", "팀명", "성명", "거래처명", "품목명", "매출액", "제품유형"];
    const today = new Date().toISOString().split('T')[0];
    const ws = XLSX.utils.aoa_to_sheet([headers, [today, "영업사업부", "영업1팀", "홍길동", "예시거래처", "예시품목", "1000000", "반도체"]]);
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

      setUploadProgress(5);
      let currentOrg = { ...orgMap };
      const errors: string[] = [];

      // 1. Bulk Extract Unique Entities
      const uniqueDivs = [...new Set(rows.map(r => r.divisionName).filter(Boolean))];
      const uniqueTeams = [...new Set(rows.map(r => `${r.divisionName}||${r.teamName}`).filter(key => key.split('||')[1]))];
      const uniqueStaff = [...new Set(rows.map(r => `${r.divisionName}||${r.teamName}||${r.name}`).filter(key => key.split('||')[2]))];
      const uniqueCats = [...new Set(rows.map(r => r.categoryName).filter(Boolean))];

      // 2. Provisions (Sequential to maintain order)
      // Division
      const newDivs = uniqueDivs.filter(n => !currentOrg.divisions[n]);
      if (newDivs.length > 0) {
        const { data: created } = await supabase.from('sales_divisions').insert(newDivs.map((n, i) => ({ 
          company_id: profile.company_id, name: n, display_order: Object.keys(currentOrg.divisions).length + i 
        }))).select();
        created?.forEach(d => currentOrg.divisions[d.name] = d.id);
      }
      setUploadProgress(15);

      // Teams
      const newTeamsToCreate = uniqueTeams.filter(key => {
        const [divName, teamName] = key.split('||');
        const divId = currentOrg.divisions[divName];
        return divId && !currentOrg.teams[`${divId}_${teamName}`];
      });
      if (newTeamsToCreate.length > 0) {
        const { data: created } = await supabase.from('sales_teams').insert(newTeamsToCreate.map((key, i) => {
          const [divName, teamName] = key.split('||');
          return { company_id: profile.company_id, division_id: currentOrg.divisions[divName], name: teamName, display_order: Object.keys(currentOrg.teams).length + i };
        })).select();
        created?.forEach(t => currentOrg.teams[`${t.division_id}_${t.name}`] = t.id);
      }
      setUploadProgress(25);

      // Staff
      const newStaffToCreate = uniqueStaff.filter(key => {
        const [divName, teamName, staffName] = key.split('||');
        const divId = currentOrg.divisions[divName];
        const teamId = currentOrg.teams[`${divId}_${teamName}`];
        return teamId && !currentOrg.staff[`${teamId}_${staffName}`];
      });
      if (newStaffToCreate.length > 0) {
        const { data: created } = await supabase.from('sales_staff').insert(newStaffToCreate.map((key, i) => {
          const [divName, teamName, staffName] = key.split('||');
          const teamId = currentOrg.teams[`${currentOrg.divisions[divName]}_${teamName}`];
          return { team_id: teamId, name: staffName, display_order: Object.keys(currentOrg.staff).length + i };
        })).select();
        created?.forEach(s => currentOrg.staff[`${s.team_id}_${s.name}`] = s.id);
      }
      setUploadProgress(35);

      // Category
      const newCats = uniqueCats.filter(n => !currentOrg.categories[n]);
      if (newCats.length > 0) {
        const { data: created } = await supabase.from('product_categories').insert(newCats.map((n, i) => ({ 
          company_id: profile.company_id, name: n, display_order: Object.keys(currentOrg.categories).length + i 
        }))).select();
        created?.forEach(c => currentOrg.categories[c.name] = c.id);
      }
      if (!currentOrg.categories['미분류']) {
        const { data: newCat } = await supabase.from('product_categories').insert({ company_id: profile.company_id, name: '미분류', display_order: 999 }).select().single();
        if (newCat) currentOrg.categories['미분류'] = newCat.id;
      }
      setUploadProgress(45);

      // 3. Chunked Records Upsert (500 records per chunk)
      const validRecords: any[] = [];
      for (const row of rows) {
        const divId = currentOrg.divisions[row.divisionName];
        const teamId = divId ? currentOrg.teams[`${divId}_${row.teamName}`] : null;
        const staffId = teamId ? currentOrg.staff[`${teamId}_${row.name}`] : null;
        const categoryId = currentOrg.categories[row.categoryName] || currentOrg.categories['미분류'];

        if (!divId || !teamId || !staffId || !row.date) {
            errors.push(`${row._rowIndex}행: 날짜 형식 오류 또는 조직 매칭 실패`);
            continue;
        }

        const cleanAmount = parseInt(String(row.amountStr).replace(/[^0-9-]/g, ''));
        if (isNaN(cleanAmount)) { errors.push(`${row._rowIndex}행: 매출액 오류`); continue; }

        validRecords.push({
          company_id: profile.company_id,
          staff_id: staffId,
          team_id: teamId,
          category_id: categoryId,
          customer_name: row.customer || '미지정',
          item_name: row.item || '미지정',
          amount: cleanAmount,
          sales_date: row.date
        });
      }

      setOrgMap(currentOrg);

      let successCount = 0;
      const CHUNK_SIZE = 500;
      const totalChunks = Math.ceil(validRecords.length / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        const chunk = validRecords.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const { error } = await supabase.from('sales_records').upsert(chunk, { onConflict: 'company_id, staff_id, customer_name, item_name, sales_date' });
        if (error) {
           errors.push(`청크(${i + 1}/${totalChunks}) 저장 실패: ${error.message}`);
        } else {
           successCount += chunk.length;
        }
        setUploadProgress(45 + Math.round(((i + 1) / totalChunks) * 55));
      }

      setResult({ total: rows.length, success: successCount, failed: rows.length - successCount, errors });
      setUploadProgress(100);
      if (successCount > 0) setFile(null);
    } catch (err: any) { 
        alert(`중단 오류: ${err.message}`); 
    } finally { 
        setIsUploading(false); 
    }
  };

  const resetAllData = async () => {
    if (!profile?.company_id || resetConfirmation !== '데이터 초기화 확인') return alert('문구 확인 필요');
    if (!confirm('경고: 기업의 모든 실적과 목표가 영구 삭제됩니다. 계속하시겠습니까?')) return;
    setIsResetting(true);
    try {
      await supabase.from('sales_records').delete().eq('company_id', profile.company_id);
      await supabase.from('sales_targets').delete().eq('company_id', profile.company_id);
      alert('전체 실적 초기화 완료'); setResetConfirmation('');
    } catch (err: any) { alert(err.message); } finally { setIsResetting(false); }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><Zap size={28} className={styles.zapIcon} /></div>
          <div>
            <h1 className={styles.title}>대용량 지능형 데이터 업로드</h1>
            <p className={styles.subtitle}>수만 건의 마감 데이터도 순차적으로 안전하게 대시보드에 반영합니다.</p>
          </div>
        </div>
      </header>

      <div className={styles.uploadCard}>
        {!file ? (
          <div className={styles.dropzone} onClick={() => fileInputRef.current?.click()}>
            <Upload size={48} className={styles.dropzoneIcon} />
            <div className={styles.dropzoneText}>
              <p>파일을 선택하거나 드래그하세요.</p>
              <span>Excel(.xlsx) 대용량 지원</span>
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
          <h3 className={styles.instructionTitle}>⚡ 스마트 데이터 처리 (Performance Optimizing)</h3>
          <ul className={styles.instructionList}>
            <li className={styles.instructionItem}><b>대용량 세이프가드:</b> 대량 데이터는 500건 단위로 나누어 순차 저장하여 누락을 방지합니다.</li>
            <li className={styles.instructionItem}><b>스마트 날짜 파싱:</b> 20240301, 24.03.01, 24/03/01 등 자유로운 날짜 입력을 지원합니다.</li>
            <li className={styles.instructionItem}><b>자동 인프라 구성:</b> 엑셀의 사업부/팀/사원이 없으면 자동으로 조직 체계를 구성합니다.</li>
            <li className={styles.instructionItem}><b>데이터 병합(Upsert):</b> 동일 날짜/거래처/품목의 실적은 중복 없이 최신 값으로 갱신됩니다.</li>
          </ul>
          <button className={styles.downloadTemplate} onClick={downloadXlsxTemplate}>
            <Download size={14} /> 최종 표준 양식 다운로드 (.xlsx)
          </button>
        </div>

        <button className={styles.uploadBtn} disabled={!file || isUploading} onClick={startUpload}>
          {isUploading ? <Loader2 className={styles.animateSpin} size={20} /> : <CheckCircle2 size={20} />}
          {isUploading ? `세이프가드 순차 저장 중... ${uploadProgress}%` : '대용량 마감 데이터 업로드 시작'}
        </button>

        {isUploading && (
          <div style={{ marginTop: 12, height: 6, width: '100%', backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: '#f6ad55', transition: 'width 0.3s ease' }} />
          </div>
        )}

        {result && (
          <div style={{ marginTop: 24, width: '100%' }}>
            <div className={styles.statsArea}>
              <div className={styles.statCard}><span className={styles.statLabel}>총 건수</span><span className={styles.statValue}>{result.total}</span></div>
              <div className={`${styles.statCard} ${styles.success}`}><span className={styles.statLabel}>임포트 완료</span><span className={styles.statValue} style={{color: '#10B981'}}>{result.success}</span></div>
              <div className={styles.statCard}><span className={styles.statLabel}>예외 행수</span><span className={styles.statValue} style={{color: '#ef4444'}}>{result.failed}</span></div>
            </div>
            {result.errors.length > 0 && (
              <div className={styles.errorArea}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><AlertCircle size={18} color="#991B1B" /><h4>실패 사유 분석 (최대 100건 표시)</h4></div>
                <ul className={styles.errorList}>{result.errors.slice(0, 100).map((err, idx) => <li key={idx}>{err}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerHeader}><AlertTriangle size={24} color="#EF4444" /><h2 className={styles.dangerTitle}>시스템 클린업</h2></div>
        <p className={styles.dangerDesc}>현재 기업의 모든 영업 실적 및 목표 데이터를 초기화합니다. 이 작업은 취소할 수 없습니다.</p>
        <div className={styles.resetControl}>
          <input type="text" className={styles.resetInput} placeholder='"데이터 초기화 확인" 입력' value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} />
          <button className={styles.resetBtn} disabled={resetConfirmation !== '데이터 초기화 확인' || isResetting} onClick={resetAllData}>전체 삭제</button>
        </div>
      </div>
    </div>
  );
};

export default DataUploadPage;
