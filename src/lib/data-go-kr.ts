// data.go.kr은 계정마다 **일반 인증키를 하나만** 준다 — 서비스별로 키가 갈리지 않고,
// 서비스마다 갈리는 것은 활용신청 승인뿐이다. 그래서 키는 `DATA_GO_KR_API_KEY` 한 줄로 두고,
// 재발급하면 그 한 줄만 고친다.
//
// 옛 이름(NATIONAL_ARCHIVES_API_KEY 등)은 이미 값이 들어 있는 .env.local이 안 깨지도록
// 뒤에서 받는다. 새 줄이 있으면 그쪽이 이긴다.
export function dataGoKrKey(...legacyNames: string[]): string | undefined {
  const names = ["DATA_GO_KR_API_KEY", ...legacyNames];
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}
