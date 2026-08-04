import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Request-boundary session guard (Next.js 16 `proxy`, Node runtime).
 * Fast cookie-presence check only — real validation happens server-side
 * in the dashboard layout and auth pages via `auth.api.getSession`.
 *
 * Auth pages are deliberately NOT bounced here: a stale/invalid cookie must
 * never make /login unreachable (redirect loop). They check the real session
 * themselves and redirect only when it is actually valid.
 */
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard") && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
