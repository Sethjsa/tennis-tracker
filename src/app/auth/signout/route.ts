import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const supabase = createSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
