import { getStore } from "@netlify/blobs";

const J = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function sha(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default async (req) => {
  const u = new URL(req.url);
  const code = (u.searchParams.get("code") || "").trim();
  const slot = u.searchParams.get("slot") || "";
  if (!/^[A-Za-z0-9_\-一-鿿]{6,40}$/.test(code) || !/^[1-3]$/.test(slot)) return J({ error: "bad request" }, 400);
  const store = getStore("saves");
  const key = (await sha(code)) + "/" + slot;
  try {
    if (req.method === "GET") {
      const txt = await store.get(key, { type: "text" });
      if (txt == null) return J({ error: "none" }, 404);
      return new Response(txt, { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    }
    if (req.method === "PUT") {
      const body = await req.text();
      if (body.length > 5000000) return J({ error: "too large" }, 413);
      let o; try { o = JSON.parse(body); } catch (e) { return J({ error: "bad json" }, 400); }
      if (!o || typeof o.ts !== "number" || typeof o.data !== "string") return J({ error: "bad body" }, 400);
      await store.set(key, body);
      return J({ ok: true });
    }
    return J({ error: "method" }, 405);
  } catch (e) {
    return J({ error: "server" }, 500);
  }
};
