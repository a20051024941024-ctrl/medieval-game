// 中世紀世界霸權：推播通知（Supabase Edge Function，名稱 mw-push）
// 金鑰第一次執行時自動產生，存在 mw_vapid 表（只有伺服器讀得到）。
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
let keys: { pub: string; priv: string } | null = null;

async function getKeys() {
  if (keys) return keys;
  let { data } = await db.from("mw_vapid").select("pub,priv").eq("id", 1).maybeSingle();
  if (!data) {
    const k = webpush.generateVAPIDKeys();
    await db.from("mw_vapid").insert({ id: 1, pub: k.publicKey, priv: k.privateKey });
    ({ data } = await db.from("mw_vapid").select("pub,priv").eq("id", 1).maybeSingle());
  }
  keys = data as { pub: string; priv: string };
  webpush.setVapidDetails("mailto:noreply@medieval-game.app", keys.pub, keys.priv);
  return keys;
}

async function sendTo(uid: string, msg: { title: string; body: string; url: string }, ignoreLimit = false) {
  const { data: subs } = await db.from("mw_push").select("endpoint,sub,last_at").eq("uid", uid);
  let sent = 0;
  for (const s of subs || []) {
    if (!ignoreLimit && s.last_at && Date.now() - Date.parse(s.last_at) < 8 * 60 * 1000) continue;
    try {
      await webpush.sendNotification(s.sub, JSON.stringify(msg));
      sent++;
      await db.from("mw_push").update({ last_at: new Date().toISOString() }).eq("endpoint", s.endpoint);
    } catch (e) {
      const sc = (e as { statusCode?: number })?.statusCode;
      if (sc === 404 || sc === 410) await db.from("mw_push").delete().eq("endpoint", s.endpoint);
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const body = await req.json().catch(() => ({}));
    const k = await getKeys();
    if (body.action === "pub") return json({ pub: k.pub });
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await db.auth.getUser(jwt);
    const me = u?.user?.id;
    if (!me) return json({ error: "not signed in" }, 401);
    const url = String(body.url || "").slice(0, 200);
    if (body.action === "test") {
      const sent = await sendTo(me, { title: "🔔 通知開啟成功", body: "有人攻打你、向你宣戰或發生全服大事時，會這樣通知你。", url }, true);
      return json({ sent });
    }
    if (body.action !== "send") return json({ error: "bad action" }, 400);
    const { data: room } = await db.from("mw_rooms").select("info").eq("code", String(body.code || "")).maybeSingle();
    if (!room || room.info?.host !== me) return json({ error: "not host" }, 403);
    const players = room.info.players || {};
    let sent = 0;
    for (const it of (body.items || []).slice(0, 30)) {
      const to = String(it.uid || "");
      if (!players[to] || to === me) continue;
      sent += await sendTo(to, { title: String(it.title || "中世紀世界霸權").slice(0, 60), body: String(it.body || "").slice(0, 180), url });
    }
    return json({ sent });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
