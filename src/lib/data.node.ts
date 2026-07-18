import { readFile } from "fs/promises";
import { join } from "path";
import type { PlayoffDataset } from "./types";

/** Node/Vitest only — do not import from client components. */
export async function loadPlayoffDataFromFs(): Promise<PlayoffDataset> {
  const p = join(process.cwd(), "public/data/playoff-2026.json");
  const raw = await readFile(p, "utf-8");
  return JSON.parse(raw) as PlayoffDataset;
}
