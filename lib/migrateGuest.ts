import { clearLocalOrigin, getLocalOrigin } from "./geo";
import { supabase } from "./supabase";

export async function migrateGuestPrefsToProfile() {
  const local = await getLocalOrigin();
  if (!local) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  await supabase
    .from("profiles")
    .update({
      home_location: `SRID=4326;POINT(${local.lon} ${local.lat})`,
      home_radius_m: local.radius_m,
    })
    .eq("id", session.user.id);

  await clearLocalOrigin();
}
