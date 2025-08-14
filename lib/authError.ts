export function authErrorToAlertMessage(raw?: string) {
  const msg = (raw ?? "").toLowerCase();

  // Supabase commonly returns this string for unverified accounts too,
  // so we avoid claiming “Google-linked” outright.
  if (msg.includes("invalid") && msg.includes("credentials")) {
    return "Invalid email or password. If you previously used Google for this email, use “Sign in with Google”, or reset your password.";
  }

  if (
    msg.includes("confirm") ||
    msg.includes("not confirmed") ||
    msg.includes("verify")
  ) {
    return "Please verify your email first. Check your inbox for the confirmation link.";
  }

  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Too many attempts. Please wait a minute and try again.";
  }

  if (msg.includes("network") || msg.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  return "Sign‑in failed. Try again, or use “Sign in with Google”.";
}
