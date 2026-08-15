"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";
import { PersonBrief } from "./types";

// 구술자·면담자 전거(persons)를 화면에서 만든다. 지금까지 인물은 CSV 동기화로만 들어왔다.
//
// 신상은 사람을 가려낼 최소한만 받는다 — 이름과 소속(직위)뿐이다. 구술자/면담자 신상기록부에
// 있는 현주소·연락처·종교·직계가족 연락처는 칸조차 만들지 않는다: persons는 RLS가
// "public read using(true)"라 브라우저로 내려가는 anon 키만 있으면 누구나 읽을 수 있고,
// 그런 자리에 연락처를 두는 것은 공개하는 것과 같다. 종이 신상기록부는 별도로 보관한다.

export type PersonRole = "구술자" | "면담자";

export interface PersonInput {
  name: string;
  affiliation: string; // 예: "ㅇㅇ대학교 문화인류학과 교수"
  role: PersonRole;
}

// subject 배열은 CSV 동기화분에서도 역할·직군을 담는 자리로 쓰고 있어(["구술자", "배우"] 등)
// 같은 규칙을 따른다. id의 pr_ 접두어는 동기화분(P001…)과 절대 부딪히지 않게 하려는 것.
export async function createPerson(input: PersonInput): Promise<PersonBrief> {
  const name = input.name.trim();
  if (!name) throw new Error("이름은 비워둘 수 없습니다.");

  const id = `pr_${randomUUID()}`;
  const affiliation = input.affiliation.trim();
  const { error } = await supabaseAdmin.from("persons").insert({
    id,
    title: name,
    affiliation: affiliation || null,
    subject: [input.role],
  });
  if (error) throw error;

  revalidatePath("/admin/oral");
  revalidatePath("/segments");
  return { id, name, affiliation: affiliation || undefined };
}
