"use client";

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

// 선반 하나와, 그 위에서 펴지는 기술지.
//
// 누른 상자에 기술지를 매달았더니 자리가 상자마다 달랐다 — 둘째 것을 누르면 셋째를 덮고,
// 끝의 것을 누르면 왼쪽으로 뒤집혀 나왔다. 어느 것을 눌렀느냐에 따라 글이 나타나는 데가
// 매번 바뀌면 눈이 그때마다 다시 찾아야 한다.
//
// 그래서 누른 상자를 선반의 첫 자리로 끌어내고, 기술지를 그 오른쪽에 편다. 자리를 못 박되
// 꺼낸 상자와 펴진 글이 떨어지지 않는다 — 서류철에서 하나를 뽑아 앞에 세우고 펼치는 것과 같다.
//
// 폭은 상자 열에 맞춘다. 선반 남은 자리를 다 쓰게 두면 상자 줄보다 오른쪽으로 더 나가 어색한
// 여백이 생기므로, 한 줄에 상자가 몇 개 서는지를 재서 "마지막 상자의 오른쪽 모서리"에서 끊는다.
// 몇 개가 서는지는 창 폭이 정하므로 셈해 두지 않고 실제로 잰다.

const BOX_WIDTH_PX = 202;
const GAP_PX = 12;

function columnsIn(width: number): number {
  return Math.max(2, Math.floor((width + GAP_PX) / (BOX_WIDTH_PX + GAP_PX)));
}

export function ShelfWithSheet({
  label,
  boxes,
  sheet,
  open,
  onClose,
}: {
  label: string;
  // 첫 자리에 설 상자(열려 있을 때) — 나머지와 갈라 받는다
  boxes: { picked: ReactNode | null; rest: ReactNode[] };
  sheet: ReactNode | null;
  open: boolean;
  onClose: () => void;
}) {
  const shelfRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(5);

  useLayoutEffect(() => {
    const el = shelfRef.current;
    if (!el) return;
    const measure = () => setCols(columnsIn(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // 첫 상자를 뺀 나머지 열을 다 쓰고, 왼쪽으로 gap+1만큼 당겨 상자와 테두리를 겹친다 —
  // 사이에 선이 둘이거나 틈이 있으면 붙어 있는 물건이 아니라 위에 뜬 창으로 읽힌다.
  const sheetWidth = (cols - 1) * (BOX_WIDTH_PX + GAP_PX) + 1;

  return (
    <div className="relative flex flex-wrap items-end gap-3 pt-4" ref={shelfRef}>
      {boxes.picked}
      {sheet && (
        <div className="shrink-0" style={{ width: sheetWidth, marginLeft: -(GAP_PX + 1) }}>
          {sheet}
        </div>
      )}
      {boxes.rest}
      <div className="w-full">
        <div
          className="mt-3.5 h-[9px] w-full shadow-[0_2px_4px_rgba(0,0,0,0.18)]"
          style={{ background: "linear-gradient(#cfcbc4,#b6b1a8)" }}
        />
        <p className="pl-1.5 pt-0.5 font-mono text-[9px] text-grey">{label}</p>
      </div>
    </div>
  );
}
