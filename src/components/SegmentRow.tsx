"use client";

import { useState } from "react";
import { Tag } from "./Tag";
import { MemoList } from "./MemoList";
import { FlagToggle } from "./FlagToggle";
import { Transcript } from "./Transcript";
import { SegmentDeleteButton } from "./SegmentDeleteButton";
import { SegmentCardData, PersonBrief } from "@/lib/types";
import { addSegmentMemo, deleteMemo, updateMemo } from "@/lib/memo-actions";
import { toggleSegmentImportant } from "@/lib/flag-actions";
import {
  ARCHIVE_ITEM_ICON,
  DOT_MINE,
  MATERIAL_THUMB_CLASSNAME,
  DISCREPANCY_LABEL_CLASSNAME,
  DISCREPANCY_ROW_CLASSNAME,
  FOCUS_HIGHLIGHT_CLASSNAME,
  MINE_ROW_CLASSNAME,
} from "@/lib/design-tokens";
import { formatEdtfToKorean } from "@/lib/edtf";

// 이름이 실명이 아닐 때 그렇다고 말해 주는 표시. 이름 문자열에 "(가명)"을 섞어 넣는 대신
// 여기서 붙인다 — 그렇게 하면 본문 줄머리와 인용문에까지 괄호가 따라 들어간다.
const KIND_TITLE: Record<NonNullable<PersonBrief["kind"]>, string> = {
  가명: "자료에 적힌 가명입니다. 같은 가명이라도 다른 사람일 수 있습니다.",
  익명: "실명을 가린 표기입니다.",
  미상: "이름이 알려지지 않은 화자입니다.",
};

// 한 역할의 화자를 한 사람씩 한 줄로 세운다.
//
// 「구술자」·「면담자」를 글자로 박는다 — 예전에는 이름 사이의 화살표 하나가 그 구분을
// 다 맡았는데, 이 아카이브의 화자는 「미상(40대 남성)」처럼 이름이 이름 노릇을 못 하는
// 경우가 많아 화살표를 놓치면 누가 묻고 누가 답했는지가 뒤집힌다. 화자가 셋이 되든
// 이름이 비어 있든 읽는 법이 안 바뀌는 쪽을 골랐다.
//
// 소속도 함께 세운다. 실명이면 소속·직위이고, 익명·미상이면 그 이름이 어느 자료 몇 쪽의
// 누구인지를 가리키는 단서다 — 같은 이름표가 여러 줄 쌓이면 이름만으로는 가려지지 않는다.
function SpeakerLines({ role, people }: { role: string; people: PersonBrief[] }) {
  return (
    <>
      {people.map((person) => (
        <div key={person.id} className="flex gap-2">
          <span className="w-12 shrink-0">{role}</span>
          <span className="min-w-0">
            <span className="font-medium text-ink">{person.name}</span>
            {person.kind && (
              <span
                title={KIND_TITLE[person.kind]}
                className="ml-1 border border-line px-1 align-[1px] text-[9px] font-normal"
              >
                {person.kind}
              </span>
            )}
            {person.affiliation && <span className="ml-1.5">{person.affiliation}</span>}
          </span>
        </div>
      ))}
    </>
  );
}

export function SegmentRow({
  data,
  zebra,
  highlighted = false,
  onEdit,
}: {
  data: SegmentCardData;
  zebra: boolean;
  highlighted?: boolean;
  onEdit?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      id={`segment-${data.id}`}
      // 행 바탕의 순서: 지금 찾아온 행 > 내가 표시한 행 > 이견 > 얼룩말. 내 표시가 이견의
      // 빨강을 덮지만 뜻은 안 사라진다 — "🔍 이견 발견"이 행 안에 빨간 글씨로 남는다.
      // 반대로 두면 이견 행에서만 표시가 안 보여, 표시해도 아무 일이 없는 행이 생긴다.
      className={`grid scroll-mt-6 grid-cols-[64px_1fr] gap-4 border-b border-line px-1 py-4 transition-colors duration-500 sm:grid-cols-[88px_minmax(0,7fr)_minmax(0,2fr)] ${
        highlighted
          ? FOCUS_HIGHLIGHT_CLASSNAME
          : data.isImportant
            ? MINE_ROW_CLASSNAME
            : data.hasDiscrepancy
              ? DISCREPANCY_ROW_CLASSNAME
              : zebra
                ? "bg-surface"
                : "bg-background"
      }`}
    >
      <div className="pt-0.5 font-mono text-xs text-grey">
        {formatEdtfToKorean(data.dateValue)}
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-grey">
          <FlagToggle
            active={data.isImportant}
            onToggle={(next) => toggleSegmentImportant(data.id, next)}
            activeLabel="중요"
            inactiveLabel="중요"
            dotClassName={DOT_MINE}
          />
          {data.hasDiscrepancy && (
            <span className={`${DISCREPANCY_LABEL_CLASSNAME} font-medium`} title={data.discrepancyNote}>
              🔍 이견 발견
            </span>
          )}
          {data.notes && (
            <span
              className="cursor-help underline decoration-dotted underline-offset-4 text-grey hover:text-ink"
              title={data.notes}
            >
              📝 원문 각주
            </span>
          )}
          {/* 각주가 여럿이면 번호를 붙여 보여준다 — 몇 개인지가 곧 원본이 얼마나 손질됐는지다 */}
          {data.noteList.length > 0 && (
            <span
              className="cursor-help underline decoration-dotted underline-offset-4 text-grey hover:text-ink"
              title={data.noteList.map((n, i) => `${i + 1}. ${n}`).join("\n")}
            >
              📝 각주 {data.noteList.length}
            </span>
          )}
        </div>

        {/* 구술을 알아보는 가장 빠른 단서는 제목이 아니라 누가 말했는가다. 화자가 적혀
            있으면 그것을 먼저 보이고, 없는 발췌(CSV 동기화분)만 제목으로 되돌아간다. */}
        <div className="mb-1.5 font-mono text-[11px] text-grey">
          {data.narrators.length > 0 || data.interviewers.length > 0 ? (
            <>
              <SpeakerLines role="구술자" people={data.narrators} />
              <SpeakerLines role="면담자" people={data.interviewers} />
            </>
          ) : (
            <span>{data.itemTitle}</span>
          )}
        </div>

        <Transcript segmentId={data.id} utterances={data.utterances} highlights={data.highlights} />

        <div className="flex flex-wrap items-center gap-1.5">
          {data.personPlaceTags.map((tag) => (
            <Tag key={tag} label={tag} variant="personPlace" />
          ))}
          {data.keywordTags.map((tag) => (
            <Tag key={tag} label={tag} variant="keyword" />
          ))}
        </div>

        {/* 행의 아랫줄 — 왼쪽은 이 발췌가 어디서 왔는지, 오른쪽은 이 발췌를 손보는 일.
            읽는 데 필요한 것은 위(화자·이견·각주)에 두고, 손대는 것은 여기로 모은다. */}
        <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[11px] text-grey">
          <span className="min-w-0">
            {data.sourceRef &&
              (data.sourceRef.url ? (
                <a
                  href={data.sourceRef.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-dotted underline-offset-4 hover:text-ink"
                >
                  {data.sourceRef.title} ↗
                </a>
              ) : (
                <span>{data.sourceRef.title}</span>
              ))}
          </span>

          {/* 점선 밑줄을 쓰지 않는다: 이 화면에서 점선 밑줄은 "올려 보면 더 있다"는
              뜻이고(각주·출처), 눌러서 무언가 일어나는 것과 섞이면 안 된다. */}
          <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
            {onEdit && (
              <button type="button" onClick={onEdit} className="hover:text-ink">
                고치기
              </button>
            )}
            <SegmentDeleteButton segmentId={data.id} noteCount={data.noteList.length} />
          </span>
        </div>

        {/* 관련자료는 붙어 있을 때만 여닫는다 — "관련자료 0"은 눌러도 아무 일이 없다 */}
        {data.relatedItems.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="font-mono text-[11px] text-grey underline decoration-dotted underline-offset-4 hover:text-ink sm:hidden"
            >
              관련자료 {data.relatedItems.length} {expanded ? "▲" : "▼"}
            </button>
          </div>
        )}

        {/* 메모(모바일) — 오른쪽 칸이 사라지는 좁은 화면에서는 본문 흐름 안에 그대로 둔다 */}
        <div className="sm:hidden">
          <MemoList
            memos={data.memos}
            onAdd={(memo) => addSegmentMemo(data.id, memo)}
            onEdit={(id, memo) => updateMemo(id, memo)}
            onDelete={(id) => deleteMemo(id)}
          />
        </div>

        {expanded && (
          <ul className="mt-3 flex flex-col gap-1 border-t border-line/70 pt-2">
            {data.relatedItems.map((item) => (
              <li key={item.id} className="group relative w-fit">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 py-1 font-mono text-xs"
                >
                  <span aria-hidden>{ARCHIVE_ITEM_ICON[item.type]}</span>
                  <span className="text-ink underline decoration-dotted underline-offset-4 group-hover:text-ink">
                    {item.title}
                  </span>
                  <span className="text-grey">— {item.sourceOrg}</span>
                  <span aria-hidden className="text-line">
                    ↗
                  </span>
                </a>

                {/* 호버 미리보기: 8-1의 "썸네일을 크게" 방향 참고, 실제 이미지는 자료 등록 시 오픈그래프로 대체될 자리 */}
                <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-64 origin-top-left rounded-md border border-line bg-background p-3 opacity-0 shadow-lg transition duration-150 group-hover:opacity-100">
                  <div
                    className={`mb-2 flex h-24 items-center justify-center rounded-sm text-3xl ${MATERIAL_THUMB_CLASSNAME}`}
                  >
                    {ARCHIVE_ITEM_ICON[item.type]}
                  </div>
                  <p className="mb-1 font-mono text-[11px] text-grey">
                    {item.type} · {item.sourceOrg}
                  </p>
                  <p className="text-xs font-medium text-ink">{item.title}</p>
                  {item.description && (
                    <p className="mt-1 text-[11px] leading-4 text-grey">{item.description}</p>
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
          <MemoList
            memos={data.memos}
            onAdd={(memo) => addSegmentMemo(data.id, memo)}
            onEdit={(id, memo) => updateMemo(id, memo)}
            onDelete={(id) => deleteMemo(id)}
          />
        </div>
        {data.relatedItems.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-mono text-xs text-grey underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            관련자료 {data.relatedItems.length} {expanded ? "▲" : "▼"}
          </button>
        )}
      </div>
    </div>
  );
}
