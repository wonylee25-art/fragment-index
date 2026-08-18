"use client";

import { ReactNode, useState } from "react";
import { EventOption } from "./EventPicker";
import { EventAttach } from "./EventAttach";
import {
  LinkBasis,
  LinkTargetType,
  linkTargetsToEvent,
  unlinkTargetsFromEvents,
} from "@/lib/link-actions";
import { LinkedEventRef } from "@/lib/types";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";

// 사료 연결과 구술 연결이 함께 쓰는 한 무리. 두 화면은 다루는 것이 다를 뿐 하는 일이
// 같다 — 붙었느냐로 갈라 세우고, 골라서 한꺼번에 붙이거나 끊거나 내린다. 조작을 두 벌
// 만들어 두면 한쪽만 고쳐지고 두 화면이 조금씩 어긋난다.
//
// 안 붙은 무리와 붙은 무리도 이 한 벌을 두 번 써서 만든다 — 머리줄(전체 고르기 체크박스와
// 비활성·연결 버튼)과 목록을 함께 묶어 둘이 나란히 같은 모양으로 선다. 고른 것은 두 무리가
// 한 벌을 함께 쓰므로(id가 겹치지 않는다), 위에서 고른 것과 아래에서 고른 것을 한꺼번에
// 내릴 수 있다.
//
// 줄의 생김새만 화면마다 다르다(renderCard) — 사료는 이미지가 붙은 카드, 구술은 화자와
// 첫 발화가 서는 얇은 줄이다. 체크박스는 여기서 그리고, 그 오른쪽만 넘겨받는다.

// 목록은 한 번에 열 건씩. 사건 목록(EventAttach)과 같은 수로 맞춘다 — 두 목록이 같은
// 화면에 겹쳐 뜨는데 끊는 단위가 다르면 눈이 두 번 센다.
const PAGE_SIZE = 10;

export interface PickEntry {
  id: string;
  // 체크박스를 소리로 읽을 때 쓸 이름. 화면에는 renderCard가 그린다.
  title: string;
  // 이 항목이 붙어 있는 사건 전부(숨긴 사건 포함). 비어 있으면 어디에도 안 붙은 것이다.
  links?: LinkedEventRef[];
}

// 연결선이 하나라도 있으면 "붙은 것"이다 — 숨긴 사건에 걸린 것도 붙은 것으로 친다.
// 연표에 안 보인다고 안 붙은 것으로 돌리면, 사건을 숨긴 순간 이미 손을 본 자료가
// 할 일 더미로 되돌아와 두 번 붙게 된다.
export function isUnlinkedEntry(entry: PickEntry): boolean {
  return (entry.links ?? []).length === 0;
}

export function PickSection<T extends PickEntry>({
  label,
  hint,
  noun,
  boxName,
  unlinkedLabel,
  entries,
  events,
  picked,
  setPicked,
  onDeactivate,
  targetType,
  basis,
  renderCard,
}: {
  label: string;
  hint: string;
  // "사료" / "구술" — 확인 문구와 빈 자리 안내에 들어가는 낱말.
  noun: string;
  boxName: string;
  // 연결을 끊으면 어느 무리로 돌아가는지. 확인 문구가 화면의 절 이름을 그대로 부른다.
  unlinkedLabel: string;
  entries: T[];
  events: EventOption[];
  picked: Set<string>;
  setPicked: (next: Set<string>) => void;
  onDeactivate: (ids: string[]) => Promise<number>;
  targetType: LinkTargetType;
  basis: LinkBasis | null;
  renderCard: (entry: T) => ReactNode;
}) {
  // 여러 건에 같은 사건을 먹이는 일이라, 고른 것이 두 건 이상일 때만 연다 — 한 건이면
  // 그 항목 안의 "+ 사건 붙이기"가 이미 같은 일을 하고, 그쪽이 무엇에 붙는지 더 분명하다.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  // 목록도 열 건씩 끊어 보여준다. 목록이 수십 건으로 불면 스크롤만 길어지고, 아래쪽
  // 비활성함까지 내려가려면 그 전부를 지나야 한다.
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  // 내리거나 붙여서 목록이 줄면 보던 쪽이 사라질 수 있다 — 상태를 고쳐 맞추지 않고
  // 그릴 때 끌어당긴다(EventAttach의 쪽 번호와 같은 방식).
  const safePage = Math.min(page, pageCount - 1);
  const shown = entries.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const pickedHere = entries.filter((e) => picked.has(e.id));
  const somePicked = pickedHere.length > 0;
  const bulkReady = pickedHere.length >= 2;
  // 머리줄 체크박스는 "지금 보이는 쪽"을 고른다(연표 표 머리와 같은 규칙). 고른 것은
  // 쪽을 넘겨도 유지되므로, 여러 쪽에 걸쳐 골라 한꺼번에 붙이거나 내릴 수 있다.
  const pickedOnPage = shown.filter((e) => picked.has(e.id));
  // 빈 무리에서는 0 === 0으로 "다 골랐다"가 되어 머리줄 체크박스가 저 혼자 켜져 있었다.
  const allPicked = shown.length > 0 && pickedOnPage.length === shown.length;
  const somePickedOnPage = pickedOnPage.length > 0;

  function togglePick(id: string, next: boolean) {
    const draft = new Set(picked);
    if (next) draft.add(id);
    else draft.delete(id);
    setPicked(draft);
  }

  async function handleDeactivate() {
    if (pickedHere.length === 0) return;
    await onDeactivate(pickedHere.map((e) => e.id));
    setPicked(new Set());
  }

  async function handleBulkLink(event: EventOption) {
    setBulkPending(true);
    try {
      await linkTargetsToEvent(event.id, targetType, pickedHere.map((e) => e.id), basis);
      setBulkOpen(false);
      setPicked(new Set());
    } finally {
      setBulkPending(false);
    }
  }

  async function handleBulkUnlink() {
    setBulkPending(true);
    try {
      await unlinkTargetsFromEvents(targetType, pickedHere.map((e) => e.id));
      setPicked(new Set());
    } finally {
      setBulkPending(false);
    }
  }

  return (
    <section>
      {/* 머리줄의 체크박스는 연표 표 머리와 같은 자리·같은 조작이다 — 행마다 붙는 체크박스가
          선 자리에서 "보이는 것 모두"를 한 번에 고른다. 일부만 골랐을 때는 반쯤 찬
          모양(indeterminate)으로 그것을 알린다. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allPicked}
            ref={(el) => {
              if (el) el.indeterminate = !allPicked && somePickedOnPage;
            }}
            onChange={() => {
              const draft = new Set(picked);
              for (const entry of shown) {
                if (allPicked) draft.delete(entry.id);
                else draft.add(entry.id);
              }
              setPicked(draft);
            }}
            title={allPicked ? "이 쪽 선택 해제" : `보이는 ${noun} ${shown.length}건 모두 선택`}
            aria-label={allPicked ? "이 쪽 선택 해제" : `보이는 ${noun} ${shown.length}건 모두 선택`}
            className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-green-fill"
          />
          <p className="font-mono text-[11px] font-semibold text-grey">
            {label} — {entries.length}건
            {pageCount > 1 && ` · ${safePage + 1}/${pageCount}쪽`}
            {somePicked && ` · ${pickedHere.length}건 고름`}
          </p>
          <span className="font-mono text-[10px] text-grey">{hint}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 고른 것이 둘 이상일 때만 서는 두 버튼. 무엇에 먹는지가 버튼 글자에 그대로
              적힌다("고른 4건") — 예전의 공용 사건 목록이 문제였던 건 고르지 않은 것에도
              조용히 먹었기 때문이지, 여러 건을 한꺼번에 잇는 일 자체가 아니었다. */}
          {bulkReady && (
            <button
              type="button"
              onClick={() => setBulkOpen(!bulkOpen)}
              disabled={bulkPending}
              className="border border-ink bg-ink px-2 py-0.5 font-mono text-[11px] font-bold text-background hover:bg-surface hover:text-ink disabled:border-line disabled:bg-surface disabled:text-grey"
            >
              {bulkPending ? "붙이는 중…" : "사건 연결"}
            </button>
          )}
          {bulkReady && (
            <ConfirmDeleteButton
              onDelete={handleBulkUnlink}
              confirmMessage={`고른 ${pickedHere.length}건의 사건 연결을 모두 끊습니다. ${noun}은(는) 그대로 남고 “${unlinkedLabel}”으로 돌아갑니다. 숨긴 사건에 걸린 연결도 끊습니다 — 그것은 이 화면에서 되붙일 수 없고, 되붙이려면 연표 관리에서 사건을 먼저 되살려야 합니다.`}
              label="사건 연결 해제"
              pendingLabel="끊는 중…"
              className="border border-line px-2 py-0.5 font-mono text-[11px] font-bold text-ink hover:border-ink disabled:text-grey"
            />
          )}
          {somePicked && (
            <ConfirmDeleteButton
              onDelete={handleDeactivate}
              confirmMessage={`고른 ${noun} ${pickedHere.length}건을 비활성으로 내립니다. DB에서는 지워지지 않고, 아래 “${boxName}”에서 되돌릴 수 있습니다.`}
              label="비활성"
              pendingLabel="내리는 중…"
              className="border border-line px-2 py-0.5 font-mono text-[11px] font-bold text-ink hover:border-ink disabled:text-grey"
            />
          )}
        </div>
      </div>

      {/* 고른 것들에 먹일 사건은 카드 안에서와 같은 목록에서 고른다 — 조작을 두 벌 만들지 않는다 */}
      {bulkOpen && bulkReady && (
        <div className="mt-2">
          <EventAttach
            events={events}
            startOpen
            pickLabel={`고른 ${pickedHere.length}건에 붙일 사건 고르기`}
            onPick={handleBulkLink}
            onClose={() => setBulkOpen(false)}
            emptyHint={<>연표에 사건이 없습니다.</>}
          />
        </div>
      )}
      {entries.length === 0 && (
        <p className="mt-2 border-t border-line py-6 text-center text-[13px] font-medium text-grey">
          해당하는 항목이 없습니다.
        </p>
      )}
      <ul>
        {shown.map((entry) => (
          <li key={entry.id} className="flex gap-4 border-t border-line py-4">
            <input
              type="checkbox"
              checked={picked.has(entry.id)}
              onChange={(e) => togglePick(entry.id, e.target.checked)}
              aria-label={`${entry.title} 고르기`}
              className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer accent-green-fill"
            />
            <div className="min-w-0 flex-1">{renderCard(entry)}</div>
          </li>
        ))}
      </ul>

      {pageCount > 1 && (
        <div className="flex items-center justify-between border-t border-line pt-2 font-mono text-[11px] text-grey">
          <button
            type="button"
            onClick={() => setPage(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            className="px-1.5 py-0.5 hover:text-ink disabled:text-line"
          >
            ‹ 이전
          </button>
          <span className="tabular-nums">
            {safePage + 1} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
            disabled={safePage >= pageCount - 1}
            className="px-1.5 py-0.5 hover:text-ink disabled:text-line"
          >
            다음 ›
          </button>
        </div>
      )}
    </section>
  );
}
