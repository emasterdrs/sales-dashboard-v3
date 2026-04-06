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
    const scanRows: any[][] = (XLSX.utils.sheet_to_json(ws, { 
      header: 1, 
      range: { s: { r: fullRange.s.r, c: fullRange.s.c }, e: { r: scanLimit, c: fullRange.e.c } } 
    }) as any[][]);

    // 디버깅용: 상단 5행을 즉시 메인 스레드로 전송
    self.postMessage({ type: 'debug_rows', data: scanRows.slice(0, 5) });

    const keyWords = ['날짜', '일자', '판매일', '성명', '이름', '담당자', '사원', '매출', '실적', '금액', '사업부', '팀'];
    let headerRowIdx = -1;
    let maxMatch = 0;

    scanRows.forEach((row, idx) => {
      const matchCount = row.filter(cell => {
        const val = String(cell || '').replace(/\s+/g, '');
        return keyWords.some(kw => val.includes(kw));
      }).length;
      if (matchCount > maxMatch && matchCount >= 2) {
        maxMatch = matchCount;
        headerRowIdx = fullRange.s.r + idx;
      }
    });

    if (headerRowIdx === -1) {
      throw new Error("필수 항목(날짜, 성명, 매출액 등)이 포함된 헤더 행을 찾을 수 없습니다.");
    }

    // 2. 헤더 확정 및 인덱스 추출
    const headers: string[] = scanRows[headerRowIdx - fullRange.s.r].map(h => String(h || '').replace(/\s+/g, ''));
    self.postMessage({ type: 'headers', data: headers });

    // 3. 데이터 청크 파싱 (헤더 다음 줄부터 시작)
    const CHUNK_SIZE = 10000;
    const totalRowsCount = fullRange.e.r - headerRowIdx;

    for (let rStart = headerRowIdx + 1; rStart <= fullRange.e.r; rStart += CHUNK_SIZE) {
      const rEnd = Math.min(rStart + CHUNK_SIZE - 1, fullRange.e.r);
      const chunk: any[][] = (XLSX.utils.sheet_to_json(ws, { 
        header: 1, 
        range: { s: { r: rStart, c: fullRange.s.c }, e: { r: rEnd, c: fullRange.e.c } } 
      }) as any[][]);

      // 빈 행 필터링 (모든 셀이 비어있거나 공백인 경우 제외)
      const validChunk = chunk.filter(row => row.some(cell => String(cell || '').trim() !== ''));

      if (validChunk.length > 0) {
        self.postMessage({ type: 'chunk', data: validChunk });
      }

      const progress = Math.min(100, Math.floor(((rStart - headerRowIdx) / totalRowsCount) * 100));
      self.postMessage({ type: 'progress', data: progress });
    }

    self.postMessage({ type: 'success' });

  } catch (error: any) {
    self.postMessage({ type: 'error', data: error.message });
  }
};
