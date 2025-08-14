export function isPublicPath(pathname: string) {
  // keep lowercase to be safe
  const p = pathname.toLowerCase();
  return (
    p.startsWith("/(auth)/") ||
    p.startsWith("/legal/") ||
    p === "/oauth-callback"
  );
}

export function isProtectedPath(pathname: string) {
  return !isPublicPath(pathname);
}
