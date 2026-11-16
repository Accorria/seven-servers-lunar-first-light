import { NextResponse } from "next/server";
import { createSupabaseServer, supabaseConfigured } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = new URL("/", url.origin);
  if (!supabaseConfigured()) return NextResponse.redirect(destination);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServer();
    if (supabase) await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(destination);
}
