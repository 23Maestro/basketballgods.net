"use client";

import { useMemo } from "react";
import {
  COURT_LENGTH,
  COURT_WIDTH,
  LEFT_RIM,
  RIGHT_RIM,
  SPURS_LINE,
  SPURS_PAINT,
  SPURS_WOOD,
} from "@/lib/court-constants";
import { toThree } from "@/lib/coords";

/** Stationary procedural court. Identity root transform — never animated. */
export function ProceduralCourt() {
  const linePositions = useMemo(() => buildCourtLines(), []);

  return (
    <group name="court-root">
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={toThree(COURT_LENGTH / 2, COURT_WIDTH / 2, 0)}
        receiveShadow
      >
        <planeGeometry args={[COURT_LENGTH, COURT_WIDTH]} />
        <meshStandardMaterial color={SPURS_WOOD} roughness={0.85} metalness={0.05} />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={toThree(9.5, 25, 0.01)}
        receiveShadow
      >
        <planeGeometry args={[19, 16]} />
        <meshStandardMaterial color={SPURS_PAINT} roughness={0.9} />
      </mesh>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={toThree(COURT_LENGTH - 9.5, 25, 0.01)}
        receiveShadow
      >
        <planeGeometry args={[19, 16]} />
        <meshStandardMaterial color={SPURS_PAINT} roughness={0.9} />
      </mesh>

      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={SPURS_LINE} />
      </lineSegments>

      <Rim x={LEFT_RIM.x} y={LEFT_RIM.y} />
      <Rim x={RIGHT_RIM.x} y={RIGHT_RIM.y} />
    </group>
  );
}

function Rim({ x, y }: { x: number; y: number }) {
  return (
    <mesh position={toThree(x, y, 0.08)} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.75, 0.07, 8, 32]} />
      <meshStandardMaterial color="#E8E8E8" metalness={0.55} roughness={0.35} />
    </mesh>
  );
}

function buildCourtLines(): Float32Array {
  const segs: number[] = [];
  const push = (x1: number, y1: number, x2: number, y2: number) => {
    const a = toThree(x1, y1, 0.03);
    const b = toThree(x2, y2, 0.03);
    segs.push(...a, ...b);
  };

  push(0, 0, COURT_LENGTH, 0);
  push(COURT_LENGTH, 0, COURT_LENGTH, COURT_WIDTH);
  push(COURT_LENGTH, COURT_WIDTH, 0, COURT_WIDTH);
  push(0, COURT_WIDTH, 0, 0);
  push(COURT_LENGTH / 2, 0, COURT_LENGTH / 2, COURT_WIDTH);

  const n = 48;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    push(
      COURT_LENGTH / 2 + 6 * Math.cos(a0),
      COURT_WIDTH / 2 + 6 * Math.sin(a0),
      COURT_LENGTH / 2 + 6 * Math.cos(a1),
      COURT_WIDTH / 2 + 6 * Math.sin(a1),
    );
  }
  push(0, 17, 19, 17);
  push(19, 17, 19, 33);
  push(19, 33, 0, 33);
  push(COURT_LENGTH, 17, COURT_LENGTH - 19, 17);
  push(COURT_LENGTH - 19, 17, COURT_LENGTH - 19, 33);
  push(COURT_LENGTH - 19, 33, COURT_LENGTH, 33);

  const r3 = 23.75;
  const rx = LEFT_RIM.x;
  const ry = LEFT_RIM.y;
  for (let i = 0; i < 40; i++) {
    const t0 = -Math.PI / 2 + (i / 40) * Math.PI;
    const t1 = -Math.PI / 2 + ((i + 1) / 40) * Math.PI;
    push(
      rx + r3 * Math.cos(t0),
      ry + r3 * Math.sin(t0),
      rx + r3 * Math.cos(t1),
      ry + r3 * Math.sin(t1),
    );
  }

  return new Float32Array(segs);
}
