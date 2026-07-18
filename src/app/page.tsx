import { readFile } from "fs/promises";
import { join } from "path";
import type { PlayoffDataset } from "@/lib/types";
import { ShotLab } from "@/components/ShotLab";

async function loadData(): Promise<PlayoffDataset> {
  const p = join(process.cwd(), "public/data/playoff-2026.json");
  const raw = await readFile(p, "utf-8");
  return JSON.parse(raw) as PlayoffDataset;
}

export default async function Page() {
  const data = await loadData();
  return (
    <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
          🏀 {data.meta.player} — {data.meta.season} Playoff Shots
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {data.fullPlayoffStats.label} · {data.meta.gameCount} games · ESPN PBP
        </p>
      </header>
      <ShotLab data={data} />
    </main>
  );
}
