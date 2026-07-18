#!/usr/bin/env python3
"""
Export Victor Wembanyama 2026 playoff FG data for the Next.js app.

Uses existing helpers.py (ESPN/sportsdataverse pipeline) as source of truth.
Writes public/data/playoff-2026.json — no Python needed at request time.
"""
from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from helpers import (  # noqa: E402
    BasketballShot,
    COURT_LENGTH,
    DEFAULT_PLAYER,
    DEFAULT_SEASON,
    FULL_RIM_X,
    FULL_RIM_Y,
    compute_shot_stats,
    load_playoff_field_goals,
    map_espn_to_fullcourt,
    playoff_game_labels,
    sort_shots_chronological,
)

LEFT_RIM_X = COURT_LENGTH - FULL_RIM_X  # 5.25
LEFT_RIM_Y = FULL_RIM_Y  # 25.0
OUT = ROOT / "public" / "data" / "playoff-2026.json"


def _json_safe(v):
    if v is None:
        return None
    if isinstance(v, (bool, str)):
        return v
    if isinstance(v, (int,)):
        return int(v)
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return float(v)
    # numpy / pandas scalars
    try:
        import numpy as np

        if isinstance(v, (np.integer,)):
            return int(v)
        if isinstance(v, (np.floating,)):
            f = float(v)
            return None if math.isnan(f) or math.isinf(f) else f
        if isinstance(v, (np.bool_,)):
            return bool(v)
    except Exception:
        pass
    return str(v)


def to_left_court(court_x: float, court_y: float) -> tuple[float, float]:
    """Mirror full-court coords so offensive basket is on the LEFT."""
    return COURT_LENGTH - float(court_x), float(court_y)


def arc_points_left(start_x: float, start_y: float, made: bool) -> list[list[float]]:
    """Spline points from release → left rim (same parabola as BasketballShot)."""
    shot = BasketballShot(
        start_x=start_x,
        start_y=start_y,
        shot_id="export",
        desc="",
        made=made,
        team="home",
        quarter="",
        clock="",
    )
    # Override hoop to left basket
    shot.hx = LEFT_RIM_X
    shot.hy = LEFT_RIM_Y
    df = shot.to_df()
    return [
        [float(r.x), float(r.y), float(r.z)]
        for r in df.itertuples(index=False)
    ]


def stats_dict(df) -> dict:
    s = compute_shot_stats(df)
    return {k: _json_safe(v) for k, v in s.items()}


def main() -> None:
    player = DEFAULT_PLAYER
    season = DEFAULT_SEASON
    print(f"Loading {player} season {season} playoff FGs…")
    all_fg = load_playoff_field_goals(player_name=player, season=season)
    if all_fg.empty:
        raise SystemExit("No field goals loaded")

    labels = playoff_game_labels(season)
    label_map: dict[int, str] = {}
    order_ids: list[int] = []
    if not labels.empty:
        for r in labels.itertuples():
            gid = int(r.gameId)
            label_map[gid] = str(r.display)
            if gid not in order_ids:
                order_ids.append(gid)

    games_with_shots = sorted(int(g) for g in all_fg["gameId"].unique())
    # Chronological: follow schedule order when present
    ordered_gids = [g for g in order_ids if g in set(games_with_shots)]
    for g in games_with_shots:
        if g not in ordered_gids:
            ordered_gids.append(g)

    games_out = []
    for gid in ordered_gids:
        gdf = sort_shots_chronological(all_fg[all_fg["gameId"] == gid].copy())
        shots_out = []
        for i, row in gdf.iterrows():
            ex = float(row["espn_x"]) if row.get("espn_x") == row.get("espn_x") else None
            ey = float(row["espn_y"]) if row.get("espn_y") == row.get("espn_y") else None
            if ex is None or ey is None:
                continue
            cx, cy = map_espn_to_fullcourt(ex, ey)
            lx, ly = to_left_court(cx, cy)
            made = bool(row.get("made", False))
            arc = arc_points_left(lx, ly, made)
            # Verify last point near left rim for made (or near for miss cut)
            shots_out.append(
                {
                    "shotOrder": len(shots_out),
                    "sequenceNumber": _json_safe(row.get("sequenceNumber")),
                    "quarter": _json_safe(row.get("quarter")),
                    "clock": _json_safe(row.get("clock")),
                    "made": made,
                    "text": _json_safe(row.get("text")),
                    "espn": {"x": ex, "y": ey},
                    "halfcourt": {
                        "x": _json_safe(row.get("hc_x", ex)),
                        "y": _json_safe(row.get("hc_y", ey)),
                    },
                    "courtRight": {"x": cx, "y": cy},
                    "courtLeft": {"x": lx, "y": ly},
                    "arcLeft": arc,
                    "shotDistance": _json_safe(row.get("shot_distance")),
                    "zone": _json_safe(row.get("zone")),
                    "isPaint": bool(row.get("is_paint", False)),
                    "isPerimeter": bool(row.get("is_perimeter", False)),
                    "isThree": bool(row.get("is_three", False)),
                }
            )

        games_out.append(
            {
                "gameId": gid,
                "label": label_map.get(gid, f"Game {gid}"),
                "stats": stats_dict(gdf),
                "shotCount": len(shots_out),
                "shots": shots_out,
            }
        )

    payload = {
        "meta": {
            "player": player,
            "season": season,
            "exportedAt": datetime.now(timezone.utc).isoformat(),
            "source": "ESPN PBP via sportsdataverse (helpers.py)",
            "gameCount": len(games_out),
            "totalShots": int(len(all_fg)),
            "leftRim": {"x": LEFT_RIM_X, "y": LEFT_RIM_Y, "z": 0},
            "rightRim": {"x": FULL_RIM_X, "y": FULL_RIM_Y, "z": 0},
            "courtLength": COURT_LENGTH,
            "courtWidth": 50.0,
        },
        "fullPlayoffStats": stats_dict(all_fg),
        "games": games_out,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
    print(f"games={len(games_out)} shots={payload['meta']['totalShots']}")
    print(f"stats={payload['fullPlayoffStats']['label']}")


if __name__ == "__main__":
    main()
