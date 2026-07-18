import * as THREE from "three";
import { SPURS_WOOD, SPURS_WOOD_DARK, SPURS_WOOD_LIGHT } from "./court-constants";

/** Lightweight procedural hardwood (no external assets). */
export function createWoodTexture(opts?: {
  width?: number;
  height?: number;
  base?: string;
  dark?: string;
  light?: string;
}): THREE.CanvasTexture {
  const w = opts?.width ?? 512;
  const h = opts?.height ?? 256;
  const base = opts?.base ?? SPURS_WOOD;
  const dark = opts?.dark ?? SPURS_WOOD_DARK;
  const light = opts?.light ?? SPURS_WOOD_LIGHT;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Base fill
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Plank strips
  const plankH = h / 8;
  for (let i = 0; i < 8; i++) {
    const y = i * plankH;
    const shade = i % 2 === 0 ? light : dark;
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = shade;
    ctx.fillRect(0, y, w, plankH);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }

  // Grain noise lines
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 120; i++) {
    const y = Math.random() * h;
    const x0 = Math.random() * w;
    ctx.strokeStyle = Math.random() > 0.5 ? dark : light;
    ctx.lineWidth = 0.6 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.bezierCurveTo(
      x0 + 40,
      y + (Math.random() - 0.5) * 4,
      x0 + 80,
      y + (Math.random() - 0.5) * 4,
      x0 + 120 + Math.random() * 80,
      y,
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createPaintTexture(): THREE.CanvasTexture {
  // Slightly translucent wood-red stain feel
  return createWoodTexture({
    base: "#9C4030",
    dark: "#6B2A1E",
    light: "#B85A45",
    width: 256,
    height: 256,
  });
}
