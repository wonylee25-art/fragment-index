import { SiteHeader } from "@/components/SiteHeader";
import { AdminTabs } from "@/components/AdminTabs";

// 관리페이지 공통 껍데기. 사건 관리와 사료 연결은 같은 작업의 두 국면이라 탭으로 붙여둔다.
// 사용자뷰(읽기전용)는 이 레이아웃 바깥에 있다.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-white">
      <SiteHeader active="/admin/timeline" title="편집" />
      <AdminTabs />
      {children}
    </div>
  );
}
