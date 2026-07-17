"""
Gating tests for Wembanyama 2026 playoff FG pipeline + scene builders.

Uses real shipped helpers (network to ESPN/sportsdataverse). Not a reimplementation.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from helpers import (  # noqa: E402
    DEFAULT_PLAYER,
    DEFAULT_SEASON,
    build_scene1_arcs,
    build_scene1_figure,
    build_scene2_figure,
    build_scene2_points,
    classify_zone,
    compute_shot_stats,
    geometric_distance_ft,
    load_playoff_field_goals,
    map_espn_to_fullcourt,
)


@pytest.fixture(scope="module")
def playoff_fgs() -> pd.DataFrame:
    df = load_playoff_field_goals(player_name=DEFAULT_PLAYER, season=DEFAULT_SEASON)
    assert not df.empty, "Expected non-empty playoff FG set from shipped loader"
    return df


def test_no_free_throws(playoff_fgs: pd.DataFrame):
    if "text" in playoff_fgs.columns:
        ft = playoff_fgs["text"].str.contains(r"free\s*throw", case=False, na=False)
        assert int(ft.sum()) == 0


def test_fga_in_target_band(playoff_fgs: pd.DataFrame):
    # Marketplace target ~357; live ESPN often ~350–380
    n = len(playoff_fgs)
    assert 250 <= n <= 450, f"FGA count {n} outside expected playoff band"


def test_required_columns(playoff_fgs: pd.DataFrame):
    for col in ("made", "gameId", "zone", "shot_distance", "espn_x", "espn_y", "court_x", "court_y"):
        assert col in playoff_fgs.columns, f"missing {col}"


def test_paint_perimeter_partition(playoff_fgs: pd.DataFrame):
    stats = compute_shot_stats(playoff_fgs)
    assert stats["paint_shots"] + stats["perimeter_shots"] == stats["total_shots"]
    assert stats["three_pt_shots"] <= stats["perimeter_shots"]
    assert stats["makes"] <= stats["total_shots"]
    # Zone flags consistent
    assert int(playoff_fgs["is_paint"].sum()) == stats["paint_shots"]
    assert int(playoff_fgs["is_perimeter"].sum()) == stats["perimeter_shots"]


def test_coordinate_mapping_rim_proximity():
    # Paint-ish ESPN point near rim maps near full-court rim
    cx, cy = map_espn_to_fullcourt(25, 5.25)
    assert abs(cx - 88.75) < 0.01
    assert abs(cy - 25.0) < 0.01
    # Geometric distance near rim is small
    assert geometric_distance_ft(25, 2) < 5
    assert geometric_distance_ft(10, 25) > 20


def test_classify_zone_rules():
    assert classify_zone("makes 2-foot dunk", 2.0) == "paint"
    assert classify_zone("misses 26-foot three point jumper", 26.0) == "three"
    assert classify_zone("misses 15-foot jumper", 15.0) == "midrange"


def test_scene1_single_game(playoff_fgs: pd.DataFrame):
    gid = int(playoff_fgs["gameId"].iloc[0])
    game = playoff_fgs[playoff_fgs["gameId"] == gid]
    assert game["gameId"].nunique() == 1
    arcs = build_scene1_arcs(game)
    assert not arcs.empty
    assert set(arcs["made"].unique()).issubset({True, False})
    assert "zone" in arcs.columns or "result" in arcs.columns
    fig = build_scene1_figure(game, title="test")
    assert fig is not None
    assert len(fig.data) > 0


def test_scene2_full_run(playoff_fgs: pd.DataFrame):
    pts = build_scene2_points(playoff_fgs)
    assert len(pts) == len(playoff_fgs.dropna(subset=["espn_x", "espn_y"]))
    assert "made" in pts.columns
    assert "zone" in pts.columns
    fig = build_scene2_figure(playoff_fgs, player_name=DEFAULT_PLAYER)
    stats = compute_shot_stats(playoff_fgs)
    # Title / caption must encode makes/attempts
    assert re.search(r"\d+\s*/\s*\d+", stats["label"])
    assert fig.layout.title.text is not None
    assert str(stats["makes"]) in fig.layout.title.text or stats["label"] in (
        fig.layout.title.text or ""
    )


def test_app_imports_without_running_server():
    src = (ROOT / "app.py").read_text()
    assert "build_scene1_figure" in src
    assert "build_scene2_figure" in src
    assert "Per-game 3D" in src
    assert "Full playoff" in src
    # Bloat removed
    assert "Center callout" not in src
    assert "st.info" not in src
    assert "st.caption(" not in src or "ESPN PBP" in src  # sidebar source only


def test_playoff_labels_chronological_natural_dates():
    from helpers import playoff_game_labels, format_natural_date

    assert format_natural_date("2026-05-31") == "May 31, 2026"
    labels = playoff_game_labels(2026)
    assert not labels.empty
    # Chronological ascending
    if "sort_date" in labels.columns and labels["sort_date"].notna().all():
        assert labels["sort_date"].is_monotonic_increasing
    # Natural language month name in display
    assert any(
        m in str(labels["display"].iloc[0])
        for m in (
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        )
    )
    assert "2026-" not in str(labels["display"].iloc[0])  # no ISO date fragment
