"use client";

import { useMemo } from "react";
import type { Shot } from "@/lib/types";
import { COLOR_MADE, COLOR_MISS } from "@/lib/court-constants";
import { toThree } from "@/lib/coords";

type Props = {
  shot: Shot;
  progress: number;
  opacity: number;
};

export function ShotArcLine({ shot, progress, opacity }: Props) {
  const color = shot.made ? COLOR_MADE : COLOR_MISS;

  const positions = useMemo(() => {
    const n = Math.max(
      2,
      Math.floor(shot.arcLeft.length * Math.min(1, Math.max(0.05, progress))),
    );
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const [x, y, z] = shot.arcLeft[i];
      const t = toThree(x, y, z);
      arr[i * 3] = t[0];
      arr[i * 3 + 1] = t[1];
      arr[i * 3 + 2] = t[2];
    }
    return arr;
  }, [shot.arcLeft, progress]);

  if (progress <= 0.001 || opacity <= 0.01) return null;

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  );
}
