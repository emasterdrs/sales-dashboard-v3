import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, Loader2, Zap, AlertTriangle } from 'lucide-react';
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
  const [orgMap, setOrgMap] = useState<any>({ divisions: {}, teamMap: {}, staffMap: {}, catMap: {} });
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => { fetchOrgInfo(); }, [profile?.company_id]);

  const fetchOrgInfo = async () => {
    const cid = profile?.company_id;
    if (!cid) return;
    try {
      const { data: divisions } = await supabase.from('sales_divisions').select('id, name').eq('company_id', cid);
      const { data: teams } = await supabase.from('sales_teams').select('id, name, division_id').eq('company_id', cid);
      const { data: staff } = await supabase.from('sales_staff').select('id, name, team_id').in('team_id', teams?.map(t => t.id) || []);
      const { data: cats } = await supabase.from('product_categories').select('id, name').eq('company_id', cid);
      const dMap: any = {}; divisions?.forEach(d => dMap[d.name.trim()] = d.id);
      const tMap: any = {}; teams?.forEach(t => tMap[`${t.division_id}_${t.name.trim()}`] = t.id);
      const sMap: any = {}; staff?.forEach(s => sMap[`${s.team_id}_${s.name.trim()}`] = s.id);
      const cMap: any = {}; cats?.forEach(c => cMap[c.name.trim()] = c.id);
      setOrgMap({ divisions: dMap, teamMap: tMap, staffMap: sMap, catMap: cMap });
    } catch (e) { console.error(e); }
  };

  const parseExcelOrCsv = async (file: File) => {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { cellFormula: false, cellHTML: false, cellText: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (raw.length < 2) return [];
    return raw.slice(1).map((row, index) => {
      if (!row || row.length === 0) return null;
      return {
        _rowIndex: index + 2,
        date: SalesCalendarService.parseUserDate(row[0]),
        rawDate: String(row[0] || '').trim(),
        divisionName: String(row[1] || '').trim(),
        teamName: String(row[2] || '').trim(),
        name: String(row[3] || '').trim(),
        customer: String(row[4] || '').trim(),
        item: String(row[5] || '').trim(),
        amountStr: String(row[6] || '').trim(),
        categoryName: String(row[7] || '').trim()
      };
    }).filter((r): r is any => r !== null);
  };

  const startUpload = async () => {
    if (!profile?.company_id && fetchProfile) await fetchProfile();
    const cid = profile?.company_id;
    if (!file || !cid) return alert('파일 또는 로그인 정보가 없습니다.');
    setIsUploading(true); setResult(null); setUploadProgress(0);
    const errList: string[] = [];
    try {
      const rows = await parseExcelOrCsv(file);
      if (rows.length === 0) { setIsUploading(false); return; }
      const local = { ...orgMap };
      const uniqDivs = [...new Set(rows.map(r => r.divisionName).filter(Boolean))];
      for (const dName of uniqDivs) {
          if (!local.divisions[dName]) {
              const { data: created } = await supabase.from('sales_divisions').insert({ company_id: cid, name: dName, display_order: 0 }).select().maybeSingle();
              if (created) local.divisions[dName] = created.id;
              else {
                  const { data: exs } = await supabase.from('sales_divisions').select('id').eq('company_id', cid).eq('name', dName).maybeSingle();
                  if (exs) local.divisions[dName] = exs.id;
              }
          }
      }
      const uniqTeams = [...new Set(rows.map(r => `${r.divisionName}||${r.teamName}`).filter(v => v.split('||')[1]))];
      for (const tKey of uniqTeams) {
          const [dn, tn] = tKey.split('||'); const dId = local.divisions[dn];
          if (dId && !local.teamMap[`${dId}_${tn}`]) {
              const { data: c } = await supabase.from('sales_teams').insert({ company_id: cid, division_id: dId, name: tn }).select().maybeSingle();
              if (c) local.teamMap[`${dId}_${tn}`] = c.id;
              else {
                  const { data: e } = await supabase.from('sales_teams').select('id').eq('division_id', dId).eq('name', tn).maybeSingle();
                  if (e) local.teamMap[`${dId}_${tn}`] = e.id;
              }
          }
      }
      const uniqStaff = [...new Set(rows.map(r => `${r.divisionName}||${r.teamName}||${r.name}`).filter(v => v.split('||')[2]))];
      for (const sKey of uniqStaff) {
          const [dn, tn, sn] = sKey.split('||');
          const dId = local.divisions[dn]; const tId = dId ? local.teamMap[`${dId}_${tn}`] : null;
          if (tId && !local.staffMap[`${tId}_${sn}`]) {
              const { data: c } = await supabase.from('sales_staff').insert({ team_id: tId, name: sn }).select().maybeSingle();
              if (c) local.staffMap[`${tId}_${sn}`] = c.id;
              else {
                  const { data: e } = await supabase.from('sales_staff').select('id').eq('team_id', tId).eq('name', sn).maybeSingle();
                  if (e) local.staffMap[`${tId}_${sn}`] = e.id;
              }
          }
      }
      const uniqCats = [...new Set(rows.map(r => r.categoryName).filter(Boolean))];
      for (const cn of uniqCats) {
          if (!local.catMap[cn]) {
              const { data: c } = await supabase.from('product_categories').insert({ company_id: cid, name: cn }).select().maybeSingle();
              if (c) local.catMap[cn] = c.id;
              else {
                  const { data: e } = await supabase.from('product_categories').select('id').eq('company_id', cid).eq('name', cn).maybeSingle();
                  if (e) local.catMap[cn] = e.id;
              }
          }
      }
      const finalRecs: any[] = [];
      const fCat = local.catMap['미분류'];
      rows.forEach(r => {
          const dId = local.divisions[r.divisionName];
          const tId = dId ? local.teamMap[`${dId}_${r.teamName}`] : null;
          const sId = tId ? local.staffMap[`${tId}_${r.name}`] : null;
          const cId = local.catMap[r.categoryName] || fCat;
          if (!r.date || !dId || !tId || !sId) {
              if(!r.date) errList.push(`${r._rowIndex}행: 날짜 파생 오류(${r.rawDate})`);
              else errList.push(`${r._rowIndex}행: 조직 매칭 실패(${r.divisionName}/${r.teamName}/${r.name})`);
              return;
          }
          finalRecs.push({ company_id: cid, staff_id: sId, team_id: tId, category_id: cId || null, customer_name: r.customer || '미지정', item_name: r.item || '미지정', amount: Math.abs(parseInt(r.amountStr.replace(/[^0-9-]/g, ''))) || 0, sales_date: r.date });
      });
      setOrgMap(local);
      let sc = 0; const CHUNK = 500;
      for (let i = 0; i < finalRecs.length; i += CHUNK) {
          const { error: uErr } = await supabase.from('sales_records').upsert(finalRecs.slice(i, i + CHUNK), { onConflict: 'company_id, staff_id, customer_name, item_name, sales_date' });
          if (uErr) errList.push(`저장 실패: ${uErr.message}`); else sc += finalRecs.slice(i, i + CHUNK).length;
          setUploadProgress(45 + Math.round(((i + CHUNK) / finalRecs.length) * 55));
      }
      setResult({ total: rows.length, success: sc, failed: rows.length - sc, errors: errList });
    } catch (e: any) { alert(e.message); } finally { setIsUploading(false); setUploadProgress(100); }
  };

  const handleReset = async () => {
    const cid = profile?.company_id;
    if (!cid || resetConfirmation !== '데이터 초기화 확인') return alert('문구 확인 필요');
    setIsResetting(true);
    try {
      if (resetType === 'data') {
          await supabase.from('sales_records').delete().eq('company_id', cid);
          await supabase.from('sales_targets').delete().eq('company_id', cid);
      } else {
          await supabase.from('sales_records').delete().eq('company_id', cid);
          await supabase.from('sales_targets').delete().eq('company_id', cid);
          const { data: teams } = await supabase.from('sales_teams').select('id').eq('company_id', cid);
          const tIds = teams?.map(t => t.id) || [];
          if (tIds.length > 0) await supabase.from('sales_staff').delete().in('team_id', tIds);
          await supabase.from('sales_teams').delete().eq('company_id', cid);
          await supabase.from('sales_divisions').delete().eq('company_id', cid);
          await supabase.from('product_categories').delete().eq('company_id', cid);
          fetchOrgInfo();
      }
      setResetType(null); setResetConfirmation(''); alert('초기화 완료');
    } catch (e: any) { alert(e.message); } finally { setIsResetting(false); }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}><div className={styles.titleArea}><div className={styles.iconWrapper}><Zap size={28} className={styles.zapIcon} /></div><h1 className={styles.title}>대용량 데이터 업로드 (v2.3)</h1></div></header>
      <div className={styles.uploadCard}>
        {!file ? (
          <div className={`${styles.dropzone} ${isDragging ? styles.isDragging : ''}`} onClick={() => fileInputRef.current?.click()} onDragOver={(e) => {e.preventDefault(); setIsDragging(true)}} onDragLeave={() => setIsDragging(false)} onDrop={(e) => {e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0])}}>
            <Upload size={48} /><div className={styles.dropzoneText}><p>파일 선택/드래그</p><span>Excel(.xlsx) 25만 건+ 지원</span></div><input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
          </div>
        ) : (
          <div className={styles.fileInfo}><div className={styles.fileName}><FileText size={20} /> {file.name}</div><button className={styles.removeBtn} onClick={() => setFile(null)}><X size={20} /></button></div>
        )}
        <button className={styles.uploadBtn} disabled={!file || isUploading} onClick={startUpload}>
          {isUploading ? <Loader2 className={styles.animateSpin} size={20} /> : '마감 데이터 업로드 시작'}
        </button>
        {result && (
          <div style={{ marginTop: 24, width: '100%' }}>
            <div className={styles.statsArea}>
              <div className={styles.statCard}><span className={styles.statLabel}>총계</span><span className={styles.statValue}>{result.total}</span></div>
              <div className={`${styles.statCard} ${styles.success}`}><span className={styles.statLabel}>성공</span><span className={styles.statValue} style={{color: '#10B981'}}>{result.success}</span></div>
              <div className={styles.statCard}><span className={styles.statLabel}>실패</span><span className={styles.statValue} style={{color: '#ef4444'}}>{result.failed}</span></div>
            </div>
            {result.errors.length > 0 && (
              <div className={styles.errorArea} style={{ marginTop: 24 }}>
                <div className={styles.errorTitle}><AlertCircle size={18} /><h4>분역 및 상세 실패 사유 (v2.3 상세)</h4></div>
                <ul className={styles.errorList}>{result.errors.slice(0, 100).map((err, idx) => <li key={idx}>{err}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>
      <div className={styles.dangerZone}>
        <div className={styles.dangerHeader}><AlertTriangle size={24} color="#EF4444" /><h2 className={styles.dangerTitle}>데이터 초기화</h2></div>
        <div className={styles.resetOptions}>
          <button className={`${styles.resetOptionBtn} ${resetType === 'data' ? styles.active : ''}`} onClick={() => setResetType('data')}>데이터만</button>
          <button className={`${styles.resetOptionBtn} ${resetType === 'factory' ? styles.active : ''}`} onClick={() => setResetType('factory')}>공장 초기화</button>
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
