"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type { Game } from "@/lib/types";
import {
  PAST_ARC_OPACITY,
  SHOT_DRAW_DURATION,
  SHOT_HOLD_DURATION,
} from "@/lib/camera";
import { ProceduralCourt } from "./ProceduralCourt";
import { ShotArcTube, ShotLanding } from "./ShotArc";
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
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    fetch(`${base}/models/court.glb`, { method: "HEAD" })
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
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const { scene } = useGLTF(`${base}/models/court.glb`);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} />;
}

/**
 * Playback lives entirely in refs so React does not reset mid-animation.
 * UI counters are throttled via onState (~10 Hz).
 */
function PlaybackEngine({
  shotCount,
  playing,
  resetKey,
  shotIndexRef,
  drawProgressRef,
  finishedRef,
  onState,
}: {
  shotCount: number;
  playing: boolean;
  resetKey: string | number;
  shotIndexRef: React.MutableRefObject<number>;
  drawProgressRef: React.MutableRefObject<number>;
  finishedRef: React.MutableRefObject<boolean>;
  onState?: (s: PlaybackState) => void;
}) {
  const phase = useRef<"draw" | "hold">("draw");
  const holdT = useRef(0);
  const playingRef = useRef(playing);
  const uiAcc = useRef(0);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    shotIndexRef.current = 0;
    drawProgressRef.current = 0;
    finishedRef.current = false;
    phase.current = "draw";
    holdT.current = 0;
    onState?.({ playing: false, shotIndex: 0, progress: 0, finished: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset on game/replay key
  }, [resetKey, shotCount]);

  useFrame((_, dt) => {
    const isPlaying = playingRef.current;
    if (!isPlaying || finishedRef.current || shotCount === 0) {
      uiAcc.current += dt;
      if (uiAcc.current > 0.15) {
        uiAcc.current = 0;
        onState?.({
          playing: isPlaying,
          shotIndex: shotIndexRef.current,
          progress: drawProgressRef.current,
          finished: finishedRef.current,
        });
      }
      return;
    }

    if (phase.current === "draw") {
      drawProgressRef.current = Math.min(
        1,
        drawProgressRef.current + dt / SHOT_DRAW_DURATION,
      );
      if (drawProgressRef.current >= 1) {
        phase.current = "hold";
        holdT.current = 0;
      }
    } else {
      holdT.current += dt;
      if (holdT.current >= SHOT_HOLD_DURATION) {
        if (shotIndexRef.current >= shotCount - 1) {
          finishedRef.current = true;
          drawProgressRef.current = 1;
        } else {
          shotIndexRef.current += 1;
          drawProgressRef.current = 0;
          phase.current = "draw";
        }
      }
    }

    uiAcc.current += dt;
    if (uiAcc.current > 0.08 || finishedRef.current) {
      uiAcc.current = 0;
      onState?.({
        playing: true,
        shotIndex: shotIndexRef.current,
        progress: drawProgressRef.current,
        finished: finishedRef.current,
      });
    }
  });

  return null;
}

function SceneInner({ game, playing, onState, resetKey }: Props) {
  const shotIndexRef = useRef(0);
  const drawProgressRef = useRef(0);
  const finishedRef = useRef(false);

  // Stable callback — does NOT reset playback when identity changes
  const handleState = useCallback(
    (s: PlaybackState) => {
      onState?.(s);
    },
    [onState],
  );

  const shots = game.shots;

  return (
    <>
      <color attach="background" args={["#0B0E14"]} />
      <fog attach="fog" args={["#0B0E14", 90, 220]} />
      <hemisphereLight args={["#ffe8c8", "#1a2030", 0.55]} />
      <ambientLight intensity={0.4} />
      <directionalLight
        castShadow
        intensity={1.15}
        position={[35, 55, 40]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight intensity={0.35} position={[-20, 30, -25]} color="#a8c4ff" />

      <CameraRig introKey={resetKey} enabled />

      <group name="court-stationary" userData={{ stationary: true }}>
        <CourtLayer />
      </group>

      <PlaybackEngine
        shotCount={shots.length}
        playing={playing}
        resetKey={resetKey}
        shotIndexRef={shotIndexRef}
        drawProgressRef={drawProgressRef}
        finishedRef={finishedRef}
        onState={handleState}
      />

      {shots.map((shot, i) => (
        <React.Fragment key={`${shot.sequenceNumber}-${i}`}>
          <ShotArcTube
            shot={shot}
            index={i}
            shotIndexRef={shotIndexRef}
            drawProgressRef={drawProgressRef}
            finishedRef={finishedRef}
            pastOpacity={PAST_ARC_OPACITY}
          />
          <ShotLanding
            shot={shot}
            index={i}
            shotIndexRef={shotIndexRef}
            finishedRef={finishedRef}
            pastOpacity={PAST_ARC_OPACITY}
          />
        </React.Fragment>
      ))}
    </>
  );
}

export function Scene1World(props: Props) {
  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ fov: 42, near: 0.1, far: 500, position: [28, 38, 25] }}
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
        <SceneInner {...props} />
      </Canvas>
    </div>
  );
}
