
import fs from 'fs';

function generateTestData() {
    // Correct Header for the system: 날짜,성명,거래처,품목,금액(원),category_id
    const header = "날짜,성명,거래처,품목,금액(원),category_id\n";
    let content = header;

    const years = [2024, 2025];
    const yearlyTargets = { 2024: 430000000000, 2025: 480000000000 };
    const teams = ["영업1팀", "영업2팀", "영업3팀", "영업4팀"];
    const staffPerTeam = 6;
    
    console.log('Generating FIXED vercel_test_sales_data.csv...');

    for (const year of years) {
        const totalYearTarget = yearlyTargets[year];
        const monthlyTarget = totalYearTarget / 12;
        const dailyTarget = monthlyTarget / 20; 
        const perStaffDailyTarget = dailyTarget / (teams.length * staffPerTeam);

        for (let month = 1; month <= 12; month++) {
            for (let day = 1; day <= 28; day++) {
                const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                const d = new Date(date).getDay();
                if (d === 0 || d === 6) continue;

                for (const teamName of teams) {
                    for (let s = 1; s <= staffPerTeam; s++) {
                        // Matching the staff name format exactly as registered: '영업1팀_사원1'
                        const staffName = `${teamName}_사원${s}`;
                        
                        const numTransactions = 5;
                        const avgAmount = perStaffDailyTarget / numTransactions;

                        for (let t = 0; t < numTransactions; t++) {
                            // Category: 유형명1 ~ 유형명12
                            // System expects this in the 6th column (category_id area)
                            const catName = `유형명${Math.floor(Math.random() * 12) + 1}`;
                            const customer = `거래처_${Math.floor(Math.random() * 100) + 1}`;
                            const item = `품목_${Math.floor(Math.random() * 500) + 1}`;
                            const amount = Math.floor(avgAmount * (0.8 + Math.random() * 0.4));
                            
                            content += `${date},${staffName},${customer},${item},${amount},${catName}\n`;
                        }
                    }
                }
            }
        }
    }

    fs.writeFileSync('vercel_test_sales_data.csv', '\uFEFF' + content, 'utf8');
    console.log('File created: vercel_test_sales_data.csv');
}

generateTestData();
