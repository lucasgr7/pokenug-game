---
name: run-pokengu
description: Run, start, build, screenshot, test, and verify the Pokengu SvelteKit Pokémon game. Use this skill when asked to launch the app, take a screenshot, confirm a feature works, or smoke-test a change.
---

Pokengu is a browser-based Pokémon RPG built with SvelteKit + Vite, served at `http://localhost:5173`. The driver is `.claude/skills/run-pokengu/driver.mjs`, backed by Playwright headless Chromium. Screenshots land in `.claude/skills/run-pokengu/screenshots/`.

## Prerequisites

```bash
# Node 20 is required — Vite 8 refuses Node 18.
export PATH="/Users/lucas.ribeiro.br/.nvm/versions/node/v20.19.1/bin:$PATH"

# Install Playwright (one-time, inside the skill dir)
cd .claude/skills/run-pokengu && npm install
```

## Build

```bash
export PATH="/Users/lucas.ribeiro.br/.nvm/versions/node/v20.19.1/bin:$PATH"
yarn build          # produces build/
```

## Run (agent path)

**Step 1 — start the dev server** (leave it running):

```bash
export PATH="/Users/lucas.ribeiro.br/.nvm/versions/node/v20.19.1/bin:$PATH"
yarn dev > /tmp/pokengu-dev.log 2>&1 &
echo $! > /tmp/pokengu-dev.pid
# Poll until ready:
until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done
echo "Ready"
```

**Step 2 — run the driver**:

```bash
export PATH="/Users/lucas.ribeiro.br/.nvm/versions/node/v20.19.1/bin:$PATH"

# Full smoke run (onboarding + all routes):
node .claude/skills/run-pokengu/driver.mjs smoke

# Screenshot a specific route:
node .claude/skills/run-pokengu/driver.mjs ss home
node .claude/skills/run-pokengu/driver.mjs ss deck
node .claude/skills/run-pokengu/driver.mjs ss battle
node .claude/skills/run-pokengu/driver.mjs ss jobs
node .claude/skills/run-pokengu/driver.mjs ss shop

# Re-run onboarding (clears IndexedDB, then fills form):
node .claude/skills/run-pokengu/driver.mjs onboard Ash Charmander

# Check for JS console errors across all routes:
node .claude/skills/run-pokengu/driver.mjs console
```

Driver commands:

| Command | What it does |
|---|---|
| `smoke` | Onboard + screenshot all 5 routes, report errors |
| `ss <route>` | Go to route, take screenshot |
| `onboard [name] [starter]` | Clear IndexedDB, fill form, start game |
| `console` | Navigate all routes, print any JS errors |

**Stop the dev server:**

```bash
kill $(cat /tmp/pokengu-dev.pid) 2>/dev/null; pkill -f "vite dev" 2>/dev/null
```

## Run (human path)

```bash
export PATH="/Users/lucas.ribeiro.br/.nvm/versions/node/v20.19.1/bin:$PATH"
yarn dev --open     # opens browser automatically
```

## App structure

- `/` and `/battle` → Region map (Mapa); redirect to onboarding if no player
- `/deck` → Card deck builder
- `/jobs` → Pokémon job assignments (passive production)
- `/shop` → Card shop (rotates daily)
- Game state stored in **IndexedDB** (`pokengu` database)
- Language: **Portuguese (pt-BR)**

## Gotchas

- **Node 18 crashes Vite 8.** `CustomEvent is not defined` at startup. Must use Node 20 via nvm.
- **All routes redirect to onboarding** if no player exists in IndexedDB. Run `onboard` first.
- **IDB proxy clone bug**: never `put()` a Svelte `$state` proxy directly into IndexedDB — it must be snapshot/plainified first (see `memory/idb-proxy-clone.md`).
- **Playwright not in project deps.** The skill has its own `package.json` + `node_modules/` in `.claude/skills/run-pokengu/`. Run `npm install` there once.
- **`timeout` command absent on macOS zsh.** Use a `until curl ...; do sleep 1; done` loop instead of `timeout 30 bash -c '...'`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `CustomEvent is not defined` | You're on Node 18. `export PATH="/Users/lucas.ribeiro.br/.nvm/versions/node/v20.19.1/bin:$PATH"` |
| `Cannot find package 'playwright'` | Run `cd .claude/skills/run-pokengu && npm install` |
| All routes show onboarding | No player in IndexedDB. Run `node driver.mjs onboard` |
| Port 5173 already in use | `pkill -f "vite dev"` then retry |
| Screenshots blank / all-black | Playwright headless rendering lag — `networkidle` wait is enough; don't add extra sleep |
