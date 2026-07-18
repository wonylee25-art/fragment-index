import { createClient } from "@supabase/supabase-js";

// 서버 컴포넌트 전용 읽기 클라이언트. anon/publishable 키는 공개해도 되는 키이고,
// RLS가 전 테이블에 공개 SELECT만 허용하므로 지금 단계(로그인 없음, 5-2 로그인 이후 쓰기 예정)엔 이걸로 충분하다.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
