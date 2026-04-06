import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertCircle, X, Loader2, Database, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { SalesCalendarService } from '../../services/SalesCalendarService';
import styles from './DataUploadPage.module.css';
import * as XLSX from 'xlsx';

interface UploadResult {
  total: number;
  success: number;
  failed: number;
  merged: number;
  errors: string[];
}

interface Notification {
  message: string;
  type: 'success' | 'error';
}

const DataUploadPage: React.FC = () => {
  const { profile, fetchProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<'IDLE' | 'PARSING' | 'SAVING'>('IDLE');
  const [isResetting, setIsResetting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [orgMap, setOrgMap] = useState<any>({ divisions: {}, teamMap: {}, staffMap: {}, catMap: {} });
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [notification, setNotification] = useState<Notification | null>(null);

  useEffect(() => { 
    fetchOrgInfo(); 
    document.title = "VODA 영업 대시보드";
  }, [profile?.company_id]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotify = (message: string, type: 'success' | 'error' = 'error') => {
    setNotification({ message, type });
  };

  const fetchAll = async (query: any) => {
      let all: any[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
          const { data, error } = await query.range(from, from + step - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all = [...all, ...data];
          if (data.length < step) break;
          from += step;
      }
      return all;
  };

  const fetchOrgInfo = async () => {
    const cid = profile?.company_id;
    if (!cid) return;
    try {
      const [divs, teams, cats] = await Promise.all([
        fetchAll(supabase.from('sales_divisions').select('id, name').eq('company_id', cid)),
        fetchAll(supabase.from('sales_teams').select('id, name, division_id').eq('company_id', cid)),
        fetchAll(supabase.from('product_categories').select('id, name').eq('company_id', cid))
      ]);
      const stf = teams.length > 0 ? await fetchAll(supabase.from('sales_staff').select('id, name, team_id').in('team_id', teams.map((t:any) => t.id))) : [];
      
      const dMap: any = {}; divs.forEach((d: any) => dMap[d.name.trim()] = d.id);
      const tMap: any = {}; teams.forEach((t: any) => tMap[`${t.division_id}_${t.name.trim()}`] = t.id);
      const sMap: any = {}; stf.forEach((s: any) => sMap[`${s.team_id}_${s.name.trim()}`] = s.id);
      const cMap: any = {}; cats.forEach((c: any) => cMap[c.name.trim()] = c.id);
      setOrgMap({ divisions: dMap, teamMap: tMap, staffMap: sMap, catMap: cMap });
    } catch (e) { console.error('fetchOrgInfo Error:', e); }
  };

  const downloadTemplate = (type: 'empty' | 'sample') => {
    const headers = [['날짜', '사업부', '팀', '성명', '거래처코드', '거래처', '품목코드', '품목', '매출액', '카테고리']];
    let data = [...headers];
    if (type === 'sample') {
      data.push(['2026-04-01', '대리점본부', '강남팀', '이태민', 'D001', '강남마트', 'P700', '어묵순살전골', '125000', '어묵']);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, type === 'empty' ? "매출업로드_양식.xlsx" : "매출_샘플데이터.xlsx");
  };

  const getColIndex = (headers: string[], aliases: string[]) => {
    const raw = headers.map(h => String(h || '').replace(/\s+/g, ''));
    const terms = aliases.map(a => a.replace(/\s+/g, ''));
    const exact = raw.findIndex(h => terms.includes(h));
    if (exact !== -1) return exact;
    return raw.findIndex(h => terms.some(t => h.includes(t) || t.includes(h)));
  };

  const cleanAmount = (val: any) => {
    if (!val) return 0;
    const cleaned = String(val).replace(/[^0-9.-]+/g, "");
    return Math.abs(parseInt(cleaned)) || 0;
  };

  const startUpload = async () => {
    if (!profile?.company_id && fetchProfile) await fetchProfile();
    const cid = profile?.company_id;
    if (!file) return showNotify('업로드할 파일을 먼저 선택해 주세요.', 'error');
    if (!cid) return showNotify('로그인 세션이 유효하지 않습니다.', 'error');

    setIsUploading(true);
    setUploadPhase('PARSING');
    setResult(null);
    setProgress(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const worker = new Worker(new URL('../../workers/excelWorker.ts', import.meta.url), { type: 'module' });

      let parsedHeaders: string[] = [];
      let gatheredRows: any[][] = [];

      worker.onmessage = async (e) => {
        const { type, data } = e.data;
        if (type === 'debug_rows') console.table(data);
        if (type === 'headers') parsedHeaders = data;
        if (type === 'chunk') gatheredRows.push(...data);
        if (type === 'progress') setProgress(Math.floor(data * 0.4));
        if (type === 'error') { worker.terminate(); showNotify(`${data}`, 'error'); resetUploadState(); }
        if (type === 'success') {
          worker.terminate();
          setUploadPhase('SAVING');
          await saveToDatabase(gatheredRows, parsedHeaders);
        }
      };
      worker.postMessage({ arrayBuffer }, [arrayBuffer]);

    } catch (e: any) {
      showNotify(`시스템 오류: ${e.message}`, 'error');
      resetUploadState();
    }
  };

  const resetUploadState = () => {
    setIsUploading(false);
    setUploadPhase('IDLE');
    setProgress(0);
  };

  const saveToDatabase = async (rawRows: any[][], headers: string[]) => {
    const cid = profile?.company_id;
    if (!cid) return;

    try {
      const idx = {
        date: getColIndex(headers, ['날짜', '일자', '판매일', '매출일']),
        div: getColIndex(headers, ['사업부', '본부', '부문']),
        team: getColIndex(headers, ['팀', '영업팀', '지점']),
        name: getColIndex(headers, ['성명', '이름', '담당자', '사원']),
        customer: getColIndex(headers, ['거래처', '고객', '업체']),
        item: getColIndex(headers, ['품목', '상품', '제품']),
        amount: getColIndex(headers, ['금액', '매출액', '매출', '판매금액', '실적']),
        cat: getColIndex(headers, ['카테고리', '유형', '분류'])
      };

      if (idx.date === -1 || idx.name === -1 || idx.amount === -1) {
         throw new Error(`필수 항목(날짜, 성명, 매출액)을 찾을 수 없습니다. 인식된 헤더: [${headers.slice(0, 5).join(', ')}...]`);
      }

      const local = { ...orgMap };
      const recordsToUpsert: any[] = [];
      const normalize = (s: string) => s.replace(/\s+/g, '');

      for (let i = 0; i < rawRows.length; i++) {
        const r = rawRows[i];
        const rawDiv = String(r[idx.div] || '').trim();
        const rawTeam = String(r[idx.team] || '').trim();
        const rawName = String(r[idx.name] || '').trim();
        const rawCat = String(r[idx.cat] || '999. 미분류').trim();

        if (rawDiv && !local.divisions[rawDiv] && !local.divisions[`_norm_${normalize(rawDiv)}`]) {
          const { data: d } = await supabase.from('sales_divisions').insert({ company_id: cid, name: rawDiv }).select();
          if (d?.[0]) local.divisions[d[0].name] = d[0].id;
        }
        
        const divId = local.divisions[rawDiv] || local.divisions[`_norm_${normalize(rawDiv)}`];
        const teamKey = `${divId}_${rawTeam}`;
        if (divId && rawTeam && !local.teamMap[teamKey]) {
          const { data: t } = await supabase.from('sales_teams').insert({ company_id: cid, division_id: divId, name: rawTeam }).select();
          if (t?.[0]) local.teamMap[`${t[0].division_id}_${t[0].name}`] = t[0].id;
        }

        const teamId = local.teamMap[teamKey] || local.teamMap[`${divId}_norm_${normalize(rawTeam)}`];
        const staffKey = `${teamId}_${rawName}`;
        if (teamId && rawName && !local.staffMap[staffKey]) {
          const { data: s } = await supabase.from('sales_staff').insert({ company_id: cid, team_id: teamId, name: rawName }).select();
          if (s?.[0]) local.staffMap[`${s[0].team_id}_${s[0].name}`] = s[0].id;
        }

        const staffId = local.staffMap[staffKey] || local.staffMap[`${teamId}_norm_${normalize(rawName)}`];
        
        if (!local.catMap[rawCat] && !local.catMap[`_norm_${normalize(rawCat)}`]) {
           const { data: c } = await supabase.from('product_categories').insert({ company_id: cid, name: rawCat }).select();
           if (c?.[0]) local.catMap[c[0].name] = c[0].id;
        }
        const catId = local.catMap[rawCat] || local.catMap[`_norm_${normalize(rawCat)}`] || local.catMap['999. 미분류'];

        const date = SalesCalendarService.parseUserDate(r[idx.date]);
        const amt = cleanAmount(r[idx.amount]);

        if (staffId && date) {
          recordsToUpsert.push({ company_id: cid, staff_id: staffId, team_id: teamId, category_id: catId || null, customer_name: String(r[idx.customer] || '').trim(), item_name: String(r[idx.item] || '').trim(), amount: amt, sales_date: date });
        }
        if (i % 200 === 0) setProgress(40 + Math.floor((i / rawRows.length) * 20));
      }

      const CHUNK = 1000;
      for (let i = 0; i < recordsToUpsert.length; i += CHUNK) {
        const { error: dbError } = await supabase.from('sales_records').upsert(recordsToUpsert.slice(i, i + CHUNK), { onConflict: 'company_id, staff_id, customer_name, item_name, sales_date' });
        if (dbError) throw new Error(`[DB 저장 실패] ${dbError.message}`);
        setProgress(60 + Math.floor((i / recordsToUpsert.length) * 40));
      }

      await supabase.rpc('refresh_sales_summary', { p_company_id: cid, p_year: new Date().getFullYear(), p_month: new Date().getMonth() + 1 });
      
      setProgress(100);
      showNotify('데이터 업로드가 안전하게 완료되었습니다.', 'success');
      setFile(null);
      setResult({ total: rawRows.length, success: recordsToUpsert.length, failed: 0, merged: recordsToUpsert.length, errors: [] });
    } catch (e: any) {
      showNotify(`DB 저장 오류: ${e.message}`, 'error');
    } finally {
      resetUploadState();
    }
  };

  const handleReset = async () => {
    if (resetConfirmation !== '데이터 초기화 확인') return showNotify('초기화 문구를 확인해 주세요.', 'error');
    setIsResetting(true);
    try {
      const cid = profile?.company_id;
      if (!cid) return;
      await Promise.all([
        supabase.from('sales_records').delete().eq('company_id', cid),
        supabase.from('sales_targets').delete().eq('company_id', cid),
        supabase.from('sales_summary').delete().eq('company_id', cid)
      ]);
      showNotify('전체 실적 데이터가 리셋되었습니다.', 'success');
      setResetConfirmation('');
    } catch (e: any) { showNotify(`리셋 오류: ${e.message}`, 'error'); } finally { setIsResetting(false); }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      {notification && (
        <div className={`${styles.toast} ${styles[notification.type]}`}>
          {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><Database size={24} /></div>
          <h1 className={styles.title}>매출 실적 데이터 업로드</h1>
        </div>
      </header>
      
      <div className={styles.uploadCard}>
        {!file ? (
          <div className={`${styles.dropzone} ${isDragging ? styles.isDragging : ''}`} 
               onClick={() => fileInputRef.current?.click()} 
               onDragOver={(e) => {e.preventDefault(); setIsDragging(true)}} 
               onDragLeave={() => setIsDragging(false)} 
               onDrop={(e) => {e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0])}}>
            <Upload size={40} color="#3b82f6" />
            <div className={styles.dropzoneText}>
              <p>클릭하거나 파일을 드래그하여 업로드</p>
              <span>VODA 엔진으로 대대용량 데이터도 안전하게 처리합니다.</span>
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
          <h3 className={styles.instructionTitle}><AlertCircle size={18} /> 업로드 전 유의사항</h3>
          <ul className={styles.instructionList}>
            <li className={styles.instructionItem}><b>데이터 권장:</b> 안정적인 처리를 위해 한 번에 10만 건 이하의 업로드를 권장합니다.</li>
            <li className={styles.instructionItem}><b>대용량 처리:</b> 수십만 건의 대용량 파일은 브라우저 메모리 한계로 멈출 수 있으니, 분기/월별로 나누어 업로드해 주세요.</li>
            <li className={styles.instructionItem}><b>필수 항목:</b> 파일 내에 필수 항목(날짜, 성명, 매출액)이 반드시 포함되어야 합니다.</li>
          </ul>
          
          <div className={styles.templateTools}>
            <button className={styles.templateBtn} onClick={() => downloadTemplate('sample')}>샘플 예시</button>
            <button className={styles.templateBtn} onClick={() => downloadTemplate('empty')}>업로드 파일 (양식)</button>
          </div>
        </div>

        {isUploading && (
          <div className={styles.progressArea}>
             <div className={styles.progressBarWrapper}>
               <div className={styles.progressBar} style={{ width: `${progress}%` }} />
               <span className={styles.progressText}>
                 {uploadPhase === 'PARSING' ? `[분석] ${progress}% 데이터를 추출하고 있습니다...` : `[저장] ${progress}% 클라우드 서버에 동기화 중...`}
               </span>
             </div>
          </div>
        )}

        <button className={styles.uploadBtn} disabled={isUploading} onClick={startUpload}>
          {isUploading ? <Loader2 className={styles.animateSpin} size={20} /> : '업로드 시작'}
        </button>

        {result && (
          <div style={{ marginTop: 24 }}>
            <div className={styles.statsArea}>
              <div className={styles.statCard}><span className={styles.statLabel}>총 건수</span><span className={styles.statValue}>{result.total}</span></div>
              <div className={styles.statCard}>
                <div style={{display:'flex', alignItems:'center', gap:4}}>
                  <span className={styles.statLabel}>병합</span>
                  <div className={styles.tooltipIcon} title="시스템에 이미 등록된 동일한 날짜/사원 데이터가 있어 최신 실적으로 업데이트된 건수입니다."><HelpCircle size={14}/></div>
                </div>
                <span className={styles.statValue} style={{color: '#3b82f6'}}>{result.merged}</span>
              </div>
            </div>
            <p className={styles.mergeHelper}>※ 병합: 중복된 데이터는 최신 실적으로 안전하게 업데이트됩니다.</p>
          </div>
        )}
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerHeader}><AlertTriangle size={24} color="#dc2626" /><h2 className={styles.dangerTitle}>데이터 초기화</h2></div>
        <div className={styles.resetConfirmArea}>
          <input type="text" className={styles.resetInput} placeholder='"데이터 초기화 확인" 입력' value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} />
          <button className={styles.resetBtn} disabled={resetConfirmation !== '데이터 초기화 확인' || isResetting} onClick={handleReset}>초기화 실행</button>
        </div>
      </div>
    </div>
  );
};

export default DataUploadPage;
