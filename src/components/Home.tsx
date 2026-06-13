"use client";

import { useState } from "react";
import Dashboard from "./Dashboard";
import Diary from "./Diary";

export default function Home() {
  const [tab, setTab] = useState<"dashboard" | "log">("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-5">
      <div className="flex gap-1">
        {(["dashboard", "log"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t ? "bg-green-600 text-white" : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            }`}>
            {t === "dashboard" ? "Dashboard" : "Log a match"}
          </button>
        ))}
      </div>

      {tab === "dashboard" ? (
        <Dashboard refreshKey={refreshKey} />
      ) : (
        <Diary onSaved={() => setRefreshKey((k) => k + 1)} />
      )}
    </div>
  );
}
