"use client";

import { useMemo, useState } from "react";
import type { PlayoffDataset, Shot } from "@/lib/types";
import { allShots, filterShots } from "@/lib/data";
import {
  COLOR_MADE_2D,
  COLOR_MISS_2D,
  SPURS_BG,
  SPURS_LINE,
  SPURS_PAINT,
  SPURS_WOOD,
} from "@/lib/court-constants";

/** ESPN half-court: rim at (25,0), baseline behind at -5.25, half ~41.75 */
const BASELINE = -5.25;
const HALF = 41.75;
const W = 50;
const H = HALF - BASELINE;

type Filter = "all" | "paint" | "perimeter" | "three";

export function Scene2Chart({ data }: { data: PlayoffDataset }) {
  const [mode, setMode] = useState<Filter>("all");
  const shots = useMemo(() => filterShots(allShots(data), mode), [data, mode]);
  const stats = data.fullPlayoffStats;

  // SVG viewBox in court feet; y flipped for screen (baseline at bottom)
  const vb = `-1.5 ${BASELINE - 1.5} ${W + 3} ${H + 3}`;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Card label="FGM / FGA" value={`${stats.makes} / ${stats.total_shots}`} sub={`${stats.fg_pct.toFixed(1)}%`} />
        <Card label="Paint" value={`${stats.paint_makes}-${stats.paint_shots}`} sub={`${stats.paint_share.toFixed(0)}%`} />
        <Card label="Perimeter" value={`${stats.perimeter_makes}-${stats.perimeter_shots}`} sub={`${stats.perimeter_share.toFixed(0)}%`} />
        <Card label="3PT" value={`${stats.three_pt_makes}-${stats.three_pt_shots}`} sub={`${stats.fg3_pct.toFixed(1)}%`} />
        <Card label="Games" value={`${stats.games}`} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "paint", "perimeter", "three"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setMode(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              mode === f
                ? "bg-zinc-100 text-zinc-900"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {f === "all" ? "All" : f === "three" ? "3PT" : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-xs text-zinc-400 self-center">
          {data.meta.player}: {stats.label} · showing {shots.length}
        </span>
      </div>

      <div className="w-full aspect-video rounded-lg border border-zinc-800 overflow-hidden bg-black">
        <svg
          viewBox={vb}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Full playoff shot chart"
        >
          {/* flip y so baseline is at bottom of frame */}
          <g transform={`scale(1,-1) translate(0, ${-(BASELINE + HALF)})`}>
            <rect x={-1.5} y={BASELINE - 1.5} width={W + 3} height={H + 3} fill={SPURS_BG} />
            <rect x={0} y={BASELINE} width={W} height={H} fill={SPURS_WOOD} />
            <rect x={17} y={BASELINE} width={16} height={19 + BASELINE} fill={SPURS_PAINT} />
            {/* outer */}
            <path
              d={`M0 ${BASELINE} H50 V${HALF} H0 Z`}
              fill="none"
              stroke={SPURS_LINE}
              strokeWidth={0.25}
            />
            {/* paint outline */}
            <path
              d={`M17 ${BASELINE} H33 V${13.75} H17 Z`}
              fill="none"
              stroke={SPURS_LINE}
              strokeWidth={0.2}
            />
            {/* rim */}
            <circle cx={25} cy={0} r={0.75} fill="none" stroke="#E8E8E8" strokeWidth={0.2} />
            {/* 3pt arc approx */}
            <path
              d={threePointPath()}
              fill="none"
              stroke={SPURS_LINE}
              strokeWidth={0.22}
            />
            {shots.map((s, i) => (
              <circle
                key={`${s.sequenceNumber}-${i}`}
                cx={s.halfcourt.x}
                cy={s.halfcourt.y}
                r={0.55}
                fill={s.made ? COLOR_MADE_2D : COLOR_MISS_2D}
                opacity={s.made ? 0.95 : 0.8}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

function threePointPath(): string {
  const r = 23.75;
  const cx = 25;
  const cy = 0;
  const cornerY = Math.sqrt(Math.max(0, r * r - 22 * 22));
  const a0 = Math.atan2(cornerY, -22);
  const a1 = Math.atan2(cornerY, 22);
  const steps = 40;
  let d = `M 3 ${BASELINE} L 3 ${cornerY}`;
  for (let i = 0; i <= steps; i++) {
    const t = a0 + ((a1 - a0) * i) / steps;
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    d += ` L ${x} ${y}`;
  }
  d += ` L 47 ${cornerY} L 47 ${BASELINE}`;
  return d;
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/80 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-lg font-semibold text-zinc-100 tabular-nums">{value}</div>
      {sub ? <div className="text-xs text-zinc-400">{sub}</div> : null}
    </div>
  );
}
