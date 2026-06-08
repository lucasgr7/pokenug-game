# Card art

Drop card images here and they show up automatically — no code change needed.
A build-time `import.meta.glob` (see [`card-art.ts`](../../data/card-art.ts)) picks
up every file in this tree; the card art window falls back to the inline SVG glyph
(`CardKindIcon.svelte`) whenever no image matches.

## Folder = element

One folder per element, plus `neutral/` for starter / colorless cards
(`element: null` in [`cards.ts`](../../data/cards.ts)).

```
cards/
  water/   fire/   grass/   ...   (one per Element)
  neutral/                        (element === null)
```

## Filename = resolution order

For a given card the first existing file wins, checked in this order inside the
card's element folder:

| Priority | File                       | Scope                                  | Example                      |
|----------|----------------------------|----------------------------------------|------------------------------|
| 1        | `<cardId>.<ext>`           | that exact card                        | `water/water_splash.jpg`     |
| 2        | `_kind_<kind>.<ext>`       | every card of that kind in the element | `neutral/_kind_attack.jpg`   |
| 3        | `_default.<ext>`           | every card of the element              | `fire/_default.jpg`          |
| 4        | *(none)*                   | inline SVG glyph fallback              | —                            |

`<cardId>` is the snake_case template id from `cards.ts` (e.g. `fire_inferno`).
`<kind>` is the `CardKind` (`attack`, `defense`, `power`, …).
Supported `<ext>`: `jpg`, `jpeg`, `png`, `webp`, `avif`.

### Workflow

- **Quick start:** drop one `_default.<ext>` per element to art a whole element at once.
- **Refine:** add `<cardId>.<ext>` for the cards that deserve bespoke art; it
  overrides the generic automatically.
