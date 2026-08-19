// EDTF(Extended Date/Time Format) 값을 한글 표기로 변환하고, 정렬용 숫자 키를 뽑아낸다.
// 규칙은 기획 정리노트 6-3 표를 그대로 따른다.

// 연대를 셋으로 나눠 적는 확장 표기("1970s-early"). 구술에서 "70년대 초쯤"처럼 연대 안의
// 어림 위치까지는 기억하는 진술을 그대로 담기 위한 것 — 연대 전체(1970s)로 뭉개지도 않고,
// 없는 확신을 지어내 특정 연도로 못박지도 않는다.
const DECADE_PART = /^(\d{4})s-(early|mid|late)$/;
const DECADE_PART_LABEL = { early: "초반", mid: "중반", late: "후반" } as const;
// 정렬·좌표에 쓸 대표 연도(연대 시작연도 + 이 값). 초=앞 4년(0~3), 중=가운데 3년(4~6),
// 후=뒤 3년(7~9)으로 보고 각 구간의 한가운데를 찍는다. 폭이 있는 시기를 축 위 한 점으로
// 옮기는 어림값이므로, 같은 연대 안에서 초·중·후 순서가 지켜지는 것까지가 이 값의 몫이다.
const DECADE_PART_ANCHOR = { early: 1, mid: 5, late: 8 } as const;

export function formatEdtfToKorean(value: string): string {
  if (!value) return "연도 미상";

  // 시트 입력에서 쓰인 확장 표기: "1960s"(연대), "1950~"(그 무렵부터), "1945~1948"(그 기간 동안),
  // "1936?/1942?"(둘 중 하나로 추정)
  const decadePart = value.match(DECADE_PART);
  if (decadePart) {
    const [, decade, part] = decadePart;
    return `${decade}년대 ${DECADE_PART_LABEL[part as keyof typeof DECADE_PART_LABEL]}`;
  }
  if (/^\d{4}s$/.test(value)) return `${value.slice(0, -1)}년대`;
  if (/^\d{4}~\d{4}$/.test(value)) {
    const [start, end] = value.split("~");
    return `${start}~${end}년`;
  }
  if (value.endsWith("~")) return `${formatEdtfToKorean(value.slice(0, -1))}~`;
  if (/^\d{4}\?\/\d{4}\?$/.test(value)) {
    const [start, end] = value.split("/").map((v) => v.slice(0, -1));
    return `${start}년 또는 ${end}년(추정)`;
  }

  if (value.includes("/")) {
    const [start] = value.split("/");
    const decade = Math.floor(parseInt(start, 10) / 10) * 10;
    return `${decade}년대(추정)`;
  }

  const uncertain = value.endsWith("?");
  const clean = uncertain ? value.slice(0, -1) : value;

  const [datePart, timePart] = clean.split("T");
  const [year, month, day] = datePart.split("-");

  let label = `${year}년`;
  if (month) label += ` ${parseInt(month, 10)}월`;
  if (day) label += ` ${parseInt(day, 10)}일`;
  if (timePart) label += ` ${timePart}`;

  return uncertain ? `${label}(추정)` : label;
}

// "1940?/1949?" → "1940", "1960s" → "1960", "1950~" → "1950", "1945~1948" → "1945"
// 처럼 정렬·좌표 계산에 쓸 "시작 연도"만 남기고 수식 기호를 벗겨낸다.
function stripEdtfMarks(value: string): string {
  const decadePart = value.match(DECADE_PART);
  if (decadePart) {
    const [, decade, part] = decadePart;
    return String(parseInt(decade, 10) + DECADE_PART_ANCHOR[part as keyof typeof DECADE_PART_ANCHOR]);
  }
  return value.split("/")[0].replace(/s$/, "").replace(/\?/g, "").split("~")[0];
}

export function edtfSortKey(value: string): number {
  if (!value) return 9999_00_00; // 연도 미상은 항상 뒤로
  const [datePart] = stripEdtfMarks(value).split("T");
  const [year, month = "1", day = "1"] = datePart.split("-");
  return parseInt(year, 10) * 10000 + parseInt(month, 10) * 100 + parseInt(day, 10);
}

// EDTF 시작 날짜를 "날 수"로 바꾼다 — 두 날짜가 얼마나 떨어졌는지 재는 데 쓴다.
// 정렬용 edtfSortKey로는 이 계산을 할 수 없다: YYYYMMDD를 그냥 이어붙인 수라 12월 31일과
// 이튿날 1월 1일이 8,870만큼 떨어진 것으로 나온다.
// 연도만 적힌 값("1960s", "1950~")은 그 해 1월 1일로 친다 — 어느 달인지 모르는 사건을
// 하루 단위로 견줄 수는 없으니, 언저리를 고르는 데 쓰는 어림값이다.
export function edtfToDays(value: string): number | null {
  if (!value) return null;
  const [datePart] = stripEdtfMarks(value).split("T");
  const [y, m = "1", d = "1"] = datePart.split("-");
  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
}

// 두 EDTF 값이 며칠 떨어졌는지. 한쪽이라도 못 읽으면 null — 견줄 수 없다는 뜻이다.
export function edtfDayGap(a: string, b: string): number | null {
  const left = edtfToDays(a);
  const right = edtfToDays(b);
  if (left === null || right === null) return null;
  return Math.abs(left - right);
}

// 간격을 사람이 읽는 말로. 날짜가 가까울수록 촘촘히, 멀어지면 뭉뚱그린다 — 3일과 5일의
// 차이는 판단에 쓰이지만 11년과 11년 2개월의 차이는 그렇지 않다.
export function formatDayGap(days: number): string {
  if (days === 0) return "같은 날";
  if (days < 90) return `${days}일`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months}개월`;
  return `${Math.round(days / 365.25)}년`;
}

// 압축된 눈금(바코드)이나 배경 숫자처럼 자리가 좁은 곳에 쓰는 연도만 뽑은 짧은 표기.
export function edtfYear(value: string): string {
  if (!value) return "미상";
  // 연대 표기는 대표 연도(1978)가 아니라 연대(1970)를 보여준다 — 사건 검색창이 이 값을
  // 그대로 훑기 때문에, "1970"으로 찾을 때 1970년대 후반 사건이 빠지면 안 된다.
  const decadePart = value.match(DECADE_PART);
  if (decadePart) return decadePart[1];
  return stripEdtfMarks(value).split("-")[0];
}

// 연표 눈금 위 가로 위치 계산용 — 연도 + 월을 소수로 (1950-07 → 1950.5).
export function edtfYearFloat(value: string): number {
  const [datePart] = stripEdtfMarks(value).split("T");
  const [year, month = "1"] = datePart.split("-");
  return parseInt(year, 10) + (parseInt(month, 10) - 1) / 12;
}

// 연도(소수)를 연표 축 위 가로 위치(%)로 변환 — 좌우 3%씩 여백을 두고 나머지 94%에 분배.
// TimelineExperience의 전체 연표와 홈 히어로 타임라인이 같은 좌표계를 공유하기 위한 함수.
export function yearToAxisPercent(yearFloat: number, min = 1900, max = 2026): number {
  return ((yearFloat - min) / (max - min)) * 94 + 3;
}
