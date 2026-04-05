
import fs from 'fs';

function generateTestData() {
    // New Header for the Intelligent Auto-Mapping system: 날짜, 사업부, 팀명, 성명, 거래처명, 품목명, 매출액
    const header = "날짜,사업부,팀명,성명,거래처명,품목명,매출액\n";
    let content = header;

    const years = [2024, 2025];
    const yearlyTargets = { 2024: 430000000000, 2025: 480000000000 };
    
    // Organization Structure
    const divisions = [
        { name: "영업사업부", teams: ["영업1팀", "영업2팀"] },
        { name: "전략사업부", teams: ["영업3팀", "영업4팀"] }
    ];
    const staffPerTeam = 6;
    
    console.log('Generating INTELLIGENT vercel_test_sales_data.csv...');

    for (const year of years) {
        const totalYearTarget = yearlyTargets[year];
        const monthlyTarget = totalYearTarget / 12;
        const dailyTarget = monthlyTarget / 20; 
        const totalStaff = divisions.length * divisions[0].teams.length * staffPerTeam;
        const perStaffDailyTarget = dailyTarget / totalStaff;

        for (let month = 1; month <= 12; month++) {
            for (let day = 1; day <= 28; day++) {
                const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                const d = new Date(date).getDay();
                if (d === 0 || d === 6) continue;

                for (const div of divisions) {
                    for (const teamName of div.teams) {
                        for (let s = 1; s <= staffPerTeam; s++) {
                            const staffName = `${teamName}_사원${s}`;
                            const numTransactions = 5;
                            const avgAmount = perStaffDailyTarget / numTransactions;

                            for (let t = 0; t < numTransactions; t++) {
                                const customer = `거래처_${Math.floor(Math.random() * 100) + 1}`;
                                const item = `품목_${Math.floor(Math.random() * 500) + 1}`;
                                const amount = Math.floor(avgAmount * (0.8 + Math.random() * 0.4));
                                
                                // Order: 날짜, 사업부, 팀명, 성명, 거래처명, 품목명, 매출액
                                content += `${date},${div.name},${teamName},${staffName},${customer},${item},${amount}\n`;
                            }
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
