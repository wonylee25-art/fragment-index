import { redirect } from "next/navigation";

// 연표는 메인화면(/)으로 올라갔다. 예전 /timeline 링크(다른 화면·북마크·외부 공유)를 살려두기 위한 리다이렉트.
export default function TimelineRedirect() {
  redirect("/");
}
