import { TimelineEventData } from "./types";
import { formatEdtfToKorean } from "./edtf";
import { formatEventSource } from "./citation";

// 셀 안에 쉼표·줄바꿈·큰따옴표가 있으면 CSV 규칙대로 큰따옴표로 감싸고 이스케이프한다.
function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function eventsToCsv(events: TimelineEventData[]): string {
  const header = ["날짜", "사건명", "키워드", "장소", "출처", "내용"];
  const rows = events.map((e) =>
    [
      formatEdtfToKorean(e.dateValue),
      e.eventName,
      e.keywordTags.join(";"),
      e.places.map((p) => p.name).join(";"),
      // 내보내는 파일은 남에게 건네 읽히는 것이라 대장 번호가 아니라 풀린 서지를 싣는다.
      formatEventSource(e),
      e.summary,
    ].map(csvCell),
  );
  return [header, ...rows].map((r) => r.join(",")).join("\n");
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
