
import fs from 'fs';

function generateCSV() {
    const header = "날짜,성명,거래처,품목,금액(원),category_id\n";
    let content = header;

    const teams = ["영업1팀", "영업2팀", "영업3팀", "영업4팀", "영업5팀"];
    const staffPerTeam = 6;
    const catCount = 10;
    const days = 15;
    
    console.log('Generating full_sales_data.csv...');

    for (let d = 1; d <= days; d++) {
        const date = `2026-03-${String(d).padStart(2, '0')}`;
        const dayOfWeek = new Date(date).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        for (const team of teams) {
            for (let s = 1; s <= staffPerTeam; s++) {
                const staffName = `${team}_사원${s}`;
                // 사원당 하루 12~18건의 거래 발생 (3월 15일까지 약 1.4B 목표의 절반인 7~9억 수준 도달)
                const recordCount = Math.floor(Math.random() * 7) + 12;
                
                for (let r = 0; r < recordCount; r++) {
                    const itemIdx = Math.floor(Math.random() * 1000) + 1;
                    const customerIdx = Math.floor(Math.random() * 55) + 1;
                    const catIdx = (itemIdx % catCount) + 1;
                    const amount = Math.floor(Math.random() * 4000000) + 1500000; // 건당 150만~550만

                    content += `${date},${staffName},거래처_${customerIdx},품목_${itemIdx},${amount},cat_id_${catIdx}\n`;
                }
            }
        }
    }

    fs.writeFileSync('full_sales_data.csv', '\uFEFF' + content, 'utf8'); // Add BOM for Excel compatibility
    console.log('File created: full_sales_data.csv');
}

generateCSV();
