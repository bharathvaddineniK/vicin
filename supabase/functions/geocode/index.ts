// @ts-nocheck

// supabase/functions/geocode/index.ts
// Geoapify geocoding proxy (Deno Edge Runtime)

type Result = {
  id: string | null;
  label: string;
  subtitle: string;
  coords: { lat: number; lng: number } | null;
  source: "geoapify";
};

// Allow "body" on init (ResponseInit doesn't include body)
type ResponseInitWithBody = Omit<ResponseInit, "headers"> & {
  headers?: HeadersInit;
  body?: BodyInit | null;
};

const ALLOWED_ORIGINS = [
  "http://localhost:8081",
  "http://localhost:19006",
  "exp://127.0.0.1:19000",
  // "https://your-prod-domain", // TODO: set your prod origin
];

function withCors(req: Request, init: ResponseInitWithBody = {}): Response {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : "*";

  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  headers.set("access-control-allow-origin", allow);
  headers.set("access-control-allow-methods", "GET, OPTIONS");
  headers.set("access-control-allow-headers", "authorization, x-client-info, apikey, content-type");
  headers.set("cache-control", "public, max-age=300, s-maxage=300"); // 5m

  return new Response(init.body ?? null, { ...init, headers });
}

function bad(status: number, message: string, extra?: Record<string, unknown>) {
  return withCors(new Request(""), {
    status,
    body: JSON.stringify({ error: message, ...(extra ?? {}) }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return withCors(req, { status: 204 });

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const lat = url.searchParams.get("lat");
    const lng = url.searchParams.get("lng");
    const limitRaw = url.searchParams.get("limit");

    if (q.length < 3) return bad(400, "Query too short; min 3 chars");

    // clamp limit 1..10 (default 5)
    let limit = 5;
    if (limitRaw) {
      const n = Number(limitRaw);
      if (Number.isFinite(n)) limit = Math.max(1, Math.min(10, Math.floor(n)));
    }

    // optional proximity bias
    let bias = "";
    if (lat && lng) {
      const la = Number(lat), ln = Number(lng);
      if (Number.isFinite(la) && Number.isFinite(ln) && la >= -90 && la <= 90 && ln >= -180 && ln <= 180) {
        bias = `&bias=proximity:${ln},${la}`;
      }
    }

    const key = Deno.env.get("GEOAPIFY_KEY");
    if (!key) return bad(500, "Server not configured: GEOAPIFY_KEY missing");

    const endpoint =
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&limit=${limit}${bias}&format=json&apiKey=${key}`;

    const upstream = await fetch(endpoint, { method: "GET" });
    if (!upstream.ok) {
      const txt = await upstream.text();
      return bad(502, "Upstream error", { status: upstream.status, body: txt });
    }

    const data = await upstream.json() as any;
    const features = Array.isArray(data?.results) ? data.results : [];

    const results: Result[] = features.map((f: any) => {
      const latOut = Number(f?.lat);
      const lngOut = Number(f?.lon);
      const label = f?.name || f?.street || f?.formatted || "";
      const subtitle =
        [f?.city, f?.state, f?.country].filter(Boolean).join(", ") ||
        (f?.address_line2 ?? "");
      return {
        id: (f?.place_id ?? null) as string | null,
        label: String(label),
        subtitle: String(subtitle),
        coords: (Number.isFinite(latOut) && Number.isFinite(lngOut)) ? { lat: latOut, lng: lngOut } : null,
        source: "geoapify",
      };
    });

    return withCors(req, {
      status: 200,
      body: JSON.stringify({ query: q, count: results.length, results }),
    });
  } catch (e: any) {
    return bad(500, "Unhandled", { message: String(e?.message ?? e) });
  }
});
