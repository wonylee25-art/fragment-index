"use client";

import { ReactNode, useEffect, useRef } from "react";

// 선반 하나와, 그 위에서 펴지는 기술지.
//
// 상자를 고정 폭으로 두었더니 한 줄에 들어가고 남은 자리가 오른쪽에 빈 채로 남았다(1186px
// 선반에 342px). 폭을 격자에 맡긴다 — 들어갈 수 있는 만큼 칸을 만들고 남는 자리는 칸들이
// 나눠 가지므로(auto-fill + 1fr) 여백이 아예 안 생기고, 창을 좁히면 칸 수가 줄어든다.
//
// 그 덕에 칸 수를 세거나 폭을 재는 일이 없어졌다. 기술지는 "둘째 칸부터 끝까지"(2/-1)라고
// 적으면 그만이라, 마지막 상자의 오른쪽 모서리에 저절로 맞는다.
//
// 누른 상자는 선반의 첫 자리로 끌려 나온다(넘겨받는 쪽에서 순서를 바꾼다). 자리를 못 박되
// 꺼낸 상자와 펴진 글이 떨어지지 않는다 — 서류철에서 하나를 뽑아 앞에 세우고 펼치는 것과 같다.

// 칸 하나의 최소 폭. 이보다 좁아지면 칸 수를 하나 줄인다. 라벨 안쪽이 두 칸(개요·정책)으로
// 갈리므로 이보다 좁으면 칸 이름이 거의 다 잘린다.
const MIN_COLUMN = "190px";
const GAP_PX = 12;

export function ShelfWithSheet({
  label,
  boxes,
  sheet,
  open,
  onClose,
}: {
  label: string;
  // 순서대로 온다 — 열려 있으면 첫 칸이 누른 상자다
  boxes: ReactNode[];
  sheet: ReactNode | null;
  open: boolean;
  onClose: () => void;
}) {
  const shelfRef = useRef<HTMLDivElement>(null);

  // 기술지는 옆 상자를 덮으므로 닫는 길이 여럿이어야 한다 — 바깥을 누르거나 Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!shelfRef.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div className="pt-4">
      <div
        ref={shelfRef}
        className="grid items-end gap-3"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${MIN_COLUMN}, 1fr))` }}
      >
        {/* 격자는 DOM 순서로 칸을 채운다 — 기술지가 상자 뒤에 있으면 마지막 줄로 밀리므로
            첫 상자 바로 다음에 끼운다. */}
        {boxes[0]}
        {sheet && (
          // 둘째 칸부터 끝까지. 왼쪽으로 칸 사이 틈만큼 당겨 첫 상자와 테두리를 겹친다 —
          // 사이에 선이 둘이거나 틈이 있으면 붙어 있는 물건이 아니라 위에 뜬 창으로 읽힌다.
          // 칸이 하나뿐인 좁은 창에서는 둘째 칸이 없으므로 한 줄을 통째로 쓴다.
          <div
            className="[grid-column:1/-1] sm:[grid-column:2/-1]"
            style={{ marginLeft: -(GAP_PX + 1) }}
          >
            {sheet}
          </div>
        )}
        {boxes.slice(1)}
      </div>
      <div
        className="mt-3.5 h-[9px] w-full shadow-[0_2px_4px_rgba(0,0,0,0.18)]"
        style={{ background: "linear-gradient(#cfcbc4,#b6b1a8)" }}
      />
      <p className="pl-1.5 pt-0.5 font-mono text-[9px] text-grey">{label}</p>
    </div>
  );
}
