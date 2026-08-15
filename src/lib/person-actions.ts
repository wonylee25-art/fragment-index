"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";
import type { PersonBrief, PersonKind } from "./types";

// 구술자·면담자 전거(persons)를 화면에서 만든다. 지금까지 인물은 CSV 동기화로만 들어왔다.
//
// 신상은 사람을 가려낼 최소한만 받는다 — 이름과 소속(직위)뿐이다. 구술자/면담자 신상기록부에
// 있는 현주소·연락처·종교·직계가족 연락처는 칸조차 만들지 않는다: persons는 RLS가
// "public read using(true)"라 브라우저로 내려가는 anon 키만 있으면 누구나 읽을 수 있고,
// 그런 자리에 연락처를 두는 것은 공개하는 것과 같다. 종이 신상기록부는 별도로 보관한다.

export type PersonRole = "구술자" | "면담자";

// 이름이 그 사람을 가리키는 방식. 전거를 한 줄로 묶어도 되는지가 여기서 갈린다.
//
//   실명            이름이 곧 식별자다. 같은 이름이 이미 있으면 그 전거에 잇는다.
//   가명·익명·미상  이름이 식별자가 아니다 — 지어낸 이름(김미영)이거나 가림표(김○○)이거나
//                   묘사(40대 남성)다. 셋 다 자료마다 따로 붙인 것이라 겹치는 게 정상이고,
//                   같은 표기가 같은 사람이라는 근거는 어디에도 없다. 그래서 부를 때마다
//                   새 전거를 만든다. 이름으로 이어 붙이면 서로 무관한 사람 수십 명이
//                   한 인격으로 합쳐진다.
//
// PersonKind 자체는 types.ts에 둔다 — 클라이언트 컴포넌트도 읽어야 하는데 "use server"
// 파일에서 타입을 다시 내보내면 서버 액션만 남기고 지워지는 자리라 번들이 깨진다.

export interface PersonInput {
  name: string;
  affiliation: string; // 예: "ㅇㅇ대학교 문화인류학과 교수". 미상·익명이면 출처와 쪽을 적는다
  role: PersonRole;
  kind: PersonKind;
}

// subject 배열은 CSV 동기화분에서도 역할·직군을 담는 자리로 쓰고 있어(["구술자", "배우"] 등)
// 같은 규칙을 따른다. 실명은 표시할 게 없으니 역할만 넣는다 — 나머지 셋은 인물 색인에서
// 이 표시를 보고 걸러낼 수 있어야 한다. id의 pr_ 접두어는 동기화분(P001…)과 절대
// 부딪히지 않게 하려는 것.
export async function createPerson(input: PersonInput): Promise<PersonBrief> {
  const name = input.name.trim();
  if (!name) throw new Error("이름은 비워둘 수 없습니다.");

  const id = `pr_${randomUUID()}`;
  const affiliation = input.affiliation.trim();
  const kind = input.kind === "실명" ? undefined : input.kind;
  const { error } = await supabaseAdmin.from("persons").insert({
    id,
    title: name,
    affiliation: affiliation || null,
    subject: kind ? [input.role, kind] : [input.role],
  });
  if (error) throw error;

  revalidatePath("/admin/oral");
  revalidatePath("/segments");
  return { id, name, affiliation: affiliation || undefined, kind };
}
