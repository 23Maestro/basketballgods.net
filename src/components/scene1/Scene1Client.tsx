"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import type { PlayoffDataset, ShotStats } from "@/lib/types";
import type { PlaybackState } from "./Scene1World";

const Scene1World = dynamic(
  () => import("./Scene1World").then((m) => m.Scene1World),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-video w-full animate-pulse rounded-lg bg-zinc-900 border border-zinc-800" />
    ),
  },
);

type Props = {
  data: PlayoffDataset;
};

export function Scene1Client({ data }: Props) {
  const games = data.games;
  const [gameId, setGameId] = useState(games[0]?.gameId ?? 0);
  const game = useMemo(
    () => games.find((g) => g.gameId === gameId) ?? games[0],
    [games, gameId],
  );

  const [playing, setPlaying] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [pb, setPb] = useState<PlaybackState>({
    playing: false,
    shotIndex: 0,
    progress: 0,
    finished: false,
  });

  // Game change: clear arcs, reset to shot 1, auto-play
  useEffect(() => {
    setPlaying(false);
    setResetKey((k) => k + 1);
    setPb({ playing: false, shotIndex: 0, progress: 0, finished: false });
    const t = setTimeout(() => setPlaying(true), 80);
    return () => clearTimeout(t);
  }, [gameId]);

  // Fresh mount: begin animation
  useEffect(() => {
    setPlaying(true);
  }, []);

  const onState = useCallback((s: PlaybackState) => {
    setPb(s);
    if (s.finished) setPlaying(false);
  }, []);

  if (!game) return null;
  const s = game.stats;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <select
          className="w-full sm:max-w-xl rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          value={gameId}
          onChange={(e) => setGameId(Number(e.target.value))}
          aria-label="Playoff game"
        >
          {games.map((g) => (
            <option key={g.gameId} value={g.gameId}>
              {g.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
            onClick={() => setPlaying(true)}
          >
            ▶ Play
          </button>
          <button
            type="button"
            className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-white hover:bg-zinc-600"
            onClick={() => setPlaying(false)}
          >
            ⏸ Pause
          </button>
          <button
            type="button"
            className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm text-white hover:bg-zinc-600"
            onClick={() => {
              setPlaying(false);
              setResetKey((k) => k + 1);
              setTimeout(() => setPlaying(true), 50);
            }}
          >
            ↺ Replay
          </button>
          <span className="text-xs text-zinc-400 tabular-nums">
            Shot {Math.min(pb.shotIndex + 1, game.shots.length)} / {game.shots.length}
          </span>
        </div>
      </div>

      <motion.div
        key={gameId}
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <Scene1World
          game={game}
          playing={playing}
          resetKey={`${gameId}-${resetKey}`}
          onState={onState}
        />
      </motion.div>

      <StatRow stats={s} />
    </div>
  );
}

function StatRow({ stats }: { stats: ShotStats }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <Stat label="FG" value={`${stats.makes}-${stats.total_shots}`} sub={`${stats.fg_pct.toFixed(0)}%`} />
      <Stat label="Paint" value={`${stats.paint_makes}-${stats.paint_shots}`} sub={`${stats.paint_pct.toFixed(0)}%`} />
      <Stat label="3PT" value={`${stats.three_pt_makes}-${stats.three_pt_shots}`} sub={`${stats.fg3_pct.toFixed(0)}%`} />
      <Stat label="Perimeter" value={`${stats.perimeter_share.toFixed(0)}%`} />
      <Stat label="Paint share" value={`${stats.paint_share.toFixed(0)}%`} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/80 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-lg font-semibold text-zinc-100 tabular-nums">{value}</div>
      {sub ? <div className="text-xs text-emerald-500/90">{sub}</div> : null}
    </div>
  );
}
