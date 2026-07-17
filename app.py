# --------------------------------------------------------------
# app.py – basketballgods.net
# Scene 1: per-game 3D arcs · Scene 2: full playoff court overview
# --------------------------------------------------------------
import streamlit as st
import pandas as pd

from helpers import (
    DEFAULT_PLAYER,
    DEFAULT_SEASON,
    build_scene1_figure,
    build_scene2_figure,
    compute_shot_stats,
    load_playoff_field_goals,
    playoff_game_labels,
)

st.set_page_config(
    page_title="Wembanyama Playoff Shots",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Compact chrome: title near sidebar toggle, court-first density
st.markdown(
    """
    <style>
      .block-container {
        padding-top: 0.6rem !important;
        padding-bottom: 0.5rem !important;
        max-width: 1400px;
      }
      h1 {
        font-size: 1.45rem !important;
        font-weight: 650 !important;
        margin: 0 0 0.35rem 0 !important;
        padding: 0 !important;
        line-height: 1.2 !important;
      }
      div[data-testid="stMetricValue"] { font-size: 1.35rem !important; }
      div[data-testid="stMetricLabel"] { font-size: 0.8rem !important; }
      div[data-testid="stMetricDelta"] { font-size: 0.75rem !important; }
      /* kill extra gap above tabs */
      div[data-testid="stVerticalBlock"] > div:has(> div[data-baseweb="tab-list"]) {
        gap: 0.4rem;
      }
      header[data-testid="stHeader"] { background: rgba(14,17,23,0.85); }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("🏀 Victor Wembanyama — 2026 Playoff Shots")

with st.sidebar:
    st.header("Player & season")
    player_name = st.text_input("Player name", DEFAULT_PLAYER)
    season = st.number_input(
        "Season (end year)",
        min_value=2024,
        max_value=2026,
        value=int(DEFAULT_SEASON),
        step=1,
    )


@st.cache_data(ttl=60 * 30, show_spinner="Loading playoff field goals…")
def cached_playoff_fgs(player: str, season_year: int) -> pd.DataFrame:
    return load_playoff_field_goals(player_name=player, season=int(season_year))


@st.cache_data(ttl=60 * 30)
def cached_game_labels(season_year: int) -> pd.DataFrame:
    return playoff_game_labels(season=int(season_year))


all_fg = cached_playoff_fgs(player_name, int(season))

if all_fg.empty:
    st.error("No playoff field goals found for this player/season.")
    st.stop()

if "text" in all_fg.columns:
    all_fg = all_fg[~all_fg["text"].str.contains(r"free\s*throw", case=False, na=False)].copy()

agg = compute_shot_stats(all_fg)

with st.sidebar:
    st.markdown(
        f"**{agg['makes']} / {agg['total_shots']}** FGA · "
        f"**{agg['fg_pct']:.1f}%** · {agg['games']} games"
    )
    st.caption("Source: ESPN PBP (sportsdataverse), field goals only.")

tab1, tab2 = st.tabs(["Per-game 3D", "Full playoff"])

# =================================================================
# SCENE 1
# =================================================================
with tab1:
    labels = cached_game_labels(int(season))
    games_with_shots = set(int(g) for g in all_fg["gameId"].unique())

    # Chronological order from schedule labels (first → last)
    ordered: list[tuple[int, str]] = []
    if not labels.empty:
        for r in labels.itertuples():
            gid = int(r.gameId)
            if gid in games_with_shots:
                ordered.append((gid, r.display))
    # Any FG games missing from schedule (append by gameId)
    known = {g for g, _ in ordered}
    for gid in sorted(games_with_shots - known):
        ordered.append((gid, f"Game {gid}"))

    if not ordered:
        st.warning("No games with field goals.")
        st.stop()

    choice = st.selectbox(
        "Playoff game",
        options=ordered,
        format_func=lambda o: o[1],
        index=0,
    )
    game_id = int(choice[0])
    game_shots = all_fg[all_fg["gameId"] == game_id].copy()
    gstats = compute_shot_stats(game_shots)

    m1, m2, m3, m4, m5 = st.columns(5)
    m1.metric("FG", f"{gstats['makes']}-{gstats['total_shots']}", f"{gstats['fg_pct']:.0f}%")
    m2.metric(
        "Paint",
        f"{gstats['paint_makes']}-{gstats['paint_shots']}",
        f"{gstats['paint_pct']:.0f}%",
    )
    m3.metric(
        "3PT",
        f"{gstats['three_pt_makes']}-{gstats['three_pt_shots']}",
        f"{gstats['fg3_pct']:.0f}%",
    )
    m4.metric("Perimeter", f"{gstats['perimeter_share']:.0f}%")
    m5.metric("Paint share", f"{gstats['paint_share']:.0f}%")

    fig1 = build_scene1_figure(game_shots, title="")
    st.plotly_chart(fig1, use_container_width=True, config={"displayModeBar": False})

    with st.expander("Shot log"):
        show_cols = [
            c
            for c in ["quarter", "clock", "text", "result", "zone", "shot_distance"]
            if c in game_shots.columns
        ]
        st.dataframe(game_shots[show_cols], use_container_width=True, hide_index=True)

# =================================================================
# SCENE 2
# =================================================================
with tab2:
    a1, a2, a3, a4, a5 = st.columns(5)
    a1.metric("FGM / FGA", f"{agg['makes']} / {agg['total_shots']}", f"{agg['fg_pct']:.1f}%")
    a2.metric("Paint", f"{agg['paint_makes']}-{agg['paint_shots']}", f"{agg['paint_share']:.0f}%")
    a3.metric(
        "Perimeter",
        f"{agg['perimeter_makes']}-{agg['perimeter_shots']}",
        f"{agg['perimeter_share']:.0f}%",
    )
    a4.metric("3PT", f"{agg['three_pt_makes']}-{agg['three_pt_shots']}", f"{agg['fg3_pct']:.1f}%")
    a5.metric("Games", f"{agg['games']}")

    zone_filter = st.radio(
        "Show",
        ["All", "Paint", "Perimeter", "3PT"],
        horizontal=True,
        index=0,
        label_visibility="collapsed",
    )
    view = all_fg
    if zone_filter == "Paint" and "is_paint" in all_fg.columns:
        view = all_fg[all_fg["is_paint"]]
    elif zone_filter == "Perimeter" and "is_perimeter" in all_fg.columns:
        view = all_fg[all_fg["is_perimeter"]]
    elif zone_filter == "3PT" and "is_three" in all_fg.columns:
        view = all_fg[all_fg["is_three"]]

    fig2 = build_scene2_figure(view, player_name=player_name)
    st.plotly_chart(fig2, use_container_width=True, config={"displayModeBar": False})
