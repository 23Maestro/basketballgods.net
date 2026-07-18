"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Shot } from "@/lib/types";
import { COLOR_MADE, COLOR_MISS } from "@/lib/court-constants";
import { toThree } from "@/lib/coords";

type Props = {
  shot: Shot;
  index: number;
  shotIndexRef: React.MutableRefObject<number>;
  drawProgressRef: React.MutableRefObject<number>;
  finishedRef: React.MutableRefObject<boolean>;
  pastOpacity: number;
};

/**
 * Thick tube arc that draws release → rim.
 * Progress is read from refs each frame so React state does not thrash.
 */
export function ShotArcTube({
  shot,
  index,
  shotIndexRef,
  drawProgressRef,
  finishedRef,
  pastOpacity,
}: Props) {
  const color = shot.made ? COLOR_MADE : COLOR_MISS;
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const { curve, pointCount } = useMemo(() => {
    const pts = shot.arcLeft.map(([x, y, z]) => {
      const t = toThree(x, y, z);
      return new THREE.Vector3(t[0], t[1], t[2]);
    });
    if (pts.length < 2) {
      const z = new THREE.Vector3();
      return {
        curve: new THREE.CatmullRomCurve3([z, z.clone()]),
        pointCount: 2,
      };
    }
    return {
      curve: new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5),
      pointCount: pts.length,
    };
  }, [shot.arcLeft]);

  const geometry = useMemo(() => {
    const segs = Math.max(12, pointCount * 3);
    return new THREE.TubeGeometry(curve, segs, 0.16, 8, false);
  }, [curve, pointCount]);

  useLayoutEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame(() => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;

    let progress = 0;
    let opacity = 0;
    const si = shotIndexRef.current;
    const finished = finishedRef.current;

    if (finished || index < si) {
      progress = 1;
      opacity = finished ? 1 : pastOpacity;
    } else if (index === si) {
      progress = drawProgressRef.current;
      opacity = 1;
    } else {
      progress = 0;
      opacity = 0;
    }

    mesh.visible = progress > 0.02 && opacity > 0.02;
    if (!mesh.visible) return;

    // Progressive reveal via scale on a group would squash the tube;
    // use drawRange on indexed geometry instead.
    const indexAttr = geometry.index;
    const total = indexAttr ? indexAttr.count : geometry.attributes.position.count;
    const count = Math.max(3, Math.floor(total * Math.min(1, Math.max(0.02, progress))));
    geometry.setDrawRange(0, count);

    mat.opacity = opacity;
    mat.emissiveIntensity = 0.35 + 0.45 * (index === si && !finished ? 1 : 0.3);
  });

  return (
    <mesh ref={meshRef} geometry={geometry} frustumCulled={false}>
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={color}
        emissiveIntensity={0.4}
        transparent
        opacity={1}
        roughness={0.35}
        metalness={0.15}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Landing ring on the floor at release point (VizRT-style). */
export function ShotLanding({
  shot,
  index,
  shotIndexRef,
  finishedRef,
  pastOpacity,
}: {
  shot: Shot;
  index: number;
  shotIndexRef: React.MutableRefObject<number>;
  finishedRef: React.MutableRefObject<boolean>;
  pastOpacity: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const color = shot.made ? COLOR_MADE : COLOR_MISS;
  const pos = useMemo(() => {
    const [x, y] = [shot.courtLeft.x, shot.courtLeft.y];
    return toThree(x, y, 0.06);
  }, [shot.courtLeft.x, shot.courtLeft.y]);

  useFrame(() => {
    const mesh = ref.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;
    const si = shotIndexRef.current;
    const finished = finishedRef.current;
    let opacity = 0;
    if (finished || index <= si) {
      opacity = finished ? 0.9 : index < si ? pastOpacity : 1;
    }
    mesh.visible = opacity > 0.05;
    mat.opacity = opacity;
  });

  return (
    <mesh ref={ref} position={pos} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.35, 0.55, 24]} />
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
