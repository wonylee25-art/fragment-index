import type { Metadata } from "next";
import { Gothic_A1, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// 제목·인용의 명조는 시스템 폰트로 쓴다(globals.css의 --font-serif).
// Noto Serif KR을 next/font/google로 받던 것을 걷어낸 이유: 한글 폰트라 @font-face 블록이
// 수백 개인데, 빌드 시점에 그걸 다 내려받다가 일부가 실패하면 Turbopack이 내부 모듈
// (@vercel/turbopack-next/internal/font/google/font)을 못 찾아 빌드가 통째로 깨진다.
// 실제로 Vercel 배포가 이 이유로 두 번 실패했고, 실패 개수가 매번 달랐다(502 → 231).
const gothicA1 = Gothic_A1({
  variable: "--font-gothic-a1",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  // 좌상단 로고와 같은 이름을 브라우저 탭에도 그대로 둔다. 북마크했을 때
  // 화면의 표제와 다른 이름이 뜨면 같은 사이트로 보이지 않는다.
  title: "FRAGMENT INDEX — 구술 아카이브",
  description: "여러 자료를 그물망처럼 연결하는 개인용 시멘틱 아카이브",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${gothicA1.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
