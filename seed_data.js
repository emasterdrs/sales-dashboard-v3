
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env manually
const envPath = path.resolve(process.cwd(), '.env');
const envData = fs.readFileSync(envPath, 'utf8');
const env = {};
envData.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('--- Starting Data Seeding ---');

  // 1. Get or Create Company ID
  let { data: companyData } = await supabase.from('companies').select('id').limit(1).maybeSingle();
  if (!companyData) {
    console.log('No company record found. Creating a demo company: (주) VODA 데모');
    const { data: newCompany, error } = await supabase.from('companies').insert({
        name: '(주) VODA 데모',
        status: 'APPROVED'
    }).select().single();
    if (error) {
        console.error('Error creating company:', error);
        return;
    }
    companyData = newCompany;
  }
  const companyId = companyData.id;
  console.log(`Using Company ID: ${companyId}`);

  // 2. Create Categories
  const categoryNames = ['치즈', '버터', '크림', '연유', '파우더', '냉동과일', '식물성휘핑', '우유', '요거트', '기타'];
  const categories = categoryNames.map((name, i) => ({
    company_id: companyId,
    name,
    display_order: i + 1
  }));
  const { data: insertedCats } = await supabase.from('product_categories').upsert(categories, { onConflict: 'company_id, name' }).select();
  const catIds = (insertedCats || []).map(c => c.id);
  console.log(`Initialized ${catIds.length} Categories.`);

  // 3. Create Teams and Staff
  const teams = [];
  for (let i = 1; i <= 5; i++) {
    const { data: team } = await supabase.from('sales_teams').upsert({ company_id: companyId, name: `영업 ${i}팀` }, { onConflict: 'company_id, name' }).select().single();
    if (team) teams.push(team);
  }

  const staffList = [];
  for (const team of teams) {
    const staffInTeam = [];
    for (let j = 1; j <= 6; j++) {
      const staffName = `${team.name.replace(' ', '')}_사원${j}`;
      const { data: staff } = await supabase.from('sales_staff').upsert({ team_id: team.id, name: staffName }, { onConflict: 'team_id, name' }).select().single();
      if (staff) staffInTeam.push(staff);
    }
    staffList.push(...staffInTeam);
  }
  console.log(`Initialized 5 Teams and ${staffList.length} Staff members.`);

  // 4. Set Targets (1.4B won per staff)
  const targets = staffList.map(s => ({
    company_id: companyId,
    entity_type: 'STAFF',
    entity_id: s.id,
    year: 2026,
    month: 3,
    target_amount: 1400000000
  }));
  // Also add team targets (6 * 1.4B = 8.4B)
  const teamTargets = teams.map(t => ({
    company_id: companyId,
    entity_type: 'TEAM',
    entity_id: t.id,
    year: 2026,
    month: 3,
    target_amount: 8400000000
  }));
  await supabase.from('sales_targets').upsert([...targets, ...teamTargets], { onConflict: 'company_id, entity_type, entity_id, year, month' });
  console.log('Set Sales Targets (1.4B per Staff, 8.4B per Team).');

  // 5. Working Days Config (Mar 2026: Total 22, elapsed 15 - holidays would make this happen)
  // Let's just set the config
  const holidays = ['2026-03-01', '2026-03-07', '2026-03-08', '2026-03-14', '2026-03-15', '2026-03-21', '2026-03-22', '2026-03-28', '2026-03-29'];
  await supabase.from('working_days_config').upsert({
    company_id: companyId,
    year: 2026,
    month: 3,
    holidays
  }, { onConflict: 'company_id, year, month' });
  console.log('Configured Working Days for March 2026.');

  // 6. Generate Sales Records (Mar 1 ~ 15)
  console.log('Generating ~8,000 performance records...');
  const customers = Array.from({ length: 55 * 30 }).map((_, i) => `거래처_${i + 1}`);
  const items = Array.from({ length: 1000 }).map((_, i) => ({ name: `품목_${i + 1}`, catId: catIds[i % catIds.length] }));
  
  const records = [];
  const days = 15;
  for (let d = 1; d <= days; d++) {
    const date = `2026-03-${String(d).padStart(2, '0')}`;
    // Skip weekends for simulation (not required but looks better)
    const dayOfWeek = new Date(date).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    for (const staff of staffList) {
      // 10-15 records per staff per day
      const recordCount = Math.floor(Math.random() * 6) + 12; 
      for (let r = 0; r < recordCount; r++) {
        const item = items[Math.floor(Math.random() * items.length)];
        const customer = `거래처_${Math.floor(Math.random() * 100) + 1}`; // Shared pool for simplicity
        const amount = Math.floor(Math.random() * 3000000) + 1000000; // 1M ~ 4M per transaction

        records.push({
          company_id: companyId,
          staff_id: staff.id,
          team_id: staff.team_id,
          category_id: item.catId,
          customer_name: customer,
          item_name: item.name,
          amount,
          sales_date: date
        });
      }
    }
    
    // Batch insert every 2 days to avoid payload limit
    if (d % 2 === 0 || d === days) {
      const { error } = await supabase.from('sales_records').insert(records);
      if (error) console.error('Error inserting records:', error);
      records.length = 0; // clear
    }
  }

  console.log('--- Seeding Complete! ---');
  console.log('Dashboard should now show 30 members and ~750M-1.1B performance each for Mar 1-15.');
}

seed();
