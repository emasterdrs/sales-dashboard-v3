import * as XLSX from 'xlsx';

// Web Worker 내부 로직
self.onmessage = async (e: MessageEvent) => {
  const { arrayBuffer } = e.data;

  try {
    // 1. 워크북 읽기 (가장 무거운 작업 중 하나)
    const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, cellNF: false, cellText: false });
    
    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      throw new Error("유효한 엑셀 시트를 찾을 수 없습니다.");
    }

    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    if (!ws || !ws['!ref']) {
      throw new Error("시트에 데이터가 없거나 형식이 올바르지 않습니다.");
    }

    // 2. 헤더 정보 추출
    const range = XLSX.utils.decode_range(ws['!ref']);
    const headerRows = (XLSX.utils.sheet_to_json(ws, { 
      header: 1, 
      range: { s: range.s, e: { r: range.s.r, c: range.e.c } } 
    }) as any[][]);
    
    const headers = (headerRows[0] || []).map(h => String(h || '').trim());
    self.postMessage({ type: 'headers', data: headers });

    // 3. 데이터 청크 파싱 및 전송
    const totalRows = range.e.r - range.s.r;
    const CHUNK_SIZE = 10000;
    const results: any[] = [];

    for (let rStart = range.s.r + 1; rStart <= range.e.r; rStart += CHUNK_SIZE) {
      const rEnd = Math.min(rStart + CHUNK_SIZE - 1, range.e.r);
      const chunkData: any[][] = (XLSX.utils.sheet_to_json(ws, { 
        header: 1, 
        range: { s: { r: rStart, c: range.s.c }, e: { r: rEnd, c: range.e.c } } 
      }) as any[][]);

      results.push(...chunkData);

      // 진행률 보고 (파싱 단계)
      const progress = Math.floor(((rStart - range.s.r) / totalRows) * 100);
      self.postMessage({ type: 'progress', data: progress });
    }

    // 최종 결과 전송
    self.postMessage({ type: 'success', data: results });

  } catch (error: any) {
    self.postMessage({ type: 'error', data: error.message });
  }
};
