import type { Game, PlayoffDataset, Shot, ShotStats } from "./types";

let cached: PlayoffDataset | null = null;

export async function loadPlayoffData(): Promise<PlayoffDataset> {
  if (cached) return cached;
  const res = await fetch("/data/playoff-2026.json", { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to load playoff data: ${res.status}`);
  cached = (await res.json()) as PlayoffDataset;
  return cached;
}

export function getGame(data: PlayoffDataset, gameId: number): Game | undefined {
  return data.games.find((g) => g.gameId === gameId);
}

export function filterShots(
  shots: Shot[],
  mode: "all" | "paint" | "perimeter" | "three",
): Shot[] {
  switch (mode) {
    case "paint":
      return shots.filter((s) => s.isPaint);
    case "perimeter":
      return shots.filter((s) => s.isPerimeter);
    case "three":
      return shots.filter((s) => s.isThree);
    default:
      return shots;
  }
}

export function allShots(data: PlayoffDataset): Shot[] {
  return data.games.flatMap((g) => g.shots);
}

export function assertPaintPerimeterPartition(stats: ShotStats): boolean {
  return stats.paint_shots + stats.perimeter_shots === stats.total_shots;
}

export function isChronological(shots: Shot[]): boolean {
  for (let i = 1; i < shots.length; i++) {
    if (shots[i].shotOrder < shots[i - 1].shotOrder) return false;
  }
  return true;
}

export function leftRimTarget(data: PlayoffDataset): { x: number; y: number } {
  return { x: data.meta.leftRim.x, y: data.meta.leftRim.y };
}

export function arcEndsNearLeftRim(
  shot: Shot,
  leftRim: { x: number; y: number },
  tol = 3.5,
): boolean {
  if (!shot.arcLeft.length) return false;
  const last = shot.arcLeft[shot.arcLeft.length - 1];
  const first = shot.arcLeft[0];
  const dist = Math.hypot(last[0] - leftRim.x, last[1] - leftRim.y);
  const d0 = Math.hypot(first[0] - leftRim.x, first[1] - leftRim.y);
  // Made: full arc ends on rim. Miss: shortened but not farther than start.
  // Tip/rim attempts can start and end on the rim (dist ≈ d0 ≈ 0).
  if (dist <= tol) return true;
  return dist <= d0 + 1e-6;
}
