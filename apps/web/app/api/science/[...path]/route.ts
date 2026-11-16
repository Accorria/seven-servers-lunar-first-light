import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, path: string[]) {
  const origin = process.env.SCIENCE_ORIGIN || "";
  if (!origin) {
    return NextResponse.json(
      { status: "unavailable", detail: "Live recalculation is incomplete. SCIENCE_ORIGIN is empty." },
      { status: 503 },
    );
  }
  const target = `${origin.replace(/\/$/, "")}/${path.join("/")}${request.nextUrl.search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (process.env.SCIENCE_API_KEY) headers.set("authorization", `Bearer ${process.env.SCIENCE_API_KEY}`);
  const init: RequestInit = { method: request.method, headers, cache: "no-store" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.text();
  try {
    const response = await fetch(target, init);
    const body = await response.arrayBuffer();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") || "application/json" },
    });
  } catch {
    return NextResponse.json({ status: "unavailable", detail: "The science service did not respond." }, { status: 503 });
  }
}

export function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return context.params.then((params) => proxy(request, params.path));
}

export function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return context.params.then((params) => proxy(request, params.path));
}
