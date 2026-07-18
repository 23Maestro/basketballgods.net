/**
 * Scene 1 camera path constants (Three.js Y-up: [x, y_up, z]).
 * Court data is Z-up feet; positions here are already in Three space
 * via toThree(length, width, height) => [length, height, width].
 *
 * Start: centered broadcast (left rim near frame center).
 * Path: shallow smile-curve into home angle.
 * Court stays fixed — only the camera moves.
 */

import type { Vector3Tuple } from "three";
import { toThree } from "./coords";

/** Fixed look-at target near left attacking basket. */
export const CAMERA_LOOK_AT: Vector3Tuple = toThree(8, 25, 1.2);

/**
 * Final home position — left-side broadcast angle
 * (adapted from Plotly eye framing).
 */
export const CAMERA_HOME: Vector3Tuple = toThree(42, -18, 28);

/** Centered broadcast start — left rim near horizontal center. */
export const CAMERA_START: Vector3Tuple = toThree(28, 25, 38);

/**
 * Smile-curve control point (Bezier mid).
 * Slight outward dip then settle into home.
 */
export const CAMERA_CURVE_CONTROL: Vector3Tuple = toThree(48, 4, 34);

/** Seconds for intro camera move. */
export const CAMERA_MOVE_DURATION = 2.4;

export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function bezier3(
  a: Vector3Tuple,
  b: Vector3Tuple,
  c: Vector3Tuple,
  t: number,
): Vector3Tuple {
  const u = 1 - t;
  return [
    u * u * a[0] + 2 * u * t * b[0] + t * t * c[0],
    u * u * a[1] + 2 * u * t * b[1] + t * t * c[1],
    u * u * a[2] + 2 * u * t * b[2] + t * t * c[2],
  ];
}

/** Seconds to draw one arc release → rim (snappy broadcast feel). */
export const SHOT_DRAW_DURATION = 0.42;
/** Pause after full arc before next shot. */
export const SHOT_HOLD_DURATION = 0.14;
/** Faded opacity of completed arcs while sequence continues. */
export const PAST_ARC_OPACITY = 0.38;
