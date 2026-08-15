"use client";

import { useMemo, useState } from "react";
import { addSegment, SpeakerRoleLabel } from "@/lib/segment-actions";
import { createPerson } from "@/lib/person-actions";
import { serializeUtterances } from "@/lib/segment-text";
import { PersonBrief, Utterance } from "@/lib/types";
import { SourceOption } from "@/lib/db";
import { EventOption } from "./EventPicker";
import { SpeakerOption, UtteranceDraft, UtteranceEditor } from "./UtteranceEditor";

// 구술 추가. 구술 목록 위에서 열리고, 구술이 구술인 이유를 다 받는다 — 어느 책 몇 쪽에서
// 왔는지, 누가 묻고 누가 답했는지, 원본에 각주가 어디에 달려 있었는지.
//
// 맨 위가 사건 연결이다. 사료든 구술이든 자료끼리 바로 잇지 않고 늘 사건을 가운데 두는데,
// 그 사건을 맨 아래 긴 목록에서 찾게 하면 다 적고 나서야 "어디에 붙이지" 하고 헤매게 된다.
// 여기서는 이름으로 좁혀 고르고, 고르지 않으면 [보류]로 저장해 사료 연결의 보류함으로 보낸다.
//
// 신상은 이름과 소속까지만 받는다(person-actions.ts에 이유를 적어 두었다).

// 너비는 쓰는 쪽에서 정한다 — w-full을 기본에 넣어 두면 좁게 쓰고 싶은 칸에서
// w-24 같은 것을 덧붙여도 어느 쪽이 이길지 알 수 없다(같은 특이도라 순서 문제가 된다).
const INPUT_BASE =
  "border border-line-strong bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-muted-2 focus:border-foreground focus:outline-none";

const INPUT_CLASSNAME = `w-full ${INPUT_BASE}`;

const LABEL_CLASSNAME =
  "mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-2";

const SECTION_TITLE_CLASSNAME =
  "mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-foreground";

const EMPTY_SOURCE = { title: "", creator: "", publisher: "", url: "" };

export function OralIntakeForm({
  persons,
  sources,
  events,
  onClose,
}: {
  persons: PersonBrief[];
  sources: SourceOption[];
  events: EventOption[];
  onClose: () => void;
}) {
  const [sourceMode, setSourceMode] = useState<"existing" | "new">("new");
  const [sourceId, setSourceId] = useState("");
  const [source, setSource] = useState(EMPTY_SOURCE);
  const [page, setPage] = useState("");

  // 구술자와 면담자를 따로 들고 있다 — 한 칸에 역할 스위치를 두면 누구를 넣는 중인지
  // 매번 확인해야 하고, 구술자가 둘일 때 목록이 뒤섞인다.
  const [narrators, setNarrators] = useState<SpeakerOption[]>([]);
  const [interviewers, setInterviewers] = useState<SpeakerOption[]>([]);
  const [people, setPeople] = useState<PersonBrief[]>(persons);

  const [utterances, setUtterances] = useState<UtteranceDraft[]>([{ speakerId: null, text: "" }]);
  const [notes, setNotes] = useState<string[]>([]);
  const [dateValue, setDateValue] = useState("");
  const [keywords, setKeywords] = useState("");
  const [eventId, setEventId] = useState<string | null>(null);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const selectedEvent = events.find((e) => e.id === eventId) ?? null;
  const roster = useMemo(() => [...narrators, ...interviewers], [narrators, interviewers]);

  // 첫 화자가 정해지면 비어 있던 첫 줄이 그 사람 말이 되게 한다 — 지문으로 시작하는 구술은 드물다.
  function seedFirstLine(speakerId: string) {
    setUtterances((rows) =>
      rows.length === 1 && rows[0].speakerId === null && rows[0].text === ""
        ? [{ speakerId, text: "" }]
        : rows,
    );
  }

  function removeSpeaker(id: string, role: SpeakerRoleLabel) {
    const setter = role === "구술자" ? setNarrators : setInterviewers;
    setter((prev) => prev.filter((s) => s.id !== id));
    setUtterances((rows) => rows.map((r) => (r.speakerId === id ? { ...r, speakerId: null } : r)));
  }

  function addFootnote() {
    setNotes((prev) => [...prev, ""]);
    return notes.length + 1;
  }

  async function save(intent: "link" | "hold") {
    const speakerById = new Map(roster.map((s) => [s.id, s]));
    const utteranceList: Utterance[] = utterances.map(({ speakerId, text }) => {
      const speaker = speakerId ? speakerById.get(speakerId) : undefined;
      if (!speaker) return { role: "stage", text };
      return {
        role: speaker.role === "면담자" ? "interviewer" : "narrator",
        text,
        speaker: speaker.name,
      };
    });

    const segmentText = serializeUtterances(utteranceList);
    if (!segmentText) {
      setError("구술 본문을 입력하세요.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      await addSegment({
        dateValue,
        segmentText,
        page,
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        speakers: roster.map((s) => ({ personId: s.id, role: s.role })),
        noteList: notes,
        sourceId: sourceMode === "existing" ? sourceId || null : null,
        sourceDraft: sourceMode === "new" ? source : null,
        eventId: intent === "link" ? eventId : null,
      });

      setSavedNote(
        intent === "link" && selectedEvent
          ? `${selectedEvent.year} ${selectedEvent.eventName}에 연결됨`
          : "보류함에 저장됨 — 사료 연결 화면에서 사건에 붙일 수 있습니다",
      );
      // 같은 면담에서 발췌를 여러 개 뜨는 게 보통이라 사건·출처·화자는 남긴다.
      setUtterances([{ speakerId: narrators[0]?.id ?? null, text: "" }]);
      setNotes([]);
      setPage("");
      setKeywords("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(eventId ? "link" : "hold");
      }}
      className="mb-6 flex flex-col gap-7 border border-line-strong bg-surface p-4"
    >
      {/* ① 어느 사건 이야기인가 — 맨 위에 둔다 */}
      <EventField events={events} selectedId={eventId} onSelect={setEventId} />

      {/* ② 어디서 왔나 */}
      <section>
        <div className="mb-2 flex items-baseline gap-3">
          <h3 className={`${SECTION_TITLE_CLASSNAME} mb-0`}>출처</h3>
          <button
            type="button"
            onClick={() => setSourceMode((m) => (m === "new" ? "existing" : "new"))}
            className="font-mono text-[10px] text-muted-2 hover:text-foreground"
          >
            {sourceMode === "new" ? "이미 등록된 출처에서 고르기" : "새 출처 적기"}
          </button>
        </div>

        {sourceMode === "existing" ? (
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className={INPUT_CLASSNAME}
          >
            <option value="">— 고르지 않음 —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {s.creator ? ` · ${s.creator}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className={LABEL_CLASSNAME}>제목</span>
              <input
                type="text"
                value={source.title}
                onChange={(e) => setSource({ ...source, title: e.target.value })}
                placeholder="책·보고서·구술자료집 제목"
                className={INPUT_CLASSNAME}
              />
            </label>
            <label>
              <span className={LABEL_CLASSNAME}>저자</span>
              <input
                type="text"
                value={source.creator}
                onChange={(e) => setSource({ ...source, creator: e.target.value })}
                placeholder="엮은이·채록자"
                className={INPUT_CLASSNAME}
              />
            </label>
            <label>
              <span className={LABEL_CLASSNAME}>발행기관</span>
              <input
                type="text"
                value={source.publisher}
                onChange={(e) => setSource({ ...source, publisher: e.target.value })}
                placeholder="펴낸 곳"
                className={INPUT_CLASSNAME}
              />
            </label>
            <label className="sm:col-span-2">
              <span className={LABEL_CLASSNAME}>원문 주소</span>
              <input
                type="text"
                value={source.url}
                onChange={(e) => setSource({ ...source, url: e.target.value })}
                placeholder="온라인에 있으면 (없으면 비움)"
                className={INPUT_CLASSNAME}
              />
            </label>
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label>
            <span className={LABEL_CLASSNAME}>쪽</span>
            <input
              type="text"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder="127, 127-129"
              className={INPUT_CLASSNAME}
            />
          </label>
          <label>
            <span className={LABEL_CLASSNAME}>면담 일자</span>
            <input
              type="text"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              placeholder="1963, 1963-05"
              className={INPUT_CLASSNAME}
            />
          </label>
          <label>
            <span className={LABEL_CLASSNAME}>키워드 (쉼표로 구분)</span>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="청계천, 복개"
              className={INPUT_CLASSNAME}
            />
          </label>
        </div>
      </section>

      {/* ③ 누가 묻고 누가 답했나 — 역할마다 칸이 따로다 */}
      <div className="grid gap-5 sm:grid-cols-2">
        <SpeakerField
          role="구술자"
          speakers={narrators}
          people={people}
          onAdd={(s) => {
            setNarrators((prev) => [...prev, s]);
            seedFirstLine(s.id);
          }}
          onRemove={(id) => removeSpeaker(id, "구술자")}
          onCreated={(person) => setPeople((prev) => [...prev, person])}
        />
        <SpeakerField
          role="면담자"
          speakers={interviewers}
          people={people}
          onAdd={(s) => setInterviewers((prev) => [...prev, s])}
          onRemove={(id) => removeSpeaker(id, "면담자")}
          onCreated={(person) => setPeople((prev) => [...prev, person])}
        />
      </div>

      {/* ④ 본문 */}
      <UtteranceEditor
        speakers={roster}
        utterances={utterances}
        onChange={setUtterances}
        onAddFootnote={addFootnote}
      />

      {/* ⑤ 각주 — 본문에 박은 번호와 짝이 맞는다 */}
      <NoteList notes={notes} onChange={setNotes} />

      {error && <p className="font-mono text-[11px] text-flag-attention">{error}</p>}
      {savedNote && !error && (
        <p className="font-mono text-[11px] font-semibold text-flag-marked">
          ✓ {savedNote} — 사건·출처·화자는 그대로 두었습니다. 이어서 다음 발췌를 넣으세요.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !eventId}
          className="border border-foreground bg-foreground px-3 py-1.5 font-mono text-[12px] font-bold text-background hover:bg-surface hover:text-foreground disabled:border-line disabled:bg-surface disabled:text-muted-2"
        >
          {pending
            ? "저장 중…"
            : selectedEvent
              ? `${selectedEvent.year} ${selectedEvent.eventName}에 연결하고 저장`
              : "맨 위에서 사건을 고르세요"}
        </button>
        <button
          type="button"
          onClick={() => void save("hold")}
          disabled={pending}
          className="border border-line-strong px-3 py-1.5 font-mono text-[12px] font-semibold text-muted hover:border-foreground hover:text-foreground disabled:text-muted-2"
        >
          보류
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="font-mono text-[11px] text-muted-2 hover:text-foreground"
        >
          닫기
        </button>
      </div>
    </form>
  );
}

// 사건 고르기. 90건이 넘는 목록을 통째로 펼쳐 두면 자리만 먹고 눈으로 훑기도 어려워,
// 이름으로 좁혀 고르고 고른 뒤에는 한 줄로 접힌다.
function EventField({
  events,
  selectedId,
  onSelect,
}: {
  events: EventOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);

  const selected = events.find((e) => e.id === selectedId) ?? null;
  const matches = useMemo(() => {
    const q = filter.trim();
    if (!q) return events.slice(0, 8);
    return events.filter((e) => e.eventName.includes(q) || e.year.includes(q)).slice(0, 8);
  }, [events, filter]);

  if (selected) {
    return (
      <section>
        <h3 className={SECTION_TITLE_CLASSNAME}>사건 연결</h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 bg-foreground px-2.5 py-1 font-mono text-[12px] font-bold text-background">
            <span className="tabular-nums opacity-70">{selected.year}</span>
            {selected.eventName}
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setFilter("");
              }}
              title="사건 고르기 취소"
              className="opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </span>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h3 className={SECTION_TITLE_CLASSNAME}>사건 연결</h3>
      <input
        type="text"
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="이 구술이 말하는 사건 — 이름이나 연도로 찾기"
        className={`${INPUT_CLASSNAME} max-w-lg`}
      />

      {open && (
        <ul className="mt-1 max-w-lg border border-line-strong bg-background">
          {matches.length === 0 ? (
            <li className="px-2.5 py-2 font-mono text-[11px] text-muted-2">걸리는 사건이 없습니다.</li>
          ) : (
            matches.map((event) => (
              <li key={event.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    onSelect(event.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left hover:bg-surface"
                >
                  <span className="font-mono text-[10px] tabular-nums text-muted-2">{event.year}</span>
                  <span className="text-[12px] font-semibold text-foreground">{event.eventName}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      <p className="mt-1 text-[11px] text-muted-2">
        고르지 않고 [보류]로 저장하면 사료 연결 화면의 보류함에 쌓입니다.
      </p>
    </section>
  );
}

// 한 역할(구술자 또는 면담자)의 명단. 이름을 직접 치면 되고, 이미 등록된 사람이면
// 목록에서 골라 같은 인물로 이어 붙는다. 여럿이면 구술자 1, 구술자 2로 쌓인다.
function SpeakerField({
  role,
  speakers,
  people,
  onAdd,
  onRemove,
  onCreated,
}: {
  role: SpeakerRoleLabel;
  speakers: SpeakerOption[];
  people: PersonBrief[];
  onAdd: (speaker: SpeakerOption) => void;
  onRemove: (id: string) => void;
  onCreated: (person: PersonBrief) => void;
}) {
  const [name, setName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listId = `people-${role}`;

  async function handleAdd() {
    const typed = name.trim();
    if (!typed) {
      setError("이름을 입력하세요.");
      return;
    }
    setError(null);

    // 같은 이름이 이미 전거에 있으면 그 사람으로 잇는다 — 같은 사람을 두 번 만들지 않는다.
    const existing = people.find((p) => p.name === typed);
    if (existing) {
      if (speakers.some((s) => s.id === existing.id)) {
        setError("이미 명단에 있습니다.");
        return;
      }
      onAdd({ id: existing.id, name: existing.name, role });
      setName("");
      setAffiliation("");
      return;
    }

    setPending(true);
    try {
      const person = await createPerson({ name: typed, affiliation, role });
      onCreated(person);
      onAdd({ id: person.id, name: person.name, role });
      setName("");
      setAffiliation("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h3 className={SECTION_TITLE_CLASSNAME}>{role}</h3>

      {speakers.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {speakers.map((s, i) => (
            <li
              key={s.id}
              className={`flex items-center gap-1.5 px-2 py-0.5 font-mono text-[11px] font-bold ${
                role === "면담자" ? "bg-emerald-600 text-white" : "bg-foreground text-background"
              }`}
            >
              <span className="opacity-70">
                {role} {i + 1}
              </span>
              <span>{s.name}</span>
              <button
                type="button"
                onClick={() => onRemove(s.id)}
                title="명단에서 빼기"
                className="opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          {/* datalist라 직접 쳐도 되고 등록된 인물에서 골라도 된다 */}
          <input
            type="text"
            list={listId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAdd();
              }
            }}
            placeholder={`${role} 이름`}
            className={`${INPUT_BASE} min-w-0 flex-1`}
          />
          <datalist id={listId}>
            {people.map((p) => (
              <option key={p.id} value={p.name}>
                {p.affiliation ?? ""}
              </option>
            ))}
          </datalist>
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className="shrink-0 border border-line-strong px-2.5 py-1.5 font-mono text-[11px] font-semibold text-foreground hover:bg-foreground hover:text-background disabled:text-muted-2"
          >
            {pending ? "…" : "추가"}
          </button>
        </div>

        <input
          type="text"
          value={affiliation}
          onChange={(e) => setAffiliation(e.target.value)}
          placeholder="소속·직위 (새 인물일 때만, 예: ㅇㅇ대학교 문화인류학과 교수)"
          className={INPUT_CLASSNAME}
        />

        {error && <span className="font-mono text-[11px] text-flag-attention">{error}</span>}
      </div>
    </section>
  );
}

// 각주는 본문에 박은 "1)" 표시와 번호로 짝을 맞춘다. 표시를 넣으면 여기 칸이 하나 생기고,
// 칸을 지우면 뒤 번호가 당겨지므로 본문 표시도 함께 고쳐야 한다 — 그래서 지우기는
// 맨 뒤 것만 열어 둔다.
function NoteList({ notes, onChange }: { notes: string[]; onChange: (next: string[]) => void }) {
  if (notes.length === 0) {
    return (
      <section>
        <h3 className={SECTION_TITLE_CLASSNAME}>각주</h3>
        <p className="border border-dashed border-line px-3 py-4 text-center text-[12px] text-muted-2">
          본문에서 각주를 달 자리에 커서를 두고 [+ 각주 표시]를 누르면 “1)”이 박히고 여기에
          칸이 생깁니다.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h3 className={SECTION_TITLE_CLASSNAME}>각주</h3>
      <ul className="flex flex-col gap-1.5">
        {notes.map((note, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-2 w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-2">
              {i + 1})
            </span>
            <textarea
              value={note}
              onChange={(e) => onChange(notes.map((n, j) => (j === i ? e.target.value : n)))}
              rows={1}
              placeholder="원본에 달려 있던 주석 — 채록·편집 과정의 보충 설명이나 정정"
              className={`${INPUT_CLASSNAME} resize-y`}
            />
            {i === notes.length - 1 && (
              <button
                type="button"
                onClick={() => onChange(notes.slice(0, -1))}
                title="마지막 각주 지우기 (본문의 표시도 지우세요)"
                className="mt-2 shrink-0 font-mono text-[11px] text-muted-2 hover:text-flag-attention"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
