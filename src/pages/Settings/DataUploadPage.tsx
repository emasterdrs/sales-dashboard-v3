import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, AlertCircle, X, Loader2, Database, AlertTriangle, Download, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { SalesCalendarService } from '../../services/SalesCalendarService';
import styles from './DataUploadPage.module.css';

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
    // 브라우저 탭 제목 명시적으로 한 번 더 보장
    document.title = "VODA 영업 대시보드";
  }, [profile?.company_id]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
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
      const divisions = await fetchAll(supabase.from('sales_divisions').select('id, name').eq('company_id', cid));
      const teams = await fetchAll(supabase.from('sales_teams').select('id, name, division_id').eq('company_id', cid));
      const staff = await fetchAll(supabase.from('sales_staff').select('id, name, team_id').in('team_id', teams?.map((t:any) => t.id) || []));
      const cats = await fetchAll(supabase.from('product_categories').select('id, name').eq('company_id', cid));
      
      const dMap: any = {}; divisions?.forEach((d: any) => dMap[d.name.trim()] = d.id);
      const tMap: any = {}; teams?.forEach((t: any) => tMap[`${t.division_id}_${t.name.trim()}`] = t.id);
      const sMap: any = {}; staff?.forEach((s: any) => sMap[`${s.team_id}_${s.name.trim()}`] = s.id);
      const cMap: any = {}; cats?.forEach((c: any) => cMap[c.name.trim()] = c.id);
      setOrgMap({ divisions: dMap, teamMap: tMap, staffMap: sMap, catMap: cMap });
    } catch (e) { console.error('fetchOrgInfo Error:', e); }
  };

  const downloadTemplate = (type: 'empty' | 'sample') => {
    const headers = [['날짜', '사업부', '팀', '성명', '거래처코드', '거래처', '품목코드', '품목', '매출액', '카테고리']];
    let data = [...headers];
    
    if (type === 'sample') {
      data.push(['2024-01-01', '2. 대리점사업부', '강남지점', '이태민', 'D0119', '북안산혜민', 'AA02230', '진종합', '601000', '어묵']);
      data.push(['2024-01-01', '2. 대리점사업부', '강남지점', '권재현', 'D5652', '서수원한림', 'AA02230', '진종합', '681000', '어묵']);
      data.push(['2024-01-01', '2. 대리점사업부', '강남지점', '권재현', 'D5652', '서수원한림', 'AA53400', '어묵전골', '218000', '어묵']);
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
    if (!cid) return showNotify('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.', 'error');

    setIsUploading(true);
    setResult(null);
    setProgress(1); // 초기 반응성 보장
    const errList: string[] = [];
    
    try {
      // 1. 대용량 파싱 최적화 (FileReader 연산을 비동기 스택으로 분리)
      const dataArr = await file.arrayBuffer();
      // XLSX.read가 큰 파일에서는 무거울 수 있는데, 이를 비동기 프레임에서 처리하도록 시도
      await new Promise(r => setTimeout(r, 100)); 
      
      const wb = XLSX.read(dataArr, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      
      // 2. 헤더 검증 및 디버깅 강화
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const headerRow: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, range: { s: range.s, e: { r: range.s.r, c: range.e.c } } })[0] || [];
      const headers = headerRow.map(h => String(h || '').trim());
      
      console.log("🔍 업로드 파일 헤더 목록:", headers);

      if (headers.length === 0) {
        throw new Error("파일에서 데이터를 읽을 수 없습니다. 파일 손상 여부를 확인해 주세요.");
      }

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
        console.warn("⚠️ 필수 헤더 감지 실패:", { headers, aliases: { date: idx.date, name: idx.name, amount: idx.amount } });
        throw new Error("필수 항목(날짜, 성명, 매출액)의 헤더 이름이 맞는지 확인해 주세요.");
      }

      // 3. 데이터 청크 파싱 로직 (UI 멈춤 방지)
      const rows: any[] = [];
      const totalRows = range.e.r - range.s.r;
      if (totalRows < 1) throw new Error("업로드한 파일에 실적 데이터가 없습니다.");

      const CHUNK_SIZE = 5000;
      for (let rStart = range.s.r + 1; rStart <= range.e.r; rStart += CHUNK_SIZE) {
        const rEnd = Math.min(rStart + CHUNK_SIZE - 1, range.e.r);
        // 특정 범위만 JSON으로 실시간 파싱
        const chunkData: any[][] = XLSX.utils.sheet_to_json(ws, { 
          header: 1, 
          range: { s: { r: rStart, c: range.s.c }, e: { r: rEnd, c: range.e.c } } 
        });

        chunkData.forEach((row, subIdx) => {
          const mapped = {
            _row: rStart + subIdx + 1,
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

        setProgress(Math.floor(((rStart - range.s.r) / totalRows) * 15)); // 파싱 과정은 15%까지 할당
        await new Promise(r => setTimeout(r, 0)); // 메인 스레드 해제 (브라우저에게 양보)
      }

      const local = { ...orgMap };
      setProgress(20);

      // 4. 조직 동기화 및 업로드 (성능 최적화는 유지)
      const normalize = (s: string) => s.replace(/\s+/g, ''); 

      // Sync Divisions
      const existingDivs = await fetchAll(supabase.from('sales_divisions').select('id, name').eq('company_id', cid));
      existingDivs.forEach(d => {
          local.divisions[d.name.trim()] = d.id;
          local.divisions[`_norm_${normalize(d.name)}`] = d.id;
      });
      
      const missingDivNames = Array.from(new Set(rows.map(r => r.div))).filter(d => d && !local.divisions[d] && !local.divisions[`_norm_${normalize(d)}`]);
      if (missingDivNames.length > 0) {
          const { data: insertedDivs, error: divErr } = await supabase.from('sales_divisions').insert(missingDivNames.map(name => ({ company_id: cid, name: name.trim() }))).select();
          if (divErr) throw new Error(`[조직 관리] ${divErr.message}`);
          insertedDivs?.forEach(d => {
              local.divisions[d.name.trim()] = d.id;
              local.divisions[`_norm_${normalize(d.name)}`] = d.id;
          });
      }
      setProgress(35);
      await new Promise(r => setTimeout(r, 10));

      const existingTeams = await fetchAll(supabase.from('sales_teams').select('id, name, division_id').eq('company_id', cid));
      existingTeams.forEach(t => {
          local.teamMap[`${t.division_id}_${t.name.trim()}`] = t.id;
          local.teamMap[`${t.division_id}_norm_${normalize(t.name)}`] = t.id;
      });
      
      const missingTeamKeys = Array.from(new Set(rows.map(r => `${r.div}|${r.team}`))).filter(key => {
          const [dName, tName] = key.split('|');
          const dId = local.divisions[dName] || local.divisions[`_norm_${normalize(dName)}`];
          return dId && tName && !local.teamMap[`${dId}_${tName}`] && !local.teamMap[`${dId}_norm_${normalize(tName)}`];
      });
      if (missingTeamKeys.length > 0) {
          const teamInserts = missingTeamKeys.map(key => {
              const [dName, tName] = key.split('|');
              const divId = local.divisions[dName] || local.divisions[`_norm_${normalize(dName)}`];
              return divId ? { company_id: cid, division_id: divId, name: tName.trim() } : null;
          }).filter(Boolean);
          
          if (teamInserts.length > 0) {
              const { data: insertedTeams, error: teamErr } = await supabase.from('sales_teams').insert(teamInserts as any).select();
              if (teamErr) throw new Error(`[조직 관리] ${teamErr.message}`);
              insertedTeams?.forEach(t => {
                  local.teamMap[`${t.division_id}_${t.name.trim()}`] = t.id;
                  local.teamMap[`${t.division_id}_norm_${normalize(t.name)}`] = t.id;
              });
          }
      }
      setProgress(50);
      await new Promise(r => setTimeout(r, 10));

      const tIds = Object.values(local.teamMap);
      if (tIds.length > 0) {
          const S_CHUNK = 100;
          for (let i = 0; i < tIds.length; i += S_CHUNK) {
              const chunkTids = tIds.slice(i, i + S_CHUNK);
              const staff = await fetchAll(supabase.from('sales_staff').select('id, name, team_id').in('team_id', chunkTids));
              staff.forEach(s => {
                  local.staffMap[`${s.team_id}_${s.name.trim()}`] = s.id;
                  local.staffMap[`${s.team_id}_norm_${normalize(s.name)}`] = s.id;
              });
          }
      }
      
      const missingStaffKeys = Array.from(new Set(rows.map(r => `${r.div}|${r.team}|${r.name}`))).filter(key => {
          const [dName, tName, sName] = key.split('|');
          const dId = local.divisions[dName] || local.divisions[`_norm_${normalize(dName)}`];
          const tId = dId ? (local.teamMap[`${dId}_${tName}`] || local.teamMap[`${dId}_norm_${normalize(tName)}`]) : null;
          return tId && sName && !local.staffMap[`${tId}_${sName}`] && !local.staffMap[`${tId}_norm_${normalize(sName)}`];
      });
      if (missingStaffKeys.length > 0) {
          const staffInserts = missingStaffKeys.map(key => {
              const [dName, tName, sName] = key.split('|');
              const dId = local.divisions[dName] || local.divisions[`_norm_${normalize(dName)}`];
              const tId = dId ? (local.teamMap[`${dId}_${tName}`] || local.teamMap[`${dId}_norm_${normalize(tName)}`]) : null;
              return tId ? { company_id: cid, team_id: tId, name: sName.trim() } : null;
          }).filter(Boolean);
          
          if (staffInserts.length > 0) {
              const { data: insertedStaff, error: sErr } = await supabase.from('sales_staff').insert(staffInserts as any).select();
              if (sErr) throw new Error(`[사원 관리] ${sErr.message}`);
              insertedStaff?.forEach(s => {
                  local.staffMap[`${s.team_id}_${s.name.trim()}`] = s.id;
                  local.staffMap[`${s.team_id}_norm_${normalize(s.name)}`] = s.id;
              });
          }
      }
      setProgress(60);

      const existingCats = await fetchAll(supabase.from('product_categories').select('id, name').eq('company_id', cid));
      existingCats.forEach(c => {
          local.catMap[c.name.trim()] = c.id;
          local.catMap[`_norm_${normalize(c.name)}`] = c.id;
      });

      const missingCatNames = Array.from(new Set(rows.map(r => r.cat))).filter(c => c && !local.catMap[c] && !local.catMap[`_norm_${normalize(c)}`]);
      if (!local.catMap['999. 미분류'] && !local.catMap['_norm_999.미분류']) {
          if (!missingCatNames.includes('999. 미분류')) missingCatNames.push('999. 미분류');
      }

      if (missingCatNames.length > 0) {
          const { data: insertedCats, error: cErr } = await supabase.from('product_categories').insert(missingCatNames.map(name => ({ company_id: cid, name: name.trim() }))).select();
          if (cErr) throw new Error(`[카테고리 관리] ${cErr.message}`);
          insertedCats?.forEach(c => {
              local.catMap[c.name.trim()] = c.id;
              local.catMap[`_norm_${normalize(c.name)}`] = c.id;
          });
      }
      setProgress(70);

      const aggMap = new Map<string, any>();
      rows.forEach(r => {
          const dId = local.divisions[r.div] || local.divisions[`_norm_${normalize(r.div)}`];
          const tId = dId ? (local.teamMap[`${dId}_${r.team}`] || local.teamMap[`${dId}_norm_${normalize(r.team)}`]) : null;
          const sId = tId ? (local.staffMap[`${tId}_${r.name}`] || local.staffMap[`${tId}_norm_${normalize(r.name)}`]) : null;
          let cId = local.catMap[r.cat] || local.catMap[`_norm_${normalize(r.cat)}`];
          if (!cId) cId = local.catMap['999. 미분류'] || local.catMap['_norm_999.미분류'] || local.catMap['기타'];

          if (!r.date || !sId) return; // SKIP invalid
          
          const key = `${sId}|${r.customer}|${r.item}|${r.date}`;
          if (aggMap.has(key)) aggMap.get(key).amount += r.amount;
          else aggMap.set(key, { company_id: cid, staff_id: sId, team_id: tId, category_id: cId || null, customer_name: r.customer, item_name: r.item, amount: r.amount, sales_date: r.date });
      });
      const finalRecs = Array.from(aggMap.values());
      const totalRecs = finalRecs.length;
      setProgress(75);

      // 5. 서버 데이터 업로드 (Chunked Upsert)
      let sc = 0; const UPLOAD_CHUNK = 1000;
      for (let i = 0; i < totalRecs; i += UPLOAD_CHUNK) {
          const chunk = finalRecs.slice(i, i + UPLOAD_CHUNK);
          const { error: uErr } = await supabase.from('sales_records').upsert(chunk, { onConflict: 'company_id, staff_id, customer_name, item_name, sales_date' });
          if (uErr) errList.push(`데이터 저장 오류 (청크 ${Math.floor(i/UPLOAD_CHUNK) + 1}): ${uErr.message}`); 
          else sc += chunk.length;
          
          setProgress(75 + Math.floor((i / totalRecs) * 20));
          await new Promise(r => setTimeout(r, 0));
      }

      setProgress(95);
      // 통계 갱신은 해당 월별로 처리
      const affectedMonths = Array.from(new Set(finalRecs.map(r => `${new Date(r.sales_date).getFullYear()}-${new Date(r.sales_date).getMonth() + 1}`)));
      for (const m of affectedMonths) {
        const [y, mm] = m.split('-').map(Number);
        await supabase.rpc('refresh_sales_summary', { p_company_id: cid, p_year: y, p_month: mm });
      }

      setResult({ total: rows.length, success: sc, failed: totalRecs - sc, merged: rows.length - totalRecs, errors: errList });
      setProgress(100);
      if (sc > 0) {
        setFile(null);
        showNotify('매출 데이터 업로드가 성공적으로 완료되었습니다.', 'success');
      }
    } catch (e: any) { 
      console.error("❌ 업로드 중 에러 발생:", e);
      showNotify(e.message, 'error');
    } finally { 
      setIsUploading(false); 
      setProgress(0); 
    }
  };

  const handleReset = async () => {
    const cid = profile?.company_id;
    if (!cid || resetConfirmation !== '데이터 초기화 확인') return showNotify('문구 확인이 필요합니다.', 'error');
    setIsResetting(true);
    try {
      await supabase.from('sales_records').delete().eq('company_id', cid);
      await supabase.from('sales_targets').delete().eq('company_id', cid);
      await supabase.from('sales_summary').delete().eq('company_id', cid);
      
      if (resetType === 'factory') {
        const { data: teams } = await supabase.from('sales_teams').select('id').eq('company_id', cid);
        const tIds = teams?.map(t => t.id) || [];
        if (tIds.length > 0) await supabase.from('sales_staff').delete().in('team_id', tIds);
        await supabase.from('sales_teams').delete().eq('company_id', cid);
        await supabase.from('sales_divisions').delete().eq('company_id', cid);
        await supabase.from('product_categories').delete().eq('company_id', cid);
        fetchOrgInfo();
      }
      showNotify('데이터 초기화가 완료되었습니다.', 'success');
      setResetType(null); setResetConfirmation('');
    } catch (e: any) { showNotify(e.message, 'error'); } finally { setIsResetting(false); }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      {notification && (
        <div className={`${styles.toast} ${styles[notification.type]}`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
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
              <p>파일을 여기에 끌어놓거나 클릭하여 선택</p>
              <span>XLSX 형식으로 업로드해 주세요.</span>
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
          <h3 className={styles.instructionTitle}><AlertCircle size={18} /> 업로드 전 안내사항</h3>
          <ul className={styles.instructionList}>
            <li className={styles.instructionItem}><b>데이터 양식:</b> 제공된 매출 업로드 양식에 맞춰 업로드해 주세요.</li>
            <li className={styles.instructionItem}><b>필수 헤더:</b> 날짜, 성명, 매출액 컬럼명은 반드시 포함되어야 합니다.</li>
            <li className={styles.instructionItem}><b>대용량 처리:</b> 대규모 데이터도 UI 멈춤 없이 안전하게 처리됩니다.</li>
          </ul>
          
          <div className={styles.templateTools}>
            <button className={styles.templateBtn} onClick={() => downloadTemplate('sample')}>
              <FileSpreadsheet size={18} /> 업로드 예시 파일 다운로드
            </button>
            <button className={styles.templateBtn} onClick={() => downloadTemplate('empty')}>
              <Download size={18} /> 업로드 전용 양식 다운로드
            </button>
          </div>
        </div>

        {isUploading && (
          <div className={styles.progressArea}>
             <div className={styles.progressBarWrapper}>
               <div className={styles.progressBar} style={{ width: `${progress}%` }} />
               <span className={styles.progressText}>{progress}% 처리 및 분석 중...</span>
             </div>
          </div>
        )}

        <button className={styles.uploadBtn} disabled={isUploading} onClick={startUpload}>
          {isUploading ? <Loader2 className={styles.animateSpin} size={20} /> : '실적 데이터 업로드 시작'}
        </button>

        {result && (
          <div style={{ marginTop: 24 }}>
            <div className={styles.statsArea}>
              <div className={styles.statCard}><span className={styles.statLabel}>총 행수</span><span className={styles.statValue}>{result.total}</span></div>
              <div className={styles.statCard}><span className={styles.statLabel}>성공 건수</span><span className={styles.statValue} style={{color: '#10B981'}}>{result.success}</span></div>
              <div className={styles.statCard}><span className={styles.statLabel}>오류 건수</span><span className={styles.statValue} style={{color: '#ef4444'}}>{result.failed}</span></div>
            </div>
            {result.errors.length > 0 && (
              <div className={styles.errorArea}>
                <div className={styles.errorTitle}><AlertCircle size={16} /><h4>실패 원인 상세 리포트 (최근 50건)</h4></div>
                <ul className={styles.errorList}>{result.errors.slice(0, 50).map((err, idx) => <li key={idx}>{err}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerHeader}>
          <AlertTriangle size={24} color="#dc2626" />
          <h2 className={styles.dangerTitle}>시스템 초기화 및 데이터 관리</h2>
        </div>
        <p className={styles.dangerDesc}>모든 데이터는 삭제 후 복구가 불가능하며, 초기화 범위를 신중하게 검토해 주세요.</p>
        
        <div className={styles.resetOptions}>
          <button className={`${styles.resetOptionBtn} ${resetType === 'data' ? styles.active : ''}`} onClick={() => setResetType('data')}>영업 데이터만 초기화</button>
          <button className={`${styles.resetOptionBtn} ${resetType === 'factory' ? styles.active : ''}`} onClick={() => setResetType('factory')}>전체 초기화 (조직 정보 포함)</button>
        </div>

        {resetType && (
          <div className={styles.resetConfirmArea}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
              안전한 초기화를 위해 아래 <b>"데이터 초기화 확인"</b> 문구를 입력해 주세요.
            </p>
            <input type="text" className={styles.resetInput} placeholder='여기에 입력하세요' value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} />
            <button className={styles.resetBtn} disabled={resetConfirmation !== '데이터 초기화 확인' || isResetting} onClick={handleReset}>
              {isResetting ? <Loader2 className={styles.animateSpin} size={20} /> : `${resetType === 'data' ? '실적' : '전체'} 영구 삭제 확정`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataUploadPage;
