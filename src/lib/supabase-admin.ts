import { createClient } from "@supabase/supabase-js";

// 쓰기 전용 서버 클라이언트. RLS를 우회하는 service_role 키를 쓰므로
// Server Action(서버에서만 실행)에서만 import한다 — 절대 클라이언트 컴포넌트에 노출하지 않는다.
// RLS 자체는 건드리지 않고(공개 읽기만 허용된 채 그대로), 쓰기는 전부 이 관리자 클라이언트를 통해서만 이뤄진다.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
