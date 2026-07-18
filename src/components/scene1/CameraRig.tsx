"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  CAMERA_CURVE_CONTROL,
  CAMERA_HOME,
  CAMERA_LOOK_AT,
  CAMERA_MOVE_DURATION,
  CAMERA_START,
  bezier3,
  easeInOutCubic,
} from "@/lib/camera";

type Props = {
  /** Bump to replay intro camera (game change / remount) */
  introKey: string | number;
  enabled: boolean;
};

/**
 * Smile-curve camera intro. Court never moves.
 * No OrbitControls — user cannot drag/zoom during presentation.
 */
export function CameraRig({ introKey, enabled }: Props) {
  const { camera } = useThree();
  const t0 = useRef<number | null>(null);
  const done = useRef(false);
  const look = useRef(new THREE.Vector3(...CAMERA_LOOK_AT));

  useEffect(() => {
    t0.current = null;
    done.current = false;
    camera.position.set(...CAMERA_START);
    camera.lookAt(look.current);
    camera.updateProjectionMatrix();
  }, [introKey, camera]);

  useFrame(({ clock }) => {
    if (!enabled || done.current) {
      if (done.current) {
        camera.position.set(...CAMERA_HOME);
        camera.lookAt(look.current);
      }
      return;
    }
    if (t0.current === null) t0.current = clock.getElapsedTime();
    const elapsed = clock.getElapsedTime() - t0.current;
    const t = easeInOutCubic(Math.min(1, elapsed / CAMERA_MOVE_DURATION));
    const pos = bezier3(CAMERA_START, CAMERA_CURVE_CONTROL, CAMERA_HOME, t);
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(look.current);
    if (t >= 1) done.current = true;
  });

  return null;
}

export function getCameraHome() {
  return [...CAMERA_HOME] as [number, number, number];
}

export function getCameraLookAt() {
  return [...CAMERA_LOOK_AT] as [number, number, number];
}
