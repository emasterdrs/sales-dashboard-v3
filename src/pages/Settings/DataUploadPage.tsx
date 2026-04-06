import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertCircle, X, Loader2, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
  const [isResetting, setIsResetting] = useState(false);
  const [resetType, setResetType] = useState<'data' | 'factory' | null>(null);
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
      const timer = setTimeout(() => setNotification(null), 3500);
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
      data.push(['2024-03-01', '2. 대리점사업부', '강남지점', '이태민', 'D0119', '북안산혜민', 'AA02230', '진종합', '601000', '어묵']);
      data.push(['2024-03-01', '2. 대리점사업부', '강남지점', '권재현', 'D5652', '서수원한림', 'AA02230', '진종합', '681000', '어묵']);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, type === 'empty' ? "매출업로드_양식.xlsx" : "매출업로드_예제.xlsx");
  };

  const getColIndex = (headers: string[], aliases: string[]) => {
    const exact = headers.findIndex(h => aliases.includes(String(h || '').trim()));
    if (exact !== -1) return exact;
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
    if (!file) return showNotify('업로드할 파일을 선택해 주세요.', 'error');
    if (!cid) return showNotify('로그인 세션이 만료되었습니다.', 'error');

    setIsUploading(true);
    setResult(null);
    setProgress(1);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const worker = new Worker(new URL('../../workers/excelWorker.ts', import.meta.url), { type: 'module' });

      worker.onmessage = async (e) => {
        const { type, data } = e.data;
        if (type === 'progress') setProgress(Math.floor(data * 0.3));
        if (type === 'headers') console.log("🔍 추출 헤더:", data);
        if (type === 'error') { worker.terminate(); showNotify(data, 'error'); setIsUploading(false); }
        if (type === 'success') {
          // 데이터 파싱 성공 시 후속 처리 (워커 내부에서 이미 정제된 rawRows 수신)
          // 워커로부터 받은 데이터의 첫 번째 행은 헤더인 경우를 대비해 처리 로직 강화
          await processParsedData(data, worker);
        }
      };
      worker.postMessage({ arrayBuffer }, [arrayBuffer]);
    } catch (e: any) {
      showNotify(`시스템 에러: ${e.message}`, 'error');
      setIsUploading(false);
    }
  };

  const processParsedData = async (rawRows: any[][], worker: Worker) => {
    const cid = profile?.company_id;
    if (!cid) return;

    try {
      // 워커가 준 데이터가 headers를 포함한 rawRows일 경우 인덱스 동적 추출 연동
      const headerRow = rawRows[0] || [];
      const headers = headerRow.map(h => String(h || '').trim());
      
      const idx = {
        date: getColIndex(headers, ['날짜', 'date']),
        div: getColIndex(headers, ['사업부', 'division']),
        team: getColIndex(headers, ['팀', 'team']),
        name: getColIndex(headers, ['성명', '이름', 'name']),
        customer: getColIndex(headers, ['거래처']),
        item: getColIndex(headers, ['품목']),
        amount: getColIndex(headers, ['금액', '매출액', '매출']),
        cat: getColIndex(headers, ['유형', '카테고리'])
      };

      if (idx.date === -1 || idx.name === -1 || idx.amount === -1) {
        worker.terminate();
        showNotify('필수 헤더를 찾을 수 없습니다 (날짜, 성명, 매출액 확인 요망)', 'error');
        setIsUploading(false);
        return;
      }

      const rows: any[] = [];
      const local = { ...orgMap };
      const dataRows = rawRows.slice(1);
      
      dataRows.forEach((row, i) => {
        const mapped = {
          _row: i + 2,
          date: SalesCalendarService.parseUserDate(row[idx.date]),
          div: String(row[idx.div] || '').trim(),
          team: String(row[idx.team] || '').trim(),
          name: String(row[idx.name] || '').trim(),
          customer: String(row[idx.customer] || '').trim(),
          item: String(row[idx.item] || '').trim(),
          amount: cleanAmount(row[idx.amount]),
          cat: String(row[idx.cat] || '999. 미분류').trim()
        };
        if (mapped.name) rows.push(mapped);
      });
      
      setProgress(40);
      const normalize = (s: string) => s.replace(/\s+/g, ''); 

      // Sync Divisions
      const divNames = Array.from(new Set(rows.map(r => r.div))).filter(d => d && !local.divisions[d] && !local.divisions[`_norm_${normalize(d)}`]);
      if (divNames.length > 0) {
        const { data: insDivs } = await supabase.from('sales_divisions').insert(divNames.map(n => ({ company_id: cid, name: n.trim() }))).select();
        insDivs?.forEach(d => { local.divisions[d.name.trim()] = d.id; local.divisions[`_norm_${normalize(d.name)}`] = d.id; });
      }
      setProgress(50);

      const teamKeys = Array.from(new Set(rows.map(r => `${r.div}|${r.team}`))).filter(k => {
        const [dn, tn] = k.split('|');
        const did = local.divisions[dn] || local.divisions[`_norm_${normalize(dn)}`];
        return did && tn && !local.teamMap[`${did}_${tn}`] && !local.teamMap[`${did}_norm_${normalize(tn)}`];
      });
      if (teamKeys.length > 0) {
        const tIns = teamKeys.map(k => {
          const [dn, tn] = k.split('|');
          const did = local.divisions[dn] || local.divisions[`_norm_${normalize(dn)}`];
          return did ? { company_id: cid, division_id: did, name: tn.trim() } : null;
        }).filter(Boolean);
        const { data: insTeams } = await supabase.from('sales_teams').insert(tIns as any).select();
        insTeams?.forEach(t => { local.teamMap[`${t.division_id}_${t.name.trim()}`] = t.id; local.teamMap[`${t.division_id}_norm_${normalize(t.name)}`] = t.id; });
      }
      setProgress(60);

      const staffKeys = Array.from(new Set(rows.map(r => `${r.div}|${r.team}|${r.name}`))).filter(k => {
        const [dn, tn, sn] = k.split('|');
        const did = local.divisions[dn] || local.divisions[`_norm_${normalize(dn)}`];
        const tid = did ? (local.teamMap[`${did}_${tn}`] || local.teamMap[`${did}_norm_${normalize(tn)}`]) : null;
        return tid && sn && !local.staffMap[`${tid}_${sn}`] && !local.staffMap[`${tid}_norm_${normalize(sn)}`];
      });
      if (staffKeys.length > 0) {
        const sIns = staffKeys.map(k => {
          const [dn, tn, sn] = k.split('|');
          const did = local.divisions[dn] || local.divisions[`_norm_${normalize(dn)}`];
          const tid = did ? (local.teamMap[`${did}_${tn}`] || local.teamMap[`${did}_norm_${normalize(tn)}`]) : null;
          return tid ? { company_id: cid, team_id: tid, name: sn.trim() } : null;
        }).filter(Boolean);
        const { data: insStf } = await supabase.from('sales_staff').insert(sIns as any).select();
        insStf?.forEach(s => { local.staffMap[`${s.team_id}_${s.name.trim()}`] = s.id; local.staffMap[`${s.team_id}_norm_${normalize(s.name)}`] = s.id; });
      }
      setProgress(70);

      const aggMap = new Map<string, any>();
      rows.forEach(r => {
        const did = local.divisions[r.div] || local.divisions[`_norm_${normalize(r.div)}`];
        const tid = did ? (local.teamMap[`${did}_${r.team}`] || local.teamMap[`${did}_norm_${normalize(r.team)}`]) : null;
        const sid = tid ? (local.staffMap[`${tid}_${r.name}`] || local.staffMap[`${tid}_norm_${normalize(r.name)}`]) : null;
        const cid_cat = local.catMap[r.cat] || local.catMap[`_norm_${normalize(r.cat)}`] || local.catMap['999. 미분류'];
        if (r.date && sid) {
          const k = `${sid}|${r.customer}|${r.item}|${r.date}`;
          if (aggMap.has(k)) aggMap.get(k).amount += r.amount;
          else aggMap.set(k, { company_id: cid, staff_id: sid, team_id: tid, category_id: cid_cat || null, customer_name: r.customer, item_name: r.item, amount: r.amount, sales_date: r.date });
        }
      });

      const finalRecs = Array.from(aggMap.values());
      const CHUNK = 1000;
      for (let i = 0; i < finalRecs.length; i += CHUNK) {
        await supabase.from('sales_records').upsert(finalRecs.slice(i, i + CHUNK), { onConflict: 'company_id, staff_id, customer_name, item_name, sales_date' });
        setProgress(Math.min(98, 70 + Math.floor((i / finalRecs.length) * 28)));
      }

      await supabase.rpc('refresh_sales_summary', { p_company_id: cid, p_year: new Date().getFullYear(), p_month: new Date().getMonth() + 1 });
      
      setProgress(100);
      showNotify('매출 업로드가 안전하게 완료되었습니다.', 'success');
      setFile(null);
      setOrgMap(local);
      setResult({ total: rows.length, success: finalRecs.length, failed: 0, merged: rows.length - finalRecs.length, errors: [] });
      
    } catch (e: any) {
      showNotify(`데이터 처리 오류: ${e.message}`, 'error');
    } finally {
      worker.terminate();
      setIsUploading(false);
    }
  };

  const handleReset = async () => {
    const cid = profile?.company_id;
    if (!cid || resetConfirmation !== '데이터 초기화 확인' || !resetType) return showNotify('모든 항목을 입력/선택해 주세요.', 'error');
    setIsResetting(true);
    try {
      if (resetType === 'data') {
        await Promise.all([
          supabase.from('sales_records').delete().eq('company_id', cid),
          supabase.from('sales_targets').delete().eq('company_id', cid),
          supabase.from('sales_summary').delete().eq('company_id', cid)
        ]);
        showNotify('실적 및 목표 데이터가 초기화되었습니다.', 'success');
      } else {
        await Promise.all([
          supabase.from('sales_records').delete().eq('company_id', cid),
          supabase.from('sales_targets').delete().eq('company_id', cid),
          supabase.from('sales_summary').delete().eq('company_id', cid),
          supabase.from('sales_divisions').delete().eq('company_id', cid) // Cascading or manual cleanup needed
        ]);
        fetchOrgInfo();
        showNotify('시스템 수동 초기화가 완료되었습니다.', 'success');
      }
      setResetType(null); setResetConfirmation('');
    } catch (e: any) { showNotify(e.message, 'error'); } finally { setIsResetting(false); }
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
          <h1 className={styles.title}>매출 실적 데이터 관리</h1>
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
              <p>마우스로 끌어서 파일을 업로드하세요.</p>
              <span>VODA 엔진으로 대용량 데이터도 안전하게.</span>
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
          <h3 className={styles.instructionTitle}><AlertCircle size={18} /> 업로드 전 안내</h3>
          <ul className={styles.instructionList}>
            <li className={styles.instructionItem}><b>병렬 처리:</b> Web Worker 기술로 브라우저 멈춤 없이 작동합니다.</li>
            <li className={styles.instructionItem}><b>실시간 상태:</b> 아래 진행 바가 100%가 될 때까지 기다려 주세요.</li>
          </ul>
          
          <div className={styles.templateTools}>
            <button className={styles.templateBtn} onClick={() => downloadTemplate('sample')}>샘플 예시</button>
            <button className={styles.templateBtn} onClick={() => downloadTemplate('empty')}>공 양식 파일</button>
          </div>
        </div>

        {isUploading && (
          <div className={styles.progressArea}>
             <div className={styles.progressBarWrapper}>
               <div className={styles.progressBar} style={{ width: `${progress}%` }} />
               <span className={styles.progressText}>{progress}% 클라우드 분석 중...</span>
             </div>
          </div>
        )}

        <button className={styles.uploadBtn} disabled={isUploading} onClick={startUpload}>
          {isUploading ? <Loader2 className={styles.animateSpin} size={20} /> : '병렬 업로드 시작'}
        </button>

        {result && (
          <div style={{ marginTop: 24 }}>
            <div className={styles.statsArea}>
              <div className={styles.statCard}><span className={styles.statLabel}>총 데이터</span><span className={styles.statValue}>{result.total}</span></div>
              <div className={styles.statCard}><span className={styles.statLabel}>처리 완료</span><span className={styles.statValue} style={{color: '#10B981'}}>{result.success}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerHeader}><AlertTriangle size={24} color="#dc2626" /><h2 className={styles.dangerTitle}>데이터 관리</h2></div>
        <div className={styles.resetOptions}>
          <button className={`${styles.resetOptionBtn} ${resetType === 'data' ? styles.active : ''}`} onClick={() => setResetType('data')}>실적만 삭제</button>
          <button className={`${styles.resetOptionBtn} ${resetType === 'factory' ? styles.active : ''}`} onClick={() => setResetType('factory')}>전체 초기화</button>
        </div>
        {resetType && (
          <div className={styles.resetConfirmArea}>
            <input type="text" className={styles.resetInput} placeholder='"데이터 초기화 확인" 입력' value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} />
            <button className={styles.resetBtn} disabled={resetConfirmation !== '데이터 초기화 확인' || isResetting} onClick={handleReset}>영구 삭제 실행</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataUploadPage;
