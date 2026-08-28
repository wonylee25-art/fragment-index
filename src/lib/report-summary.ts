// 보고서 요약(research_summary)을 화면에 세우기 전에 다듬는 자리.
//
// PRISM이 주는 이 칸은 초록이 아니라 **과업 개요**인 경우가 절반이 넘는다(51건 중 33건).
// 초록 칸에 "[부록] 수집자료 목록" 한 줄만 들어 있어 개요로 밀려난 것들이다
// (scripts/import-prism-papers.mjs의 summaryOf 참고). 그래서 원문은 발주 문서의 항목
// 나열이고, 그중 앞머리 넉 줄은 이 화면이 이미 제 칸으로 들고 있는 것들이다:
//
//   ○ 용 역 명: 캠프마켓 …[3차년도)   → 제목
//   ○ 기 간: 2025. 2. 27. ~ 10. 24.   → 연구기간
//   ○ 용 역 사: 모씨네 사회적협동조합  → 수행기관
//   ○ 용역금액: 88,656천원            → 화면에 자리가 없다(아래 KEEP_AMOUNT 참고)
//
// 같은 것을 두 번 읽게 두면, 정작 읽을 것(구술 대상·사업내용)이 그 밑에 깔린다. 그래서
// 겹치는 머리만 걷고 나머지는 원문 그대로 세운다. **DB는 손대지 않는다** — 여기서 걷는
// 판단이 틀려도 research_summary에는 원문이 남아 있고, 검색도 원문을 훑는다.
//
// 걷는 이름은 지어내지 않았다. 51건이 실제로 쓴 머리말을 세어서 나온 것들이다.

// 값이 한 줄에 함께 붙은 "이름 : 값" 꼴일 때만 걷는다. 이름만 있고 아래로 항목이
//매달리는 머리(예: "○ 사업내용")는 걷으면 그 아래가 통째로 미아가 되므로 남긴다.
const DROP_LABELS = [
  // 제목 자리 — 과제명은 이미 행 머리에 크게 서 있다.
  /^(용역명|과업명|사업명|과제명|연구과제명|연구용역명)$/,
  // 연구기간 칸 자리.
  /^(기간|용역기간|과업기간|사업기간|연구기간|연구수행기간|추진기간|과업의기간)$/,
  // 수행기관 칸 자리.
  /^(용역사|수행기관|수행업체|계약업체|용역업체)$/,
  // 돈과 절차 — 구술채록을 읽는 자리에서 찾을 것이 아니다. 원문에는 남는다.
  /^(용역금액|계약금액|과업비|사업비|소요예산|예산|예산과목|추진방법|계약방법|계약및사업자선정)$/,
  // 발주처 칸 자리.
  /^(발주처|발주기관|주관기관|의뢰기관)$/,
];

// PRISM 원문에 섞여 오는 부스러기.
// - "＆＃10061;"은 글머리표(❍)가 두 번 엔티티로 감긴 것.
// - "?"는 글머리표 자리에서 인코딩을 잃은 것 — 물음표로 읽히면 안 된다.
// - 줄머리의 "o"는 소문자 오가 아니라 글머리표다.
function normalizeBullets(line: string): string {
  return line
    .replace(/＆＃\d+;/g, "○")
    .replace(/&#\d+;/g, "○")
    .replace(/^\s*[?？]\s+/, "○ ")
    .replace(/^(\s*)o\s+/, "$1○ ")
    // 낱말 한가운데 낀 "?"는 물음이 아니라 가운뎃점이 인코딩을 잃은 것이다 —
    // "5?18민주화운동", "직?간접", "피해자?참고인". 양옆이 모두 글자·숫자일 때만 되돌린다.
    .replace(/(?<=[가-힣0-9])[?？](?=[가-힣0-9])/g, "·");
}

// 번호 매김("1.", "가.", "①")과 글머리표를 떼어 낸 알맹이. 번호는 두 자리까지만 본다 —
// "2021.08.13."의 앞머리를 번호로 잘못 읽으면 날짜가 이름표가 된다.
function stripMarkers(line: string): string {
  return line
    .replace(/^[\s○ㅇ◦●□■◇◆·•*※\-–—]+/u, "")
    .replace(/^[0-9０-９]{1,2}\s*[.)]\s*/, "")
    .replace(/^[가-힣]\s*[.)]\s+/, "")
    .replace(/^[①-⑳]\s*/, "");
}

// 번호나 글머리표를 달고 선 줄 — 아래 항목을 쓸어 담을 때 여기서 멈춘다.
function isMarked(line: string): boolean {
  return /^\s*([0-9０-９]{1,2}\s*[.)]\s|[가-힣]\s*[.)]\s|[○ㅇ◦●□■◇◆·•*※\-–—①-⑳])/u.test(line);
}

// 이름표만 뽑는다 — 글머리표("○ ㅇ · - □ ①", "1.", "가.")를 떼고 콜론 앞을 본다.
// 공백은 지운 채로 맞춘다: 원문은 표를 맞추려고 "용 역 명"처럼 자간을 벌려 둔다.
function labelOf(line: string): string | null {
  const m = stripMarkers(line).match(/^([^:：]{1,16})[:：]\s*(.*)$/);
  if (!m) return null;
  // 값이 비어 있으면 머리글이다 — 아래로 항목이 매달린다(예: "○ 구술 세부 내용 :").
  if (!m[2].trim()) return null;
  return m[1].replace(/\s+/g, "");
}

// 값을 데리고 있지 않은 이름표 — "1. 과업명" 다음 줄에 값이 오는 꼴이다.
function bareLabelOf(line: string): string | null {
  const body = stripMarkers(line).replace(/[:：]\s*$/, "").trim();
  if (!body || body.length > 16 || /[:：]/.test(body)) return null;
  return body.replace(/\s+/g, "");
}

// 들여쓰기 깊이. 항목이 다 걷힌 머리글을 홀로 남기지 않으려고 잰다.
function depthOf(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

/**
 * 보고서 요약에서 화면과 겹치는 머리 항목을 걷는다. 걸 것이 없으면(제대로 된 초록이나
 * 한 줄짜리 개요) 손대지 않고 그대로 돌려준다.
 */
export function trimReportSummary(text: string | undefined | null): string {
  if (!text) return "";
  // PRISM은 줄 끝에 \r을 달아 준다. 남겨 두면 이름표를 읽는 정규식의 `$`가 그 앞에서
  // 멈춰(자바스크립트의 `.`은 \r을 먹지 않는다) 걷어야 할 줄을 그냥 지나친다.
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map(normalizeBullets);

  const drops = (label: string | null) => label !== null && DROP_LABELS.some((re) => re.test(label));

  const cut = new Set<number>();
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim()) {
      cut.add(i);
      continue;
    }
    if (drops(labelOf(lines[i]))) {
      cut.add(i);
      continue;
    }
    // 이름만 서고 값이 다음 줄에 오는 꼴("1. 과업명" 아래 과제명 한 줄)은 그 값까지
    // 함께 걷는다. 번호를 새로 단 줄에서 멈춘다 — 거기서부터는 다른 항목이다.
    if (drops(bareLabelOf(lines[i]))) {
      cut.add(i);
      const depth = depthOf(lines[i]);
      for (let j = i + 1; j < lines.length; j += 1) {
        if (!lines[j].trim() || depthOf(lines[j]) <= depth || isMarked(lines[j])) break;
        cut.add(j);
      }
    }
  }
  let kept = lines.filter((_, i) => !cut.has(i));

  // 항목이 전부 걷혀 홀로 남은 머리글을 떨어낸다("2. 개요"만 남는 꼴). 걷을 때마다 그
  // 위의 머리글이 또 홀로 남을 수 있어 변화가 없을 때까지 되풀이한다.
  for (;;) {
    const next = kept.filter((line, i) => {
      if (labelOf(line) !== null) return true; // 값을 가진 줄은 그 자체로 내용이다
      if (!/[:：]\s*$/.test(line)) return true; // 콜론으로 끝나지 않으면 머리글이 아니다
      const below = kept[i + 1];
      return below !== undefined && depthOf(below) > depthOf(line);
    });
    if (next.length === kept.length) break;
    kept = next;
  }

  // 머리를 걷고 나면 원문의 들여쓰기가 통째로 한 칸씩 뜬 채로 남는 경우가 있다 —
  // 가장 얕은 줄을 왼쪽 끝에 맞춘다.
  const base = Math.min(...kept.map(depthOf), 0 === kept.length ? 0 : Infinity);
  const shifted = Number.isFinite(base) ? kept.map((l) => l.slice(base)) : kept;

  return shifted.join("\n").trim();
}
