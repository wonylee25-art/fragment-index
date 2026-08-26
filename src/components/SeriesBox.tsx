"use client";

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SERIES_BOX_HEIGHT_PX } from "./SeriesLabel";

// 선반 하나와, 그 위로 빠져나오는 기술지.
//
// 기술지를 누른 상자에 매달았더니 자리가 상자마다 달라졌다 — 둘째 것을 누르면 셋째를 덮고,
// 끝의 것을 누르면 왼쪽으로 뒤집혀 나왔다. 어느 것을 눌렀느냐에 따라 글이 나타나는 데가
// 매번 바뀌면 눈이 그때마다 다시 찾아야 한다.
//
// 그래서 상자가 아니라 선반에 맨다. 기술지는 늘 첫 상자의 오른쪽 모서리에서 시작해 선반
// 끝까지 채우므로, 무엇을 누르든 같은 자리에 같은 폭으로 선다. 세로 자리만 누른 상자가
// 있는 줄을 따라간다 — 그 줄에서 나왔다는 것은 남겨야 한다.
//
// 첫 상자는 늘 보인다(왼쪽 202px을 비워 두므로). 눌린 상자가 그 줄의 첫째가 아니면 가려지는데,
// 자리를 못 박는 값이 그것보다 크다고 보았다.

const BOX_WIDTH_PX = 202;

export function ShelfWithSheet({
  label,
  boxes,
  sheet,
  pickedRef,
  onClose,
}: {
  label: string;
  boxes: ReactNode;
  // 열린 상자가 이 선반에 없으면 null
  sheet: ReactNode | null;
  pickedRef: string | null;
  onClose: () => void;
}) {
  const shelfRef = useRef<HTMLDivElement>(null);
  const [rowTop, setRowTop] = useState(0);

  // 누른 상자가 몇 번째 줄에 있는지는 창 폭이 정하므로 셈해 두지 않고, 열 때 실제 자리를 잰다.
  useLayoutEffect(() => {
    if (!pickedRef || !shelfRef.current) return;
    const el = shelfRef.current.querySelector<HTMLElement>(`[data-ref="${CSS.escape(pickedRef)}"]`);
    if (el) setRowTop(el.offsetTop);
  }, [pickedRef]);

  // 기술지는 옆 상자를 덮으므로 닫는 길이 여럿이어야 한다 — 바깥을 누르거나 Esc.
  useEffect(() => {
    if (!pickedRef) return;
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
  }, [pickedRef, onClose]);

  return (
    <div className="relative flex flex-wrap items-end gap-3 pt-4" ref={shelfRef}>
      {boxes}
      {sheet && (
        // 테두리를 첫 상자와 겹쳐 한 선으로 만든다 — 사이에 선이 둘이면 두 물건이 된다.
        <div
          className="absolute right-0 z-30 -ml-px"
          style={{ top: rowTop, left: BOX_WIDTH_PX, height: SERIES_BOX_HEIGHT_PX }}
        >
          {sheet}
        </div>
      )}
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
