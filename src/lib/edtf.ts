// EDTF(Extended Date/Time Format) 값을 한글 표기로 변환하고, 정렬용 숫자 키를 뽑아낸다.
// 규칙은 기획 정리노트 6-3 표를 그대로 따른다.

export function formatEdtfToKorean(value: string): string {
  if (!value) return "연도 미상";

  // 시트 입력에서 쓰인 확장 표기: "1960s"(연대), "1950~"(그 무렵부터), "1945~1948"(그 기간 동안),
  // "1936?/1942?"(둘 중 하나로 추정)
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
  return value.split("/")[0].replace(/s$/, "").replace(/\?/g, "").split("~")[0];
}

export function edtfSortKey(value: string): number {
  if (!value) return 9999_00_00; // 연도 미상은 항상 뒤로
  const [datePart] = stripEdtfMarks(value).split("T");
  const [year, month = "1", day = "1"] = datePart.split("-");
  return parseInt(year, 10) * 10000 + parseInt(month, 10) * 100 + parseInt(day, 10);
}

// 압축된 눈금(바코드)이나 배경 숫자처럼 자리가 좁은 곳에 쓰는 연도만 뽑은 짧은 표기.
export function edtfYear(value: string): string {
  if (!value) return "미상";
  return stripEdtfMarks(value).split("-")[0];
}

// 연표 눈금 위 가로 위치 계산용 — 연도 + 월을 소수로 (1950-07 → 1950.5).
export function edtfYearFloat(value: string): number {
  const [datePart] = stripEdtfMarks(value).split("T");
  const [year, month = "1"] = datePart.split("-");
  return parseInt(year, 10) + (parseInt(month, 10) - 1) / 12;
}
