import { handlers } from "@/auth";
import { NextRequest } from "next/server";

export const GET = async (req: NextRequest, props: { params: Promise<{ nextauth: string[] }> }) => {
  // Next.js 15+ requires awaiting params
  await props.params;
  return handlers.GET(req);
};

export const POST = async (req: NextRequest, props: { params: Promise<{ nextauth: string[] }> }) => {
  // Next.js 15+ requires awaiting params
  await props.params;
  return handlers.POST(req);
};
