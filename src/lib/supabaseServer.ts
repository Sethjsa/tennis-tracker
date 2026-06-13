import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Auth-aware Supabase client for Server Components, Route Handlers and Server Actions.
// Reads/writes the session cookie so RLS sees the logged-in user.
export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only — safe to ignore;
            // middleware refreshes the session.
          }
        },
      },
    },
  );
}
