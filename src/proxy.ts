import { NextResponse } from "next/server";

/**
 * DealCollab AI Proxy
 * Handles routing and request flow in the Node.js runtime.
 */
export function proxy() {
  return NextResponse.next();
}
