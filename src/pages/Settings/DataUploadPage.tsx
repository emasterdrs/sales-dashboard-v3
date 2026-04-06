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

  useEffect(() => { fetchOrgInfo(); }, [profile?.company_id]);

  // 알림 표시 후 3초 뒤 자동 삭제
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
    
    if (!file) return showNotify('업로드할 파일을 먼저 선택해 주세요.', 'error');
    if (!cid) return showNotify('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.', 'error');

    setIsUploading(true);
    setResult(null);
    setProgress(0);
    const errList: string[] = [];
    
    try {
      const dataArr = await file.arrayBuffer();
      const wb = XLSX.read(dataArr, { type: 'array', cellNF: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      if (raw.length < 2) {
        throw new Error("업로드한 파일에 데이터가 없습니다. 내용을 확인해 주세요.");
      }

      const headers = raw[0].map(h => String(h || ''));
      
      const idx = {
        date: getColIndex(headers, ['날짜', 'date']),
        div: getColIndex(headers, ['지점', '사업부', 'division']),
        team: getColIndex(headers, ['팀', '팀명', 'team']),
        name: getColIndex(headers, ['성명', '이름', 'name', 'staff']),
        customer: getColIndex(headers, ['거래처']),
        item: getColIndex(headers, ['품목']),
        amount: getColIndex(headers, ['금액', '매출액', '매출', 'amount']),
        cat: getColIndex(headers, ['유형', '카테고리', 'category'])
      };

      if (idx.date === -1 || idx.name === -1 || idx.amount === -1) {
        throw new Error("필수 항목(날짜, 성명, 매출액)이 누락되었습니다. 지정된 양식에 맞게 업로드해 주세요.");
      }

      const rows: any[] = [];
      const totalRawRows = raw.length - 1;
      const PARSE_CHUNK = 5000;
      
      for (let i = 1; i < raw.length; i += PARSE_CHUNK) {
          const chunk = raw.slice(i, i + PARSE_CHUNK);
          chunk.forEach((r, subIdx) => {
              const mapped = {
                _row: i + subIdx + 1,
                date: SalesCalendarService.parseUserDate(r[idx.date]),
                div: String(r[idx.div] || '').trim(),
                team: String(r[idx.team] || '').trim(),
                name: String(r[idx.name] || '').trim(),
                customer: String(r[idx.customer] || '').trim(),
                item: String(r[idx.item] || '').trim(),
                amount: cleanAmount(r[idx.amount]),
                cat: String(r[idx.cat] || '999. 미분류').trim()
              };
              if (mapped.name) rows.push(mapped);
          });
          setProgress(Math.floor((i / totalRawRows) * 10));
          await new Promise(r => setTimeout(r, 0));
      }

      const local = { ...orgMap };
      setProgress(15);
      const normalize = (s: string) => s.replace(/\s+/g, ''); 

      // Sync Hierarchy
      const existingDivs = await fetchAll(supabase.from('sales_divisions').select('id, name').eq('company_id', cid));
      existingDivs.forEach(d => {
          local.divisions[d.name.trim()] = d.id;
          local.divisions[`_norm_${normalize(d.name)}`] = d.id;
      });
      
      const missingDivNames = Array.from(new Set(rows.map(r => r.div))).filter(d => d && !local.divisions[d] && !local.divisions[`_norm_${normalize(d)}`]);
      if (missingDivNames.length > 0) {
          const { data: insertedDivs, error: divErr } = await supabase.from('sales_divisions').insert(missingDivNames.map(name => ({ company_id: cid, name: name.trim() }))).select();
          if (divErr) throw new Error(`[사업부 생성 실패] ${divErr.message}`);
          insertedDivs?.forEach(d => {
              local.divisions[d.name.trim()] = d.id;
              local.divisions[`_norm_${normalize(d.name)}`] = d.id;
          });
      }
      setProgress(25);

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
              if (teamErr) throw new Error(`[영업팀 생성 실패] ${teamErr.message}`);
              insertedTeams?.forEach(t => {
                  local.teamMap[`${t.division_id}_${t.name.trim()}`] = t.id;
                  local.teamMap[`${t.division_id}_norm_${normalize(t.name)}`] = t.id;
              });
          }
      }
      setProgress(40);

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
              if (sErr) throw new Error(`[사원 생성 실패] ${sErr.message}`);
              insertedStaff?.forEach(s => {
                  local.staffMap[`${s.team_id}_${s.name.trim()}`] = s.id;
                  local.staffMap[`${s.team_id}_norm_${normalize(s.name)}`] = s.id;
              });
          }
      }
      setProgress(55);

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
          if (cErr) throw new Error(`[카테고리 생성 실패] ${cErr.message}`);
          insertedCats?.forEach(c => {
              local.catMap[c.name.trim()] = c.id;
              local.catMap[`_norm_${normalize(c.name)}`] = c.id;
          });
      }
      setProgress(65);

      const aggMap = new Map<string, any>();
      let skippedCount = 0;
      rows.forEach(r => {
          const dId = local.divisions[r.div] || local.divisions[`_norm_${normalize(r.div)}`];
          const tId = dId ? (local.teamMap[`${dId}_${r.team}`] || local.teamMap[`${dId}_norm_${normalize(r.team)}`]) : null;
          const sId = tId ? (local.staffMap[`${tId}_${r.name}`] || local.staffMap[`${tId}_norm_${normalize(r.name)}`]) : null;
          
          let cId = local.catMap[r.cat] || local.catMap[`_norm_${normalize(r.cat)}`];
          if (!cId) cId = local.catMap['999. 미분류'] || local.catMap['_norm_999.미분류'] || local.catMap['기타'];

          if (!r.date || !sId) {
              if(!r.date) errList.push(`${r._row}행: 날짜 파싱 실패`);
              else errList.push(`${r._row}행: 사원 매칭 실패(${r.div}/${r.team}/${r.name})`);
              skippedCount++;
              return;
          }
          
          const key = `${sId}|${r.customer}|${r.item}|${r.date}`;
          if (aggMap.has(key)) {
              const existing = aggMap.get(key);
              existing.amount += r.amount;
          } else {
              aggMap.set(key, { 
                  company_id: cid, staff_id: sId, team_id: tId, category_id: cId || null, 
                  customer_name: r.customer, item_name: r.item, amount: r.amount, sales_date: r.date 
              });
          }
      });
      const finalRecs = Array.from(aggMap.values());
      setOrgMap(local);
      setProgress(70);

      let sc = 0; const CHUNK = 1000;
      const totalRecs = finalRecs.length;
      if (totalRecs === 0 && rows.length > 0) throw new Error("유효한 실적 데이터가 없습니다. 사원 정보와 데이터 형식을 확인해주세요.");

      for (let i = 0; i < totalRecs; i += CHUNK) {
          const chunk = finalRecs.slice(i, i + CHUNK);
          const { error: uErr } = await supabase.from('sales_records').upsert(chunk, { 
              onConflict: 'company_id, staff_id, customer_name, item_name, sales_date' 
          });
          if (uErr) {
              console.error('Record Upsert Error:', uErr);
              errList.push(`저장 오류 (청크 ${Math.floor(i/CHUNK) + 1}): ${uErr.message}`); 
          } else sc += chunk.length;
          
          setProgress(70 + Math.floor((i / totalRecs) * 30));
          await new Promise(r => setTimeout(r, 10));
      }

      setProgress(95);
      const affectedMonths = Array.from(new Set(finalRecs.map(r => {
        const d = new Date(r.sales_date);
        return `${d.getFullYear()}-${d.getMonth() + 1}`;
      })));

      for (const m of affectedMonths) {
        const [y, mm] = m.split('-').map(Number);
        await supabase.rpc('refresh_sales_summary', { p_company_id: cid, p_year: y, p_month: mm });
      }

      setResult({ total: rows.length, success: sc, failed: totalRecs - sc + skippedCount, merged: rows.length - totalRecs - skippedCount, errors: errList });
      setProgress(100);
      if (sc > 0) {
        setFile(null);
        showNotify('매출 데이터 업로드가 완료되었습니다!', 'success');
      }
    } catch (e: any) { 
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
      if (resetType === 'data') {
          await supabase.from('sales_records').delete().eq('company_id', cid);
          await supabase.from('sales_targets').delete().eq('company_id', cid);
          await supabase.from('sales_summary').delete().eq('company_id', cid);
          showNotify('영업 실적 및 목표 데이터가 초기화되었습니다.', 'success');
      } else {
          await supabase.from('sales_records').delete().eq('company_id', cid);
          await supabase.from('sales_targets').delete().eq('company_id', cid);
          await supabase.from('sales_summary').delete().eq('company_id', cid);
          const { data: teams } = await supabase.from('sales_teams').select('id').eq('company_id', cid);
          const tIds = teams?.map(t => t.id) || [];
          if (tIds.length > 0) await supabase.from('sales_staff').delete().in('team_id', tIds);
          await supabase.from('sales_teams').delete().eq('company_id', cid);
          await supabase.from('sales_divisions').delete().eq('company_id', cid);
          await supabase.from('product_categories').delete().eq('company_id', cid);
          fetchOrgInfo();
          showNotify('조직 정보를 포함한 모든 데이터가 초기화되었습니다.', 'success');
      }
      setResetType(null); setResetConfirmation('');
    } catch (e: any) { showNotify(e.message, 'error'); } finally { setIsResetting(false); }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      {/* 커스텀 알림 UI */}
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
              <p>마우스로 파일을 끌어오거나 클릭하여 선택</p>
              <span>엑셀(.xlsx) 파일만 업로드 가능합니다.</span>
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
          <h3 className={styles.instructionTitle}><AlertCircle size={18} /> 업로드 전 꼭 확인해주세요!</h3>
          <ul className={styles.instructionList}>
            <li className={styles.instructionItem}><b>날짜 형식:</b> '2024-03-01' 또는 '2024.03.01' 형식을 권장합니다.</li>
            <li className={styles.instructionItem}><b>필수 정보:</b> 날짜, 성명, 매출액은 반드시 입력되어야 합니다.</li>
            <li className={styles.instructionItem}><b>자동 매칭:</b> 조직 정보가 시스템에 등록되어 있어야 실적이 정확히 집계됩니다.</li>
            <li className={styles.instructionItem}><b>데이터 덮어쓰기:</b> 동일한 날짜/사원/품목의 실적은 최신 업로드 파일로 업데이트됩니다.</li>
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
               <span className={styles.progressText}>{progress}% 처리 중...</span>
             </div>
          </div>
        )}

        <button className={styles.uploadBtn} disabled={isUploading} onClick={startUpload}>
          {isUploading ? <Loader2 className={styles.animateSpin} size={20} /> : '매출 데이터 업로드 시작'}
        </button>

        {result && (
          <div style={{ marginTop: 24 }}>
            <div className={styles.statsArea}>
              <div className={styles.statCard}><span className={styles.statLabel}>전체 행</span><span className={styles.statValue}>{result.total}</span></div>
              <div className={styles.statCard}><span className={styles.statLabel}>성공</span><span className={styles.statValue} style={{color: '#10B981'}}>{result.success}</span></div>
              <div className={styles.statCard}><span className={styles.statLabel}>오류</span><span className={styles.statValue} style={{color: '#ef4444'}}>{result.failed}</span></div>
            </div>
            {result.errors.length > 0 && (
              <div className={styles.errorArea}>
                <div className={styles.errorTitle}><AlertCircle size={16} /><h4>실패 사유 리포트</h4></div>
                <ul className={styles.errorList}>{result.errors.slice(0, 50).map((err, idx) => <li key={idx}>{err}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.dangerZone}>
        <div className={styles.dangerHeader}>
          <AlertTriangle size={24} color="#dc2626" />
          <h2 className={styles.dangerTitle}>데이터 관리 및 초기화</h2>
        </div>
        <p className={styles.dangerDesc}>데이터 초기화는 되돌릴 수 없습니다. 범위를 신중하게 선택하신 후 진행해 주세요.</p>
        
        <div className={styles.resetOptions}>
          <button className={`${styles.resetOptionBtn} ${resetType === 'data' ? styles.active : ''}`} onClick={() => setResetType('data')}>
            영업 실적/목표만 초기화
          </button>
          <button className={`${styles.resetOptionBtn} ${resetType === 'factory' ? styles.active : ''}`} onClick={() => setResetType('factory')}>
            모든 데이터(조직 포함) 초기화
          </button>
        </div>

        {resetType && (
          <div className={styles.resetConfirmArea}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
              안전을 위해 <b>"데이터 초기화 확인"</b> 문구를 아래에 입력해 주세요.
            </p>
            <input type="text" className={styles.resetInput} placeholder='문구를 입력하세요' value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} />
            <button className={styles.resetBtn} disabled={resetConfirmation !== '데이터 초기화 확인' || isResetting} onClick={handleReset}>
              {isResetting ? <Loader2 className={styles.animateSpin} size={20} /> : `${resetType === 'data' ? '실적' : '전체'} 데이터 영구 삭제`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataUploadPage;
