"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg(
          "Account created. If email confirmation is on, check your inbox — otherwise sign in.",
        );
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/");
        router.refresh();
      }
    } catch (err: any) {
      setMsg(err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight">🎾 Tennis Diary</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Log the matches you&apos;ve watched.
          </p>
        </div>
        <form
          onSubmit={submit}
          className="space-y-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm"
        >
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 outline-none focus:border-neutral-500"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 outline-none focus:border-neutral-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 px-3 py-2 font-medium text-white"
          >
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          {msg && <p className="text-sm text-amber-600">{msg}</p>}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-center text-sm text-neutral-500 hover:underline"
          >
            {mode === "signin"
              ? "Need an account? Sign up"
              : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
