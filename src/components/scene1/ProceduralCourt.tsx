"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
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
import { createPaintTexture, createWoodTexture } from "@/lib/woodTexture";

/**
 * Hardwood-forward procedural court (broadcast / VizRT language).
 * Stationary identity root — never animated.
 */
export function ProceduralCourt() {
  const woodMap = useMemo(() => createWoodTexture(), []);
  const paintMap = useMemo(() => createPaintTexture(), []);
  const linePositions = useMemo(() => buildCourtLines(), []);

  useEffect(() => {
    return () => {
      woodMap.dispose();
      paintMap.dispose();
    };
  }, [woodMap, paintMap]);

  return (
    <group name="court-root">
      {/* Soft apron under the floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={toThree(COURT_LENGTH / 2, COURT_WIDTH / 2, -0.03)}
        receiveShadow
      >
        <planeGeometry args={[COURT_LENGTH + 18, COURT_WIDTH + 18]} />
        <meshStandardMaterial color="#10141c" roughness={1} />
      </mesh>

      {/* Full hardwood */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={toThree(COURT_LENGTH / 2, COURT_WIDTH / 2, 0)}
        receiveShadow
      >
        <planeGeometry args={[COURT_LENGTH, COURT_WIDTH]} />
        <meshStandardMaterial
          map={woodMap}
          color={SPURS_WOOD}
          roughness={0.78}
          metalness={0.04}
        />
      </mesh>

      {/* Left key — wood-red stain, not solid black */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={toThree(9.5, 25, 0.02)}
        receiveShadow
      >
        <planeGeometry args={[19, 16]} />
        <meshStandardMaterial
          map={paintMap}
          color={SPURS_PAINT}
          roughness={0.82}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Right key */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={toThree(COURT_LENGTH - 9.5, 25, 0.02)}
        receiveShadow
      >
        <planeGeometry args={[19, 16]} />
        <meshStandardMaterial
          map={paintMap}
          color={SPURS_PAINT}
          roughness={0.82}
          transparent
          opacity={0.9}
        />
      </mesh>

      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={SPURS_LINE} transparent opacity={0.95} />
      </lineSegments>

      <Hoop x={LEFT_RIM.x} y={LEFT_RIM.y} side="left" />
      <Hoop x={RIGHT_RIM.x} y={RIGHT_RIM.y} side="right" />
    </group>
  );
}

function Hoop({
  x,
  y,
  side,
}: {
  x: number;
  y: number;
  side: "left" | "right";
}) {
  // group origin at rim center in three-space
  const [tx, , tz] = toThree(x, y, 0);
  const boardOffset = side === "left" ? -1.2 : 1.2;

  return (
    <group position={[tx, 0, tz]}>
      {/* Backboard */}
      <mesh position={[boardOffset, 2.2, 0]}>
        <boxGeometry args={[0.12, 3.5, 6]} />
        <meshStandardMaterial color="#F7F7F7" roughness={0.4} metalness={0.1} transparent opacity={0.85} />
      </mesh>
      {/* Rim */}
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.75, 0.08, 10, 36]} />
        <meshStandardMaterial color="#F0F0F0" metalness={0.65} roughness={0.28} />
      </mesh>
      {/* Soft net cone */}
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.55, 0.32, 0.75, 14, 1, true]} />
        <meshStandardMaterial
          color="#EEEEEE"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function buildCourtLines(): Float32Array {
  const segs: number[] = [];
  const push = (x1: number, y1: number, x2: number, y2: number, z = 0.05) => {
    const a = toThree(x1, y1, z);
    const b = toThree(x2, y2, z);
    segs.push(...a, ...b);
  };
  const arc = (
    cx: number,
    cy: number,
    r: number,
    a0: number,
    a1: number,
    steps = 36,
  ) => {
    for (let i = 0; i < steps; i++) {
      const t0 = a0 + ((a1 - a0) * i) / steps;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / steps;
      push(
        cx + r * Math.cos(t0),
        cy + r * Math.sin(t0),
        cx + r * Math.cos(t1),
        cy + r * Math.sin(t1),
      );
    }
  };

  push(0, 0, COURT_LENGTH, 0);
  push(COURT_LENGTH, 0, COURT_LENGTH, COURT_WIDTH);
  push(COURT_LENGTH, COURT_WIDTH, 0, COURT_WIDTH);
  push(0, COURT_WIDTH, 0, 0);
  push(COURT_LENGTH / 2, 0, COURT_LENGTH / 2, COURT_WIDTH);
  arc(COURT_LENGTH / 2, COURT_WIDTH / 2, 6, 0, Math.PI * 2, 48);

  push(0, 17, 19, 17);
  push(19, 17, 19, 33);
  push(19, 33, 0, 33);
  push(COURT_LENGTH, 17, COURT_LENGTH - 19, 17);
  push(COURT_LENGTH - 19, 17, COURT_LENGTH - 19, 33);
  push(COURT_LENGTH - 19, 33, COURT_LENGTH, 33);

  arc(19, 25, 6, -Math.PI / 2, Math.PI / 2, 28);
  arc(COURT_LENGTH - 19, 25, 6, Math.PI / 2, (3 * Math.PI) / 2, 28);
  arc(LEFT_RIM.x, LEFT_RIM.y, 4, -Math.PI / 2, Math.PI / 2, 24);
  arc(RIGHT_RIM.x, RIGHT_RIM.y, 4, Math.PI / 2, (3 * Math.PI) / 2, 24);

  const r3 = 23.75;
  arc(LEFT_RIM.x, LEFT_RIM.y, r3, -Math.PI / 2 + 0.12, Math.PI / 2 - 0.12, 42);
  arc(RIGHT_RIM.x, RIGHT_RIM.y, r3, Math.PI / 2 + 0.12, (3 * Math.PI) / 2 - 0.12, 42);

  const cornerY = Math.sqrt(Math.max(0, r3 * r3 - 22 * 22));
  push(0, 3, LEFT_RIM.x + cornerY * 0 + (LEFT_RIM.x + Math.sqrt(Math.max(0, r3 * r3 - 22 * 22))), 3);
  // cleaner corners:
  const leftCornerX = LEFT_RIM.x + Math.sqrt(Math.max(0, r3 * r3 - 22 * 22));
  push(0, 3, leftCornerX, 3);
  push(0, 47, leftCornerX, 47);

  return new Float32Array(segs);
}
