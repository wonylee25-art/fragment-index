import { PaperData } from "@/lib/types";

// RISS에서 받아오는 주제어는 논문마다 저자가 적은 그대로라, 같은 것을 두고 표기가 갈린다.
// 원본(papers.keywords)은 건드리지 않고, 읽을 때만 대표어로 묶어 보여준다 — 여기서 한 줄
// 지우면 그대로 다시 갈라지고, RISS를 다시 받아도 정리가 깨지지 않는다.
//
// 「변형 → 대표」. 뜻으로 합치는 것은 자동으로 가릴 수 없어(「생애사」와 「학습 생애사」는
// 겹치지만 다른 것이다) 사람이 골라 여기 적는다. 재편할 때마다 이 표에 줄을 더한다.
export const KEYWORD_ALIASES: Record<string, string> = {
  농촌여성노인: "농촌 여성",
};

// 띄어쓰기만 다른 표기는 사람이 적지 않아도 묶인다 — 공백을 지운 형태가 같으면 한 덩이로 본다.
function spacingKey(keyword: string): string {
  return keyword.replace(/\s+/g, "").toLowerCase();
}

// 저자가 뜻을 밝히려고 붙인 번역 — 「구술사(Oral History)」, 「Oral history(구술사)」처럼
// 한쪽이 다른 쪽의 번역일 때 괄호를 걷어 한 이름으로 만든다. 괄호 안이 라틴문자로만 되어
// 있으면 그 앞이 대표어이고, 앞이 라틴문자로만 되어 있으면 괄호 안이 대표어다.
//
// 괄호 안이 한글이면 번역이 아니라 뜻을 좁히는 말일 수 있어(「사이구(LA 폭동)」) 건드리지
// 않는다. 괄호가 닫히지 않은 것(「행위주체성(agency」)도 그대로 둔다 — RISS에서 잘려 들어온
// 것이라 어디까지가 이름인지 알 수 없다.
const LATIN_ONLY = /^[A-Za-z0-9\s.,'’\-&/]+$/;

function stripGloss(keyword: string): string {
  const m = keyword.match(/^(.+?)\s*\(([^()]+)\)$/);
  if (!m) return keyword;
  const [, head, inside] = m;
  if (LATIN_ONLY.test(inside) && !LATIN_ONLY.test(head)) return head.trim();
  if (LATIN_ONLY.test(head) && !LATIN_ONLY.test(inside)) return inside.trim();
  return keyword;
}

// 주제어 하나하나에 대표어를 달아 준다. 대표어를 고르는 순서는,
//   1. 별칭 표에 적혀 있으면 그것
//   2. 번역 괄호를 걷어낸 형태
//   3. 공백을 지운 형태가 같은 것들끼리 묶고, 그중 편수가 가장 많은 표기
//      (생애사 연구 131편 ← 생애사연구 25편). 편수가 같으면 먼저 나온 것.
export function buildCanonicalMap(papers: PaperData[]): Map<string, string> {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const paper of papers) {
    for (const keyword of paper.keywords) {
      if (!counts.has(keyword)) order.push(keyword);
      counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
    }
  }

  // 별칭 표와 번역 괄호를 먼저 적용해 두고, 남은 것끼리 띄어쓰기로 묶는다. 앞 단계가 만들어
  // 낸 이름이 또 다른 표기와 띄어쓰기만 다를 수 있어(농촌여성노인 → 농촌 여성) 단계를 잇는다.
  const aliased = new Map<string, string>();
  for (const keyword of order) {
    aliased.set(keyword, stripGloss(KEYWORD_ALIASES[keyword] ?? keyword));
  }

  // 띄어쓰기 덩이마다 대표 표기를 고른다. 앞 단계가 만들어 낸 이름은 원본에 없을 수도 있어,
  // 표기 자체의 편수가 아니라 그 이름으로 모이는 편수를 다 더해 견준다 — 그래야 「구술사」가
  // 「구술사(Oral History)」를 제치고 대표가 된다.
  const weight = new Map<string, number>();
  for (const keyword of order) {
    const target = aliased.get(keyword)!;
    weight.set(target, (weight.get(target) ?? 0) + (counts.get(keyword) ?? 0));
  }

  const best = new Map<string, string>();
  for (const keyword of order) {
    const target = aliased.get(keyword)!;
    const key = spacingKey(target);
    const current = best.get(key);
    if (!current || (weight.get(target) ?? 0) > (weight.get(current) ?? 0)) {
      best.set(key, target);
    }
  }

  const canonical = new Map<string, string>();
  for (const keyword of order) {
    canonical.set(keyword, best.get(spacingKey(aliased.get(keyword)!))!);
  }
  return canonical;
}

// 한 논문의 주제어를 대표어로 바꾸고 중복을 없앤다 — 「농촌 여성」과 「농촌여성노인」이 둘 다
// 붙은 논문에서 같은 칩이 두 번 나오면 안 된다. 나온 차례는 그대로 둔다.
export function canonicalKeywords(keywords: string[], canonical: Map<string, string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const keyword of keywords) {
    const target = canonical.get(keyword) ?? keyword;
    if (seen.has(target)) continue;
    seen.add(target);
    out.push(target);
  }
  return out;
}
