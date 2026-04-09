import * as XLSX from 'xlsx';

// Web Worker 내부 로직
self.onmessage = async (e: MessageEvent) => {
  const { arrayBuffer } = e.data;

  try {
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, cellNF: false, cellText: false });
    if (!wb.SheetNames || wb.SheetNames.length === 0) throw new Error("유효한 엑셀 시트를 찾을 수 없습니다.");

    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws['!ref']) throw new Error("시트에 데이터가 없거나 형식이 올바르지 않습니다.");

    const fullRange = XLSX.utils.decode_range(ws['!ref']);
    
    // 1. 지능형 헤더 탐색 (상단 20행 스캔)
    const scanLimit = Math.min(fullRange.s.r + 20, fullRange.e.r);
    const scanRows = XLSX.utils.sheet_to_json(ws, { 
      header: 1, 
      range: { s: { r: fullRange.s.r, c: fullRange.s.c }, e: { r: scanLimit, c: fullRange.e.c } } 
    }) as unknown[][];

    // [최우선 디버깅] 헤더 탐색 전 원본 데이터를 통째로 메인 스레드에 쏩니다.
    self.postMessage({ type: 'debug_rows', data: scanRows.slice(0, 5) });

    const keyWords = ['날짜', '일자', '판매일', '성명', '이름', '담당자', '사원', '매출', '실적', '금액', '사업부', '팀'];
    let headerRowIdx = -1;
    let maxMatch = 0;
    let bestCandidateHeaders: string[] = [];

    scanRows.forEach((row, idx) => {
      const cleanRow = row.map(c => String(c || '').trim());
      const matchCount = cleanRow.filter(cell => {
        const val = cell.replace(/\s+/g, '');
        return keyWords.some(kw => val.includes(kw));
      }).length;
      
      // 후보군 수집 (가장 많은 컬럼이 채워진 행)
      if (cleanRow.filter(Boolean).length > bestCandidateHeaders.length) {
        bestCandidateHeaders = cleanRow;
      }

      if (matchCount > maxMatch && matchCount >= 2) {
        maxMatch = matchCount;
        headerRowIdx = fullRange.s.r + idx;
      }
    });

    if (headerRowIdx === -1) {
      // 헤더를 찾지 못한 경우, 가장 유력한 행의 내용을 에러에 담아 보냅니다.
      const rawHeaderString = bestCandidateHeaders.length > 0 ? `[${bestCandidateHeaders.slice(0, 8).join(', ')}...]` : "없음";
      throw new Error(`필수 헤더 행(날짜, 성명 등)을 찾지 못했습니다. 인식된 컬럼: ${rawHeaderString}`);
    }

    // 2. 헤더 확정 및 메인 전송
    const headers = (scanRows[headerRowIdx - fullRange.s.r] as unknown[]).map(h => String(h || '').replace(/\s+/g, ''));
    self.postMessage({ type: 'headers', data: headers });

    // 3. 데이터 청크 파싱 (헤더 다음 줄부터 시작)
    const CHUNK_SIZE = 10000;
    const totalRowsCount = fullRange.e.r - headerRowIdx;

    for (let rStart = headerRowIdx + 1; rStart <= fullRange.e.r; rStart += CHUNK_SIZE) {
      const rEnd = Math.min(rStart + CHUNK_SIZE - 1, fullRange.e.r);
      const chunk = XLSX.utils.sheet_to_json(ws, { 
        header: 1, 
        range: { s: { r: rStart, c: fullRange.s.c }, e: { r: rEnd, c: fullRange.e.c } } 
      }) as unknown[][];

      const validChunk = chunk.filter(row => row.some(cell => String(cell || '').trim() !== ''));
      if (validChunk.length > 0) {
        self.postMessage({ type: 'chunk', data: validChunk });
      }

      const progress = Math.min(100, Math.floor(((rStart - headerRowIdx) / totalRowsCount) * 100));
      self.postMessage({ type: 'progress', data: progress });
    }

    self.postMessage({ type: 'success' });

  } catch (error: unknown) {
    const err = error as Error;
    self.postMessage({ type: 'error', data: err.message });
  }
};
