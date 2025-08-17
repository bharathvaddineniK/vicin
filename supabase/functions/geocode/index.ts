// @ts-nocheck

// supabase/functions/geocode/index.ts
// deno-lint-ignore-file no-explicit-any

type GeocodeResult = {
  id?: string | null;
  label: string;
  subtitle?: string;
  coords?: { lat: number; lng: number } | null;
  source?: string;
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, OPTIONS",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(null, 204);

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const id = (url.searchParams.get("id") ?? "").trim();
  const session = (url.searchParams.get("session") ?? "sess").trim().replace(/\s+/g, "");
  const limit = Math.max(1, Math.min(10, Number(url.searchParams.get("limit") ?? "6")));
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const region = (url.searchParams.get("region") ?? "").trim().toLowerCase();

  const GOOGLE_PLACES_KEY = Deno.env.get("GOOGLE_PLACES_KEY");
  if (!GOOGLE_PLACES_KEY) return json({ code: 500, message: "Missing GOOGLE_PLACES_KEY env" }, 500);

  // Require an Authorization header (your client should send user JWT or ANON key)
  if (!req.headers.get("authorization")) {
    return json({ code: 401, message: "Missing authorization header" }, 401);
  }

  // --- Helpers ---
  const v1Autocomplete = async (): Promise<GeocodeResult[]> => {
    const endpoint = "https://places.googleapis.com/v1/places:autocomplete";
    const body: any = { input: q, sessionToken: session };
    if (lat && lng) {
      body.locationBias = {
        circle: { center: { latitude: Number(lat), longitude: Number(lng) }, radius: 50000 },
      };
    }
    if (region) body.regionCode = region.toUpperCase();

    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      console.error("[geocode] v1 autocomplete error", r.status, await r.text().catch(() => ""));
      return [];
    }
    const j = await r.json().catch(() => ({}));
    const suggestions: any[] = j?.suggestions ?? [];
    return suggestions.slice(0, limit).map((s) => {
      const pred = s.placePrediction ?? {};
      const main = pred.structuredFormat?.mainText?.text ?? pred.text?.text ?? "";
      const secondary = pred.structuredFormat?.secondaryText?.text ?? "";
      const placeId = pred.placeId ?? null;
      return { id: placeId, label: main, subtitle: secondary, coords: null, source: "google-v1" };
    });
  };

  const legacyAutocomplete = async (): Promise<GeocodeResult[]> => {
    const ac = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    ac.searchParams.set("key", GOOGLE_PLACES_KEY);
    ac.searchParams.set("input", q);
    ac.searchParams.set("sessiontoken", session);
    if (lat && lng) {
      ac.searchParams.set("location", `${lat},${lng}`);
      ac.searchParams.set("radius", "50000");
    }
    if (region) ac.searchParams.set("region", region);

    const r = await fetch(ac);
    if (!r.ok) {
      console.error("[geocode] legacy autocomplete error", r.status, await r.text().catch(() => ""));
      return [];
    }
    const j = await r.json().catch(() => ({}));
    const preds: any[] = Array.isArray(j?.predictions) ? j.predictions : [];
    return preds.slice(0, limit).map((p) => ({
      id: p.place_id ?? null,
      label: p.structured_formatting?.main_text ?? p.description ?? "",
      subtitle: p.structured_formatting?.secondary_text ?? "",
      coords: null,
      source: "google-legacy",
    }));
  };

  const v1Details = async (placeId: string): Promise<GeocodeResult | null> => {
    const endpoint = `https://places.googleapis.com/v1/places/${placeId}`;
    const r = await fetch(endpoint, {
      headers: {
        "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
        "X-Goog-FieldMask": "id,displayName,text,addressComponents,formattedAddress,location",
        "X-Goog-Session-Token": session,
      },
    });
    if (!r.ok) {
      console.error("[geocode] v1 details error", r.status, await r.text().catch(() => ""));
      return null;
    }
    const j = await r.json().catch(() => ({}));
    const name = j?.displayName?.text ?? j?.text?.text ?? "";
    const formatted = j?.formattedAddress ?? "";
    const loc = j?.location;
    return {
      id: placeId,
      label: name || formatted || "",
      subtitle: formatted || "",
      coords:
        loc && typeof loc.latitude === "number" && typeof loc.longitude === "number"
          ? { lat: loc.latitude, lng: loc.longitude }
          : null,
      source: "google-v1",
    };
  };

  const legacyDetails = async (placeId: string): Promise<GeocodeResult | null> => {
    const det = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    det.searchParams.set("key", GOOGLE_PLACES_KEY);
    det.searchParams.set("place_id", placeId);
    det.searchParams.set("sessiontoken", session);
    det.searchParams.set("fields", "geometry/location,formatted_address,name");

    const r = await fetch(det);
    if (!r.ok) {
      console.error("[geocode] legacy details error", r.status, await r.text().catch(() => ""));
      return null;
    }
    const j = await r.json().catch(() => ({}));
    const res = j?.result;
    if (!res) return null;
    const loc = res?.geometry?.location;
    const label = res?.name ?? res?.formatted_address ?? "";
    const subtitle = res?.formatted_address ?? "";
    return {
      id: placeId,
      label,
      subtitle,
      coords:
        loc && typeof loc.lat === "number" && typeof loc.lng === "number"
          ? { lat: loc.lat, lng: loc.lng }
          : null,
      source: "google-legacy",
    };
  };

  try {
    if (id) {
      let one = await v1Details(id);
      if (!one) one = await legacyDetails(id);
      const results = one ? [one] : [];
      return json({ query: id, results, count: results.length, session });
    }

    if (!q) return json({ query: q, results: [], count: 0, session });

    let results = await v1Autocomplete();
    if (results.length === 0) results = await legacyAutocomplete();
    return json({ query: q, results, count: results.length, session });
  } catch (e) {
    console.error("[geocode] fatal", e);
    return json({ code: 500, message: "geocode failed" }, 500);
  }
});
