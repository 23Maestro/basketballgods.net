# --------------------------------------------------------------
# helpers.py – Wembanyama playoff FG pipeline + two scene builders
# --------------------------------------------------------------
from __future__ import annotations

import re
from datetime import datetime

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from sportsdataverse.nba.nba_loaders import load_nba_rosters, load_nba_schedule
from sportsdataverse.nba.nba_pbp import espn_nba_pbp

# ESPN season year = year the season ends (e.g. 2025-26 → 2026)
DEFAULT_SEASON = 2026
DEFAULT_PLAYER = "Victor Wembanyama"
# season_type: 1=preseason, 2=regular, 3=postseason, 4=all-star, 5=off-season
POSTSEASON_TYPE = 3

# ESPN half-court feet: x along baseline (0–50), y from baseline outward
ESPN_RIM_X = 25.0
ESPN_RIM_Y = 5.25  # rim is 5.25 ft from baseline
# Full-court feet used for 3D arcs (basket on right side)
FULL_RIM_X = 88.75
FULL_RIM_Y = 25.0
COURT_LENGTH = 94.0
COURT_WIDTH = 50.0
PAINT_FEET = 8.0  # distance band for paint callouts

# Marketplace-style colors
COLOR_MADE = "#00C853"  # green arcs (scene 1)
COLOR_MISS = "#FF1744"  # red arcs (scene 1)
COLOR_MADE_2D = "#F5A623"  # orange dots (scene 2)
COLOR_MISS_2D = "#8FA3B8"  # cool gray-blue dots (scene 2)
COURT_LINE = "#C5CDD8"
COURT_BG_2D = "#0F1B2D"


# --------------------------------------------------------------
# 1️⃣  NBA COURT – static geometry
# --------------------------------------------------------------
class CourtCoordinates:
    """NBA full-court linework in feet (x = length 0–94, y = width 0–50)."""

    def __init__(self):
        self.length = COURT_LENGTH
        self.width = COURT_WIDTH

    def _segment(self, xs, ys, zs, grp, col="court"):
        return pd.DataFrame(
            {
                "x": list(xs),
                "y": list(ys),
                "z": list(zs) if hasattr(zs, "__iter__") else [zs] * len(list(xs)),
                "line_group": grp,
                "color": col,
            }
        )

    def _basket_markings(self, rim_x: float, baseline_x: float, side: str) -> list[pd.DataFrame]:
        """Paint, FT circle, restricted area, 3PT, rim, backboard for one end."""
        segs: list[pd.DataFrame] = []
        cy = FULL_RIM_Y
        paint_half = 8.0
        paint_depth = 19.0
        # +1 = left basket (midcourt is +x), -1 = right basket
        inward = 1.0 if baseline_x < 47 else -1.0
        paint_inner_x = baseline_x + inward * paint_depth

        # Lane
        segs.append(
            self._segment(
                [baseline_x, baseline_x, paint_inner_x, paint_inner_x, baseline_x],
                [cy - paint_half, cy + paint_half, cy + paint_half, cy - paint_half, cy - paint_half],
                [0] * 5,
                f"paint_{side}",
            )
        )

        # Free-throw circle
        th = np.linspace(0, 2 * np.pi, 80)
        segs.append(
            self._segment(
                paint_inner_x + 6 * np.cos(th),
                cy + 6 * np.sin(th),
                [0] * len(th),
                f"ft_circle_{side}",
            )
        )

        # Restricted area (semicircle toward midcourt)
        if inward > 0:
            th_ra = np.linspace(-np.pi / 2, np.pi / 2, 40)
        else:
            th_ra = np.linspace(np.pi / 2, 3 * np.pi / 2, 40)
        segs.append(
            self._segment(
                rim_x + 4 * np.cos(th_ra),
                cy + 4 * np.sin(th_ra),
                [0] * len(th_ra),
                f"ra_{side}",
            )
        )

        # Rim + backboard
        th_h = np.linspace(0, 2 * np.pi, 60)
        segs.append(
            self._segment(
                rim_x + 0.75 * np.cos(th_h),
                cy + 0.75 * np.sin(th_h),
                [0] * 60,
                f"hoop_{side}",
                "hoop",
            )
        )
        bb_x = baseline_x + inward * 4.0
        segs.append(
            self._segment([bb_x, bb_x], [cy - 3, cy + 3], [0, 0], f"board_{side}", "hoop")
        )

        # 3-point corners + arc (23.75 ft from rim)
        r3 = 23.75
        y_lo, y_hi = 3.0, self.width - 3.0
        dy_c = cy - y_lo
        dx_c = float(np.sqrt(max(r3**2 - dy_c**2, 0.0)))
        corner_x = rim_x + inward * dx_c
        segs.append(
            self._segment([baseline_x, corner_x], [y_lo, y_lo], [0, 0], f"3pt_c0_{side}")
        )
        segs.append(
            self._segment([baseline_x, corner_x], [y_hi, y_hi], [0, 0], f"3pt_c1_{side}")
        )
        a0 = float(np.arctan2(y_lo - cy, corner_x - rim_x))
        a1 = float(np.arctan2(y_hi - cy, corner_x - rim_x))
        # Walk the short arc on the midcourt side
        if inward > 0:
            if a0 > a1:
                a0, a1 = a1, a0
            aa = np.linspace(a0, a1, 80)
        else:
            # right basket: angles near π
            aa = np.linspace(a0, a1, 80)
            # ensure we don't cross the baseline side
            mid = float(np.arctan2(0, inward))  # π or 0
            if abs(float(np.mean(np.cos(aa))) - np.cos(mid)) > 0.5:
                aa = np.linspace(a1, a0 + 2 * np.pi, 80)
        segs.append(
            self._segment(
                rim_x + r3 * np.cos(aa),
                cy + r3 * np.sin(aa),
                [0] * len(aa),
                f"3pt_arc_{side}",
            )
        )
        return segs

    def get_court_lines(self):
        segs: list[pd.DataFrame] = []
        # Outer boundary
        segs.append(
            self._segment(
                [0, self.length, self.length, 0, 0],
                [0, 0, self.width, self.width, 0],
                [0] * 5,
                "outer",
            )
        )
        # Half-court line
        segs.append(
            self._segment(
                [self.length / 2] * 2,
                [0, self.width],
                [0, 0],
                "midline",
            )
        )
        # Center circle
        th = np.linspace(0, 2 * np.pi, 80)
        segs.append(
            self._segment(
                self.length / 2 + 6 * np.cos(th),
                self.width / 2 + 6 * np.sin(th),
                [0] * len(th),
                "center_circle",
            )
        )
        # Both baskets
        segs.extend(self._basket_markings(FULL_RIM_X, self.length, "R"))
        segs.extend(self._basket_markings(self.length - FULL_RIM_X, 0.0, "L"))
        return pd.concat(segs, ignore_index=True)


def halfcourt_line_traces(color: str = COURT_LINE) -> list[go.Scatter]:
    """2D half-court outline (basket at bottom) for Scene 2 overview."""
    traces: list[go.Scatter] = []

    def line(xs, ys, name="court"):
        traces.append(
            go.Scatter(
                x=xs,
                y=ys,
                mode="lines",
                line=dict(color=color, width=1.5),
                hoverinfo="skip",
                showlegend=False,
                name=name,
            )
        )

    # Outer: width 0–50, depth 0–47 (half court)
    line([0, 50, 50, 0, 0], [0, 0, 47, 47, 0])
    # Paint (16 ft wide, 19 ft deep)
    paint_l, paint_r = 25 - 8, 25 + 8
    line([paint_l, paint_r, paint_r, paint_l, paint_l], [0, 0, 19, 19, 0])
    # Free-throw circle
    theta = np.linspace(0, np.pi, 60)
    line(25 + 6 * np.cos(theta), 19 + 6 * np.sin(theta))
    # Restricted area
    theta_r = np.linspace(0, np.pi, 40)
    line(25 + 4 * np.cos(theta_r), 5.25 + 4 * np.sin(theta_r))
    # Hoop
    th = np.linspace(0, 2 * np.pi, 60)
    line(25 + 0.75 * np.cos(th), 5.25 + 0.75 * np.sin(th), name="hoop")
    # Backboard
    line([22, 28], [4, 4])
    # 3-point arc: corners at y=14, arc radius 23.75 from rim
    corner_y = 14.0
    r3 = 23.75
    # left corner
    line([3, 3], [0, corner_y])
    line([47, 47], [0, corner_y])
    # arc between corners
    # angle from rim to corner points
    def ang(x, y):
        return np.arctan2(y - ESPN_RIM_Y, x - ESPN_RIM_X)

    a0 = ang(3, corner_y)
    a1 = ang(47, corner_y)
    aa = np.linspace(a0, a1, 80)
    line(ESPN_RIM_X + r3 * np.cos(aa), ESPN_RIM_Y + r3 * np.sin(aa))
    return traces


# --------------------------------------------------------------
# 2️⃣  SHOT PATH – simple parabola
# --------------------------------------------------------------
class BasketballShot:
    """Create a smooth 3‑D arc from the launch point to the hoop."""

    POINTS = 30
    MAX_HT = 10

    def __init__(
        self,
        start_x,
        start_y,
        shot_id,
        desc,
        made,
        team,
        quarter,
        clock,
        zone: str | None = None,
        shot_distance: float | None = None,
    ):
        self.sx, self.sy = float(start_x), float(start_y)
        self.id = shot_id
        self.desc = desc
        self.made = bool(made)
        self.team = team
        self.quarter = quarter
        self.clock = clock
        self.zone = zone
        self.shot_distance = shot_distance
        self.hx = FULL_RIM_X
        self.hy = FULL_RIM_Y

    def _z(self, t):
        return self.MAX_HT * (4 * t * (1 - t))

    def to_df(self) -> pd.DataFrame:
        xs = np.linspace(self.sx, self.hx, self.POINTS)
        ys = np.linspace(self.sy, self.hy, self.POINTS)
        t = np.linspace(0, 1, self.POINTS)
        zs = self._z(t)

        if not self.made:
            cut = int(self.POINTS * 0.85)
            xs, ys, zs = xs[:cut], ys[:cut], zs[:cut]

        return pd.DataFrame(
            {
                "x": xs,
                "y": ys,
                "z": zs,
                "line_id": self.id,
                "team": self.team,
                "description": self.desc,
                "quarter": self.quarter,
                "clock": self.clock,
                "made": self.made,
                "result": "Made" if self.made else "Missed",
                "zone": self.zone,
                "shot_distance": self.shot_distance,
            }
        )


# --------------------------------------------------------------
# Coordinate mapping & zone classification
# --------------------------------------------------------------
def map_espn_to_fullcourt(espn_x: float, espn_y: float) -> tuple[float, float]:
    """
    Map ESPN half-court feet → full-court feet with basket on the right.

    ESPN: x along width (0–50, center 25), y from baseline outward (rim ≈ 5.25).
    Full: rim at (FULL_RIM_X, FULL_RIM_Y); depth runs toward midcourt as y grows.
    """
    dx = float(espn_x) - ESPN_RIM_X
    dy = float(espn_y) - ESPN_RIM_Y
    court_x = FULL_RIM_X - dy
    court_y = FULL_RIM_Y + dx
    return court_x, court_y


def geometric_distance_ft(espn_x: float, espn_y: float) -> float:
    """Euclidean feet from ESPN rim to shot location."""
    return float(
        np.hypot(float(espn_x) - ESPN_RIM_X, float(espn_y) - ESPN_RIM_Y)
    )


def _shot_distance_from_text(text: str | None) -> float | None:
    if not text:
        return None
    m = re.search(r"(\d+)\s*(?:-foot|ft\b)", text, flags=re.IGNORECASE)
    return float(m.group(1)) if m else None


def _is_three_point(text: str | None) -> bool:
    if not text:
        return False
    return bool(
        re.search(
            r"three[\s\-]?point|3[\s\-]?pt|3[\s\-]?pointer",
            text,
            flags=re.IGNORECASE,
        )
    )


def classify_zone(
    text: str | None,
    shot_distance: float | None,
    espn_x: float | None = None,
    espn_y: float | None = None,
) -> str:
    """
    Return zone label: 'paint' | 'midrange' | 'three'.

    Paint: ≤ PAINT_FEET (text distance, else geometric).
    Three: text indicates a three-point attempt.
    Else midrange (non-paint 2PT) — part of perimeter with threes.
    """
    if _is_three_point(text):
        return "three"

    dist = shot_distance
    if dist is None or (isinstance(dist, float) and np.isnan(dist)):
        if espn_x is not None and espn_y is not None and not (
            pd.isna(espn_x) or pd.isna(espn_y)
        ):
            dist = geometric_distance_ft(espn_x, espn_y)
        else:
            dist = None

    if dist is not None and dist <= PAINT_FEET:
        return "paint"
    return "midrange"


def enrich_shot_row(df: pd.DataFrame) -> pd.DataFrame:
    """Add mapped coords, filled distance, zone, and perimeter flags."""
    if df is None or df.empty:
        return pd.DataFrame()

    out = df.copy()
    ex = pd.to_numeric(out.get("coordinate.x"), errors="coerce")
    ey = pd.to_numeric(out.get("coordinate.y"), errors="coerce")
    out["espn_x"] = ex
    out["espn_y"] = ey

    mapped = [
        map_espn_to_fullcourt(x, y) if pd.notna(x) and pd.notna(y) else (np.nan, np.nan)
        for x, y in zip(ex, ey)
    ]
    out["court_x"] = [m[0] for m in mapped]
    out["court_y"] = [m[1] for m in mapped]

    text_dist = out["text"].apply(_shot_distance_from_text) if "text" in out.columns else pd.Series([None] * len(out))
    geom = [
        geometric_distance_ft(x, y) if pd.notna(x) and pd.notna(y) else np.nan
        for x, y in zip(ex, ey)
    ]
    out["shot_distance"] = text_dist.where(text_dist.notna(), geom)

    zones = [
        classify_zone(
            t,
            d if pd.notna(d) else None,
            x if pd.notna(x) else None,
            y if pd.notna(y) else None,
        )
        for t, d, x, y in zip(
            out["text"] if "text" in out.columns else [""] * len(out),
            out["shot_distance"],
            ex,
            ey,
        )
    ]
    out["zone"] = zones
    out["is_three"] = out["zone"] == "three"
    out["is_paint"] = out["zone"] == "paint"
    out["is_perimeter"] = out["zone"].isin(["midrange", "three"])
    out["result"] = np.where(out["made"].fillna(False).astype(bool), "Made", "Missed")
    return out


# --------------------------------------------------------------
# Internal loaders
# --------------------------------------------------------------
def _resolve_season(season: int | None = None) -> int:
    if season is not None:
        return int(season)
    now = datetime.now()
    return now.year + 1 if now.month >= 8 else now.year


def _load_schedule(season: int) -> pd.DataFrame:
    return load_nba_schedule(seasons=season, return_as_pandas=True)


def _load_players(season: int) -> pd.DataFrame:
    candidates = [season]
    if season != DEFAULT_SEASON:
        candidates.append(DEFAULT_SEASON)
    if 2025 not in candidates:
        candidates.append(2025)

    last_err: Exception | None = None
    for s in candidates:
        try:
            df = load_nba_rosters(seasons=s, return_as_pandas=True)
            if df is not None and not df.empty:
                return df
        except Exception as exc:
            last_err = exc
            continue
    if last_err:
        raise last_err
    return pd.DataFrame()


# --------------------------------------------------------------
# 3️⃣  DATA FETCHING & CLEAN‑UP
# --------------------------------------------------------------
def fetch_pbp(game_id: int) -> pd.DataFrame:
    """
    Pull live ESPN PBP for a game; return field-goal attempts only
    (no free throws), with columns shaped for the app + scene builders.
    """
    raw = espn_nba_pbp(int(game_id))
    plays = raw.get("plays") or []
    if not plays:
        return pd.DataFrame()

    df = pd.DataFrame(plays)

    if "shootingPlay" in df.columns:
        df = df[df["shootingPlay"].fillna(False).astype(bool)].copy()
    elif "text" in df.columns:
        df = df[
            df["text"].str.contains("shot|jumper|layup|dunk|hook", case=False, na=False)
        ].copy()
    else:
        return pd.DataFrame()

    if df.empty:
        return pd.DataFrame()

    # FG only — free throws out of scope
    if "text" in df.columns:
        df = df[~df["text"].str.contains(r"free\s*throw", case=False, na=False)].copy()
    if "type.text" in df.columns:
        df = df[~df["type.text"].str.contains(r"free\s*throw", case=False, na=False)].copy()

    for col in ("coordinate.x", "coordinate.y"):
        if col in df.columns:
            vals = pd.to_numeric(df[col], errors="coerce")
            df = df[vals.notna() & (vals.abs() < 1_000_000)].copy()

    if df.empty:
        return pd.DataFrame()

    rename = {
        "period.displayValue": "quarter",
        "clock.displayValue": "clock",
        "scoringPlay": "made",
        "team.id": "team_id",
        "participants.0.athlete.id": "playerId",
    }
    df = df.rename(columns={k: v for k, v in rename.items() if k in df.columns})

    home_id = raw.get("homeTeamId")
    if home_id is None and "homeTeamId" in df.columns:
        home_id = df["homeTeamId"].iloc[0]
    if "team_id" in df.columns and home_id is not None:
        df["team_side"] = np.where(
            df["team_id"].astype(str) == str(home_id),
            "home",
            "away",
        )
    else:
        df["team_side"] = "home"

    if "made" not in df.columns:
        df["made"] = False
    else:
        df["made"] = df["made"].fillna(False).astype(bool)

    if "quarter" not in df.columns and "period.number" in df.columns:
        df["quarter"] = df["period.number"]
    if "clock" not in df.columns:
        df["clock"] = ""

    df["playerId"] = df["playerId"].astype(str) if "playerId" in df.columns else None
    df["gameId"] = int(game_id)

    for col in ("coordinate.x", "coordinate.y"):
        if col not in df.columns:
            df[col] = np.nan
    if "sequenceNumber" not in df.columns:
        df["sequenceNumber"] = df.index.astype(str)
    if "text" not in df.columns:
        df["text"] = ""

    return enrich_shot_row(df.reset_index(drop=True))


def format_natural_date(val) -> str:
    """July 17, 2026 (no leading zero on day)."""
    ts = pd.to_datetime(val, errors="coerce", utc=True)
    if pd.isna(ts):
        return ""
    if getattr(ts, "tzinfo", None) is not None:
        ts = ts.tz_convert(None)
    return f"{ts.strftime('%B')} {ts.day}, {ts.year}"


def fetch_current_season_schedule(season: int | None = None) -> pd.DataFrame:
    season = _resolve_season(season if season is not None else DEFAULT_SEASON)
    sched = _load_schedule(season)
    if sched is None or sched.empty:
        return pd.DataFrame(columns=["gameId", "display", "sort_date"])

    sched = sched.copy()
    if "game_id" in sched.columns:
        sched["gameId"] = sched["game_id"].astype(int)
    elif "id" in sched.columns:
        sched["gameId"] = sched["id"].astype(int)

    away = sched.get(
        "away_abbreviation", sched.get("away_id", pd.Series(["?"] * len(sched)))
    ).astype(str)
    home = sched.get(
        "home_abbreviation", sched.get("home_id", pd.Series(["?"] * len(sched)))
    ).astype(str)
    raw_date = sched.get("game_date", sched.get("start_date", sched.get("date")))
    sched["sort_date"] = pd.to_datetime(raw_date, errors="coerce", utc=True)
    when_nl = sched["sort_date"].apply(format_natural_date)
    note = (
        sched.get("notes_headline", pd.Series([""] * len(sched)))
        .fillna("")
        .astype(str)
        .str.replace(r"\s*-\s*", " ", regex=True)
        .str.strip()
    )

    # May 31, 2026 — SA @ OKC (West Finals Game 7)
    base = when_nl + " — " + away + " @ " + home
    has_note = note.str.len() > 0
    sched["display"] = base
    sched.loc[has_note, "display"] = base[has_note] + " (" + note[has_note] + ")"
    return sched


def lookup_player_id(name: str, season: int | None = None) -> str | None:
    season = _resolve_season(season if season is not None else DEFAULT_SEASON)
    players = _load_players(season)
    if players.empty or "full_name" not in players.columns:
        return None
    mask = players["full_name"].str.contains(name, case=False, na=False)
    matches = players[mask]
    if matches.empty:
        return None
    return str(matches.iloc[0]["athlete_id"])


def filter_by_player(df: pd.DataFrame, player_name: str) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()
    pid = lookup_player_id(player_name)
    if pid is None or "playerId" not in df.columns:
        return pd.DataFrame()
    return df[df["playerId"].astype(str) == str(pid)].copy()


# --------------------------------------------------------------
# 4️⃣  PLAYOFF PIPELINE
# --------------------------------------------------------------
def get_victor_game_ids(season: int = DEFAULT_SEASON) -> list[int]:
    """ESPN game IDs for every postseason game Victor's team played."""
    return get_player_playoff_game_ids(DEFAULT_PLAYER, season=season)


def get_player_playoff_game_ids(
    player_name: str = DEFAULT_PLAYER,
    season: int = DEFAULT_SEASON,
) -> list[int]:
    sched = _load_schedule(season)
    if sched is None or sched.empty:
        return []
    if "home_id" not in sched.columns or "away_id" not in sched.columns:
        return []

    players = _load_players(season)
    if players is None or players.empty or "full_name" not in players.columns:
        return []
    row = players[players["full_name"].str.contains(player_name, case=False, na=False)]
    if row.empty:
        return []
    team_id = int(row.iloc[0]["team_id"])
    game_col = "game_id" if "game_id" in sched.columns else "id"
    if game_col not in sched.columns:
        return []
    post = (
        sched["season_type"] == POSTSEASON_TYPE
        if "season_type" in sched.columns
        else True
    )
    mask = post & (
        (sched["home_id"].astype(int) == team_id)
        | (sched["away_id"].astype(int) == team_id)
    )
    return list(sched.loc[mask, game_col].astype(int))


def playoff_game_labels(season: int = DEFAULT_SEASON) -> pd.DataFrame:
    """Playoff games for Victor's team, chronological first→last, NL dates."""
    gids = set(get_victor_game_ids(season))
    sched = fetch_current_season_schedule(season)
    if sched.empty:
        return sched
    out = sched[sched["gameId"].isin(gids)].copy()
    if "sort_date" in out.columns:
        out = out.sort_values(["sort_date", "gameId"], ascending=True)
    else:
        out = out.sort_values("gameId", ascending=True)
    return out.reset_index(drop=True)


def load_playoff_field_goals(
    player_name: str = DEFAULT_PLAYER,
    season: int = DEFAULT_SEASON,
    game_ids: list[int] | None = None,
) -> pd.DataFrame:
    """
    Load all postseason field-goal attempts for a player (no free throws).

    This is the primary shipped data path for both scenes.
    """
    gids = game_ids if game_ids is not None else get_player_playoff_game_ids(player_name, season)
    frames: list[pd.DataFrame] = []
    for gid in gids:
        df = fetch_pbp(int(gid))
        if df.empty:
            continue
        df = filter_by_player(df, player_name)
        if not df.empty:
            frames.append(df)
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


def filter_shots_to_games(df: pd.DataFrame, game_ids: list[int]) -> pd.DataFrame:
    if df is None or df.empty or "gameId" not in df.columns:
        return df if df is not None else pd.DataFrame()
    return df[df["gameId"].isin(game_ids)].copy()


def compute_shot_stats(df: pd.DataFrame) -> dict:
    """
    FG-only stats with paint / perimeter / 3PT callouts (no FT emphasis).
    """
    empty = {
        "total_shots": 0,
        "makes": 0,
        "fg_pct": 0.0,
        "two_pt_shots": 0,
        "two_pt_makes": 0,
        "three_pt_shots": 0,
        "three_pt_makes": 0,
        "fg3_pct": 0.0,
        "paint_shots": 0,
        "paint_makes": 0,
        "paint_pct": 0.0,
        "perimeter_shots": 0,
        "perimeter_makes": 0,
        "perimeter_pct": 0.0,
        "paint_share": 0.0,
        "perimeter_share": 0.0,
        "ppg_est": 0.0,
        "games": 0,
        "label": "0 / 0 (0.0%)",
    }
    if df is None or df.empty:
        return empty

    total = len(df)
    made = df["made"].fillna(False).astype(bool)
    makes = int(made.sum())
    fg_pct = 100.0 * makes / total if total else 0.0

    is_three = df["is_three"] if "is_three" in df.columns else df["text"].apply(_is_three_point)
    is_paint = df["is_paint"] if "is_paint" in df.columns else pd.Series([False] * total)
    is_perim = df["is_perimeter"] if "is_perimeter" in df.columns else ~is_paint

    # If zone columns missing, recompute from distance
    if "zone" not in df.columns:
        zones = [
            classify_zone(t, d if pd.notna(d) else None)
            for t, d in zip(
                df["text"] if "text" in df.columns else [""] * total,
                df["shot_distance"] if "shot_distance" in df.columns else [None] * total,
            )
        ]
        is_three = pd.Series([z == "three" for z in zones])
        is_paint = pd.Series([z == "paint" for z in zones])
        is_perim = pd.Series([z in ("midrange", "three") for z in zones])

    n3 = int(is_three.sum())
    m3 = int((is_three & made).sum())
    n2 = total - n3
    m2 = makes - m3
    paint_n = int(is_paint.sum())
    paint_m = int((is_paint & made).sum())
    perim_n = int(is_perim.sum())
    perim_m = int((is_perim & made).sum())

    points = m2 * 2 + m3 * 3
    games = int(df["gameId"].nunique()) if "gameId" in df.columns else 0

    return {
        "total_shots": total,
        "makes": makes,
        "fg_pct": fg_pct,
        "two_pt_shots": n2,
        "two_pt_makes": m2,
        "three_pt_shots": n3,
        "three_pt_makes": m3,
        "fg3_pct": (100.0 * m3 / n3) if n3 else 0.0,
        "paint_shots": paint_n,
        "paint_makes": paint_m,
        "paint_pct": (100.0 * paint_m / paint_n) if paint_n else 0.0,
        "perimeter_shots": perim_n,
        "perimeter_makes": perim_m,
        "perimeter_pct": (100.0 * perim_m / perim_n) if perim_n else 0.0,
        "paint_share": (100.0 * paint_n / total) if total else 0.0,
        "perimeter_share": (100.0 * perim_n / total) if total else 0.0,
        "ppg_est": (points / games) if games else 0.0,
        "games": games,
        "label": f"{makes} / {total} ({fg_pct:.1f}%)",
    }


# Back-compat alias used by older app code
def compute_playoff_stats(df: pd.DataFrame) -> dict:
    s = compute_shot_stats(df)
    # legacy keys
    s["ft_pct"] = 0.0
    s["ppg"] = s["ppg_est"]
    return s


# --------------------------------------------------------------
# 5️⃣  SCENE BUILDERS (testable without Streamlit)
# --------------------------------------------------------------
def build_scene1_arcs(shots: pd.DataFrame) -> pd.DataFrame:
    """
    Scene 1 data: 3D arc polylines for one game (or any FG subset).
    Expects enrich_shot_row columns (court_x/court_y or ESPN coords).
    """
    if shots is None or shots.empty:
        return pd.DataFrame()

    frames: list[pd.DataFrame] = []
    for i, row in shots.iterrows():
        cx = row.get("court_x")
        cy = row.get("court_y")
        if pd.isna(cx) or pd.isna(cy):
            ex, ey = row.get("espn_x", row.get("coordinate.x")), row.get(
                "espn_y", row.get("coordinate.y")
            )
            if pd.isna(ex) or pd.isna(ey):
                continue
            cx, cy = map_espn_to_fullcourt(ex, ey)

        shot = BasketballShot(
            start_x=cx,
            start_y=cy,
            shot_id=str(row.get("sequenceNumber", i)),
            desc=row.get("text", ""),
            made=bool(row.get("made", False)),
            team=row.get("team_side", "home"),
            quarter=row.get("quarter", ""),
            clock=row.get("clock", ""),
            zone=row.get("zone"),
            shot_distance=row.get("shot_distance"),
        )
        frames.append(shot.to_df())

    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


def build_scene1_figure(shots: pd.DataFrame, title: str = "") -> go.Figure:
    """Scene 1: full-court 3D arcs (green made / red missed). No big title overlay."""
    arcs = build_scene1_arcs(shots)
    court = CourtCoordinates().get_court_lines()
    fig = go.Figure()
    wood = "#CDB892"
    line_c = "#2A2418"

    for grp, gdf in court.groupby("line_group"):
        is_hoop = gdf["color"].iloc[0] == "hoop"
        fig.add_trace(
            go.Scatter3d(
                x=gdf["x"],
                y=gdf["y"],
                z=gdf["z"],
                mode="lines",
                line=dict(color="#E07030" if is_hoop else line_c, width=3 if is_hoop else 2.5),
                hoverinfo="skip",
                showlegend=False,
                name=str(grp),
            )
        )

    if not arcs.empty:
        for _, gdf in arcs.groupby("line_id"):
            made = bool(gdf["made"].iloc[0])
            color = COLOR_MADE if made else COLOR_MISS
            fig.add_trace(
                go.Scatter3d(
                    x=gdf["x"],
                    y=gdf["y"],
                    z=gdf["z"],
                    mode="lines",
                    line=dict(color=color, width=5),
                    legendgroup="Made" if made else "Missed",
                    showlegend=False,
                    hovertemplate=(
                        f"{gdf['description'].iloc[0]}<br>"
                        f"Q{gdf['quarter'].iloc[0]} – {gdf['clock'].iloc[0]} left<br>"
                        f"{'Made' if made else 'Missed'}<extra></extra>"
                    ),
                )
            )
            fig.add_trace(
                go.Scatter3d(
                    x=[gdf["x"].iloc[0]],
                    y=[gdf["y"].iloc[0]],
                    z=[0.05],
                    mode="markers",
                    marker=dict(size=3.5, color=color),
                    showlegend=False,
                    hoverinfo="skip",
                )
            )

    fig.add_trace(
        go.Scatter3d(
            x=[None], y=[None], z=[None], mode="lines",
            line=dict(color=COLOR_MADE, width=5), name="Made",
        )
    )
    fig.add_trace(
        go.Scatter3d(
            x=[None], y=[None], z=[None], mode="lines",
            line=dict(color=COLOR_MISS, width=5), name="Missed",
        )
    )

    layout_kw = dict(
        scene=dict(
            xaxis=dict(
                range=[0, 94], showticklabels=False, title="", showgrid=False,
                backgroundcolor=wood, showbackground=True, zeroline=False,
            ),
            yaxis=dict(
                range=[0, 50], showticklabels=False, title="", showgrid=False,
                backgroundcolor=wood, showbackground=True, zeroline=False,
            ),
            zaxis=dict(
                range=[0, 11], showticklabels=False, title="", showgrid=False,
                backgroundcolor=wood, showbackground=True, zeroline=False,
            ),
            aspectratio=dict(x=94 / 50, y=1, z=0.22),
            bgcolor=wood,
            camera=dict(eye=dict(x=1.35, y=-1.55, z=0.55), center=dict(x=0.15, y=0, z=-0.1)),
        ),
        margin=dict(l=0, r=0, t=28, b=0),
        legend=dict(
            orientation="h", yanchor="bottom", y=1.0, x=0,
            font=dict(size=11), bgcolor="rgba(0,0,0,0)",
            title=None,
        ),
        paper_bgcolor="#0E1117",
        font=dict(color="#E8E8E8", size=12),
        height=720,
    )
    if title:
        layout_kw["title"] = dict(text=title, font=dict(size=14), x=0, xanchor="left")
    fig.update_layout(**layout_kw)
    return fig


def build_scene2_points(shots: pd.DataFrame) -> pd.DataFrame:
    """
    Scene 2 data: one row per FG on half-court ESPN feet (x,y) for scatter overview.
    """
    if shots is None or shots.empty:
        return pd.DataFrame()

    out = shots.copy()
    if "espn_x" not in out.columns:
        out = enrich_shot_row(out)
    cols = [
        c
        for c in [
            "espn_x",
            "espn_y",
            "made",
            "result",
            "zone",
            "is_paint",
            "is_three",
            "is_perimeter",
            "shot_distance",
            "text",
            "gameId",
            "quarter",
            "clock",
            "sequenceNumber",
        ]
        if c in out.columns
    ]
    pts = out[cols].dropna(subset=["espn_x", "espn_y"]).copy()
    pts = pts.rename(columns={"espn_x": "x", "espn_y": "y"})
    return pts.reset_index(drop=True)


def _court_texture_path() -> str | None:
    """Optional Envato half-court image at assets/court/halfcourt.png."""
    from pathlib import Path

    p = Path(__file__).resolve().parent / "assets" / "court" / "halfcourt.png"
    return str(p) if p.is_file() else None


def build_scene2_figure(
    shots: pd.DataFrame,
    player_name: str = DEFAULT_PLAYER,
) -> go.Figure:
    """Scene 2: dark half-court scatter; optional Envato texture underlay."""
    pts = build_scene2_points(shots)
    stats = compute_shot_stats(shots)
    title = f"{player_name}: {stats['label']}"

    fig = go.Figure()
    tex = _court_texture_path()
    if tex:
        fig.add_layout_image(
            dict(
                source=tex,
                xref="x",
                yref="y",
                x=-1,
                y=48,
                sizex=52,
                sizey=50,
                sizing="stretch",
                opacity=0.85,
                layer="below",
            )
        )
    for tr in halfcourt_line_traces():
        fig.add_trace(tr)

    if not pts.empty:
        made = pts[pts["made"] == True]  # noqa: E712
        miss = pts[pts["made"] == False]  # noqa: E712
        if not miss.empty:
            fig.add_trace(
                go.Scatter(
                    x=miss["x"],
                    y=miss["y"],
                    mode="markers",
                    marker=dict(
                        size=10,
                        color=COLOR_MISS_2D,
                        opacity=0.75,
                        line=dict(width=0),
                    ),
                    name="Missed",
                    text=miss.get("text"),
                    hovertemplate="%{text}<br>Missed<extra></extra>",
                )
            )
        if not made.empty:
            fig.add_trace(
                go.Scatter(
                    x=made["x"],
                    y=made["y"],
                    mode="markers",
                    marker=dict(
                        size=10,
                        color=COLOR_MADE_2D,
                        opacity=0.9,
                        line=dict(width=0),
                    ),
                    name="Made",
                    text=made.get("text"),
                    hovertemplate="%{text}<br>Made<extra></extra>",
                )
            )

    fig.update_layout(
        title=dict(text=title, x=0.5, xanchor="center", font=dict(size=14)),
        xaxis=dict(
            range=[-1, 51],
            scaleanchor="y",
            scaleratio=1,
            showgrid=False,
            zeroline=False,
            showticklabels=False,
            title="",
        ),
        yaxis=dict(
            range=[-2, 48],
            showgrid=False,
            zeroline=False,
            showticklabels=False,
            title="",
        ),
        plot_bgcolor=COURT_BG_2D,
        paper_bgcolor="#0E1117",
        font=dict(color="#E8EEF7", size=12),
        margin=dict(l=10, r=10, t=36, b=16),
        legend=dict(orientation="h", yanchor="bottom", y=1.0, x=0, font=dict(size=11), title=None),
        height=720,
    )
    return fig
