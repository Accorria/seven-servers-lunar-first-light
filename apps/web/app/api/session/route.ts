import { NextResponse } from "next/server";
import { createSupabaseServer, supabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  if (!supabaseConfigured()) {
    return NextResponse.json({ configured: false, authenticated: false });
  }
  try {
    const supabase = await createSupabaseServer();
    if (!supabase) return NextResponse.json({ configured: false, authenticated: false });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return NextResponse.json({ configured: true, authenticated: false });
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, permissions, mission_specialist_id")
      .eq("id", user.id)
      .maybeSingle();
    return NextResponse.json({
      configured: true,
      authenticated: true,
      email: user.email ?? null,
      profile: profile
        ? {
            full_name: profile.full_name,
            role: profile.role,
            permissions: profile.permissions ?? [],
            mission_specialist_id: profile.mission_specialist_id,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ configured: true, authenticated: false });
  }
}

export function POST() {
  return NextResponse.json(
    { message: "Sign-in uses the account form. This route does not grant a role." },
    { status: 405 },
  );
}
