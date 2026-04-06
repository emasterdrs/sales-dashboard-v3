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
      data.push(['2024-03-01', '대리점본부', '지방팀', '홍길동', 'A1234', '코스트코', 'P5678', '사조대림어묵', '550200', '어묵']);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, type === 'empty' ? "매출_공양식.xlsx" : "매출_샘플.xlsx");
  };

  const getColIndex = (headers: string[], aliases: string[]) => {
    const rawHeaders = headers.map(h => String(h || '').replace(/\s+/g, ''));
    const searchTerms = aliases.map(a => a.replace(/\s+/g, ''));
    
    // 1. 정확한 매칭 우선
    const exact = rawHeaders.findIndex(h => searchTerms.includes(h));
    if (exact !== -1) return exact;
    
    // 2. 포함 관계 매칭 (Fuzzy)
    return rawHeaders.findIndex(h => searchTerms.some(st => h.includes(st) || st.includes(h)));
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
    if (!cid) return showNotify('로그인 세션 만료', 'error');

    setIsUploading(true);
    setResult(null);
    setProgress(1);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const worker = new Worker(new URL('../../workers/excelWorker.ts', import.meta.url), { type: 'module' });

      let currentHeaders: string[] = [];
      let totalRawRows: any[][] = [];

      worker.onmessage = async (e) => {
        const { type, data } = e.data;

        if (type === 'debug_rows') {
          console.log("🛠️ [VODA 디버거] 엑셀 상단 5개 로우 데이터:", data);
        }

        if (type === 'headers') {
          currentHeaders = data;
          console.log("🔍 [VODA 인텔리전스] 탐색된 지능형 헤더:", data);
        }

        if (type === 'chunk') {
          totalRawRows.push(...data);
        }

        if (type === 'progress') {
          // 파싱은 전체 프로세스의 25% 차지
          setProgress(Math.floor(data * 0.25));
        }

        if (type === 'error') {
          worker.terminate();
          showNotify(data, 'error');
          setIsUploading(false);
        }

        if (type === 'success') {
          console.log(`✅ [VODA 파싱 완료] 총 ${totalRawRows.length}개의 유효 데이터 행을 수집했습니다.`);
          await processAggregatedData(totalRawRows, currentHeaders, worker);
        }
      };

      worker.postMessage({ arrayBuffer }, [arrayBuffer]);

    } catch (e: any) {
      showNotify(`시스템 치명적 오류: ${e.message}`, 'error');
      setIsUploading(false);
    }
  };

  const processAggregatedData = async (rawRows: any[][], headers: string[], worker: Worker) => {
    const cid = profile?.company_id;
    if (!cid) return;

    try {
      // 1. 컬럼 인덱스 매핑 (Fuzzy 매칭 강화)
      const idx = {
        date: getColIndex(headers, ['날짜', '일자', '판매일', '매출일', '일시']),
        div: getColIndex(headers, ['사업부', '본부', '부문', '부서']),
        team: getColIndex(headers, ['팀', '팀명', '영업팀', '영업지점', '지점']),
        name: getColIndex(headers, ['성명', '이름', '사원', '담당자', '담당', '직원']),
        customer: getColIndex(headers, ['거래처', '고객', '매장', '업체']),
        item: getColIndex(headers, ['품목', '상품', '제품', '모델']),
        amount: getColIndex(headers, ['금액', '매출액', '매출', '판매금액', '실적', '합계']),
        cat: getColIndex(headers, ['카테고리', '유형', '분류', '그룹'])
      };

      console.log("🎯 [VODA 매칭 리포트] 인덱스 매핑 결과:", idx);

      if (idx.date === -1 || idx.name === -1 || idx.amount === -1) {
        worker.terminate();
        showNotify('필수 컬럼을 찾을 수 없습니다. (날짜, 성명, 매출액 유사어를 확인해 주세요)', 'error');
        setIsUploading(false);
        return;
      }

      const rows: any[] = [];
      const local = { ...orgMap };

      // 2. 데이터 정제 (매핑 및 매칭)
      rawRows.forEach((r, i) => {
        const mapped = {
          _row: i + 1, // 헤더 이후 데이터이므로 인덱싱 유의
          date: SalesCalendarService.parseUserDate(r[idx.date]),
          div: String(r[idx.div] || '').trim(),
          team: String(r[idx.team] || '').trim(),
          name: String(r[idx.name] || '').trim(),
          customer: String(r[idx.customer] || '').trim(),
          item: String(r[idx.item] || '').trim(),
          amount: cleanAmount(r[idx.amount]),
          cat: String(r[idx.cat] || '999. 미분류').trim()
        };
        if (mapped.name && mapped.date) rows.push(mapped);
      });

      setProgress(35);
      const normalize = (s: string) => s.replace(/\s+/g, '');

      // 3. 조직 정보 실시간 동기화
      const divNames = Array.from(new Set(rows.map(r => r.div))).filter(d => d && !local.divisions[d] && !local.divisions[`_norm_${normalize(d)}`]);
      if (divNames.length > 0) {
        const { data: insDivs } = await supabase.from('sales_divisions').insert(divNames.map(n => ({ company_id: cid, name: n.trim() }))).select();
        insDivs?.forEach(d => { local.divisions[d.name.trim()] = d.id; local.divisions[`_norm_${normalize(d.name)}`] = d.id; });
      }
      setProgress(45);

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
      setProgress(55);

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
      setProgress(65);

      // 4. 데이터 집계 (동일 데이터 병합)
      const aggMap = new Map<string, any>();
      rows.forEach(r => {
        const did = local.divisions[r.div] || local.divisions[`_norm_${normalize(r.div)}`];
        const tid = did ? (local.teamMap[`${did}_${r.team}`] || local.teamMap[`${did}_norm_${normalize(r.team)}`]) : null;
        const sid = tid ? (local.staffMap[`${tid}_${r.name}`] || local.staffMap[`${tid}_norm_${normalize(r.name)}`]) : null;
        const cid_cat = local.catMap[r.cat] || local.catMap[`_norm_${normalize(r.cat)}`] || local.catMap['999. 미분류'];
        
        if (r.date && sid) {
          const key = `${sid}|${r.customer}|${r.item}|${r.date}`;
          if (aggMap.has(key)) aggMap.get(key).amount += r.amount;
          else aggMap.set(key, { company_id: cid, staff_id: sid, team_id: tid, category_id: cid_cat || null, customer_name: r.customer, item_name: r.item, amount: r.amount, sales_date: r.date });
        }
      });

      const finalRecs = Array.from(aggMap.values());
      console.log(`🚀 [VODA 집계 완료] 중복 병합 후 ${finalRecs.length}건의 데이터를 클라우드에 업로드합니다.`);

      // 5. 서버 데이터 업로드 (Upsert)
      const CHUNK = 1000;
      for (let i = 0; i < finalRecs.length; i += CHUNK) {
        await supabase.from('sales_records').upsert(finalRecs.slice(i, i + CHUNK), { onConflict: 'company_id, staff_id, customer_name, item_name, sales_date' });
        setProgress(Math.min(98, 70 + Math.floor((i / finalRecs.length) * 28)));
      }

      // 통계 요약 갱신
      const affectedYearsMonths = Array.from(new Set(finalRecs.map(r => {
        const d = new Date(r.sales_date);
        return `${d.getFullYear()}-${d.getMonth() + 1}`;
      })));

      for (const ym of affectedYearsMonths) {
        const [y, m] = ym.split('-').map(Number);
        await supabase.rpc('refresh_sales_summary', { p_company_id: cid, p_year: y, p_month: m });
      }

      setProgress(100);
      showNotify('실무 데이터 업로드가 완료되었습니다.', 'success');
      setFile(null);
      setOrgMap(local);
      setResult({ total: rows.length, success: finalRecs.length, failed: 0, merged: rows.length - finalRecs.length, errors: [] });
      
    } catch (e: any) {
      showNotify(`업로드 처리 실패: ${e.message}`, 'error');
    } finally {
      worker.terminate();
      setIsUploading(false);
    }
  };

  const handleReset = async () => {
    const cid = profile?.company_id;
    if (!cid || resetConfirmation !== '데이터 초기화 확인' || !resetType) return showNotify('초기화 설정을 확인해 주세요.', 'error');
    setIsResetting(true);
    try {
      if (resetType === 'data') {
        await Promise.all([
          supabase.from('sales_records').delete().eq('company_id', cid),
          supabase.from('sales_targets').delete().eq('company_id', cid),
          supabase.from('sales_summary').delete().eq('company_id', cid)
        ]);
        showNotify('실적 데이터 초기화 성공', 'success');
      } else {
        await Promise.all([
          supabase.from('sales_records').delete().eq('company_id', cid),
          supabase.from('sales_targets').delete().eq('company_id', cid),
          supabase.from('sales_summary').delete().eq('company_id', cid),
          supabase.from('sales_staff').delete().eq('company_id', cid),
          supabase.from('sales_teams').delete().eq('company_id', cid),
          supabase.from('sales_divisions').delete().eq('company_id', cid),
          supabase.from('product_categories').delete().eq('company_id', cid)
        ]);
        fetchOrgInfo();
        showNotify('시스템 전체 초기화 완료', 'success');
      }
      setResetType(null); setResetConfirmation('');
    } catch (e: any) { showNotify(`초기화 실패: ${e.message}`, 'error'); } finally { setIsResetting(false); }
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
          <h1 className={styles.title}>매출 실적 데이터 관리 (사조대림 최적화)</h1>
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
              <p>실제 사용 중인 엑셀 파일을 업로드하세요.</p>
              <span>제목행 자동 인식 및 유연한 컬럼 매핑 지원</span>
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
          <h3 className={styles.instructionTitle}><AlertCircle size={18} /> 실무 엑셀 업로드 안내</h3>
          <ul className={styles.instructionList}>
            <li className={styles.instructionItem}><b>자동 행 탐색:</b> 파일 상단에 큰 제목 등이 있어도 자동으로 데이터 시작점을 찾습니다.</li>
            <li className={styles.instructionItem}><b>유연한 헤더:</b> '일자', '사원명', '실적' 등 다양한 명칭을 자동으로 인식합니다.</li>
            <li className={styles.instructionItem}><b>빈 행 무시:</b> 중간의 빈 줄이나 의미 없는 셀은 자동으로 필터링됩니다.</li>
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
               <span className={styles.progressText}>{progress}% 스마트 분석 및 동기화 중...</span>
             </div>
          </div>
        )}

        <button className={styles.uploadBtn} disabled={isUploading} onClick={startUpload}>
          {isUploading ? <Loader2 className={styles.animateSpin} size={20} /> : '인텔리전스 데이터 업로드 시작'}
        </button>

        {result && (
          <div style={{ marginTop: 24 }}>
            <div className={styles.statsArea}>
              <div className={styles.statCard}><span className={styles.statLabel}>총 건수</span><span className={styles.statValue}>{result.total}</span></div>
              <div className={styles.statCard}><span className={styles.statLabel}>성공</span><span className={styles.statValue} style={{color: '#10B981'}}>{result.success}</span></div>
              <div className={styles.statCard}><span className={styles.statLabel}>병합</span><span className={styles.statValue} style={{color: '#3b82f6'}}>{result.merged}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerHeader}><AlertTriangle size={24} color="#dc2626" /><h2 className={styles.dangerTitle}>데이터 관리</h2></div>
        <div className={styles.resetOptions}>
          <button className={`${styles.resetOptionBtn} ${resetType === 'data' ? styles.active : ''}`} onClick={() => setResetType('data')}>영업 실적만 삭제</button>
          <button className={`${styles.resetOptionBtn} ${resetType === 'factory' ? styles.active : ''}`} onClick={() => setResetType('factory')}>전체 초기화 (조직 포함)</button>
        </div>
        {resetType && (
          <div className={styles.resetConfirmArea}>
            <input type="text" className={styles.resetInput} placeholder='"데이터 초기화 확인" 입력' value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} />
            <button className={styles.resetBtn} disabled={resetConfirmation !== '데이터 초기화 확인' || isResetting} onClick={handleReset}>초기화 실행</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataUploadPage;
