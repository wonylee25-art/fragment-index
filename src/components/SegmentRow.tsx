"use client";

import { useState } from "react";
import { Tag } from "./Tag";
import { MemoField } from "./MemoField";
import { FlagToggle } from "./FlagToggle";
import { SegmentDeleteButton } from "./SegmentDeleteButton";
import { SegmentCardData, ArchiveItemType, PersonBrief, Utterance } from "@/lib/types";
import { saveSegmentMemo } from "@/lib/memo-actions";
import { toggleSegmentImportant } from "@/lib/flag-actions";
import {
  ARCHIVE_ITEM_ICON,
  DISCREPANCY_LABEL_CLASSNAME,
  DISCREPANCY_ROW_CLASSNAME,
  FOCUS_HIGHLIGHT_CLASSNAME,
  SPEAKER_CLASSNAME,
  TEXT_BODY_CLASSNAME,
} from "@/lib/design-tokens";
import { formatEdtfToKorean } from "@/lib/edtf";

// 이름이 실명이 아닐 때 그렇다고 말해 주는 표시. 이름 문자열에 "(가명)"을 섞어 넣는 대신
// 여기서 붙인다 — 그렇게 하면 본문 줄머리와 인용문에까지 괄호가 따라 들어간다.
const KIND_TITLE: Record<NonNullable<PersonBrief["kind"]>, string> = {
  가명: "자료에 적힌 가명입니다. 같은 가명이라도 다른 사람일 수 있습니다.",
  익명: "실명을 가린 표기입니다.",
  미상: "이름이 알려지지 않은 화자입니다.",
};

// 화자 이름을 가운뎃점으로 잇되, 실명이 아닌 사람에게는 뒤에 표시를 붙인다.
function SpeakerNames({ people }: { people: PersonBrief[] }) {
  return (
    <>
      {people.map((person, i) => (
        <span key={person.id}>
          {i > 0 && " · "}
          {person.name}
          {person.kind && (
            <span
              title={KIND_TITLE[person.kind]}
              className="ml-1 border border-zinc-300 px-1 align-[1px] text-[9px] font-normal text-zinc-400"
            >
              {person.kind}
            </span>
          )}
        </span>
      ))}
    </>
  );
}

// 실제 썸네일(오픈그래프 등)이 붙기 전까지 자료 유형을 구분해 보여주는 placeholder 배경.
const ITEM_TYPE_THUMBNAIL_BG: Record<ArchiveItemType, string> = {
  구술: "bg-amber-50",
  신문: "bg-zinc-100",
  문서: "bg-stone-100",
  이미지: "bg-blue-50",
  학술: "bg-violet-50",
  지도: "bg-emerald-50",
  박물: "bg-rose-50",
  음원: "bg-teal-50",
  영상: "bg-indigo-50",
};

// 화면에서 직접 넣은 발췌는 id가 "manual-"로 시작한다(segment-actions.ts). CSV
// 동기화분은 CSV의 segment_id를 그대로 쓰므로 이 접두어가 둘을 가른다.
function isManual(id: string) {
  return id.startsWith("manual-");
}

// 구술 본문. 발화를 한 문단에 이어 붙이면 색깔만으로 화자가 바뀐 것을 알아채야 하는데,
// 면담자의 짧은 물음이 구술자의 긴 답 사이에 끼면 그 초록색이 인용이나 강조로 읽힌다.
// 발화마다 줄을 주고, 화자가 바뀌는 줄에만 이름을 붙인다 — 같은 사람이 이어 말할 때
// 이름을 반복하면 이름이 본문만큼 눈에 들어온다.
function Transcript({ utterances }: { utterances: Utterance[] }) {
  return (
    // 크기는 본문 한 단(design-tokens.ts). 행간만 연표 요약(leading-5)보다 넓게 잡는다 —
    // 구술은 요약 한 줄이 아니라 여러 줄을 이어 읽는 글이다.
    <ul className={`flex flex-col gap-1 ${TEXT_BODY_CLASSNAME} leading-6 text-zinc-800`}>
      {utterances.map((utterance, i) => {
        const previous = utterances[i - 1];
        // 지문은 화자가 없는 줄이라 이름을 달지 않고, 다음 발화의 "바뀌었는가" 판단에서도
        // 건너뛴다 — 지문이 끼었다고 같은 사람의 이름을 다시 적을 이유는 없다.
        const label =
          utterance.role === "stage"
            ? null
            : utterance.speaker ?? (utterance.role === "interviewer" ? "면담자" : "구술자");
        const previousLabel =
          previous && previous.role !== "stage"
            ? previous.speaker ?? (previous.role === "interviewer" ? "면담자" : "구술자")
            : undefined;
        const showLabel = label !== null && label !== previousLabel;

        return (
          <li key={i} className={utterance.role === "stage" ? "pl-3" : undefined}>
            {showLabel && (
              <span className="mr-1.5 font-mono text-[10px] text-zinc-400">{label}</span>
            )}
            <span className={SPEAKER_CLASSNAME[utterance.role]}>
              {utterance.role === "stage" ? `[${utterance.text}]` : utterance.text}
            </span>
          </li>
        );
      })}
    </ul>
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
          {/* 구술을 알아보는 가장 빠른 단서는 제목이 아니라 누가 말했는가다. 화자가 적혀
              있으면 그것을 먼저 보이고, 없는 발췌(CSV 동기화분)만 제목으로 되돌아간다. */}
          {data.narrators.length > 0 ? (
            <span className="font-medium text-zinc-600">
              <SpeakerNames people={data.narrators} />
              {data.interviewers.length > 0 && (
                <span className="text-zinc-400">
                  {" ← "}
                  <SpeakerNames people={data.interviewers} />
                </span>
              )}
            </span>
          ) : (
            <span>{data.itemTitle}</span>
          )}
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
          {/* 각주가 여럿이면 번호를 붙여 보여준다 — 몇 개인지가 곧 원본이 얼마나 손질됐는지다 */}
          {data.noteList.length > 0 && (
            <span
              className="cursor-help underline decoration-dotted underline-offset-4 text-zinc-400 hover:text-zinc-700"
              title={data.noteList.map((n, i) => `${i + 1}. ${n}`).join("\n")}
            >
              📝 각주 {data.noteList.length}
            </span>
          )}
        </div>

        <Transcript utterances={data.utterances} />

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
        {(data.sourceRef || isManual(data.id)) && (
          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[11px] text-zinc-400">
            <span className="min-w-0">
              {data.sourceRef &&
                (data.sourceRef.url ? (
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
                ))}
            </span>

            {/* 화면에서 넣은 발췌만 고치고 지울 수 있다 — CSV 동기화분은 여기서 손대도
                다음 동기화 때 되돌아간다(segment-actions.ts 참고).
                점선 밑줄을 쓰지 않는다: 이 화면에서 점선 밑줄은 "올려 보면 더 있다"는
                뜻이고(각주·출처), 눌러서 무언가 일어나는 것과 섞이면 안 된다. */}
            {isManual(data.id) && (
              <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
                {onEdit && (
                  <button type="button" onClick={onEdit} className="hover:text-zinc-900">
                    고치기
                  </button>
                )}
                <SegmentDeleteButton segmentId={data.id} noteCount={data.noteList.length} />
              </span>
            )}
          </div>
        )}

        {/* 관련자료는 붙어 있을 때만 여닫는다 — "관련자료 0"은 눌러도 아무 일이 없다 */}
        {data.relatedItems.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="font-mono text-[11px] text-zinc-400 underline decoration-dotted underline-offset-4 hover:text-zinc-800 sm:hidden"
            >
              관련자료 {data.relatedItems.length} {expanded ? "▲" : "▼"}
            </button>
          </div>
        )}

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
                  <span aria-hidden>{ARCHIVE_ITEM_ICON[item.type]}</span>
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
                    {ARCHIVE_ITEM_ICON[item.type]}
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
        {data.relatedItems.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="font-mono text-xs text-zinc-400 underline decoration-dotted underline-offset-4 hover:text-zinc-800"
          >
            관련자료 {data.relatedItems.length} {expanded ? "▲" : "▼"}
          </button>
        )}
      </div>
    </div>
  );
}
