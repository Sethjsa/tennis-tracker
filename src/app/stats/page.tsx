import Link from "next/link";
import StatsView from "@/components/StatsView";

export default function StatsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Your tennis, by the numbers</h1>
        <Link
          href="/"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
          ← Log matches
        </Link>
      </header>
      <StatsView />
    </main>
  );
}
