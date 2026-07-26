// fast-xml-parser는 태그가 한 번만 나오면 단일 객체, 여러 번 나오면 배열로 파싱한다.
// 이 차이를 없애고 항상 배열로 다루기 위한 헬퍼 — museum-relics.ts, th-timeline.ts가 공유한다.
export function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
