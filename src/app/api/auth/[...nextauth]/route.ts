import { handlers } from "@/auth";
import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "next-auth.session-token",
  "__Secure-authjs.session-token",
  "__Secure-next-auth.session-token",
];

// When next-auth beta.31 gets an invalid JWT (JWEInvalid) it can return a
// 404 HTML page instead of a clean null-session JSON response. That turns into
// a ClientFetchError loop in the browser. We intercept that case, clear the
// stale cookie, and return the same empty-session JSON that a fresh visitor
// would get.
async function wrapGet(req: NextRequest): Promise<Response> {
  try {
    const response = await handlers.GET(req);

    if (response.status === 404 || response.status === 500) {
      const { pathname } = new URL(req.url);
      if (pathname.endsWith("/session")) {
        const cleared = NextResponse.json(null, { status: 200 });
        for (const name of SESSION_COOKIE_NAMES) {
          cleared.cookies.delete(name);
        }
        return cleared;
      }
    }

    return response;
  } catch (error) {
    console.error("[AUTH ROUTE] GET error:", error);
    const { pathname } = new URL(req.url);
    if (pathname.endsWith("/session")) {
      return NextResponse.json(null, { status: 200 });
    }
    return new Response(null, { status: 500 });
  }
}

async function wrapPost(req: NextRequest): Promise<Response> {
  try {
    return await handlers.POST(req);
  } catch (error) {
    console.error("[AUTH ROUTE] POST error:", error);
    return new Response(null, { status: 400 });
  }
}

export const GET = wrapGet;
export const POST = wrapPost;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
