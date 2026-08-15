"use client";

import { useEffect, useRef } from "react";

// 구술 본문 입력기. 구술은 두 사람(때로 그 이상)이 번갈아 말하는 기록이라, 한 덩어리
// textarea에 "구술자:"를 손으로 타이핑하게 두면 화자를 적는 일이 내용을 적는 일보다
// 번거로워진다. 여기서는 줄마다 화자가 붙고, 새 줄은 방금 줄과 반대 역할의 화자로 열린다.
//
// 화자는 이름으로 적는다("김청기: …"). 구술자가 둘 이상인 면담에서 "구술자1"이 누구였는지
// 되짚지 않아도 되기 때문이다. 명단은 위쪽 화자 칸에서 정하고, 여기서는 그중에서 고른다.
//
// 조작:
//   Enter        다음 발화로 (반대 역할의 화자로 자동 전환)
//   Shift+Enter  같은 발화 안에서 줄바꿈
//   Tab          이 발화의 화자 바꾸기 (명단 순서대로 돌고 마지막이 지문)
//   Backspace    빈 줄에서 누르면 그 줄을 지우고 앞 줄로

export interface SpeakerOption {
  id: string;
  name: string;
  role: "구술자" | "면담자";
}

// speakerId가 null이면 지문 — 화자가 없는 줄이다.
export interface UtteranceDraft {
  speakerId: string | null;
  text: string;
}

const CHIP_BASE = "mt-[3px] w-20 shrink-0 truncate px-1 py-0.5 text-center font-mono text-[10px] font-bold";

export function UtteranceEditor({
  speakers,
  utterances,
  onChange,
  onAddFootnote,
}: {
  speakers: SpeakerOption[];
  utterances: UtteranceDraft[];
  onChange: (next: UtteranceDraft[]) => void;
  // 각주를 하나 늘리고 그 번호를 돌려준다. 번호는 본문에 "1)"로 박히고, 같은 번호의
  // 각주 칸이 아래에 생긴다 — 각주는 발췌 어딘가에 달리는 것이지 발췌 전체에 달리는 게 아니다.
  onAddFootnote: () => number;
}) {
  const inputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  // 각주 표시는 "마지막으로 손대던 자리"에 박는다. 버튼을 누르는 순간 textarea에서 포커스가
  // 떠나므로, 떠나기 전의 줄과 커서 위치를 여기 적어 둔다. select 이벤트만 봐서는 안 된다 —
  // 그건 글자를 "선택"할 때 나는 것이라, 그냥 쳐 넣기만 하면 커서 위치를 놓친다.
  const lastCaret = useRef<{ index: number; pos: number }>({ index: 0, pos: 0 });

  function recordCaret(index: number, el: HTMLTextAreaElement) {
    lastCaret.current = { index, pos: el.selectionStart ?? el.value.length };
  }
  // 커서를 옮길 줄은 ref에 적어 두었다가 렌더가 끝난 뒤에 옮긴다. 새 줄이 아직 DOM에 없는
  // 시점에 focus를 걸면 아무 일도 일어나지 않고, 이어서 친 글자가 앞 줄에 붙어 버린다.
  const pendingFocus = useRef<number | null>(null);

  useEffect(() => {
    const index = pendingFocus.current;
    if (index === null) return;
    pendingFocus.current = null;
    const el = inputRefs.current[index];
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [utterances]);

  const speakerById = new Map(speakers.map((s) => [s.id, s]));
  // 화자 순환 목록의 끝에 지문(null)을 둔다.
  const cycle: (string | null)[] = [...speakers.map((s) => s.id), null];

  function roleOf(speakerId: string | null) {
    return speakerId ? speakerById.get(speakerId)?.role : undefined;
  }

  function update(index: number, patch: Partial<UtteranceDraft>) {
    onChange(utterances.map((u, i) => (i === index ? { ...u, ...patch } : u)));
  }

  // 구술자 다음은 면담자, 면담자 다음은 구술자. 그 역할의 화자가 여럿이면 이 발췌에서
  // 가장 최근에 말한 사람을 고른다 — 두 사람이 주고받는 중간에 세 번째 화자가 끼어드는
  // 것보다, 방금 오가던 짝이 이어지는 편이 실제 대화에 가깝다.
  function nextSpeakerAfter(index: number): string | null {
    const currentRole = roleOf(utterances[index].speakerId);
    const wantRole = currentRole === "구술자" ? "면담자" : "구술자";

    for (let i = index; i >= 0; i--) {
      const candidate = utterances[i].speakerId;
      if (candidate && roleOf(candidate) === wantRole) return candidate;
    }
    return speakers.find((s) => s.role === wantRole)?.id ?? utterances[index].speakerId;
  }

  function insertAfter(index: number) {
    const next = [...utterances];
    next.splice(index + 1, 0, { speakerId: nextSpeakerAfter(index), text: "" });
    onChange(next);
    pendingFocus.current = index + 1;
  }

  function removeAt(index: number) {
    if (utterances.length === 1) return;
    onChange(utterances.filter((_, i) => i !== index));
    pendingFocus.current = Math.max(0, index - 1);
  }

  // 커서 자리에 "N)"을 박고, 커서를 그 뒤로 옮긴다.
  function insertFootnoteMarker() {
    const { index, pos } = lastCaret.current;
    const row = utterances[index];
    if (!row) return;
    const number = onAddFootnote();
    const marker = `${number})`;
    const caret = Math.min(pos, row.text.length);
    update(index, { text: `${row.text.slice(0, caret)}${marker}${row.text.slice(caret)}` });

    requestAnimationFrame(() => {
      const el = inputRefs.current[index];
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret + marker.length, caret + marker.length);
    });
  }

  function cycleSpeaker(index: number) {
    const current = cycle.indexOf(utterances[index].speakerId);
    update(index, { speakerId: cycle[(current + 1) % cycle.length] });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      insertAfter(index);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      cycleSpeaker(index);
      return;
    }
    if (e.key === "Backspace" && utterances[index].text === "" && utterances.length > 1) {
      e.preventDefault();
      removeAt(index);
    }
  }

  return (
    <div className="border border-line-strong bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-2">
          구술 본문
        </span>
        <span className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-muted-2">
            Enter 다음 발화 · Shift+Enter 줄바꿈 · Tab 화자 바꾸기
          </span>
          <button
            type="button"
            onClick={insertFootnoteMarker}
            title="커서 자리에 각주 번호를 넣습니다"
            className="border border-line-strong px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground hover:bg-foreground hover:text-background"
          >
            + 각주 표시
          </button>
        </span>
      </div>

      {speakers.length === 0 && (
        <p className="border-b border-line px-2.5 py-2 font-mono text-[11px] text-muted-2">
          위에서 구술자와 면담자를 먼저 정하면 줄마다 이름이 붙습니다. 정하지 않고 적으면
          “구술자 / 면담자”로 저장됩니다.
        </p>
      )}

      <ul>
        {utterances.map((utterance, i) => {
          const speaker = utterance.speakerId ? speakerById.get(utterance.speakerId) : undefined;
          const role = speaker?.role;
          return (
            <li
              key={i}
              className="flex items-start gap-2 border-b border-line px-2.5 py-1.5 last:border-b-0"
            >
              <button
                type="button"
                onClick={() => cycleSpeaker(i)}
                title="화자 바꾸기 (Tab)"
                className={`${CHIP_BASE} ${
                  role === "면담자"
                    ? "bg-emerald-600 text-white"
                    : role === "구술자"
                      ? "bg-foreground text-background"
                      : "border border-line-strong bg-surface text-muted-2"
                }`}
              >
                {speaker ? speaker.name : "지문"}
              </button>

              <textarea
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                value={utterance.text}
                onChange={(e) => {
                  recordCaret(i, e.target);
                  update(i, { text: e.target.value });
                  // 내용만큼만 높이를 갖게 한다 — 발화 길이가 제각각이라 고정 높이는 늘 남거나 모자란다.
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => handleKeyDown(e, i)}
                onSelect={(e) => recordCaret(i, e.currentTarget)}
                onKeyUp={(e) => recordCaret(i, e.currentTarget)}
                onClick={(e) => recordCaret(i, e.currentTarget)}
                onFocus={(e) => recordCaret(i, e.currentTarget)}
                onBlur={(e) => recordCaret(i, e.currentTarget)}
                rows={1}
                placeholder={speaker ? "말한 내용" : "(웃음), (자료를 꺼내며)"}
                className={`min-h-[24px] w-full resize-none bg-transparent text-[13px] leading-relaxed placeholder:not-italic placeholder:text-muted-2 focus:outline-none ${
                  role === "면담자"
                    ? "italic text-emerald-700"
                    : role === "구술자"
                      ? "text-foreground"
                      : "italic text-muted-2"
                }`}
              />

              {utterances.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  title="이 발화 지우기"
                  className="mt-[3px] shrink-0 font-mono text-[11px] text-muted-2 hover:text-flag-attention"
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
