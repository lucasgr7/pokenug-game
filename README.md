# Pokengu

A browser-based card-battler idle game built with **SvelteKit 5** and **Svelte Runes**.  
Catch Pokémon, build a deck, fight through elemental regions, and let your roster grind while you're away.

> [!NOTE]
> **Looking for contributors!** See [Contributing](#contributing) — all skill levels welcome.

---

## What is Pokengu?

Pokengu blends two genres:

- **Slay-the-Spire-style card combat** — play Attack, Defense, Heal, Buff, Capture, and Combo cards with a 3-mana hand each turn
- **Idle/NGU progression** — assign captured Pokémon to jobs that passively generate money and elemental points while you're offline

The core loop:

1. **Pick a region** (Verdant Forest → Ember Cave → Crystal Lake → … → Psychic Tower)
2. **Battle wild Pokémon** using type-advantage mechanics (15 elements, gen-1 type chart)
3. **Throw a Poké Ball card** to capture enemies and grow your roster
4. **Fight the region boss** (daily cooldown) for rare card rewards
5. **Spend earnings** in the Shop, upgrade your deck, and invest in permanent NGU upgrades
6. **Trade element points** on the in-game marketplace where prices drift over time

All state is stored client-side in **IndexedDB** — no account, no server, fully offline-capable.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [SvelteKit 5](https://kit.svelte.dev/) — SPA mode (no SSR) |
| Reactivity | Svelte 5 Runes (`$state`, `$derived`, `$effect`) |
| Styling | Tailwind CSS v4 |
| Persistence | IndexedDB via [`idb`](https://github.com/jakearchibald/idb) |
| Pokémon data | [PokéAPI](https://pokeapi.co/) (sprites + base stats) |
| Language | TypeScript (strict) |
| Deploy | Docker → Nginx → Cloudflare Tunnel |

---

## Getting Started

**Prerequisites:** Node 20+, Yarn classic

```sh
git clone https://github.com/<your-user>/pokengu.git
cd pokengu
yarn install
yarn dev
```

Open `http://localhost:5173`, pick a starter, and start battling.

### Other commands

```sh
yarn check        # type-check with svelte-check
yarn build        # production build (static)
yarn preview      # preview production build locally
```

### Docker (production)

```sh
docker build -t pokengu:local .
# or via Compose:
WEB_PORT=3030 docker compose up -d --build
```

The app is served by Nginx on port `3030` by default.

---

## Project Structure

```
src/
├── routes/           # SvelteKit pages
│   ├── +page.svelte          # Region map & battle entry
│   ├── battle/               # Card battle arena
│   ├── shop/                 # Daily card shop
│   ├── deck/                 # Deck builder
│   ├── jobs/                 # Idle job assignment
│   ├── market/               # Element point marketplace
│   └── catalog/              # Full card catalog
├── lib/
│   ├── game/         # Domain logic (battle engine, shop, jobs, state)
│   ├── data/         # Static data — cards, regions, starters
│   ├── db/           # IndexedDB adapters (one file per bounded context)
│   ├── components/   # Svelte UI components
│   ├── api/          # PokéAPI + sprite cache
│   └── utils/        # Math, RNG, time helpers
```

The fastest reading order for new contributors:

1. [`routes/+layout.svelte`](src/routes/+layout.svelte) — bootstrap & route guard
2. [`lib/game/types.ts`](src/lib/game/types.ts) — all domain types
3. [`lib/game/battle.svelte.ts`](src/lib/game/battle.svelte.ts) — full battle engine
4. [`lib/data/cards.ts`](src/lib/data/cards.ts) — card catalog & pricing

---

## Contributing

All contributions welcome — game design ideas, balance tweaks, new cards, UI polish, or bug fixes.

**Good first issues to tackle:**

- New card ideas (attack/defense/buff/combo — any element)
- Balance pass on existing cards or NGU upgrade costs
- Accessibility improvements (keyboard nav, contrast)
- Missing regions or boss encounters (gen-1 Pokémon only for now)
- Mobile layout polish

**How to contribute:**

1. Fork the repo and create a branch
2. Run `yarn check` before opening a PR — all type errors must be fixed
3. For new cards, add a `CardTemplate` to [`lib/data/cards.ts`](src/lib/data/cards.ts) and make sure the battle engine handles any new fields
4. Open a PR with a short description of what changed and why

For bigger changes (new systems, architecture changes) open an issue first so we can align before you invest the time.

---

## Roadmap ideas

- [ ] PvP / async battle replays
- [ ] Deck-sharing via URL export
- [ ] More regions (gen-2 Pokémon)
- [ ] Card fusion / crafting system
- [ ] Achievements & challenge runs
- [ ] Localization (currently mixed PT-BR / EN)

---

## License

MIT
