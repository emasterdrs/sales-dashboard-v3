import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, Loader2, Download, Zap, AlertTriangle } from 'lucide-react';
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
  const [resetType, setResetType] = useState<'data' | 'factory' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  
  const [orgMap, setOrgMap] = useState<any>({
    divisions: {}, 
    teams: {}, 
    staff: {}, 
    categories: {} 
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
    const workbook = XLSX.read(data, { cellFormula: false, cellHTML: false, cellText: false });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    if (rawData.length < 2) return [];

    return rawData.slice(1).map((row, index) => {
      if (!row || row.length < 4) return null;
      const cleanDate = SalesCalendarService.parseUserDate(row[0]);
      return {
        _rowIndex: index + 2,
        date: cleanDate,
        rawDate: row[0],
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
    const ws = XLSX.utils.aoa_to_sheet([headers, ["2017-01-01", "판매사업부", "강남지점", "이태민", "북안산혜민", "진종합", "770000", ""]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "양식");
    XLSX.writeFile(wb, `voda_template_standard.xlsx`);
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
        setResult({ total: 0, success: 0, failed: 0, errors: ["유효한 영업 데이터가 없습니다."] });
        setIsUploading(false); return;
      }
      setUploadProgress(5);
      const localOrg = { divisions: { ...orgMap.divisions }, teams: { ...orgMap.teams }, staff: { ...orgMap.staff }, categories: { ...orgMap.categories } };
      const errList: string[] = [];

      // Provision logic (Robust v2.2)
      const uniqDivs = [...new Set(rows.map(r => r!.divisionName).filter(Boolean))];
      for (const dName of uniqDivs) {
          if (!localOrg.divisions[dName]) {
              const { data: existing } = await supabase.from('sales_divisions').select('id').eq('company_id', profile.company_id).eq('name', dName).maybeSingle();
              if (existing) localOrg.divisions[dName] = existing.id;
              else {
                  const { data: created } = await supabase.from('sales_divisions').insert({ company_id: profile.company_id, name: dName, display_order: Object.keys(localOrg.divisions).length }).select().single();
                  if (created) localOrg.divisions[dName] = created.id;
              }
          }
      }
      setUploadProgress(15);
      const uniqTeams = [...new Set(rows.map(r => `${r!.divisionName}||${r!.teamName}`).filter(k => k.split('||')[1]))];
      for (const teamKey of uniqTeams) {
          const [dName, tName] = teamKey.split('||');
          const dId = localOrg.divisions[dName];
          if (dId && !localOrg.teams[`${dId}_${tName}`]) {
              const { data: existing } = await supabase.from('sales_teams').select('id').eq('company_id', profile.company_id).eq('division_id', dId).eq('name', tName).maybeSingle();
              if (existing) localOrg.teams[`${dId}_${tName}`] = existing.id;
              else {
                  const { data: created } = await supabase.from('sales_teams').insert({ company_id: profile.company_id, division_id: dId, name: tName, display_order: Object.keys(localOrg.teams).length }).select().single();
                  if (created) localOrg.teams[`${dId}_${tName}`] = created.id;
              }
          }
      }
      setUploadProgress(25);
      const uniqStaff = [...new Set(rows.map(r => `${r!.divisionName}||${r!.teamName}||${r!.name}`).filter(k => k.split('||')[2]))];
      for (const staffKey of uniqStaff) {
          const [dName, tName, sName] = staffKey.split('||');
          const dId = localOrg.divisions[dName];
          const tId = dId ? localOrg.teams[`${dId}_${tName}`] : null;
          if (tId && !localOrg.staff[`${tId}_${sName}`]) {
              const { data: existing } = await supabase.from('sales_staff').select('id').eq('team_id', tId).eq('name', sName).maybeSingle();
              if (existing) localOrg.staff[`${tId}_${sName}`] = existing.id;
              else {
                  const { data: created } = await supabase.from('sales_staff').insert({ team_id: tId, name: sName, display_order: Object.keys(localOrg.staff).length }).select().single();
                  if (created) localOrg.staff[`${tId}_${sName}`] = created.id;
              }
          }
      }
      setUploadProgress(35);
      const uniqCats = [...new Set(rows.map(r => r!.categoryName).filter(Boolean))];
      for (const cName of uniqCats) {
          if (cName !== '미분류' && !localOrg.categories[cName]) {
              const { data: existing } = await supabase.from('product_categories').select('id').eq('company_id', profile.company_id).eq('name', cName).maybeSingle();
              if (existing) localOrg.categories[cName] = existing.id;
              else {
                  const { data: created } = await supabase.from('product_categories').insert({ company_id: profile.company_id, name: cName, display_order: Object.keys(localOrg.categories).length }).select().single();
                  if (created) localOrg.categories[cName] = created.id;
              }
          }
      }
      if (!localOrg.categories['미분류']) {
          const { data: fallback } = await supabase.from('product_categories').select('id').eq('company_id', profile.company_id).eq('name', '미분류').maybeSingle();
          if (fallback) localOrg.categories['미분류'] = fallback.id;
          else {
              const { data: created } = await supabase.from('product_categories').insert({ company_id: profile.company_id, name: '미분류', display_order: 999 }).select().single();
              if (created) localOrg.categories['미분류'] = created.id;
          }
      }
      setUploadProgress(45);
      const finalRecs: any[] = [];
      const fallbackCatId = localOrg.categories['미분류'];
      rows.forEach(r => {
          if (!r) return;
          const dId = localOrg.divisions[r.divisionName];
          const tId = dId ? localOrg.teams[`${dId}_${r.teamName}`] : null;
          const sId = tId ? localOrg.staff[`${tId}_${r.name}`] : null;
          const cId = localOrg.categories[r.categoryName] || fallbackCatId;
          if (!r.date) { errList.push(`${r._rowIndex}행: 날짜 파싱 실패 (${r.rawDate})`); return; }
          if (!dId || !tId || !sId) {
              errList.push(`${r._rowIndex}행: 조직 정보 누락 (사업부: ${r.divisionName}, 팀: ${r.teamName}, 성명: ${r.name})`);
              return;
          }
          const amnt = Math.abs(parseInt(String(r.amountStr).replace(/[^0-9-]/g, ''))) || 0;
          finalRecs.push({ company_id: profile.company_id, staff_id: sId, team_id: tId, category_id: cId, customer_name: r.customer || '미지정', item_name: r.item || '미지정', amount: amnt, sales_date: r.date });
      });
      setOrgMap(localOrg);
      let success = 0;
      const CHUNK = 500;
      const tChunks = Math.ceil(finalRecs.length / CHUNK);
      for (let i = 0; i < tChunks; i++) {
        const chunk = finalRecs.slice(i * CHUNK, (i + 1) * CHUNK);
        const { error } = await supabase.from('sales_records').upsert(chunk, { onConflict: 'company_id, staff_id, customer_name, item_name, sales_date' });
        if (error) errList.push(`실적 저장 실패(${i + 1}): ${error.message}`);
        else success += chunk.length;
        setUploadProgress(45 + Math.round(((i + 1) / tChunks) * 55));
      }
      setResult({ total: rows.length, success, failed: rows.length - success, errors: errList });
      setUploadProgress(100);
      if (success > 0) setFile(null);
    } catch (e: any) { alert(`업로드 중단: ${e.message}`); } finally { setIsUploading(false); }
  };

  const handleReset = async () => {
    if (!profile?.company_id || resetConfirmation !== '데이터 초기화 확인') return alert('문구 확인 필요');
    setIsResetting(true);
    try {
      if (resetType === 'data') {
          await supabase.from('sales_records').delete().eq('company_id', profile.company_id);
          await supabase.from('sales_targets').delete().eq('company_id', profile.company_id);
          alert('영업 실적 및 목표 데이터 초기화 완료');
      } else if (resetType === 'factory') {
          // Cascade delete order
          await supabase.from('sales_records').delete().eq('company_id', profile.company_id);
          await supabase.from('sales_targets').delete().eq('company_id', profile.company_id);
          // Delete staff/teams/divisions/categories
          const { data: teams } = await supabase.from('sales_teams').select('id').eq('company_id', profile.company_id);
          const teamIds = teams?.map(t => t.id) || [];
          if (teamIds.length > 0) await supabase.from('sales_staff').delete().in('team_id', teamIds);
          await supabase.from('sales_teams').delete().eq('company_id', profile.company_id);
          await supabase.from('sales_divisions').delete().eq('company_id', profile.company_id);
          await supabase.from('product_categories').delete().eq('company_id', profile.company_id);
          alert('공장 초기화 완료 (전체 조직 및 데이터 삭제)');
          fetchOrgInfo();
      }
      setResetConfirmation('');
      setResetType(null);
    } catch (e: any) { alert(e.message); } finally { setIsResetting(false); }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.toLowerCase().endsWith('.xlsx')) setFile(droppedFile);
      else alert('.xlsx 파일만 업로드해 주세요.');
    }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><Zap size={28} className={styles.zapIcon} /></div>
          <div>
            <h1 className={styles.title}>대용량 지능형 데이터 업로드 (SaaS Pro)</h1>
            <p className={styles.subtitle}>모든 데이터는 업로드를 통해서만 관리됩니다. (수기 작성 제한 모드)</p>
          </div>
        </div>
      </header>

      <div className={styles.uploadCard}>
        {!file ? (
          <div className={`${styles.dropzone} ${isDragging ? styles.isDragging : ''}`} onClick={() => fileInputRef.current?.click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            <Upload size={48} className={styles.dropzoneIcon} />
            <div className={styles.dropzoneText}><p>{isDragging ? '여기에 놓으세요' : '파일을 선택하거나 드래그하세요'}</p><span>Excel(.xlsx) 초대량 데이터 지원</span></div>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
          </div>
        ) : (
          <div className={styles.fileInfo}>
            <div className={styles.fileName}><FileText size={20} color="#3b82f6" /> {file.name}</div>
            <button className={styles.removeBtn} onClick={() => setFile(null)}><X size={20} /></button>
          </div>
        )}

        <div className={styles.instructions}>
          <h3 className={styles.instructionTitle}>⚡ 스마트 데이터 처리 (v2.2)</h3>
          <ul className={styles.instructionList}>
            <li className={styles.instructionItem}><b>자동 인프라 구성:</b> 엑셀의 조직(사업부/팀/사원) 및 제품유형이 없으면 자동 생성됩니다.</li>
            <li className={styles.instructionItem}><b>무중단 업데이트:</b> 동일 조건 실적은 누적되지 않고 마감 최신값으로 자동 갱신됩니다.</li>
            <li className={styles.instructionItem}><b>정렬 제어:</b> 업로드된 조직은 '전체 정렬 관리' 메뉴에서 순서를 조정할 수 있습니다.</li>
          </ul>
          <button className={styles.downloadTemplate} onClick={downloadXlsxTemplate}><Download size={14} /> 분석 표준 양식 다운로드 (.xlsx)</button>
        </div>

        <button className={styles.uploadBtn} disabled={!file || isUploading} onClick={startUpload}>
          {isUploading ? <Loader2 className={styles.animateSpin} size={20} /> : <CheckCircle2 size={20} />}
          {isUploading ? `고성능 데이터 매핑 중... ${uploadProgress}%` : '대용량 마감 데이터 업로드 시작'}
        </button>

        {isUploading && (
          <div style={{ marginTop: 12, height: 6, width: '100%', backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: '#f6ad55' }} />
          </div>
        )}

        {result && (
          <div style={{ marginTop: 24, width: '100%' }}>
            <div className={styles.statsArea}>
              <div className={styles.statCard}><span className={styles.statLabel}>데이터 총계</span><span className={styles.statValue}>{result.total}</span></div>
              <div className={`${styles.statCard} ${styles.success}`}><span className={styles.statLabel}>업로드 성공</span><span className={styles.statValue} style={{color: '#10B981'}}>{result.success}</span></div>
              <div className={styles.statCard}><span className={styles.statLabel}>예외 행수</span><span className={styles.statValue} style={{color: '#ef4444'}}>{result.failed}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerHeader}><AlertTriangle size={24} color="#EF4444" /><h2 className={styles.dangerTitle}>데이터 시스템 초기화</h2></div>
        <p className={styles.dangerDesc}>모든 데이터는 영구 삭제되며 복구할 수 없습니다.</p>
        
        <div className={styles.resetControl}>
          <div className={styles.resetOptions}>
            <button className={`${styles.resetOptionBtn} ${resetType === 'data' ? styles.active : ''}`} onClick={() => setResetType('data')}>영업실적/목표만 삭제</button>
            <button className={`${styles.resetOptionBtn} ${resetType === 'factory' ? styles.active : ''}`} onClick={() => setResetType('factory')}>전체 공장 초기화 (조직/카테고리 포함)</button>
          </div>
          
          {resetType && (
            <div className={styles.resetConfirmArea} style={{ marginTop: 16, display: 'flex', gap: 12 }}>
              <input type="text" className={styles.resetInput} placeholder='"데이터 초기화 확인" 입력' value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} />
              <button className={styles.resetBtn} disabled={resetConfirmation !== '데이터 초기화 확인' || isResetting} onClick={handleReset}>
                {isResetting ? <Loader2 className={styles.animateSpin} size={20} /> : <X size={20} />}
                {resetType === 'data' ? '실적 데이터 즉시 삭제' : '전체 시스템 공장 초기화'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default DataUploadPage;
