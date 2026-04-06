import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("🚨 [VODA 인증 치명적 오류] Supabase 환경 변수가 누락되었습니다.");
  console.warn("📌 해결 방법: .env 파일 혹은 Vercel 환경 변수에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY가 설정되어 있는지 확인해 주세요.");
}

export const supabase = createClient(
  supabaseUrl || 'https://missing-url.supabase.co', 
  supabaseAnonKey || 'missing-key', 
  {
    auth: {
      persistSession: true,
      storageKey: 'voda-auth-session',
      storage: window.sessionStorage,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: { 'x-application-name': 'voda-sales-dashboard' }
    }
  }
);

