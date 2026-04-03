import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertCircle, X, Loader2, Zap, AlertTriangle } from 'lucide-react';
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

  useEffect(() => { fetchOrgInfo(); }, [profile?.company_id]);

  const fetchOrgInfo = async () => {
    const cid = profile?.company_id;
    if (!cid) return;
    try {
      const { data: divisions } = await supabase.from('sales_divisions').select('id, name').eq('company_id', cid);
      const { data: teams } = await supabase.from('sales_teams').select('id, name, division_id').eq('company_id', cid);
      const { data: staff } = await supabase.from('sales_staff').select('id, name, team_id').in('team_id', teams?.map(t => t.id) || []);
      const { data: cats } = await supabase.from('product_categories').select('id, name').eq('company_id', cid);
      
      const dMap: any = {}; divisions?.forEach((d: any) => dMap[d.name.trim()] = d.id);
      const tMap: any = {}; teams?.forEach((t: any) => tMap[`${t.division_id}_${t.name.trim()}`] = t.id);
      const sMap: any = {}; staff?.forEach((s: any) => sMap[`${s.team_id}_${s.name.trim()}`] = s.id);
      const cMap: any = {}; cats?.forEach((c: any) => cMap[c.name.trim()] = c.id);
      setOrgMap({ divisions: dMap, teamMap: tMap, staffMap: sMap, catMap: cMap });
    } catch (e) { console.error(e); }
  };

  const getColIndex = (headers: string[], aliases: string[]) => {
    return headers.findIndex(h => aliases.some(a => String(h || '').trim().includes(a)));
  };

  const cleanAmount = (val: any) => {
    if (!val) return 0;
    const cleaned = String(val).replace(/[^0-9.-]+/g, "");
    return Math.abs(parseInt(cleaned)) || 0;
  };

  const startUpload = async () => {
    if (!profile?.company_id && fetchProfile) await fetchProfile();
    const cid = profile?.company_id;
    if (!file || !cid) return alert('파일 또는 로그인 정보가 없습니다.');

    setIsUploading(true);
    setResult(null);
    const errList: string[] = [];
    
    try {
      const dataArr = await file.arrayBuffer();
      const wb = XLSX.read(dataArr, { cellFormula: false, cellHTML: false, cellText: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      if (raw.length < 2) throw new Error("데이터가 부족합니다.");
      const headers = raw[0].map(h => String(h || ''));
      
      const idx = {
        date: getColIndex(headers, ['날짜', 'date']),
        div: getColIndex(headers, ['지점', '사업부', 'division']),
        team: getColIndex(headers, ['팀', '팀명', 'team']),
        name: getColIndex(headers, ['성명', '이름', 'name', 'staff']),
        customer: getColIndex(headers, ['거래처', 'customer']),
        item: getColIndex(headers, ['품목', 'item']),
        amount: getColIndex(headers, ['금액', '매출', 'amount']),
        cat: getColIndex(headers, ['유형', '카테고리', 'category'])
      };

      if (idx.date === -1 || idx.name === -1 || idx.amount === -1) {
        throw new Error("필수 컬럼(날짜, 성명, 매출액)을 찾을 수 없습니다.");
      }

      const rows = raw.slice(1).map((r, i) => ({
        _row: i + 2,
        date: SalesCalendarService.parseUserDate(r[idx.date]),
        div: String(r[idx.div] || '').trim(),
        team: String(r[idx.team] || '').trim(),
        name: String(r[idx.name] || '').trim(),
        customer: String(r[idx.customer] || '').trim(),
        item: String(r[idx.item] || '').trim(),
        amount: cleanAmount(r[idx.amount]),
        cat: String(r[idx.cat] || '999. 미분류').trim()
      })).filter(r => r.name);

      const local = { ...orgMap };

      // Provisioning Logic (Optimized v2.4)
      for (const r of rows) {
          // Division
          if (r.div && !local.divisions[r.div]) {
              const { data: d } = await supabase.from('sales_divisions').insert({ company_id: cid, name: r.div }).select().maybeSingle();
              if (d) local.divisions[r.div] = d.id;
              else {
                  const { data: e } = await supabase.from('sales_divisions').select('id').eq('company_id', cid).eq('name', r.div).maybeSingle();
                  if (e) local.divisions[r.div] = e.id;
              }
          }
          // Team
          const dId = local.divisions[r.div] || null;
          if (r.team && dId && !local.teamMap[`${dId}_${r.team}`]) {
              const { data: t } = await supabase.from('sales_teams').insert({ company_id: cid, division_id: dId, name: r.team }).select().maybeSingle();
              if (t) local.teamMap[`${dId}_${r.team}`] = t.id;
              else {
                  const { data: e } = await supabase.from('sales_teams').select('id').eq('division_id', dId).eq('name', r.team).maybeSingle();
                  if (e) local.teamMap[`${dId}_${r.team}`] = e.id;
              }
          }
          // Staff (3-Level Composite matching)
          const tId = dId ? local.teamMap[`${dId}_${r.team}`] : null;
          if (r.name && tId && !local.staffMap[`${tId}_${r.name}`]) {
              const { data: s } = await supabase.from('sales_staff').insert({ team_id: tId, name: r.name }).select().maybeSingle();
              if (s) local.staffMap[`${tId}_${r.name}`] = s.id;
              else {
                  const { data: e } = await supabase.from('sales_staff').select('id').eq('team_id', tId).eq('name', r.name).maybeSingle();
                  if (e) local.staffMap[`${tId}_${r.name}`] = e.id;
              }
          }
          // Category
          if (r.cat && !local.catMap[r.cat]) {
              const { data: c } = await supabase.from('product_categories').insert({ company_id: cid, name: r.cat }).select().maybeSingle();
              if (c) local.catMap[r.cat] = c.id;
              else {
                  const { data: e } = await supabase.from('product_categories').select('id').eq('company_id', cid).eq('name', r.cat).maybeSingle();
                  if (e) local.catMap[r.cat] = e.id;
              }
          }
      }

      const finalRecs: any[] = [];
      rows.forEach(r => {
          const dId = local.divisions[r.div];
          const tId = dId ? local.teamMap[`${dId}_${r.team}`] : null;
          const sId = tId ? local.staffMap[`${tId}_${r.name}`] : null;
          const cId = local.catMap[r.cat] || local.catMap['999. 미분류'];
          if (!r.date || !sId) {
              if(!r.date) errList.push(`${r._row}행: 날짜 파싱 실패`);
              else errList.push(`${r._row}행: 사원 매칭 실패(${r.div}/${r.team}/${r.name})`);
              return;
          }
          finalRecs.push({ company_id: cid, staff_id: sId, team_id: tId, category_id: cId || null, customer_name: r.customer, item_name: r.item, amount: r.amount, sales_date: r.date });
      });

      setOrgMap(local);
      let sc = 0; const CHUNK = 200; // 200건 단위 Chunk
      for (let i = 0; i < finalRecs.length; i += CHUNK) {
          const { error: uErr } = await supabase.from('sales_records').upsert(finalRecs.slice(i, i + CHUNK), { onConflict: 'company_id, staff_id, customer_name, item_name, sales_date' });
          if (uErr) errList.push(`저장 오류: ${uErr.message}`); else sc += finalRecs.slice(i, i + CHUNK).length;
      }

      setResult({ total: rows.length, success: sc, failed: rows.length - sc, errors: errList });
      if (sc > 0) {
        setFile(null);
        alert(`업로드 완료!\n성공: ${sc}건\n실패: ${rows.length - sc}건`);
      }
    } catch (e: any) { alert(e.message); } finally { setIsUploading(false); }
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
      setResetType(null); setResetConfirmation(''); alert('완전 초기화 완료');
    } catch (e: any) { alert(e.message); } finally { setIsResetting(false); }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}><div className={styles.titleArea}><div className={styles.iconWrapper}><Zap size={28} /></div><h1 className={styles.title}>데이터 인텔리전스 업로드 (v2.4)</h1></div></header>
      <div className={styles.uploadCard}>
        {!file ? (
          <div className={`${styles.dropzone} ${isDragging ? styles.isDragging : ''}`} onClick={() => fileInputRef.current?.click()} onDragOver={(e) => {e.preventDefault(); setIsDragging(true)}} onDragLeave={() => setIsDragging(false)} onDrop={(e) => {e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0])}}>
            <Upload size={48} /><div className={styles.dropzoneText}><p>파일 업로드</p><span>지능형 헤더 매핑 및 200건 Chunk 처리</span></div><input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
          </div>
        ) : (
          <div className={styles.fileInfo}><div className={styles.fileName}><FileText size={20} /> {file.name}</div><button className={styles.removeBtn} onClick={() => setFile(null)}><X size={20} /></button></div>
        )}
        <div className={styles.instructions}>
          <h3 className={styles.instructionTitle}>🚀 업그레이드 엔진 v2.4</h3>
          <ul className={styles.instructionList}>
            <li className={styles.instructionItem}><b>헤더 별칭 매핑:</b> '사업부', '성명', '매출액' 등 다양한 이름을 자동으로 인식합니다.</li>
            <li className={styles.instructionItem}><b>3단계 검증:</b> (사업부-팀-성명) 구조를 매칭하여 동명이인 혼선을 방지합니다.</li>
          </ul>
        </div>
        <button className={styles.uploadBtn} disabled={!file || isUploading} onClick={startUpload}>
          {isUploading ? <Loader2 className={styles.animateSpin} size={20} /> : '지능형 대용량 업로드 시작'}
        </button>
        {result && (
          <div style={{ marginTop: 24 }}>
            <div className={styles.statsArea}>
              <div className={styles.statCard}><span className={styles.statLabel}>총계</span><span className={styles.statValue}>{result.total}</span></div>
              <div className={styles.statCard} style={{borderColor: '#10B981'}}><span className={styles.statLabel}>성공</span><span className={styles.statValue} style={{color: '#10B981'}}>{result.success}</span></div>
              <div className={styles.statCard} style={{borderColor: '#ef4444'}}><span className={styles.statLabel}>실패</span><span className={styles.statValue} style={{color: '#ef4444'}}>{result.failed}</span></div>
            </div>
            {result.errors.length > 0 && (
              <div className={styles.errorArea} style={{ marginTop: 24 }}>
                <div className={styles.errorTitle}><AlertCircle size={18} /><h4>상세 실패 리포트 (행 번호 및 사유)</h4></div>
                <ul className={styles.errorList}>{result.errors.slice(0, 100).map((err, idx) => <li key={idx}>{err}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>
      <div className={styles.dangerZone}>
        <div className={styles.dangerHeader}><AlertTriangle size={24} color="#EF4444" /><h2 className={styles.dangerTitle}>시스템 초기화</h2></div>
        <div className={styles.resetOptions}>
          <button className={`${styles.resetOptionBtn} ${resetType === 'data' ? styles.active : ''}`} onClick={() => setResetType('data')}>실적만</button>
          <button className={`${styles.resetOptionBtn} ${resetType === 'factory' ? styles.active : ''}`} onClick={() => setResetType('factory')}>전체 공장</button>
        </div>
        {resetType && (
          <div className={styles.resetConfirmArea} style={{ marginTop: 16 }}>
            <input type="text" className={styles.resetInput} placeholder='"데이터 초기화 확인" 입력' value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} />
            <button className={styles.resetBtn} disabled={resetConfirmation !== '데이터 초기화 확인' || isResetting} onClick={handleReset}>초기화</button>
          </div>
        )}
      </div>
    </div>
  );
};
export default DataUploadPage;
