"use client";

// 화면 한 겹을 접었다 펴는 on/off 스위치. 연표(눈금·교차점·키워드)와 연구 동향(주제어 클라우드)이
// 같은 모양을 쓴다 — 글자 칩으로는 "지금 켜져 있나"가 한눈에 안 읽혀서, 손잡이가 좌우로 움직이는
// 물리적 모양을 쓴다. 라벨이 먼저, 스위치가 오른쪽이다.
export function Switch({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="group flex items-center gap-1.5"
    >
      <span className={on ? "text-zinc-700" : "text-zinc-400 group-hover:text-zinc-600"}>{label}</span>
      <span
        className={`relative inline-flex h-3.5 w-7 shrink-0 items-center rounded-full transition-colors ${
          on ? "bg-zinc-900" : "bg-zinc-200 group-hover:bg-zinc-300"
        }`}
      >
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform ${
            on ? "translate-x-[15px]" : "translate-x-[3px]"
          }`}
        />
      </span>
    </button>
  );
}
