import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // 로컬 개발 서버는 보호하지 않는다 — .env.local에 인증 정보가 있어도 통과시킨다.
  // (미리보기 창처럼 Basic Auth 로그인 창을 못 띄우는 환경에서 화면을 볼 수 없기 때문)
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const user = process.env.SITE_AUTH_USER;
  const pass = process.env.SITE_AUTH_PASS;

  // 인증 정보가 설정되지 않았으면 보호 없이 통과
  if (!user || !pass) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const separatorIndex = decoded.indexOf(":");
      const suppliedUser = decoded.slice(0, separatorIndex);
      const suppliedPass = decoded.slice(separatorIndex + 1);
      if (suppliedUser === user && suppliedPass === pass) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Fragment Index"' },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
