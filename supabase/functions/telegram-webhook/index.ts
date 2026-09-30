import postgres from "npm:postgres@3.4.4";

const TOKEN = (Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "").trim();
const OWNER_ID = (Deno.env.get("TELEGRAM_OWNER_ID") ?? "").trim();
// 웹훅 등록 때 정한 비밀 문구. 텔레그램이 요청마다 헤더에 붙여 보낸다.
// 아직 저장하지 않았다면 확인을 건너뛴다(전환 기간).
const WEBHOOK_SECRET = (Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "").trim();
// 없으면 사진 변환은 꺼진 상태로 동작한다
const ANTHROPIC_KEY = (Deno.env.get("ANTHROPIC_API_KEY") ?? "").trim();
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PHOTO_BUCKET = "grains";
// 화면에 두고 볼 사본의 긴 변 상한. 텔레그램이 크기별 사본을 이미 만들어 주므로 직접 줄이지 않는다.
const KEEP_PX = 800;
const GAP_MINUTES = 30;
const UNCONVERTED = "(사진, 아직 글로 바꾸지 않음)";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false });

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function send(chatId: number, text: string, replyTo?: number) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(replyTo ? { reply_parameters: { message_id: replyTo } } : {}),
    }),
  });
}

// deno-lint-ignore no-explicit-any
function forwardSource(m: any): string | null {
  const o = m.forward_origin;
  if (!o) return null;
  if (o.type === "user") {
    return [o.sender_user?.first_name, o.sender_user?.last_name].filter(Boolean).join(" ") || null;
  }
  if (o.type === "hidden_user") return o.sender_user_name ?? null;
  if (o.type === "chat") return o.sender_chat?.title ?? null;
  if (o.type === "channel") return o.chat?.title ?? null;
  return null;
}

async function currentThreadId(): Promise<string> {
  const rows = await sql`
    select t.id,
           greatest(t.created_at, coalesce(max(f.created_at), t.created_at)) as last_at
    from grains.threads t
    left join grains.fragments f on f.thread_id = t.id
    group by t.id
    order by last_at desc
    limit 1`;
  if (rows.length) {
    const ageMin = (Date.now() - new Date(rows[0].last_at).getTime()) / 60000;
    if (ageMin < GAP_MINUTES) return rows[0].id;
  }
  const created = await sql`insert into grains.threads default values returning id`;
  return created[0].id;
}

// 텔레그램에서 파일 내용을 받는다. 실패하면 null.
async function downloadTelegramFile(fileId: string): Promise<Uint8Array | null> {
  try {
    const info = await fetch(
      `https://api.telegram.org/bot${TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
    ).then((r) => r.json());
    const path = info?.result?.file_path;
    if (!path) return null;
    const img = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${path}`);
    if (!img.ok) return null;
    return new Uint8Array(await img.arrayBuffer());
  } catch (e) {
    console.error(e);
    return null;
  }
}

// 사진 사본을 비공개 버킷에 올리고 버킷 안 경로를 돌려준다. 실패하면 null.
async function storePhoto(
  bytes: Uint8Array,
  chatId: number,
  messageId: number,
): Promise<string | null> {
  try {
    const path = `photos/${chatId}-${messageId}.jpg`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${PHOTO_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!res.ok) {
      console.error("storage", res.status, await res.text());
      return null;
    }
    return path;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// 손글씨 사진을 Claude로 글로 바꾼다. 실패하면 null.
async function transcribe(bytes: Uint8Array): Promise<string | null> {
  try {
    const b64 = toBase64(bytes);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
            {
              type: "text",
              text: "이 사진은 손으로 쓴 메모다. 적힌 글을 있는 그대로 옮겨 적어라. 줄바꿈은 유지하고, 설명이나 해석은 덧붙이지 말고 옮긴 글만 답해라. 읽을 수 없는 글자는 [?]로 표시해라.",
            },
          ],
        }],
      }),
    });
    if (!res.ok) {
      console.error("anthropic", res.status);
      return null;
    }
    const data = await res.json();
    const out = (data.content ?? []).filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text).join("").trim();
    return out || null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    // 텔레그램이 보낸 요청인지 확인. 문구가 다르면 아무 일도 하지 않는다.
    if (WEBHOOK_SECRET && req.headers.get("x-telegram-bot-api-secret-token") !== WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403 });
    }

    const update = await req.json();
    const edited = !!update.edited_message;
    const m = update.message ?? update.edited_message;
    if (!m || !m.from) return new Response("ok");

    const chatId: number = m.chat.id;
    const fromId = String(m.from.id);
    const text: string = m.text ?? m.caption ?? "";

    // /id 는 누구에게나 자기 숫자만 알려준다 (저장은 하지 않음)
    if (text.trim().split(/\s|@/)[0] === "/id") {
      await send(chatId, `내 숫자 ID: ${fromId}`);
      return new Response("ok");
    }

    // 주인이 아니면 조용히 무시
    if (!OWNER_ID || fromId !== OWNER_ID) return new Response("ok");

    // 수정된 메시지: 저장된 조각 갱신 (사진은 변환한 글을 덮어쓰지 않도록 건너뜀)
    if (edited) {
      if (!m.photo) {
        await sql`
          update grains.fragments
          set body = ${text}, edited_at = now()
          where tg_chat_id = ${chatId} and tg_message_id = ${m.message_id}`;
      }
      return new Response("ok");
    }

    // /new: 덩어리 강제 분리
    if (text.trim().split(/\s|@/)[0] === "/new") {
      await sql`insert into grains.threads default values`;
      await send(chatId, "새 덩어리를 시작했어요.");
      return new Response("ok");
    }

    // 다른 명령어는 아직 준비 중
    if (text.startsWith("/")) {
      await send(chatId, "아직 준비 중인 명령이에요.");
      return new Response("ok");
    }

    let body = text;
    let kind = m.forward_origin ? "forward" : "text";
    let imagePath: string | null = null;
    let note = "✓";

    if (m.photo) {
      kind = "photo";
      // 크기별 사본 중 글자 읽기에는 가장 큰 것, 보관에는 긴 변이 KEEP_PX 이하인 가장 큰 것을 쓴다.
      // deno-lint-ignore no-explicit-any
      const sizes: any[] = m.photo;
      const largest = sizes[sizes.length - 1];
      const keep =
        [...sizes].reverse().find((p) => Math.max(p.width ?? 0, p.height ?? 0) <= KEEP_PX) ??
          sizes[0];

      const largestBytes = await downloadTelegramFile(largest.file_id);
      const keepBytes = keep.file_id === largest.file_id
        ? largestBytes
        : await downloadTelegramFile(keep.file_id);

      // 올리기에 실패해도 기록이 사라지지 않게 텔레그램 file_id를 대신 남긴다.
      imagePath = (keepBytes && (await storePhoto(keepBytes, chatId, m.message_id))) ||
        `tg:${keep.file_id}`;

      let converted: string | null = null;
      if (ANTHROPIC_KEY) {
        converted = largestBytes ? await transcribe(largestBytes) : null;
        if (!converted) note = "✓ (글로 바꾸지 못해서 사진만 저장했어요)";
      } else {
        note = "✓ (사진 변환은 꺼져 있어요)";
      }
      body = converted ?? UNCONVERTED;
      if (text) body = `${body}\n\n[사진 설명] ${text}`;
    }

    if (!body) return new Response("ok");

    const source = forwardSource(m);
    const threadId = await currentThreadId();
    const replyTo = m.reply_to_message?.message_id ?? null;

    await sql`
      insert into grains.fragments
        (body, kind, source, image_path, tg_chat_id, tg_message_id, thread_id, reply_to_message_id)
      values
        (${body}, ${kind}, ${source}, ${imagePath}, ${chatId}, ${m.message_id}, ${threadId}, ${replyTo})
      on conflict (tg_chat_id, tg_message_id) do nothing`;

    await send(chatId, note, m.message_id);
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("ok"); // 텔레그램이 같은 메시지를 계속 재전송하지 않도록 항상 200
  }
});
