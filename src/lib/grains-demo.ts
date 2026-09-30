import type { Grain, GrainThread } from "./grains";

// /grains?demo=1 에서만 쓰는 예시 데이터. DB를 읽지도 쓰지도 않는다.
// 실제 봇이 쌓는 모양(30분 넘게 비면 새 덩어리, 사진은 글로 옮긴 본문, 전달은 출처 표시,
// 수정은 '수정됨')과, 「키워드만 진하게」·강조 표시가 어떻게 보이는지를 보여 주려고 만든
// 가짜 메모다. 키워드는 여러 날에 걸쳐 되풀이되도록 잡았다(회색·버스·기억·구술).

const at = (iso: string) => `${iso}+09:00`;

// 손글씨 메모 사진 자리에 넣는 회색 줄무늬 그림. 실제 사진은 비공개 버킷의 서명 주소로 온다.
const PHOTO_PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><rect width='800' height='600' fill='%23f4f4f2'/><g stroke='%236b6b68' stroke-width='6' stroke-linecap='round' fill='none'><path d='M80 130h420M80 230h560M80 330h340M80 430h480'/></g></svg>";

// 강조 구간을 글자 위치로 적기 번거로우니, 본문에서 구절을 찾아 위치를 얻는다.
function mark(body: string, phrase: string): { start: number; end: number } {
  const start = body.indexOf(phrase);
  return { start, end: start + phrase.length };
}

function grain(g: Partial<Grain> & Pick<Grain, "id" | "createdAt" | "body">): Grain {
  return {
    kind: "text",
    source: null,
    editedAt: null,
    photoUrl: null,
    keywords: [],
    highlights: [],
    ...g,
  };
}

const BODY_QUOTE = "기억은 사실을 보관하는 창고가 아니라 매번 다시 지어지는 집이라는 문장.";

export const DEMO_THREADS: GrainThread[] = [
  {
    id: "demo-4",
    createdAt: at("2026-09-30T21:05:00"),
    title: null,
    summary: null,
    grains: [
      grain({
        id: "demo-4-1",
        createdAt: at("2026-09-30T21:05:00"),
        body: "퇴근길 버스에서 본 것. 창밖 간판이 전부 켜지기 직전, 십 분쯤 도시가 회색이다.",
        keywords: ["버스", "회색"],
      }),
      grain({
        id: "demo-4-2",
        createdAt: at("2026-09-30T21:12:00"),
        body: "그 회색 시간을 뭐라고 부를지. 아직 이름이 없다.",
        keywords: ["회색", "이름"],
        editedAt: at("2026-09-30T21:14:00"),
        highlights: [mark("그 회색 시간을 뭐라고 부를지. 아직 이름이 없다.", "아직 이름이 없다")],
      }),
    ],
  },
  {
    id: "demo-3",
    createdAt: at("2026-09-30T13:20:00"),
    title: "책상 위 메모",
    summary: "점심 뒤 손으로 적은 할 일과 읽던 책의 한 줄.",
    grains: [
      grain({
        id: "demo-3-1",
        createdAt: at("2026-09-30T13:20:00"),
        body: "오후에 할 일\n- 구술 목록 정리\n- 답장 두 통\n- 빨래 걷기 [?]",
        kind: "photo",
        photoUrl: PHOTO_PLACEHOLDER,
        keywords: ["구술"],
      }),
      grain({
        id: "demo-3-2",
        createdAt: at("2026-09-30T13:31:00"),
        body: BODY_QUOTE,
        kind: "forward",
        source: "독서 모임 채널",
        keywords: ["기억"],
        highlights: [mark(BODY_QUOTE, "매번 다시 지어지는 집")],
      }),
    ],
  },
  {
    id: "demo-2",
    createdAt: at("2026-09-29T08:40:00"),
    title: null,
    summary: null,
    grains: [
      grain({
        id: "demo-2-1",
        createdAt: at("2026-09-29T08:40:00"),
        body: "아침에 커피를 내리다가 문득, 어제 들은 구술에서 날짜가 하나 어긋난 것 같다. 기억이 틀렸을 수도, 내가 틀렸을 수도. 확인해 볼 것.",
        keywords: ["구술", "기억"],
      }),
    ],
  },
  {
    id: "demo-1",
    createdAt: at("2026-09-27T19:50:00"),
    title: null,
    summary: null,
    grains: [
      grain({
        id: "demo-1-1",
        createdAt: at("2026-09-27T19:50:00"),
        body: "버스 정류장에서 오래 기다렸다. 회색 저녁이 길게 이어졌다.",
        keywords: ["버스", "회색"],
      }),
    ],
  },
];
