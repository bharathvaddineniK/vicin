import { supabase } from "./supabase";

export async function ensureMyProfile() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  // Try to read
  let { data, error, status } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  // If missing, create a skeleton
  if (status === 406 || (!data && !error)) {
    const skeleton = {
      id: session.user.id,
      display_name: session.user.email?.split("@")[0] ?? "New user",
      handle: `user_${session.user.id.slice(0, 8)}`,
      bio: null,
      avatar_url: null,
      home_location: null,
      home_radius_m: 8047, // 5 mi default
    };
    const { data: ins, error: insErr } = await supabase
      .from("profiles")
      .insert(skeleton)
      .select("*")
      .single();
    if (insErr) throw insErr;
    return ins;
  }

  if (error) throw error;
  return data;
}

export async function isHandleAvailable(h: string, excludeUserId?: string) {
  let q = supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .ilike("handle", h);

  if (excludeUserId) q = q.neq("id", excludeUserId);
  const { count } = await q;
  return (count ?? 0) === 0;
}
