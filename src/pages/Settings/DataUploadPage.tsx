import React, { useState, useRef, useEffect } from 'react';
import { Database, Upload, FileText, CheckCircle2, AlertCircle, X, Loader2, Download, Trash2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';
import styles from './DataUploadPage.module.css';

interface UploadResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

const DataUploadPage: React.FC = () => {
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});
  const [resetConfirmation, setResetConfirmation] = useState('');

  useEffect(() => {
    fetchStaffInfo();
  }, [profile?.company_id]);

  const fetchStaffInfo = async () => {
    if (!profile?.company_id) return;
    try {
      // Get all staff and their team_ids for this company
      const { data: teams } = await supabase.from('sales_teams').select('id').eq('company_id', profile.company_id);
      if (teams && teams.length > 0) {
        const teamIds = teams.map(t => t.id);
        const { data: staff } = await supabase.from('sales_staff').select('id, name, team_id').in('team_id', teamIds);
        
        const map: Record<string, { id: string; teamId: string }> = {};
        (staff || []).forEach(s => {
          map[s.name] = { id: s.id, teamId: s.team_id };
        });
        setStaffMap(map as any);
      }
    } catch (err) {
      console.error('Error fetching staff info:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setResult(null);
    }
  };

  const parseExcelOrCsv = async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    if (rawData.length < 2) return [];

    const entries = rawData.slice(1).map((row, index) => {
      if (!row || row.length === 0) return null;
      
      let dateValue = row[0];
      // Excel Serial Date Conversion
      if (typeof dateValue === 'number') {
        const dateObj = XLSX.SSF.parse_date_code(dateValue);
        dateValue = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
      }

      return {
        _rowIndex: index + 2, // Excel numbering starts from 2
        date: dateValue ? String(dateValue).trim() : '',
        name: row[1] ? String(row[1]).trim() : '',
        customer: row[2] ? String(row[2]).trim() : '',
        item: row[3] ? String(row[3]).trim() : '',
        amountStr: row[4] ? String(row[4]) : ''
      };
    }).filter(row => row !== null);
    
    return entries;
  };

  const downloadTemplate = () => {
    const csvContent = "날짜,성명,거래처,품목,금액(원)\n2025-03-01,홍길동,(주)이마트,오렌지10kg,150000";
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sales_upload_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validateDate = (dateStr: string) => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date.getTime());
  };

  const startUpload = async () => {
    if (!file || !profile?.company_id) return;

    setIsUploading(true);
    setResult(null);
    
    try {
      const rows = await parseExcelOrCsv(file);
      
      if (rows.length === 0) {
        setResult({ total: 0, success: 0, failed: 0, errors: ["파일에 유효한 데이터가 없습니다."] });
        return;
      }

      const errors: string[] = [];
      const uploadBatch: any[] = [];
      const currentCompanyId = profile.company_id;

      for (const row of rows) {
        const rowNum = (row as any)._rowIndex;
        const staffMapping = (staffMap as any)[row.name];
        
        // 1. Required field validation
        if (!row.date || !row.name || !row.amountStr) {
          errors.push(`${rowNum}행: 필수 정보(날짜, 성명, 금액)가 누락되었습니다.`);
          continue;
        }

        // 2. Date Format Validation (YYYY-MM-DD)
        if (!validateDate(row.date)) {
          errors.push(`${rowNum}행: 날짜 형식이 올바르지 않습니다. (권장: YYYY-MM-DD)`);
          continue;
        }

        // 3. Staff/Team Mapping Validation
        if (!staffMapping) {
          errors.push(`${rowNum}행: 등록되지 않은 성명(${row.name})입니다. [조직 관리]를 확인해 주세요.`);
          continue;
        }

        // 4. Amount Validation (Numeric only)
        const cleanAmount = parseInt(row.amountStr.replace(/[^0-9]/g, ''));
        if (isNaN(cleanAmount)) {
          errors.push(`${rowNum}행: 금액 형식이 잘못되었습니다.`);
          continue;
        }

        // Add to batch with mapped role/team info and current company_id
        uploadBatch.push({
          company_id: currentCompanyId,
          staff_id: staffMapping.id,
          team_id: staffMapping.teamId,
          customer_name: row.customer || '미지정',
          item_name: row.item || '미지정',
          amount: cleanAmount,
          sales_date: row.date
        });
      }

      let successCount = 0;
      if (uploadBatch.length > 0) {
        // Bulk INSERT
        const { error } = await supabase.from('sales_records').insert(uploadBatch);
        if (error) {
          errors.push(`데이터베이스 저장 중 오류 발생: ${error.message}`);
        } else {
          successCount = uploadBatch.length;
        }
      }

      setResult({
        total: rows.length,
        success: successCount,
        failed: rows.length - successCount,
        errors
      });
      
      if (successCount > 0) setFile(null); // Clear file on partial/full success
    } catch (err) {
      console.error('Upload Error:', err);
      alert('파일 처리 중 예상치 못한 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const resetAllData = async () => {
    if (!profile?.company_id) return;
    if (resetConfirmation !== '데이터 초기화 확인') {
      alert('정확한 문구를 입력해 주세요.');
      return;
    }

    if (!confirm('정말로 모든 실적 및 목표 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    setIsResetting(true);
    try {
      // Delete Performance
      const { error: pError } = await supabase.from('sales_records').delete().eq('company_id', profile.company_id);
      // Delete Targets
      const { error: tError } = await supabase.from('sales_targets').delete().eq('company_id', profile.company_id);

      if (pError || tError) throw new Error('삭제 중 오류가 발생했습니다.');
      
      alert('모든 데이터가 초기화되었습니다.');
      setResetConfirmation('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><Database size={28} /></div>
          <div>
            <h1 className={styles.title}>데이터 대량 업로드</h1>
            <p className={styles.subtitle}>CSV 및 엑셀 파일을 이용하여 실적 데이터를 대량으로 등록할 수 있습니다.</p>
          </div>
        </div>
      </header>

      <div className={styles.uploadCard}>
        {/* Dropzone */}
        {!file ? (
          <div 
            className={styles.dropzone} 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={48} className={styles.dropzoneIcon} />
            <div className={styles.dropzoneText}>
              <p>파일을 끌어다 놓거나 클릭하여 선택하세요.</p>
              <span>Excel (.xlsx) 및 CSV 파일 형식을 지원합니다.</span>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".csv, .xlsx, .xls"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className={styles.fileInfo}>
            <div className={styles.fileName}>
              <FileText size={20} color="#3b82f6" />
              {file.name}
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500, marginLeft: 8 }}>
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <button className={styles.removeBtn} onClick={() => setFile(null)}>
              <X size={20} />
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className={styles.instructions}>
          <h3 className={styles.instructionTitle}>업로드 가이드</h3>
          <div className={styles.instructionList}>
            <div className={styles.instructionItem}>
              <div style={{ color: '#1a1a1a', fontWeight: 'bold' }}>1.</div>
              <p>첫 줄에는 항목명이 포함되어야 합니다 (날짜, 성명, 거래처, 품목, 금액 순).</p>
            </div>
            <div className={styles.instructionItem}>
              <div style={{ color: '#1a1a1a', fontWeight: 'bold' }}>2.</div>
              <p>성명은 [조직 및 인원 관리]에 등록된 정식 이름과 정확히 일치해야 합니다.</p>
            </div>
            <div className={styles.instructionItem}>
              <div style={{ color: '#1a1a1a', fontWeight: 'bold' }}>3.</div>
              <p>날짜는 YYYY-MM-DD (예: 2025-03-24) 형식을 권장합니다.</p>
            </div>
          </div>
          <button className={styles.downloadTemplate} onClick={downloadTemplate}>
            <Download size={14} /> 샘플 템플릿 다운로드 (.csv)
          </button>
        </div>

        <button 
          className={styles.uploadBtn} 
          disabled={!file || isUploading}
          onClick={startUpload}
        >
          {isUploading ? <Loader2 className={styles.animateSpin} size={20} /> : <CheckCircle2 size={20} />}
          {isUploading ? '데이터 분석 및 업로드 중...' : '파일 업로드 시작하기'}
        </button>

        {/* Upload Result */}
        {result && (
          <div style={{ marginTop: 24 }}>
            <div className={styles.statsArea}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>총 건수</span>
                <span className={styles.statValue}>{result.total}</span>
              </div>
              <div className={`${styles.statCard} ${styles.success}`}>
                <span className={styles.statLabel}>성공</span>
                <span className={`${styles.statValue}`} style={{color: '#10B981'}}>{result.success}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>실패</span>
                <span className={styles.statValue} style={{color: '#ef4444'}}>{result.failed}</span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className={styles.errorArea}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <AlertCircle size={18} color="#991B1B" />
                  <h4 className={styles.errorTitle}>오류 및 제외 내역 ({result.errors.length}건)</h4>
                </div>
                <ul className={styles.errorList}>
                  {result.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Danger Zone: Data Reset */}
      <div className={styles.dangerZone}>
        <div className={styles.dangerHeader}>
          <AlertTriangle size={24} color="#EF4444" />
          <h2 className={styles.dangerTitle}>데이터 초기화 (Caution)</h2>
        </div>
        <p className={styles.dangerDesc}>
          해당 기업의 모든 실적 데이터와 목표 데이터를 영구적으로 삭제합니다. 관리자의 실수로 잘못된 데이터가 대량 업로드된 경우에만 사용하세요.
        </p>
        
        <div className={styles.resetControl}>
          <input 
            type="text" 
            className={styles.resetInput}
            placeholder='"데이터 초기화 확인" 입력'
            value={resetConfirmation}
            onChange={(e) => setResetConfirmation(e.target.value)}
          />
          <button 
            className={styles.resetBtn}
            disabled={resetConfirmation !== '데이터 초기화 확인' || isResetting}
            onClick={resetAllData}
          >
            {isResetting ? <Loader2 className={styles.animateSpin} size={18} /> : <Trash2 size={18} />}
            전체 데이터 삭제하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataUploadPage;
