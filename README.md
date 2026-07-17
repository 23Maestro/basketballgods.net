# basketballgods.net — Wembanyama 2026 Playoff Shots

Streamlit app: per-game **3D** field-goal arcs + full-playoff **half-court** overview for Victor Wembanyama’s 2025–26 postseason.

- **Data:** ESPN play-by-play via [sportsdataverse](https://github.com/sportsdataverse) (public, no API key)
- **Shots only:** free throws excluded  
- **Counts:** live ESPN FGA (e.g. ~366) may differ slightly from other sites (~357) — different filters/sources, not a bug

## Local run

```bash
cd nba-3d-live-shot   # or your clone path
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# macOS: brew install libomp   # if xgboost fails to load
streamlit run app.py
```

## Deploy (Streamlit Community Cloud)

1. Repo: [23Maestro/basketballgods.net](https://github.com/23Maestro/basketballgods.net)
2. Open [share.streamlit.io](https://share.streamlit.io) → sign in with GitHub
3. **Create app** → this repo → branch `main` → main file `app.py`
4. Advanced → **Python 3.12** recommended
5. Deploy. Pushes to `main` update the app.

No secrets required.

## Envato court texture (optional)

See [`assets/README.md`](assets/README.md). Place `assets/court/halfcourt.png` to underlay Scene 2.

## Tests

```bash
pytest tests/ -v
```
