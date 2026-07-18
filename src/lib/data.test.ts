import { describe, expect, it } from "vitest";
import {
  arcEndsNearLeftRim,
  assertPaintPerimeterPartition,
  filterShots,
  isChronological,
} from "./data";
import { loadPlayoffDataFromFs } from "./data.node";
import { CAMERA_HOME, CAMERA_LOOK_AT, CAMERA_START, bezier3, easeInOutCubic } from "./camera";

describe("playoff dataset parity", () => {
  it("loads 22 games and chronological shots", async () => {
    const data = await loadPlayoffDataFromFs();
    expect(data.meta.gameCount).toBe(22);
    expect(data.games).toHaveLength(22);
    expect(data.meta.totalShots).toBe(366);
    expect(data.fullPlayoffStats.makes).toBe(176);
    expect(data.fullPlayoffStats.total_shots).toBe(366);
    expect(assertPaintPerimeterPartition(data.fullPlayoffStats)).toBe(true);

    for (const g of data.games) {
      expect(isChronological(g.shots)).toBe(true);
      const makes = g.shots.filter((s) => s.made).length;
      expect(makes).toBe(g.stats.makes);
      expect(g.shots.length).toBe(g.stats.total_shots);
    }
  });

  it("Scene 1 arcs terminate toward left basket", async () => {
    const data = await loadPlayoffDataFromFs();
    const rim = data.meta.leftRim;
    let checked = 0;
    for (const g of data.games) {
      for (const s of g.shots) {
        expect(s.arcLeft.length).toBeGreaterThan(2);
        expect(arcEndsNearLeftRim(s, rim, 4)).toBe(true);
        // Arc polyline aims at left rim (x≈5.25)
        const last = s.arcLeft[s.arcLeft.length - 1];
        expect(last[0]).toBeLessThan(20);
        checked++;
      }
    }
    expect(checked).toBe(366);
  });

  it("Scene 2 filters return correct counts", async () => {
    const data = await loadPlayoffDataFromFs();
    const all = data.games.flatMap((g) => g.shots);
    expect(filterShots(all, "all")).toHaveLength(366);
    expect(filterShots(all, "paint")).toHaveLength(data.fullPlayoffStats.paint_shots);
    expect(filterShots(all, "perimeter")).toHaveLength(
      data.fullPlayoffStats.perimeter_shots,
    );
    expect(filterShots(all, "three")).toHaveLength(data.fullPlayoffStats.three_pt_shots);
  });

  it("camera path ends at home with fixed look-at", () => {
    const end = bezier3(CAMERA_START, CAMERA_START, CAMERA_HOME, easeInOutCubic(1));
    expect(end[0]).toBeCloseTo(CAMERA_HOME[0], 5);
    expect(end[1]).toBeCloseTo(CAMERA_HOME[1], 5);
    expect(end[2]).toBeCloseTo(CAMERA_HOME[2], 5);
    expect(CAMERA_LOOK_AT[0]).toBeLessThan(20); // near left rim
  });
});
