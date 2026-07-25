"use client";

import { useState } from "react";
import { Tag } from "./Tag";
import { MemoField } from "./MemoField";
import { FlagToggle } from "./FlagToggle";
import { SegmentCardData, ArchiveItemType } from "@/lib/types";
import { saveSegmentMemo } from "@/lib/memo-actions";
import { toggleSegmentImportant } from "@/lib/flag-actions";
import {
  SPEAKER_CLASSNAME,
  DISCREPANCY_ROW_CLASSNAME,
  DISCREPANCY_LABEL_CLASSNAME,
  FOCUS_HIGHLIGHT_CLASSNAME,
} from "@/lib/design-tokens";
import { formatEdtfToKorean } from "@/lib/edtf";

const ITEM_TYPE_ICON: Record<ArchiveItemType, string> = {
  구술: "🎙️",
  신문: "📰",
  문서: "🗂️",
  사진: "🖼️",
  논문: "📄",
  지도: "🗺️",
};

// 실제 썸네일(오픈그래프 등)이 붙기 전까지 자료 유형을 구분해 보여주는 placeholder 배경.
const ITEM_TYPE_THUMBNAIL_BG: Record<ArchiveItemType, string> = {
  구술: "bg-amber-50",
  신문: "bg-zinc-100",
  문서: "bg-stone-100",
  사진: "bg-blue-50",
  논문: "bg-violet-50",
  지도: "bg-emerald-50",
};

export function SegmentRow({
  data,
  zebra,
  highlighted = false,
}: {
  data: SegmentCardData;
  zebra: boolean;
  highlighted?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      id={`segment-${data.id}`}
      className={`grid scroll-mt-6 grid-cols-[64px_1fr] gap-4 border-b border-zinc-200 px-1 py-4 transition-colors duration-500 sm:grid-cols-[88px_2fr_1fr] ${
        highlighted
          ? FOCUS_HIGHLIGHT_CLASSNAME
          : data.hasDiscrepancy
            ? DISCREPANCY_ROW_CLASSNAME
            : zebra
              ? "bg-zinc-50/70"
              : "bg-white"
      }`}
    >
      <div className="pt-0.5 font-mono text-xs text-zinc-400">
        {formatEdtfToKorean(data.dateValue)}
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-zinc-400">
          <FlagToggle
            active={data.isImportant}
            onToggle={(next) => toggleSegmentImportant(data.id, next)}
            activeLabel="★ 중요"
            inactiveLabel="☆ 중요"
            activeClassName="bg-amber-100 text-amber-700"
          />
          <span>{data.itemTitle}</span>
          {data.hasDiscrepancy && (
            <span className={`${DISCREPANCY_LABEL_CLASSNAME} font-medium`} title={data.discrepancyNote}>
              🔍 이견 발견
            </span>
          )}
          {data.notes && (
            <span
              className="cursor-help underline decoration-dotted underline-offset-4 text-zinc-400 hover:text-zinc-700"
              title={data.notes}
            >
              📝 원문 각주
            </span>
          )}
        </div>

        <p className="text-[15px] leading-7 text-zinc-800">
          {data.utterances.map((u, i) => (
            <span key={i} className={SPEAKER_CLASSNAME[u.role]}>
              {u.role === "stage" ? `[${u.text}]` : u.text}
              {i < data.utterances.length - 1 ? " " : ""}
            </span>
          ))}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          {data.personPlaceTags.map((tag) => (
            <Tag key={tag} label={tag} variant="personPlace" />
          ))}
          {data.keywordTags.map((tag) => (
            <Tag key={tag} label={tag} variant="keyword" />
          ))}
        </div>

        {data.sourceRef && (
          <div className="mt-1.5 font-mono text-[11px] text-zinc-400">
            {data.sourceRef.url ? (
              <a
                href={data.sourceRef.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-dotted underline-offset-4 hover:text-zinc-800"
              >
                {data.sourceRef.title} ↗
              </a>
            ) : (
              <span>{data.sourceRef.title}</span>
            )}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-mono text-[11px] text-zinc-400 underline decoration-dotted underline-offset-4 hover:text-zinc-800 sm:hidden"
          >
            관련자료 {data.relatedItems.length} {expanded ? "▲" : "▼"}
          </button>
        </div>

        {/* 메모(모바일) — 오른쪽 칸이 사라지는 좁은 화면에서는 본문 흐름 안에 그대로 둔다 */}
        <div className="sm:hidden">
          <MemoField initialValue={data.userMemo} onSave={(memo) => saveSegmentMemo(data.id, memo)} />
        </div>

        {expanded && (
          <ul className="mt-3 flex flex-col gap-1 border-t border-zinc-200/70 pt-2">
            {data.relatedItems.map((item) => (
              <li key={item.id} className="group relative w-fit">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 py-1 font-mono text-xs"
                >
                  <span aria-hidden>{ITEM_TYPE_ICON[item.type]}</span>
                  <span className="text-zinc-700 underline decoration-dotted underline-offset-4 group-hover:text-zinc-950">
                    {item.title}
                  </span>
                  <span className="text-zinc-400">— {item.sourceOrg}</span>
                  <span aria-hidden className="text-zinc-300">
                    ↗
                  </span>
                </a>

                {/* 호버 미리보기: 8-1의 "썸네일을 크게" 방향 참고, 실제 이미지는 자료 등록 시 오픈그래프로 대체될 자리 */}
                <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-64 origin-top-left rounded-md border border-zinc-200 bg-white p-3 opacity-0 shadow-lg transition duration-150 group-hover:opacity-100">
                  <div
                    className={`mb-2 flex h-24 items-center justify-center rounded-sm text-3xl ${ITEM_TYPE_THUMBNAIL_BG[item.type]}`}
                  >
                    {ITEM_TYPE_ICON[item.type]}
                  </div>
                  <p className="mb-1 font-mono text-[11px] text-zinc-400">
                    {item.type} · {item.sourceOrg}
                  </p>
                  <p className="text-xs font-medium text-zinc-800">{item.title}</p>
                  {item.description && (
                    <p className="mt-1 text-[11px] leading-4 text-zinc-500">{item.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 오른쪽 칸(데스크톱) — 관련자료 버튼과 메모를 같은 행(row 1)에 위로 붙여 쌓는다.
          메모를 별도 그리드 행으로 두면 본문(구술 인용)이 긴 만큼 아래로 밀려버려서, 같은 셀 안에 넣는다. */}
      <div className="hidden text-right sm:flex sm:flex-col sm:items-end sm:gap-2">
        <div className="w-full">
          <MemoField initialValue={data.userMemo} onSave={(memo) => saveSegmentMemo(data.id, memo)} />
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="font-mono text-xs text-zinc-400 underline decoration-dotted underline-offset-4 hover:text-zinc-800"
        >
          관련자료 {data.relatedItems.length} {expanded ? "▲" : "▼"}
        </button>
      </div>
    </div>
  );
}
