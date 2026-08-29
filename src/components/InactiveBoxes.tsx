"use client";

import { useState } from "react";
import { InactiveSegment } from "@/lib/db";
import { RelatedItem } from "@/lib/types";
import { ARCHIVE_ITEM_ICON } from "@/lib/design-tokens";
import { formatEdtfToKorean } from "@/lib/edtf";
import { deleteMaterials, reactivateMaterial } from "@/lib/material-actions";
import { deleteSegment, reactivateSegment } from "@/lib/segment-actions";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";

// 보류함에서 내린 것들이 모이는 두 함. 연표 아래 "숨긴 사건"과 같은 자리·같은 뜻이다 —
// 되돌리는 길이 없으면 내려두는 것은 지우는 것과 다르지 않다.
//
// 정말로 지우는 길은 여기에만 둔다. 훑어보는 자리(보류함)에서 한 손짓으로 닿게 두면
// 잘못 누른 한 번으로 자료가 사라지는데, 사료도 구술도 다시 찾아오기 어려운 것들이다.
// 여기까지 들어와 한 번 더 물어 지우는 것이라면, 그건 뜻이 있어 지우는 것이다.

function Row({
  children,
  onRestore,
  deleteButton,
}: {
  children: React.ReactNode;
  onRestore: () => Promise<void>;
  deleteButton: React.ReactNode;
}) {
  const [pending, setPending] = useState(false);

  async function handleRestore() {
    setPending(true);
    try {
      await onRestore();
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-3 border-t border-line py-1.5">
      <span className="min-w-0 text-[13px] text-grey">{children}</span>
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleRestore}
          disabled={pending}
          className="font-mono text-[11px] font-semibold text-ink underline decoration-dotted underline-offset-4 hover:opacity-70 disabled:opacity-50"
        >
          {pending ? "되돌리는 중…" : "되돌리기"}
        </button>
        {deleteButton}
      </span>
    </li>
  );
}

function Box({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="font-mono text-[11px] font-bold text-grey hover:text-ink"
      >
        {open ? "▾" : "▸"} {title} {count}건
      </button>
      {open && children}
    </div>
  );
}

// 함은 제 화면에만 선다 — 비활성 사료함은 「사료」 아래, 비활성 구술함은 「구술」
// 아래. 내린 자리와 되돌리는 자리가 갈라져 있으면 되돌리는 길을 찾지 못한다.
export function InactiveBoxes({
  materials = [],
  segments = [],
}: {
  materials?: RelatedItem[];
  segments?: InactiveSegment[];
}) {
  if (materials.length === 0 && segments.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-line bg-surface py-3">
      <Box title="비활성 사료함" count={materials.length}>
        <>
          <p className="mt-2 font-mono text-[11px] leading-5 text-grey">
            화면에서만 내린 것이라 DB에는 그대로 있습니다. 되돌리면 붙어 있던 사건으로 함께
            돌아옵니다. “완전 삭제”만이 되돌릴 수 없습니다.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {materials.map((material) => (
              <Row
                key={material.id}
                onRestore={() => reactivateMaterial(material.id)}
                deleteButton={
                  <ConfirmDeleteButton
                    onDelete={async () => {
                      await deleteMaterials([material.id]);
                    }}
                    confirmMessage={`“${material.title}”을(를) DB에서 완전히 지웁니다. 붙어 있던 연결선도 함께 사라지고, 되돌릴 수 없습니다.`}
                    label="완전 삭제"
                    className="font-mono text-[11px] text-orange-fill underline decoration-dotted underline-offset-4 hover:opacity-70 disabled:opacity-50"
                  />
                }
              >
                <span className="mr-2 font-mono text-[11px] text-grey">
                  {ARCHIVE_ITEM_ICON[material.type]} {material.type}
                </span>
                {material.title}
                {(material.sourceOrg || material.dateValue) && (
                  <span className="ml-2 font-mono text-[11px] text-grey">
                    {[material.sourceOrg, material.dateValue].filter(Boolean).map((v) => `· ${v}`).join(" ")}
                  </span>
                )}
              </Row>
            ))}
          </ul>
        </>
      </Box>

      <Box title="비활성 구술함" count={segments.length}>
        <>
          <p className="mt-2 font-mono text-[11px] leading-5 text-grey">
            구술 목록·연표에서 빠져 있을 뿐 DB에는 그대로 있습니다.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {segments.map((segment) => (
              <Row
                key={segment.id}
                onRestore={() => reactivateSegment(segment.id)}
                deleteButton={
                  <ConfirmDeleteButton
                    onDelete={() => deleteSegment(segment.id)}
                    confirmMessage={`“${segment.itemTitle}”을(를) DB에서 완전히 지웁니다. 발췌 본문·화자·각주와 연결선이 함께 사라지고, 되돌릴 수 없습니다.`}
                    label="완전 삭제"
                    className="font-mono text-[11px] text-orange-fill underline decoration-dotted underline-offset-4 hover:opacity-70 disabled:opacity-50"
                  />
                }
              >
                <span className="mr-2 font-mono text-[11px] tabular-nums text-grey">
                  {segment.dateValue ? formatEdtfToKorean(segment.dateValue) : "연도 미상"}
                </span>
                {segment.itemTitle}
              </Row>
            ))}
          </ul>
        </>
      </Box>
    </div>
  );
}
