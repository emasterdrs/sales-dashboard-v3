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
    divisions: {}, teamMap: {}, staffMap: {}, catMap: {}
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
      
      const dMap: any = {};
      divisions?.forEach(d => dMap[d.name.trim()] = d.id);
      const tMap: any = {};
      teams?.forEach(t => tMap[`${t.division_id}_${t.name.trim()}`] = t.id);
      const sMap: any = {};
      staff?.forEach(s => sMap[`${s.team_id}_${s.name.trim()}`] = s.id);
      const cMap: any = {};
      cats?.forEach(c => cMap[c.name.trim()] = c.id);

      setOrgMap({ divisions: dMap, teamMap: tMap, staffMap: sMap, catMap: cMap });
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
      if (!row || row.length === 0) return null;
      const cleanDate = SalesCalendarService.parseUserDate(row[0]);
      return {
        _rowIndex: index + 2,
        date: cleanDate,
        rawDate: String(row[0] || '').trim(),
        divisionName: String(row[1] || '').trim(),
        teamName: String(row[2] || '').trim(),
        name: String(row[3] || '').trim(),
        customer: String(row[4] || '').trim(),
        item: String(row[5] || '').trim(),
        amountStr: String(row[6] || '').trim(),
        categoryName: String(row[7] || '').trim()
      };
    }).filter(r => r && (r.divisionName || r.name));
  };

  const startUpload = async () => {
    if (!profile?.company_id && fetchProfile) await fetchProfile();
    if (!file) return alert('파일을 선택해 주세요.');
    if (!profile?.company_id) return alert('기업 정보가 없습니다.');

    setIsUploading(true);
    setResult(null);
    setUploadProgress(0);
    const errList: string[] = [];

    try {
      const rows = await parseExcelOrCsv(file);
      if (rows.length === 0) {
        setResult({ total: 0, success: 0, failed: 0, errors: ["파일에 유효한 정보가 없습니다."] });
        setIsUploading(false); return;
      }

      setUploadProgress(5);
      const local = { ...orgMap };

      // 1. Divisions
      const uniqDivs = [...new Set(rows.map(r => r.divisionName).filter(Boolean))];
      for (const dName of uniqDivs) {
          if (!local.divisions[dName]) {
              const { data: created, error } = await supabase.from('sales_divisions').insert({ company_id: profile.company_id, name: dName, display_order: 0 }).select().maybeSingle();
              if (created) local.divisions[dName] = created.id;
              else {
                  const { data: exs } = await supabase.from('sales_divisions').select('id').eq('company_id', profile.company_id).eq('name', dName).maybeSingle();
                  if (exs) local.divisions[dName] = exs.id;
                  else errList.push(`사업부 가입 실패: ${dName} ${error?.message || ''}`);
              }
          }
      }
      setUploadProgress(15);

      // 2. Teams
      const uniqTeams = [...new Set(rows.map(r => `${r.divisionName}||${r.teamName}`).filter(v => v.split('||')[1]))];
      for (const tKey of uniqTeams) {
          const [dName, tName] = tKey.split('||');
          const dId = local.divisions[dName];
          if (dId && !local.teamMap[`${dId}_${tName}`]) {
              const { data: created, error } = await supabase.from('sales_teams').insert({ company_id: profile.company_id, division_id: dId, name: tName }).select().maybeSingle();
              if (created) local.teamMap[`${dId}_${tName}`] = created.id;
              else {
                  const { data: exs } = await supabase.from('sales_teams').select('id').eq('division_id', dId).eq('name', tName).maybeSingle();
                  if (exs) local.teamMap[`${dId}_${tName}`] = exs.id;
                  else errList.push(`팀 가입 실패: ${tName} ${error?.message || ''}`);
              }
          }
      }
      setUploadProgress(25);

      // 3. Staff
      const uniqStaff = [...new Set(rows.map(r => `${r.divisionName}||${r.teamName}||${r.name}`).filter(v => v.split('||')[2]))];
      for (const sKey of uniqStaff) {
          const [dName, tName, sName] = sKey.split('||');
          const dId = local.divisions[dName];
          const tId = dId ? local.teamMap[`${dId}_${tName}`] : null;
          if (tId && !local.staffMap[`${tId}_${sName}`]) {
              const { data: created, error } = await supabase.from('sales_staff').insert({ team_id: tId, name: sName }).select().maybeSingle();
              if (created) local.staffMap[`${tId}_${sName}`] = created.id;
              else {
                  const { data: exs } = await supabase.from('sales_staff').select('id').eq('team_id', tId).eq('name', sName).maybeSingle();
                  if (exs) local.staffMap[`${tId}_${sName}`] = exs.id;
                  else errList.push(`사원 가입 실패: ${sName} ${error?.message || ''}`);
              }
          }
      }
      setUploadProgress(35);

      // 4. Categories
      const uniqCats = [...new Set(rows.map(r => r.categoryName).filter(Boolean))];
      for (const cName of uniqCats) {
          if (!local.catMap[cName]) {
              const { data: created } = await supabase.from('product_categories').insert({ company_id: profile.company_id, name: cName }).select().maybeSingle();
              if (created) local.catMap[cName] = created.id;
              else {
                  const { data: exs } = await supabase.from('product_categories').select('id').eq('company_id', profile.company_id).eq('name', cName).maybeSingle();
                  if (exs) local.catMap[cName] = exs.id;
              }
          }
      }
      setUploadProgress(45);

      // 5. Records
      const finalRecs: any[] = [];
      const fallbackCat = local.catMap['미분류'];
      rows.forEach(r => {
          const dId = local.divisions[r.divisionName];
          const tId = dId ? local.teamMap[`${dId}_${r.teamName}`] : null;
          const sId = tId ? local.staffMap[`${tId}_${r.name}`] : null;
          const cId = local.catMap[r.categoryName] || fallbackCat;
          if (!r.date) { errList.push(`${r._rowIndex}행: 날짜 파생 오류 (${r.rawDate})`); return; }
          if (!dId || !tId || !sId) {
              errList.push(`${r._rowIndex}행: 조직 매칭 실패 (${r.divisionName}/${r.teamName}/${r.name})`);
              return;
          }
          const amt = Math.abs(parseInt(r.amountStr.replace(/[^0-9-]/g, ''))) || 0;
          finalRecs.push({ company_id: profile.company_id, staff_id: sId, team_id: tId, category_id: cId || null, customer_name: r.customer || '미지정', item_name: r.item || '미지정', amount: amt, sales_date: r.date });
      });

      setOrgMap(local);
      let success = 0;
      const CHUNK = 500;
      for (let i = 0; i < finalRecs.length; i += CHUNK) {
          const chunk = finalRecs.slice(i, i + CHUNK);
          const { error } = await supabase.from('sales_records').upsert(chunk, { onConflict: 'company_id, staff_id, customer_name, item_name, sales_date' });
          if (error) errList.push(`저장 실패: ${error.message} (청크 ${i/CHUNK + 1})`);
          else success += chunk.length;
          setUploadProgress(45 + Math.round(((i + CHUNK) / finalRecs.length) * 55));
      }

      setResult({ total: rows.length, success, failed: rows.length - success, errors: errList });
      if (success > 0) setFile(null);
    } catch (e: any) { alert(`오류 발생: ${e.message}`); } finally { setIsUploading(false); setUploadProgress(100); }
  };

  const handleReset = async () => {
    if (!profile?.company_id || resetConfirmation !== '데이터 초기화 확인') return alert('문구 확인 필요');
    setIsResetting(true);
    try {
      if (resetType === 'data') {
          await supabase.from('sales_records').delete().eq('company_id', profile.company_id);
          await supabase.from('sales_targets').delete().eq('company_id', profile.company_id);
          alert('영업 데이터 초기화 완료');
      } else {
          await supabase.from('sales_records').delete().eq('company_id', profile.company_id);
          await supabase.from('sales_targets').delete().eq('company_id', profile.company_id);
          const { data: teams } = await supabase.from('sales_teams').select('id').eq('company_id', profile.company_id);
          const tIds = teams?.map(t => t.id) || [];
          if (tIds.length > 0) await supabase.from('sales_staff').delete().in('team_id', tIds);
          await supabase.from('sales_teams').delete().eq('company_id', profile.company_id);
          await supabase.from('sales_divisions').delete().eq('company_id', profile.company_id);
          await supabase.from('product_categories').delete().eq('company_id', profile.company_id);
          alert('전체 조직 및 데이터 공장 초기화 완료');
          fetchOrgInfo();
      }
      setResetType(null); setResetConfirmation('');
    } catch (e: any) { alert(e.message); } finally { setIsResetting(false); }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}><div className={styles.iconWrapper}><Zap size={28} className={styles.zapIcon} /></div><h1 className={styles.title}>대용량 지능형 데이터 업로드 (v2.3)</h1></div>
      </header>

      <div className={styles.uploadCard}>
        {!file ? (
          <div className={`${styles.dropzone} ${isDragging ? styles.isDragging : ''}`} onClick={() => fileInputRef.current?.click()} onDragOver={(e) => {e.preventDefault(); setIsDragging(true)}} onDragLeave={() => setIsDragging(false)} onDrop={(e) => {e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0])}}>
            <Upload size={48} className={styles.dropzoneIcon} /><div className={styles.dropzoneText}><p>파일을 드래그하거나 선택하세요</p><span>Excel(.xlsx) 25만 건+ 초대량 지원</span></div>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
          </div>
        ) : (
          <div className={styles.fileInfo}><div className={styles.fileName}><FileText size={20} color="#3b82f6" /> {file.name}</div><button className={styles.removeBtn} onClick={() => setFile(null)}><X size={20} /></button></div>
        )}

        <div className={styles.instructions}>
          <h3 className={styles.instructionTitle}>⚡ 스마트 데이터 처리 안내</h3>
          <ul className={styles.instructionList}>
            <li className={styles.instructionItem}><b>v2.3 Core:</b> 조직 자동 생성 및 실시간 매핑 엔진이 가동 중입니다.</li>
            <li className={styles.instructionItem}><b>실패 시 가이드:</b> 하단 <b>'실패 사유'</b> 영역을 통해 어떤 데이터에 문제가 있는지 확인할 수 있습니다.</li>
          </ul>
        </div>

        <button className={styles.uploadBtn} disabled={!file || isUploading} onClick={startUpload}>
          {isUploading ? <Loader2 className={styles.animateSpin} size={20} /> : <CheckCircle2 size={20} />}
          {isUploading ? `데이터 처리 중... ${uploadProgress}%` : '대용량 마감 데이터 업로드 시작'}
        </button>

        {result && (
          <div style={{ marginTop: 24, width: '100%' }}>
            <div className={styles.statsArea}>
              <div className={styles.statCard}><span className={styles.statLabel}>데이터 총계</span><span className={styles.statValue}>{result.total}</span></div>
              <div className={`${styles.statCard} ${styles.success}`}><span className={styles.statLabel}>업로드 성공</span><span className={styles.statValue} style={{color: '#10B981'}}>{result.success}</span></div>
              <div className={styles.statCard}><span className={styles.statLabel}>예외 행수</span><span className={styles.statValue} style={{color: '#ef4444'}}>{result.failed}</span></div>
            </div>
            {result.errors.length > 0 && (
              <div className={styles.errorArea} style={{ marginTop: 24 }}>
                <div className={styles.errorTitle}><AlertCircle size={18} /><h4>상세 실패 사유 분석 (상위 100건)</h4></div>
                <ul className={styles.errorList}>{result.errors.slice(0, 100).map((err, idx) => <li key={idx}>{err}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerHeader}><AlertTriangle size={24} color="#EF4444" /><h2 className={styles.dangerTitle}>데이터 시스템 초기화</h2></div>
        <div className={styles.resetOptions}>
          <button className={`${styles.resetOptionBtn} ${resetType === 'data' ? styles.active : ''}`} onClick={() => setResetType('data')}>데이터만 초기화</button>
          <button className={`${styles.resetOptionBtn} ${resetType === 'factory' ? styles.active : ''}`} onClick={() => setResetType('factory')}>전체 공장 초기화</button>
        </div>
        {resetType && (
          <div className={styles.resetConfirmArea} style={{ marginTop: 16 }}>
            <input type="text" className={styles.resetInput} placeholder='"데이터 초기화 확인" 입력' value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} />
            <button className={styles.resetBtn} disabled={resetConfirmation !== '데이터 초기화 확인' || isResetting} onClick={handleReset}>초기화 실행</button>
          </div>
        )}
      </div>
    </div>
  );
};
export default DataUploadPage;
