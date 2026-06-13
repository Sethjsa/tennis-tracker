import { createSupabaseServer } from "@/lib/supabaseServer";
import Home from "@/components/Home";

export default async function HomePage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">🎾 Tennis Diary</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline text-neutral-400">{user?.email}</span>
          <form action="/auth/signout" method="post">
            <button className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <Home />
    </main>
  );
}
