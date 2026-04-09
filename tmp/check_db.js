import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://erfzcfyitqnfhtgtqvzq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyZnpjZnlpdHFuZmh0Z3RxdnpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNzgzNDcsImV4cCI6MjA4OTc1NDM0N30.jrO6FHLqejKkKJxG6HCunPFjrr_ey5R5oz2XOls5_2A";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  // Query to find enum values for types used in sales_targets
  const { data: enumValues, error } = await supabase.rpc('get_enum_values', { type_name: 'target_entity_type' });
  
  if (error) {
    console.log("RPC get_enum_values not found. Trying raw SQL via query if possible (likely not).");
    // Since I can't run raw SQL, I'll try to infer by checking column info
    const { data: cols } = await supabase.from('sales_targets').select('*').limit(0);
    console.log("Columns in sales_targets:", cols);
  } else {
    console.log("Enum values for target_entity_type:", enumValues);
  }
}

check();
