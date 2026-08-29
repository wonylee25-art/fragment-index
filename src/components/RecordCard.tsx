"use client";

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArchiveItemType } from "@/lib/types";
import { formatEdtfToKorean } from "@/lib/edtf";
import { ARCHIVE_ITEM_HUE, archiveTintStyle, RECORD_CELL_CLASSNAME, RECORD_LINE_CLASSNAME } from "@/lib/design-tokens";

// 사료가 서는 카드 한 벌. 편집 「사료」의 위(검색 결과)와 아래(보류함)가 함께 쓴다 —
// 같은 자료가 한 화면에서 위아래로 다르게 생겼으면, 담기 전과 담은 뒤가 다른 자료처럼 보인다.
//
// 카드는 서식(form)이다 — 선이 칸을 나누고, 칸마다 무엇이 적히는지 이름표가 붙는다.
// 장식이 아니라 읽는 순서다: 어느 기관 언제 것이냐(머리칸) → 무엇이냐(표제) → 무슨
// 이야기냐(발췌) → 어디까지 손봤냐(바닥칸). 칸 여백은 design-tokens가 들고 있다
// (서버 컴포넌트도 같은 칸을 그려야 해서 — 그쪽 주석 참고).
const CELL_CLASSNAME = RECORD_CELL_CLASSNAME;

// 이름표. 라틴 소문자와 우리말을 나란히 둔다 — 값과 섞이지 않게 아주 작고 자간만 넓다.
export function FieldLabel({ en, ko }: { en: string; ko: string }) {
  return (
    <p className="font-mono text-[8.5px] uppercase leading-none tracking-[0.18em] text-grey">
      {en} <span className="tracking-normal">{ko}</span>
    </p>
  );
}

// 카드 위로 솟은 꼭다리. 서류철 탭이 그렇듯 접힌 채로도 그것이 무엇인지 — 신문이냐 문서냐
// 박물이냐 — 를 알린다. 자료 유형은 카드를 열어 볼지 말지를 가르는 첫 잣대라, 서식 안이
// 아니라 서식 밖으로 나와 있어야 훑는 눈에 먼저 걸린다.
//
// 유형을 가르는 것은 색이 아니라 자리다. 서류철에서 탭을 층층이 어긋나게 꽂는 것과 같은
// 이치로, 유형마다 꼭다리가 서는 가로 자리가 다르다 — 격자를 훑으면 같은 자리에 선 것들이
// 같은 유형으로 묶여 보인다. 색을 쓰지 않는 것은 이 화면의 규칙이다(globals.css): 색은
// 사람이 손댄 흔적이고, 자료가 스스로 말하는 것(유형·날짜·출처)은 색을 갖지 않는다.
//
// 사다리꼴은 clip-path 두 겹으로 만든다 — 자른 면에는 테두리가 남지 않으므로, 테두리 색
// 판을 깔고 그 위에 1px 안쪽으로 바탕색 판을 얹어 테두리처럼 보이게 한다.
const TAB_SHAPE_CLASSNAME = "[clip-path:polygon(0_0,calc(100%-9px)_0,100%_100%,0_100%)]";

// 꼭다리가 서는 자리. 자주 들어오는 유형을 왼쪽부터 둔다 — 신문 아흔 건이 맨 왼쪽에
// 가지런히 서고, 드문 유형일수록 오른쪽에서 눈에 띈다.
const TAB_SLOT: Record<ArchiveItemType, number> = {
  신문: 0,
  문서: 1,
  박물: 2,
  구술: 3,
  이미지: 4,
  영상: 5,
  음원: 6,
  학술: 7,
  지도: 8,
};

export function TypeTab({ type, strength = 0 }: { type?: ArchiveItemType; strength?: number }) {
  const slot = type ? TAB_SLOT[type] : 0;
  const hue = type ? ARCHIVE_ITEM_HUE[type] : null;
  return (
    <div
      className="relative h-[17px] w-fit"
      // 칸 폭이 얼마든 자리 비율은 같게 — 좁은 화면에서도 유형별 층이 유지된다.
      style={{ marginLeft: `${slot * 9}%` }}
    >
      <div aria-hidden className={`absolute inset-0 bg-line ${TAB_SHAPE_CLASSNAME}`} />
      <div
        aria-hidden
        className={`absolute inset-x-px top-px bottom-0 bg-background ${TAB_SHAPE_CLASSNAME}`}
        // 꼭다리는 카드보다 한 단 진하다 — 솟은 부분이 먼저 눈에 걸려야 유형이 읽힌다.
        style={hue ? archiveTintStyle(hue, strength + 1) : undefined}
      />
      <span className="relative block pl-2 pr-3.5 font-mono text-[9.5px] font-bold leading-[17px] tracking-[0.14em] text-ink">
        {type || "사료"}
      </span>
    </div>
  );
}

// 머리칸. 신문 지면 스캔은 가져올 수 없다 — 네이버 뉴스라이브러리는 robots.txt가 전면
// 금지고, 지면 이미지는 언론사 저작물이라 재호스팅할 것도 아니다. 그렇다고 "이미지 없음"
// 상자를 아흔 개 세우면 목록이 빈칸의 행렬이 된다. 가진 것(기관·날짜)을 서식의 첫 줄로
// 짜 넣으면 스캔이 주던 정보 — 어디 것이 언제 것이냐 — 는 그대로 남고, 빈 상자는 사라진다.
export function HeadRow({
  sourceOrg,
  itemType,
  dateValue,
  dateText,
  checkbox,
}: {
  sourceOrg?: string;
  itemType?: ArchiveItemType;
  // 자료 자체의 연대(EDTF). 검색 결과처럼 EDTF가 아직 없는 자리는 dateText로 그대로 적는다
  // (국가기록원 생산연도가 그렇다 — "1968"만 오고 월·일이 없다).
  dateValue?: string;
  dateText?: string;
  checkbox?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 items-stretch border-b border-ink">
      {checkbox && (
        <div className={`flex items-center border-r px-2 ${RECORD_LINE_CLASSNAME}`}>{checkbox}</div>
      )}
      <div className={`min-w-0 flex-1 ${CELL_CLASSNAME}`}>
        <FieldLabel en="source" ko="출처" />
        <p className="mt-0.5 truncate text-[11.5px] font-extrabold tracking-tight text-ink">
          {sourceOrg || itemType || "사료"}
        </p>
      </div>
      <div className={`shrink-0 border-l text-right ${RECORD_LINE_CLASSNAME} ${CELL_CLASSNAME}`}>
        <FieldLabel en="date" ko="날짜" />
        <p className="mt-0.5 font-mono text-[10.5px] tabular-nums text-ink">
          {dateValue ? formatEdtfToKorean(dateValue) : dateText || "연도 미상"}
        </p>
      </div>
    </div>
  );
}

// 덧창은 카드보다 넓게 편다. 260px 칸에서 기사 본문을 읽으면 한 줄이 열몇 자라 토막난다.
const OVERLAY_WIDTH_PX = 432;

// 바닥칸 손잡이 한 벌. 세 화면(검색 결과·DB 사료·세 함)의 카드가 똑같이 이 줄을 단다 —
// 같은 자료가 화면마다 다른 손잡이를 달고 있으면, 무엇을 할 수 있는지 매번 다시 읽어야 한다.
//
//   사건 연결 / 미연결 / 보류                    원문보기
//
// 세 손잡이는 누르는 자리이면서 동시에 지금 어디에 있는지를 알린다 — 칠해진 것이 이 사료가
// 지금 선 함이다. 그래서 "미연결 001/103" 같은 상태 줄을 따로 두지 않는다.
export const FOOT_BUTTON_CLASSNAME =
  "shrink-0 border px-1.5 py-0.5 font-mono text-[10px] font-bold transition-colors";

export function footButtonClass(on: boolean): string {
  return `${FOOT_BUTTON_CLASSNAME} ${
    on ? "border-ink bg-ink text-background" : "border-line text-ink hover:border-ink"
  }`;
}

// 카드 겉. 크기가 고정이고, 펼친 것은 카드 위에 덧창으로 얹힌다 — 펼친 것이 격자를 밀어내면
// 접었을 때 눈이 보던 카드가 어디로 갔는지 알 수 없다.
// 덧창을 무엇 하러 열었나. 읽으러 열었으면 본문이, 붙이러 열었으면 사건 고르기가 먼저 선다.
export type OverlayMode = "read" | "link";

export function CardShell({
  itemType,
  strength = 0,
  heightClassName,
  head,
  foot,
  sourceUrl,
  overlay,
  children,
}: {
  itemType?: ArchiveItemType;
  // 얼마나 걸린 자료인지(0~3). 사건에 많이 붙었거나 찾던 말과 많이 겹칠수록 종이가 진해진다 —
  // 옅은 쪽에 아직 손대지 않은 것이 모여 보이는 것이 이 화면에서 가장 필요한 정보다.
  strength?: number;
  // 카드 키. 발췌 칸이 서는 함은 크고, 담을지만 정하는 검색 결과는 낮다.
  heightClassName: string;
  // 머리칸. 여는 단추 밖에 선다 — 안에 체크박스가 들어 있어서, 단추로 감싸면 고르려고
  // 누른 것이 덧창까지 열어버린다(단추 안의 단추는 HTML에서도 어긋난 짜임이다).
  head: ReactNode;
  // 바닥칸 왼쪽의 세 손잡이. 덧창을 여닫는 것도 이 안에서 하므로 여는 손잡이를 함께 넘긴다.
  foot: (control: { open: boolean; toggle: () => void; openLink: () => void }) => ReactNode;
  sourceUrl?: string;
  // 덧창에 담기는 것. 읽는 일과 붙이는 일이 한 자리에서 끝나야 해서 둘 다 여기 들어가되,
  // 무엇을 하러 열었는지에 따라 먼저 서는 것이 다르다(mode) — [사건 연결]로 열면 사건
  // 고르기가 위에 펼쳐진 채 서고, 표제·발췌를 눌러 열면 본문이 먼저 선다.
  overlay: (mode: OverlayMode) => ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<OverlayMode>("read");
  // 오른쪽 끝 칸에서는 덧창이 화면 밖으로 나간다 — 그 칸만 오른쪽에 맞춰 편다. 칸 수는
  // 화면 폭이 정하므로 셈해 두지 않고, 열 때 카드가 실제로 선 자리를 재서 정한다.
  const [flip, setFlip] = useState(false);
  // 덧창이 카드 머리에서 얼마나 내려앉는지(px). 기본은 0 — 카드 자리에서 그대로 편다.
  // 아래쪽 카드에서는 그대로 펴면 창 밖으로 자라 끝이 잘리는데, 그 아래를 보려고 굴리면
  // 페이지가 밀리고 덧창은 카드에 매달려 함께 움직여서 잘린 끝에 영영 닿지 못한다.
  // 그래서 창 안에 들어오도록 위로 끌어올린다(키는 아래 max-h가 창보다 크지 않게 잡는다).
  const [offsetTop, setOffsetTop] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // 읽으러 열기 — 표제·발췌를 누른 자리.
  const toggle = () => {
    setMode("read");
    setOpen((v) => !(v && mode === "read"));
  };
  // 붙이러 열기 — 바닥칸 [사건 연결].
  const openLink = () => {
    setOpen((v) => !(v && mode === "link"));
    setMode("link");
  };

  useLayoutEffect(() => {
    if (!open || !cardRef.current || !overlayRef.current) return;
    const card = cardRef.current.getBoundingClientRect();
    setFlip(card.left + OVERLAY_WIDTH_PX > window.innerWidth - 16);
    const height = overlayRef.current.offsetHeight;
    // top은 카드 겉이 아니라 덧창이 매달린 상자(서식 칸) 기준이다 — 그 위에 꼭다리가
    // 얹혀 있어 겉의 좌표로 셈하면 꼭다리 높이만큼 어긋난다.
    const host = (overlayRef.current.offsetParent as HTMLElement | null) ?? cardRef.current;
    const hostTop = host.getBoundingClientRect().top;
    const highest = 8 - hostTop; // 이보다 올리면 창 위로 넘는다
    const lowest = window.innerHeight - 8 - height - hostTop; // 이보다 내리면 창 아래로 넘는다
    setOffsetTop(Math.round(Math.min(Math.max(0, highest), Math.max(highest, lowest))));
  }, [open, mode]);

  // 덧창은 옆 카드를 덮으므로 닫는 길이 여럿이어야 한다 — 바깥을 누르거나 Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    // 겉은 꼭다리와 서식을 함께 묶기만 한다 — 덧창은 서식(아래 칸)에 매달려서, 열려 있는
    // 동안에도 꼭다리는 덧창 위로 그대로 보인다(서류철에서 꺼내 편 것처럼).
    <div ref={cardRef} className={`flex flex-col ${open ? "relative z-30" : ""}`}>
      <TypeTab type={itemType} strength={strength} />
      <div
        className={`relative flex flex-col border ${heightClassName} ${
          open ? "overflow-visible border-ink" : "overflow-hidden border-line hover:border-ink"
        }`}
        style={itemType ? archiveTintStyle(ARCHIVE_ITEM_HUE[itemType], strength) : undefined}
      >
        {head}

        {/* 표제와 발췌를 누르면 덧창이 열린다 — 읽으려고 누르는 자리가 곧 여는 자리다.
            바닥칸의 [사건 연결]도 같은 덧창을 연다(거기서 사건을 고르므로). */}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? "덧창 닫기" : "펼쳐 읽기"}
          className="flex min-h-0 flex-1 cursor-pointer flex-col text-left"
        >
          {children}
        </button>

        <div className="mt-auto flex shrink-0 items-center justify-between gap-2 border-t border-ink">
          <div className={`flex min-w-0 items-center gap-1 ${CELL_CLASSNAME}`}>
            {foot({ open, toggle, openLink })}
          </div>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              // 칸 높이를 다 쓰는 자리라, 글자는 그 칸 가운데에 놓는다 — 위로 붙어 있으면
              // 왼쪽 버튼들과 눈높이가 어긋나 줄이 기울어 보인다.
              className={`flex shrink-0 items-center justify-center self-stretch border-l ${RECORD_LINE_CLASSNAME} font-mono text-[10px] text-grey underline decoration-dotted underline-offset-4 hover:bg-surface hover:text-ink ${CELL_CLASSNAME}`}
            >
              원문보기 ↗
            </a>
          )}
        </div>

        {/* 덧창 — 이 카드 자리에서 시작해 아래로 자란다. 카드와 같은 서식이라 같은 종이의
            펼친 면처럼 읽힌다. */}
        {open && (
          <div
            ref={overlayRef}
            // 키는 창을 넘지 않는다 — 넘으면 잘린 부분이 스크롤로도 닿지 않는다.
            // overscroll-contain은 덧창 끝까지 굴렸을 때 그 힘이 페이지로 넘어가지 않게 한다:
            // 페이지가 밀리면 카드가 움직이고 덧창도 따라가 읽던 자리를 잃는다.
            style={{ top: offsetTop }}
            className={`absolute z-30 flex max-h-[min(34rem,calc(100vh-1rem))] w-[432px] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto overscroll-contain border border-ink bg-background shadow-[6px_6px_0_rgba(26,26,24,0.10)] ${
              flip ? "right-0" : "left-0"
            }`}
          >
            <div className="flex justify-end border-b border-line">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="덧창 닫기"
                className="border-l border-line px-2 py-1 font-mono text-[11px] font-bold text-grey hover:bg-surface hover:text-ink"
              >
                ✕
              </button>
            </div>
            {overlay(mode)}
          </div>
        )}
      </div>
    </div>
  );
}
