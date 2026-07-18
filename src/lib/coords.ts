/**
 * Court data uses feet with Z-up (x=length, y=width, z=height).
 * Three.js is Y-up — convert for rendering.
 */
export function toThree(x: number, y: number, z: number): [number, number, number] {
  return [x, z, y];
}
