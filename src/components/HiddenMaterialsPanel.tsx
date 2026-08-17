"use client";

import { useState } from "react";
import { RelatedItem } from "@/lib/types";
import { ARCHIVE_ITEM_ICON } from "@/lib/design-tokens";
import { deleteMaterials, unhideMaterial } from "@/lib/material-actions";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";

// 보류함에서 치운 사료를 담아두는 곳. 연표 아래 "숨긴 사건"과 같은 자리·같은 뜻이다 —
// 되돌리는 길이 없으면 치우는 것은 지우는 것과 다르지 않다.
//
// 정말로 지우는 길은 여기에만 둔다. 훑어보는 자리(보류함)에서 한 손짓으로 닿게 두면
// 잘못 누른 한 번으로 자료가 사라지는데, 사료는 다시 찾아오기 어려운 것들이다.
// 여기까지 들어와 한 번 더 물어 지우는 것이라면, 그건 뜻이 있어 지우는 것이다.
export function HiddenMaterialsPanel({ materials }: { materials: RelatedItem[] }) {
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // 되돌리거나 지운 것을 목록에서 빼는 일은 서버가 맡는다 — 여기서 따로 기억해 두면
  // 보류함으로 돌아간 사료를 이쪽 기억이 계속 "없는 것"으로 쳐서 둘이 어긋난다.
  const visible = materials;
  if (visible.length === 0) return null;

  async function handleRestore(id: string) {
    setPendingId(id);
    try {
      await unhideMaterial(id);
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(id: string) {
    await deleteMaterials([id]);
  }

  return (
    <div className="border-t border-line bg-surface">
      <div className="py-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="font-mono text-[11px] font-bold text-grey hover:text-ink"
        >
          {open ? "▾" : "▸"} 치운 사료 {visible.length}건
        </button>

        {open && (
          <>
            <p className="mt-2 font-mono text-[11px] leading-5 text-grey">
              화면에서만 내린 것이라 DB에는 그대로 있습니다. 되돌리면 붙어 있던 사건으로
              함께 돌아옵니다. “완전 삭제”만이 되돌릴 수 없습니다.
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {visible.map((material) => (
                <li
                  key={material.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 border-t border-line py-1.5"
                >
                  <span className="min-w-0 text-[13px] text-grey">
                    <span className="mr-2 font-mono text-[11px] text-grey">
                      {ARCHIVE_ITEM_ICON[material.type]} {material.type}
                    </span>
                    {material.title}
                    {material.sourceOrg && (
                      <span className="ml-2 font-mono text-[11px] text-grey">
                        · {material.sourceOrg}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRestore(material.id)}
                      disabled={pendingId === material.id}
                      className="font-mono text-[11px] font-semibold text-ink underline decoration-dotted underline-offset-4 hover:opacity-70 disabled:opacity-50"
                    >
                      {pendingId === material.id ? "되돌리는 중…" : "되돌리기"}
                    </button>
                    <ConfirmDeleteButton
                      onDelete={() => handleDelete(material.id)}
                      confirmMessage={`“${material.title}”을(를) DB에서 완전히 지웁니다. 붙어 있던 연결선도 함께 사라지고, 되돌릴 수 없습니다.`}
                      label="완전 삭제"
                      className="font-mono text-[11px] text-orange-fill underline decoration-dotted underline-offset-4 hover:opacity-70 disabled:opacity-50"
                    />
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
