import { PaperData } from "@/lib/types";

// RISS에서 받아오는 주제어는 논문마다 저자가 적은 그대로라, 같은 것을 두고 표기가 갈린다.
// 원본(papers.keywords)은 건드리지 않고, 읽을 때만 대표어로 묶어 보여준다 — 여기서 한 줄
// 지우면 그대로 다시 갈라지고, RISS를 다시 받아도 정리가 깨지지 않는다.
//
// 「변형 → 대표」. 뜻으로 합치는 것은 자동으로 가릴 수 없어(「생애사」와 「학습 생애사」는
// 겹치지만 다른 것이다) 사람이 골라 여기 적는다. 재편할 때마다 이 표에 줄을 더한다.
export const KEYWORD_ALIASES: Record<string, string> = {
  농촌여성노인: "농촌 여성",

  // 영문과 한글이 괄호 없이 한 칸에 뭉쳐 들어온 것. 규칙으로는 어디까지가 이름인지 가릴 수
  // 없어 논문마다 나머지 주제어를 보고 정했다 — 이미 붙어 있는 이름과 겹치면 그쪽을 살리고,
  // 아니면 남는 뜻을 대표로 삼는다.
  "생애사life history": "생애사",
  "실천학습 life history": "실천학습", // 이 논문에는 「생애사」가 따로 붙어 있다
  "Life history 알코올중독": "알코올중독", // 여기도 「생애사」가 따로 있다
  "생애사 연구 Development of teachers": "생애사 연구",
  "구술사 인터뷰 History-retelling": "구술사 인터뷰",
  "여가 및 학습경험 middle-aged": "여가 및 학습경험",
  "케이팝 K-pop": "케이팝",

  // 생애사 분석법은 누구의 것이냐로 갈린다. 로마자와 한글, 「분석」과 「연구」와 「접근」으로
  // 갈래가 나 있던 것을 사람 이름으로 모은다 — 방법을 부르는 이름이 곧 그 사람이다.
  "만델바움 생애사": "만델바움",
  "만델바움의 생애사연구": "만델바움",
  "Mandelbaum 생애사분석": "만델바움",
  "Mandelbaum생애사 분석": "만델바움",
  "Mandelbaum의 생애사 연구": "만델바움",

  "슛제의 이야기식 인터뷰": "슛제",
  "슛제(F. Schütze)의 생애사 분석방법": "슛제",
  "Schütze의 생애사 이야기식 접근": "슛제",

  // 일본군위안부 — 홑따옴표를 두르는 표기가 섞여 있어 띄어쓰기 규칙에 걸리지 않는다.
  // 「대한민국 육군에 의한 위안부」는 다른 일을 가리키므로 여기 넣지 않는다.
  위안부: "일본군위안부",
  군위안부: "일본군위안부",
  "일본군‘위안부’": "일본군위안부",
  "일본군 ‘위안부’ 운동": "일본군위안부",

  // 구술 아카이브 — 「아카이브」와 「아카이브즈」, 「구술」과 「구술사」와 「구술사료」로 갈렸다.
  // 「구술 아카이브 이용」·「구술사료 아카이브 시스템」처럼 다른 것을 가리키는 말은 뺀다.
  "구술 아카이브즈": "구술 아카이브",
  "구술사 아카이브": "구술 아카이브",
  "구술사 아카이브즈": "구술 아카이브",
  "구술사아카이브즈": "구술 아카이브",
  "구술사료 아카이브": "구술 아카이브",

  // 합치기가 아니라 깨진 것을 고치는 자리. RISS에서 가운뎃점 뒤가 잘려 들어왔다.
  제주4: "제주4·3",
  "제주 4": "제주4·3",

  // 생애사 연구 — 「생애사적」이라 적은 것과 방법론을 따로 세운 것을 한 이름으로 모은다.
  "생애사적 연구": "생애사 연구",
  "생애사 연구방법": "생애사 연구",
  "생애사 연구 방법": "생애사 연구",
  "생애사 연구방법론": "생애사 연구",

  "여성 구술사 연구": "여성구술사",

  // 「20세기민중생활사연구단」은 기관 이름이라 남겨 둔다.
  "민중생활사 연구": "민중생활사",
  "20세기 민중생활사": "민중생활사",
  "20세기민중생활사": "민중생활사",

  생애구술사: "구술생애사", // 앞뒤가 뒤집힌 같은 말

  // 「생애사 연구」는 「생애사」와 가리키는 바가 같다. 위의 「생애사적 연구」·「생애사 연구방법」
  // 들은 여기까지 이어져 내려온다 — 별칭은 사슬로 따라간다.
  "생애사 연구": "생애사",
  "생애사연구.": "생애사", // 마침표가 붙어 들어와 띄어쓰기 규칙에 걸리지 않는다
  "생애사 (연구)": "생애사", // 괄호가 낱말 하나를 감싸 버린 것

  // 구술로 받은 생애사도 생애사로 본다. 「이야기된」과 「체험된」은 로젠탈이 갈라 놓은 짝인데,
  // 이 목록에서는 그 구분까지 세우지 않기로 했다.
  구술생애사: "생애사",
  "이야기된 생애사": "생애사",
  "체험된 생애사": "생애사",

  "구술사 연구": "구술사",
  "구술사 인터뷰": "구술사",

  이주민: "이주",

  장소기억: "장소성",

  의미: "삶의 의미",

  // 여성 — 여기서부터는 표기를 맞추는 것이 아니라 하위 갈래를 상위로 들이는 것이다.
  // 제주해녀도 여성노인도 「여성」 하나로 서고, 그 이름으로는 따로 찾을 수 없게 된다.
  // 갈래를 따로 두는 길도 있었으나 이 목록에서는 한 이름으로 모으기로 했다.
  여성사: "여성",
  여성노인: "여성",
  "농촌 여성": "여성", // 「농촌여성노인」이 여기를 거쳐 내려온다
  "여성 구술생애사": "여성",
  제주해녀: "여성",
  여성구술사: "여성", // 「여성 구술사 연구」가 여기를 거쳐 내려온다
  "한인 여성": "여성",
  노동이주여성: "여성",
  "(노동)이주여성": "여성",
  "재독 한인여성": "여성",
  "여성주의 정체성": "여성",
  여성구술: "여성",
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

// 별칭 표를 띄어쓰기를 지운 형태로 찾을 수 있게 바꿔 둔다. 표에 「생애사 연구」 한 줄만
// 적어도 「생애사연구」가 함께 걸린다 — 표기마다 줄을 늘리지 않아도 된다.
const ALIAS_BY_KEY = new Map(
  Object.entries(KEYWORD_ALIASES).map(([from, to]) => [spacingKey(from), to]),
);

// 별칭은 사슬로 따라간다. 「생애사 연구방법」 → 「생애사 연구」 → 「생애사」처럼 대표어가
// 다시 다른 이름으로 옮겨 갈 수 있어서다. 표를 잘못 적어 고리가 생겨도 멈추게 해 둔다.
function resolveAlias(keyword: string): string {
  let current = stripGloss(keyword.trim());
  const seen = new Set<string>();
  for (;;) {
    const key = spacingKey(current);
    if (seen.has(key)) return current;
    seen.add(key);
    const next = ALIAS_BY_KEY.get(key);
    if (next === undefined) return current;
    current = stripGloss(next.trim());
  }
}

// 주제어 하나하나에 대표어를 달아 준다. 대표어를 고르는 순서는,
//   1. 번역 괄호를 걷어낸 형태
//   2. 별칭 표를 사슬 끝까지 따라간 이름
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
    aliased.set(keyword, resolveAlias(keyword));
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
