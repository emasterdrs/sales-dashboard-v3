import React, { useState, useRef, useEffect } from 'react';
import { Database, Upload, FileText, CheckCircle2, AlertCircle, X, Loader2, Download } from 'lucide-react';
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
  const [result, setResult] = useState<UploadResult | null>(null);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchStaffInfo();
  }, [profile?.company_id]);

  const fetchStaffInfo = async () => {
    if (!profile?.company_id) return;
    try {
      // Get all staff for this company by joining with teams
      const { data: teams } = await supabase.from('sales_teams').select('id').eq('company_id', profile.company_id);
      if (teams && teams.length > 0) {
        const teamIds = teams.map(t => t.id);
        const { data: staff } = await supabase.from('sales_staff').select('id, name').in('team_id', teamIds);
        
        const map: Record<string, string> = {};
        (staff || []).forEach(s => {
          map[s.name] = s.id;
        });
        setStaffMap(map);
      }
    } catch (err) {
      console.error('Error fetching staff info:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const parseCsv = (csv: string) => {
    const lines = csv.split(/\r?\n/).filter(line => line.trim().length > 0);
    // Skip header if it exists
    const startIndex = lines[0].includes('금액') || lines[0].includes('날짜') ? 1 : 0;
    
    const results = lines.slice(startIndex).map(line => {
      // Simple comma separator, handle quotes if needed but keeping it simple for now
      const [date, name, customer, item, amount] = line.split(',').map(s => s.trim());
      return { date, name, customer, item, amount: parseInt(amount.replace(/[^0-9]/g, '')) };
    });
    
    return results;
  };

  const downloadTemplate = () => {
    const csvContent = "날짜,성명,거래처,품목,금액(원)\n2024-03-01,홍길동,(주)이마트,오렌지10kg,150000";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sales_upload_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startUpload = async () => {
    if (!file || !profile?.company_id) return;

    setIsUploading(true);
    setResult(null);
    
    try {
      const text = await file.text();
      const records = parseCsv(text);
      
      const errors: string[] = [];
      let successCount = 0;
      
      const uploadBatch = [];

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const staffId = staffMap[row.name];
        
        if (!row.date || !row.name || !row.amount) {
          errors.push(`${i+1}행: 필수 데이터가 누락되었습니다.`);
          continue;
        }

        if (!staffId) {
          errors.push(`${i+1}행: 성명(${row.name})에 해당하는 팀원이 등록되어 있지 않습니다.`);
          continue;
        }

        uploadBatch.push({
          company_id: profile.company_id,
          staff_id: staffId,
          customer_name: row.customer,
          item_name: row.item,
          amount: row.amount,
          sales_date: row.date
        });
      }

      if (uploadBatch.length > 0) {
        const { error } = await supabase.from('sales_performance').insert(uploadBatch);
        if (error) {
          errors.push(`데이터베이스 업로드 중 오류가 발생했습니다: ${error.message}`);
        } else {
          successCount = uploadBatch.length;
        }
      }

      setResult({
        total: records.length,
        success: successCount,
        failed: records.length - successCount,
        errors
      });
      
      setFile(null);
    } catch (err) {
      console.error('Upload Error:', err);
      alert('파일 업로드 중 처리 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`${styles.container} fade-in`}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrapper}><Database size={28} /></div>
          <div>
            <h1 className={styles.title}>데이터 대량 업로드</h1>
            <p className={styles.subtitle}>CSV 파일을 이용하여 실적 데이터를 한꺼번에 등록할 수 있습니다.</p>
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
              <span>CSV 파일 형식만 지원합니다. (날짜, 성명, 거래처, 품목, 금액)</span>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".csv"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className={styles.fileInfo}>
            <div className={styles.fileName}>
              <FileText size={20} color="#3b82f6" />
              {file.name}
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
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
              <p>파일의 첫 번째 줄(헤더)은 데이터 항목 이름이어야 합니다. (순서: 날짜, 성명, 거래처, 품목, 금액)</p>
            </div>
            <div className={styles.instructionItem}>
              <div style={{ color: '#1a1a1a', fontWeight: 'bold' }}>2.</div>
              <p>날짜 형식은 YYYY-MM-DD (예: 2024-03-24) 형식을 권장합니다.</p>
            </div>
            <div className={styles.instructionItem}>
              <div style={{ color: '#1a1a1a', fontWeight: 'bold' }}>3.</div>
              <p>성명은 현재 시스템의 [조직 및 인원 관리]에 등록된 정식 성함과 일치해야 합니다.</p>
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
          <>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={18} color="#991B1B" />
                  <h4 className={styles.errorTitle}>업로드 제외 항목 및 오류 발생 내역</h4>
                </div>
                <ul className={styles.errorList}>
                  {result.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DataUploadPage;
