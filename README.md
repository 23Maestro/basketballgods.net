# Wemby Shot Lab (`basketballgods.net`)

Victor Wembanyama **2026 playoff** field-goal visualization.

| Surface | Stack |
|---------|--------|
| **Production UI** | Next.js App Router · TypeScript · React Three Fiber · Tailwind · Motion |
| **Data pipeline** | Python `helpers.py` (ESPN / sportsdataverse) → static JSON |
| **Legacy** | Streamlit `app.py` still present for local reference |

## Commands

```bash
# 1) Refresh playoff JSON from ESPN (needs Python venv + network)
source .venv/bin/activate
pip install -r requirements.txt
python scripts/export_playoff_json.py
# → public/data/playoff-2026.json

# 2) Next.js app
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
npm run test         # Vitest (data parity)
npm run test:e2e     # Playwright
npm run typecheck
```

## Data export

```bash
npm run export:data
# or: python scripts/export_playoff_json.py
```

Production loads **only** `public/data/playoff-2026.json` (22 games, 366 FGA). No Python at request time.

## Optional court model

Place a licensed GLB at:

```
public/models/court.glb
```

If absent, a procedural Spurs-styled court is used.

## Deploy (Vercel project: `wemby-shot-lab`)

Separate from singleton-systems.com:

```bash
npm run build
npm exec -- vercel deploy --prod -y --name wemby-shot-lab
```

## Camera constants (Scene 1)

Edit `src/lib/camera.ts`:

- `CAMERA_START` · `CAMERA_CURVE_CONTROL` · `CAMERA_HOME`
- `CAMERA_LOOK_AT` · `CAMERA_MOVE_DURATION`
- `SHOT_DRAW_DURATION` · `SHOT_HOLD_DURATION` · `PAST_ARC_OPACITY`
