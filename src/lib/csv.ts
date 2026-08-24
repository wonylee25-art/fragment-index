import { TimelineRow } from "./types";
import { formatEdtfToKorean } from "./edtf";
import { formatEventSource } from "./citation";

// 셀 안에 쉼표·줄바꿈·큰따옴표가 있으면 CSV 규칙대로 큰따옴표로 감싸고 이스케이프한다.
function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// 연표에서 고른 행을 그대로 내보낸다. 사건 말고 사료도 한 행으로 서므로 갈래 칸과 자료
// 칸을 함께 둔다 — 표에서 사료가 사료 칸에 서던 구분이 파일에서도 남아야 한다. 사건명 칸에
// 기사 제목을 밀어넣으면 건네받은 사람은 그것을 사건으로 읽는다.
export function rowsToCsv(rows: TimelineRow[]): string {
  const header = ["구분", "날짜", "사건명", "자료", "키워드", "장소", "출처", "내용"];

  const cells = rows.map((row) => {
    if (row.kind === "material") {
      const { material } = row;
      return [
        "사료",
        formatEdtfToKorean(row.dateValue),
        "",
        material.title,
        (material.keywords ?? []).join(";"),
        "",
        // 사료의 출처는 소장기관과 발행일, 그리고 원본 주소다 — 재호스팅하지 않으므로
        // 건네받은 사람이 원본까지 갈 수 있어야 한다.
        [material.sourceOrg, material.dateValue, material.sourceUrl].filter(Boolean).join(" "),
        row.body,
      ];
    }

    const e = row.event;
    return [
      "사건",
      formatEdtfToKorean(e.dateValue),
      e.eventName,
      "",
      e.keywordTags.join(";"),
      e.places.map((p) => p.name).join(";"),
      // 내보내는 파일은 남에게 건네 읽히는 것이라 대장 번호가 아니라 풀린 서지를 싣는다.
      formatEventSource(e),
      e.summary,
    ];
  });

  return [header, ...cells.map((r) => r.map(csvCell))].map((r) => r.join(",")).join("\n");
}

export function downloadCsv(filename: string, csvContent: string) {
  // 한글이 엑셀에서 깨지지 않도록 UTF-8 BOM을 붙인다.
  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
