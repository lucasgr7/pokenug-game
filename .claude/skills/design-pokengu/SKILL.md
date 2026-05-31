---
name: design-pokengu
description: Design guidelines and visual consistency rules for Pokengu. Use this skill when adding SVGs, icons, UI components, cards, animations, colors, or any visual element. Ensures the game feels fun and cohesive.
---

Pokengu is a dark-themed mobile-first Pokémon RPG. Every visual decision should feel like a **game**, not a dashboard. Fun, colorful, tactile — but within a tight, consistent design system. When in doubt, look at `Card.svelte` and `CardKindIcon.svelte` — they're the visual heart of the game.

## Design tokens (`src/app.css`)

Always use CSS variables. Never hardcode hex values for structural colors.

| Variable | Dark value | Use |
|---|---|---|
| `--bg` | `#0c0a09` | Page background |
| `--surface` | `#1c1917` | Card / panel background |
| `--surface-2` | `#292524` | Nested surface, inputs |
| `--text` | `#f5f5f4` | Primary text |
| `--text-muted` | `#a8a29e` | Secondary / disabled |
| `--border` | `#3f3f46` | Dividers, card borders |
| `--accent` | `#8b5cf6` | Purple — CTA buttons, active tabs |
| `--danger` | `#ef4444` | HP loss, errors |
| `--success` | `#22c55e` | HP gain, success states |

**Exception:** element colors and rarity colors are hardcoded in `src/lib/game/elements.ts` and `Card.svelte`. That's intentional — they are game data, not theme variables.

## Element color palette (`src/lib/game/elements.ts`)

15 Pokémon types, each with `ELEMENT_COLOR`, `ELEMENT_LABEL` (PT-BR), `ELEMENT_EMOJI`:

| Element | Color | Emoji |
|---|---|---|
| fire | `#ef4444` | 🔥 |
| water | `#3b82f6` | 💧 |
| grass | `#16a34a` | 🌿 |
| electric | `#eab308` | ⚡ |
| normal | `#a8a29e` | ⭐ |
| fighting | `#c2410c` | 🥊 |
| psychic | `#db2777` | 🔮 |
| rock | `#a16207` | 🪨 |
| ground | `#b45309` | ⛰️ |
| flying | `#60a5fa` | 🪶 |
| bug | `#84cc16` | 🐛 |
| poison | `#9333ea` | ☠️ |
| ghost | `#6d28d9` | 👻 |
| ice | `#22d3ee` | ❄️ |
| dragon | `#4f46e5` | 🐉 |

When designing any element-themed UI, pull color from `ELEMENT_COLOR[element]` — never invent a new red for fire or blue for water.

## Card rarity system

| Rarity | Color | When to use |
|---|---|---|
| starter | `#9ca3af` | Gray — the 3 starting cards |
| common | `#64748b` | Slate — basic drops |
| rare | `#3b82f6` | Blue — mid-tier |
| epic | `#a855f7` | Purple — powerful cards |

Cards that have an element use `ELEMENT_COLOR` instead of the rarity color for their theme. Element > rarity for visual theming.

## SVG icons — the `CardKindIcon` pattern

All card art is inline SVG in `src/lib/components/CardKindIcon.svelte`. The viewBox is always `0 0 48 48`. Icons receive `color` (a hex string from the element/rarity system) and `size` props.

**Rules for new card kind icons:**
1. ViewBox `0 0 48 48` — always.
2. Accept `color` as a prop; use it for `fill` and `stroke`. Never hardcode element colors inside the icon.
3. Two-layer style: a filled shape at `opacity: 0.22–0.25` (the "glow layer"), then a stroked outline at full opacity.
4. `stroke-width: 3`, `stroke-linecap: round`, `stroke-linejoin: round` — consistent with existing icons.
5. White accent paths at `opacity: 0.55` for depth (see the attack sword's highlight path).
6. `aria-hidden="true"` on the `<svg>` — the card footer has text labels.
7. Keep paths simple: the icon renders at 65px (normal) and 86px (showcase). Details below ~12px will be invisible.

**Example — adding a "poison" kind icon:**
```svelte
{:else if kind === 'poison'}
  <!-- skull -->
  <circle cx="24" cy="20" r="12" fill={color} opacity="0.22" />
  <circle cx="24" cy="20" r="12" stroke={color} stroke-width="3" />
  <path d="M18 28v4h12v-4" stroke={color} stroke-width="3" stroke-linecap="round" />
  <circle cx="20" cy="18" r="2.5" fill={color} />
  <circle cx="28" cy="18" r="2.5" fill={color} />
  <path d="M22 24h4" stroke={color} stroke-width="2.5" stroke-linecap="round" />
```

## General SVG rules

- **Static assets** in `static/` (served at `/`) — for icons reused outside Svelte (e.g., favicon, manifest icons).
- **Component SVGs** in `src/lib/components/` or inline in `.svelte` — for icons that need dynamic `color`/`size` props.
- `viewBox` must be square. `1:1` ratio for icons, `3:4` is the card aspect ratio.
- All SVGs `aria-hidden="true"` unless they're the _only_ visual representation (then add `role="img"` + `aria-label`).
- No `<title>` tags inside SVGs used as decorative icons.

## Animation conventions

Two animations are already defined and should be the reference style:

**Card flip** (`card-flip` in `Card.svelte`):  
`perspective(600px) rotateY(80deg→0)`, 300ms, `ease-out`, `backwards`. Use this whenever a card enters.

**Shield shine** (`shield-shine`):  
A diagonal `linear-gradient` sweep across the card, `1.6s`, `ease-in-out`, `infinite`. Use this for "active" or "defended" state emphasis.

New animations must:
- Use `ease-out` for entering elements (snappy feel)
- Use `ease-in-out` for looping effects (breathing feel)
- Stay under 400ms for one-shot transitions
- Never animate `width`/`height` — use `transform` and `opacity` only

## Typography

Tailwind utility classes only — no custom font sizes in `<style>`. The card uses:
- `text-[8px]` — type label (ALL CAPS, `tracking-wide`)
- `text-[9px]` — badge text
- `text-[10px]` — small counts
- `text-[11px]` — card name (`font-extrabold`)

In game screens, headings use `text-xl font-bold` or `text-2xl font-extrabold`. Never go below `text-[8px]` — anything smaller is invisible on mobile.

## Mobile-first shell

- Max width: `480px`, centered via `#app-shell` in `app.css`. All game UI must work within this shell.
- Bottom nav height: ~56px. Content must not be clipped by it — use `pb-16` or `pb-20` on scrollable lists.
- Tap targets: minimum `44×44px`. Use `min-h-11` or `min-w-11` for interactive elements.
- No hover-only interactions — touch is primary.

## Visual feel checklist

Before shipping any visual change, ask:
- [ ] Does it use `--surface`/`--bg` or a hardcoded black? (use variables)
- [ ] Does it feel like a card game? (rounded-xl, subtle shadows, dark bg)
- [ ] Is the color pulled from the element/rarity system rather than invented?
- [ ] Does it work at 375px viewport width?
- [ ] Is text legible at `text-[9px]` minimum (game uses tiny text intentionally)?
- [ ] If it has animation — is it `transform`/`opacity` only, under 400ms?
- [ ] If it has an SVG icon — does it follow the `CardKindIcon` viewBox + opacity layer pattern?

## Visual review

Visual validation is optional and should be left to the human unless a screenshot or smoke test was explicitly requested.

If a manual screenshot is requested, use the route-specific commands from the `run-pokengu` skill.
