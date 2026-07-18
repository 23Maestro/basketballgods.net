"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { Game, Shot } from "@/lib/types";
import { PAST_ARC_OPACITY, SHOT_DRAW_DURATION, SHOT_HOLD_DURATION } from "@/lib/camera";
import { ProceduralCourt } from "./ProceduralCourt";
import { ShotArcLine } from "./ShotArc";
import { CameraRig } from "./CameraRig";

export type PlaybackState = {
  playing: boolean;
  shotIndex: number;
  progress: number;
  finished: boolean;
};

type Props = {
  game: Game;
  playing: boolean;
  onState?: (s: PlaybackState) => void;
  resetKey: string | number;
};

function CourtLayer() {
  const [mode, setMode] = useState<"proc" | "glb">("proc");
  useEffect(() => {
    let cancelled = false;
    fetch("/models/court.glb", { method: "HEAD" })
      .then((r) => {
        if (!cancelled && r.ok) setMode("glb");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (mode === "glb") {
    return (
      <React.Suspense fallback={<ProceduralCourt />}>
        <GlbCourt />
      </React.Suspense>
    );
  }
  return <ProceduralCourt />;
}

function GlbCourt() {
  const { scene } = useGLTF("/models/court.glb");
  const cloned = useMemo(() => scene.clone(true), [scene]);
  // Identity transform — court never moves
  return <primitive object={cloned} />;
}

function PlaybackController({
  shots,
  playing,
  resetKey,
  onState,
}: {
  shots: Shot[];
  playing: boolean;
  resetKey: string | number;
  onState?: (s: PlaybackState) => void;
}) {
  const shotIndex = useRef(0);
  const progress = useRef(0);
  const phase = useRef<"draw" | "hold">("draw");
  const finished = useRef(false);
  const holdT = useRef(0);

  useEffect(() => {
    shotIndex.current = 0;
    progress.current = 0;
    phase.current = "draw";
    finished.current = false;
    holdT.current = 0;
    onState?.({ playing: false, shotIndex: 0, progress: 0, finished: false });
  }, [resetKey, shots, onState]);

  useFrame((_, dt) => {
    if (!playing || finished.current || shots.length === 0) {
      onState?.({
        playing,
        shotIndex: shotIndex.current,
        progress: progress.current,
        finished: finished.current,
      });
      return;
    }

    if (phase.current === "draw") {
      progress.current = Math.min(1, progress.current + dt / SHOT_DRAW_DURATION);
      if (progress.current >= 1) {
        phase.current = "hold";
        holdT.current = 0;
      }
    } else {
      holdT.current += dt;
      if (holdT.current >= SHOT_HOLD_DURATION) {
        if (shotIndex.current >= shots.length - 1) {
          finished.current = true;
          progress.current = 1;
        } else {
          shotIndex.current += 1;
          progress.current = 0;
          phase.current = "draw";
        }
      }
    }

    onState?.({
      playing,
      shotIndex: shotIndex.current,
      progress: progress.current,
      finished: finished.current,
    });
  });

  return null;
}

function Arcs({
  shots,
  shotIndex,
  progress,
  finished,
}: {
  shots: Shot[];
  shotIndex: number;
  progress: number;
  finished: boolean;
}) {
  return (
    <>
      {shots.map((shot, i) => {
        let p = 0;
        let opacity = 0;
        if (finished || i < shotIndex) {
          p = 1;
          opacity = finished ? 1 : PAST_ARC_OPACITY;
        } else if (i === shotIndex) {
          p = progress;
          opacity = 1;
        }
        return (
          <ShotArcLine
            key={`${shot.sequenceNumber}-${i}`}
            shot={shot}
            progress={p}
            opacity={opacity}
          />
        );
      })}
    </>
  );
}

function SceneInner({ game, playing, onState, resetKey }: Props) {
  const [pb, setPb] = useState<PlaybackState>({
    playing: false,
    shotIndex: 0,
    progress: 0,
    finished: false,
  });

  const handleState = (s: PlaybackState) => {
    setPb(s);
    onState?.(s);
  };

  return (
    <>
      <color attach="background" args={["#0E1117"]} />
      <hemisphereLight args={["#b1e1ff", "#3a3a3a", 0.55]} />
      <ambientLight intensity={0.35} />
      <directionalLight castShadow intensity={1.05} position={[40, 55, 60]} />

      <CameraRig introKey={resetKey} enabled />

      {/* Court is stationary: fixed identity transform, never animated */}
      <group name="court-stationary" userData={{ stationary: true }}>
        <CourtLayer />
      </group>

      <PlaybackController
        shots={game.shots}
        playing={playing}
        resetKey={resetKey}
        onState={handleState}
      />
      <Arcs
        shots={game.shots}
        shotIndex={pb.shotIndex}
        progress={pb.progress}
        finished={pb.finished}
      />
    </>
  );
}

export function Scene1World(props: Props) {
  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 42, near: 0.1, far: 500, position: [28, 25, 38] }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener(
            "wheel",
            (e) => {
              e.preventDefault();
            },
            { passive: false },
          );
        }}
      >
        {/* No OrbitControls */}
        <SceneInner {...props} />
      </Canvas>
    </div>
  );
}
