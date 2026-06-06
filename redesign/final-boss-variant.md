# Boss Battle Screen — AI Implementation Spec

Complete specification for implementing the Final Boss Battle screen for Pokemon NGU.
Copy the exact values. Do not approximate colors or timings.

---

## Stack

- React 18 + Babel standalone (inline JSX, no build step)
- Plain CSS (no framework)
- Font: `Inter` (400/600/700/800/900) + `Russo One` (damage numbers, banners)
- Phone frame: `402 × 874px`, scaled to viewport via `transform: scale()` on `#phone-scale`

---

## 1. Color Tokens

Define as CSS custom properties on `:root`.

```css
:root {
  /* surfaces */
  --bg-0:  #06040f;   /* phone background */
  --bg-1:  #0d0a1c;   /* cards, modals, nameplates */
  --bg-2:  #141028;   /* elevated panels */
  --bg-3:  #1c1636;   /* chips, badges */
  --line:  #231d3a;   /* borders, dividers */

  /* text */
  --txt:      #ede9ff;
  --txt-dim:  #7a6e9e;
  --txt-mute: #4a4268;

  /* accents */
  --boss:    #c0273a;   /* boss HP base, vignette core */
  --boss-2:  #ff4d62;   /* boss HP highlight, speech name */
  --teal:    #3ad6c2;   /* player HP, ally speech, nav active */
  --teal-2:  #6fe6d4;   /* block value, BLOQUEADO floater */
  --mana:    #a86bff;   /* energy pips dark */
  --mana-2:  #c9a3ff;   /* energy pips lit, corrupt fog */
  --gold:    #ffc24a;   /* end turn button */
  --orange:  #ffb088;   /* FÚRIA intent text */
  --void-purple: rgba(88, 4, 158, 1); /* fog wisps */
}
```

---

## 2. Layout Structure

```
#stage  (fixed, full viewport, dark radial bg)
  └── #phone-scale  (transform: scale for viewport fit)
        └── #shake-wrap  (receives .tremor class on boss attack)
              └── .phone  (402×874, border-radius:26px, overflow:hidden)
                    ├── .statusbar   (34px, flex-shrink:0)
                    ├── .arena       (flex:1, position:relative, overflow:hidden)
                    │     ├── .fog-layer       (z-index:2, absolute, pointer-events:none)
                    │     ├── .vignette        (z-index:4, absolute, pointer-events:none)
                    │     ├── .dark-flash      (z-index:8, absolute, pointer-events:none)
                    │     ├── .floor.enemy     (z-index:1, top glow)
                    │     ├── .floor.player    (z-index:1, bottom glow)
                    │     ├── .sprite-wrap.enemy-sprite  (top:96px, right:30px)
                    │     ├── .sprite-wrap.player-sprite (bottom:310px, left:18px)
                    │     ├── .plate.enemy     (z-index:12, top:62px, left:16px)
                    │     ├── .speech-wrap     (z-index:25, top:56px, right:14px)
                    │     ├── .phase-badge     (z-index:9, top:56px, centered)
                    │     ├── .plate.player    (z-index:12, bottom:308px, right:16px)
                    │     ├── .log             (z-index:8, bottom:270px)
                    │     ├── .actionbar       (z-index:25, bottom:228px)
                    │     ├── .hand            (z-index:20, bottom:22px, height:230px)
                    │     └── .turn-flash      (z-index:55)
                    └── .navbar      (78px, flex-shrink:0)
```

---

## 3. Arena Background

```css
.arena {
  background:
    radial-gradient(75% 45% at 68% 10%, rgba(180,18,38,.28), transparent 55%),
    radial-gradient(65% 55% at 28% 78%, rgba(90,8,170,.2),  transparent 58%),
    radial-gradient(110% 65% at 50% 50%, rgba(28,0,58,.55), transparent 70%),
    linear-gradient(180deg, #0e061a 0%, #080412 40%, #040210 100%);
}

/* Stage behind the phone */
#stage {
  background: radial-gradient(130% 90% at 50% -5%, #1c0514 0%, #060309 55%, #020108 100%);
}
```

---

## 4. Speech Bubble

### CSS

```css
/* ── wrapper (animates in) ── */
.speech-wrap {
  position: absolute;
  z-index: 25;
  top: 56px;
  right: 14px;
  max-width: 178px;
  animation: bubbleIn .38s cubic-bezier(.34, 1.56, .64, 1) both;
}
@keyframes bubbleIn {
  from { opacity: 0; transform: scale(.72) translateY(10px); }
  to   { opacity: 1; transform: scale(1)   translateY(0);    }
}

/* ── bubble body ── */
.speech-bubble {
  background: linear-gradient(145deg, rgba(16,6,28,.97), rgba(8,3,16,.99));
  border: 1px solid rgba(175, 18, 42, .6);
  border-radius: 4px 14px 14px 14px; /* sharp top-left = tail side */
  padding: 9px 13px 10px;
  position: relative;
  box-shadow:
    0 8px 28px rgba(0,0,0,.78),
    0 0 22px rgba(175,18,42,.12),
    inset 0 1px 0 rgba(255,255,255,.04);
}

/* ── left-pointing tail (boss is on the right, points left toward enemy) ── */
.speech-bubble::before {
  content: '';
  position: absolute;
  top: 12px; left: -12px;
  border-top:    6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right:  12px solid rgba(175, 18, 42, .6); /* outer border color */
}
.speech-bubble::after {
  content: '';
  position: absolute;
  top: 13px; left: -9px;
  border-top:    5px solid transparent;
  border-bottom: 5px solid transparent;
  border-right:  9px solid rgba(10, 3, 18, .98); /* inner fill color */
}

/* ── ally/player variant: right-pointing tail ── */
.speech-bubble.ally {
  border-radius: 14px 4px 14px 14px; /* sharp top-right */
  border-color: rgba(18, 140, 140, .55);
  box-shadow: 0 8px 28px rgba(0,0,0,.6), 0 0 20px rgba(18,140,140,.1);
  margin-left: auto;
}
.speech-bubble.ally::before {
  left: auto; right: -12px;
  border-right: none;
  border-left: 12px solid rgba(18, 140, 140, .55);
}
.speech-bubble.ally::after {
  left: auto; right: -9px;
  border-right: none;
  border-left: 9px solid rgba(3, 10, 18, .98);
}

/* ── speaker label ── */
.speech-name {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #ff4d62;           /* use #3ad6c2 for ally */
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.speech-name::before { content: '▣'; font-size: 7px; } /* boss */
.speech-name.ally::after { content: '▣'; font-size: 7px; } /* ally: suffix instead */

/* ── body text ── */
.speech-text {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  color: rgba(228, 222, 252, .88);
  font-style: italic;
  text-wrap: pretty;
}

/* ── typewriter cursor ── */
.speech-cursor {
  display: inline-block;
  width: 2px;
  height: 11px;
  background: #ff4d62;       /* use #3ad6c2 for ally */
  margin-left: 2px;
  vertical-align: middle;
  animation: blink .65s step-end infinite;
}
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
```

### React Component

```jsx
/**
 * SpeechBubble
 * Force a remount (and typewriter restart) by changing the `key` prop.
 * Auto-dismiss: call showSpeech() which sets a 5.2s timeout to clear.
 */
function SpeechBubble({ text, isAlly = false }) {
  const [shown, setShown] = useState('');
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    // Mount-only: key prop change forces full remount = clean restart
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) { clearInterval(iv); setTyping(false); }
    }, 30); // 30ms per character
    return () => clearInterval(iv);
  }, []); // intentionally empty — key handles reset

  return (
    <div className="speech-wrap">
      <div className={`speech-bubble${isAlly ? ' ally' : ''}`}>
        <div className={`speech-name${isAlly ? ' ally' : ''}`}>
          {isAlly ? 'Charizard' : 'Giovanni'}
        </div>
        <div className="speech-text">
          &ldquo;{shown}{typing && <span className="speech-cursor"/>}&rdquo;
        </div>
      </div>
    </div>
  );
}

/**
 * Usage in parent App:
 * const [speech, setSpeech] = useState(null); // { text: string, key: number }
 *
 * const showSpeech = useCallback(text => {
 *   setSpeech(s => ({ text, key: (s?.key ?? 0) + 1 }));
 *   setTimeout(() => setSpeech(null), 5200);
 * }, []);
 *
 * // In JSX:
 * {speech && <SpeechBubble key={speech.key} text={speech.text} />}
 */
```

### Trigger Points

| Event | Speech pool |
|---|---|
| Battle start (+1.3s delay) | `SPEECH.intro` |
| Turn end (AMEAÇA, even turns) | `SPEECH.intro` |
| Turn end (FÚRIA phase) | `SPEECH.furia` |
| Boss uses CORROMPIMENTO | `SPEECH.corrupt` |
| Player HP drops below 42% | `SPEECH.playerLow` |
| Phase changes to FÚRIA | hardcoded: `"Isso é tudo?! Sinta minha FÚRIA!"` |
| Phase changes to DESESPERO | hardcoded: `"IMPOSSÍVEL! Como você ousou..."` |

```js
const SPEECH = {
  intro:     ['Você ousou vir até aqui?', 'Nenhum treinador me vence.', 'Prepare-se para o fim.'],
  furia:     ['Sinta o poder das trevas!', 'Suas cartas são inúteis!', 'Vou destruir tudo que você tem.'],
  corrupt:   ['Suas cartas... corrompidas!', 'Sinta o vazio...', 'A escuridão consome tudo.'],
  desespero: ['IMPOSSÍVEL!', 'Você... você não pode...', 'Isso não pode estar acontecendo!'],
  playerLow: ['Você já está caindo...', 'Quase lá. Continue sofrendo.', 'Patético.'],
};
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
```

---

## 5. Card Corruption Effect

Three-phase destruction triggered by boss's `CORROMPIMENTO` intent.

### CSS

```css
/* Phase 1: card trembles while ink spreads */
.card.corrupting {
  animation: cardTremble .1s ease-in-out infinite;
}
@keyframes cardTremble {
  0%, 100% { margin-left: 0;   margin-top: 0;  }
  33%       { margin-left: -3px; margin-top: -2px; }
  66%       { margin-left:  3px; margin-top:  1px; }
}

/* Corruption overlay — rendered as an absolute sibling with identical transform */
.corrupt-overlay {
  position: absolute;
  left: 50%; bottom: 0;
  width: 124px; height: 184px;
  transform-origin: bottom center;
  pointer-events: none;
  border-radius: 13px;
  overflow: hidden;
}

/* Ink spreads radially from top-right corner */
.corrupt-ink {
  position: absolute; inset: 0;
  border-radius: inherit;
  z-index: 10;
  animation: corruptInk .55s ease-out forwards;
}
@keyframes corruptInk {
  0%   { background: radial-gradient(circle at 78% 18%, rgba(110,0,160,0)   0%, rgba(8,0,18,0)    100%); }
  28%  { background: radial-gradient(circle at 78% 18%, rgba(155,0,210,.70) 0%, rgba(40,0,70,.40) 38%, rgba(8,0,18,0) 72%); }
  65%  { background: radial-gradient(circle at 48% 48%, rgba(78,0,122,.92)  0%, rgba(26,0,50,.74) 48%, rgba(6,0,16,.30) 85%); }
  100% { background: rgba(4,0,10,.95); box-shadow: inset 0 0 24px rgba(108,0,152,.95); }
}

/* Crack lines appear at 0.18s delay */
.corrupt-cracks {
  position: absolute; inset: 0;
  z-index: 11;
  pointer-events: none;
  opacity: 0;
  animation: cracksIn .44s ease-out .18s forwards;
  background:
    linear-gradient(128deg, transparent 28%,  rgba(165,0,210,.22) 28%,  rgba(165,0,210,.22) 28.4%, transparent 28.4%),
    linear-gradient(52deg,  transparent 58%,  rgba(205,0,155,.16) 58%,  rgba(205,0,155,.16) 58.4%, transparent 58.4%),
    linear-gradient(98deg,  transparent 44%,  rgba(125,0,185,.20) 44%,  rgba(125,0,185,.20) 44.4%, transparent 44.4%);
}
@keyframes cracksIn { from { opacity: 0; } to { opacity: 1; } }
```

### React Logic

```jsx
// Scatter vectors — 5 unique directions keyed by card.uid % 5
const DEL_DIRS = [
  { dx: -92, dr: -58 },
  { dx:  98, dr:  60 },
  { dx: -55, dr:  74 },
  { dx:  80, dr: -64 },
  { dx: -78, dr:  52 },
];

// In App state:
const [corruptSet, setCorruptSet] = useState(new Set()); // cards showing ink
const [deleteSet,  setDeleteSet]  = useState(new Set()); // cards flying away

// Corruption sequence:
const doCorrupt = useCallback(count => {
  const eligible = handRef.current.filter(c => !c._playing);
  if (!eligible.length) return 0;
  const n    = Math.min(count, eligible.length);
  const uids = new Set(eligible.slice(0, n).map(c => c.uid));

  setCorruptSet(uids);   // start ink animation + trembling
  doFlash();             // crimson screen flash
  doShake();             // screen tremor

  setTimeout(() => setDeleteSet(new Set(uids)), 480);  // start fly-away

  setTimeout(() => {
    setHand(h => h.filter(c => !uids.has(c.uid)));     // remove from DOM
    setCorruptSet(new Set());
    setDeleteSet(new Set());
    setDiscard(d => d + n);
  }, 1080);

  return n;
}, [doFlash, doShake]);

// In hand render:
const isCorr = corruptSet.has(card.uid);
const isDel  = deleteSet.has(card.uid);
const dir    = DEL_DIRS[card.uid % DEL_DIRS.length];

const normalTx = `translateX(calc(-50% + ${x}px)) translateY(${yArc}px) rotate(${rot}deg)`;
const deleteTx = `translateX(calc(-50% + ${x + dir.dx}px)) translateY(-215px) rotate(${rot + dir.dr}deg) scale(0.04)`;
const tx       = isDel ? deleteTx : normalTx;

const delStyle = isDel ? {
  transition: 'transform .54s ease-in, opacity .34s ease-in .12s, filter .34s ease-in',
  opacity: 0,
  filter:  'saturate(0) brightness(0)',
} : {};

// Render card + overlay as siblings inside .hand:
return (
  <React.Fragment key={card.uid}>
    <Card
      card={card}
      affordable={!isCorr && !isDel && card.cost <= energy}
      className={[isCorr ? 'corrupting' : '', isDel ? '' : ''].filter(Boolean).join(' ')}
      style={{ transform: tx, zIndex: i, ...delStyle }}
    />
    {(isCorr || isDel) && (
      <div className="corrupt-overlay" style={{ transform: tx, zIndex: i + 1, ...delStyle }}>
        <div className="corrupt-ink"/>
        <div className="corrupt-cracks"/>
      </div>
    )}
  </React.Fragment>
);
```

> **Key insight:** The corruption overlay is a *sibling* element (not a child of Card) with the *exact same `transform`* as the card. This avoids needing to modify the Card component while achieving perfect visual overlay.

---

## 6. Ominous Presence

### Fog Wisps

```jsx
// Seeded RNG for stable, deterministic layout
function seededRNG(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 0x100000000; };
}

function FogLayer({ phase }) {
  const wisps = useMemo(() => {
    const rng = seededRNG(0xf065); // fixed seed = same layout every render
    return Array.from({ length: 26 }, (_, i) => ({
      id:      i,
      x:       4   + rng() * 92,    // % from left
      yPct:    50  + rng() * 46,    // % from top (bottom half of arena)
      w:       52  + rng() * 115,   // px diameter
      delay:   rng() * 10,          // s animation delay
      dur:     8   + rng() * 7,     // s animation duration (before speed mult)
      opacity: 0.1 + rng() * 0.22,  // peak opacity
      dx:      (rng() - 0.5) * 70,  // px horizontal drift
      isRed:   rng() > 0.52,        // crimson vs purple
    }));
  }, []);

  // Fog speeds up as boss weakens
  const speed = phase === 'DESESPERO' ? 0.5 : phase === 'FÚRIA' ? 0.7 : 1.0;

  return (
    <div className="fog-layer">
      {wisps.map(w => (
        <div key={w.id} className="fog-wisp" style={{
          left:      w.x + '%',
          top:       w.yPct + '%',
          width:     w.w,
          height:    w.w,
          marginLeft: w.w / -2,     // center the circle on its x/y point
          marginTop:  w.w / -2,
          background: `radial-gradient(circle, ${
            w.isRed
              ? `rgba(188,8,34,${w.opacity})`
              : `rgba(88,4,158,${w.opacity})`
          } 0%, transparent 70%)`,
          '--fo':  w.opacity,
          '--fdx': w.dx + 'px',
          animationDelay:    w.delay + 's',
          animationDuration: (w.dur * speed) + 's',
        }}/>
      ))}
    </div>
  );
}
```

```css
.fog-layer { position: absolute; inset: 0; pointer-events: none; z-index: 2; overflow: hidden; }
.fog-wisp  { position: absolute; border-radius: 50%; filter: blur(24px); animation: fogRise linear infinite; }
@keyframes fogRise {
  0%   { opacity: 0;          transform: translateY(0); }
  12%  { opacity: var(--fo); }
  86%  { opacity: var(--fo); }
  100% { opacity: 0;          transform: translateY(-210px) translateX(var(--fdx, 0px)); }
}
```

### Vignette

```css
.vignette {
  position: absolute; inset: 0; pointer-events: none; z-index: 4;
  border-radius: 26px; /* match phone border-radius */
  animation: vigBreath 4.5s ease-in-out infinite;
}
@keyframes vigBreath {
  0%, 100% { box-shadow: inset 0 0  90px rgba(175,0,28,.18), inset 0 0 38px rgba(75,0,115,.14); }
  50%      { box-shadow: inset 0 0 115px rgba(200,0,36,.28), inset 0 0 48px rgba(95,0,135,.20); }
}

/* Applied when phase === 'DESESPERO' */
.vignette.rage {
  animation: vigRage 1.4s ease-in-out infinite;
}
@keyframes vigRage {
  0%, 100% { box-shadow: inset 0 0 115px rgba(218,0,28,.45), inset 0 0 55px rgba(120,0,38,.36); }
  50%      { box-shadow: inset 0 0 150px rgba(255,0,28,.62), inset 0 0 70px rgba(158,0,50,.52); }
}
```

```jsx
function Vignette({ phase }) {
  return <div className={`vignette${phase === 'DESESPERO' ? ' rage' : ''}`}/>;
}
```

### Screen Shake

```css
/* Applied imperatively to #shake-wrap, not via React state */
.tremor { animation: tremoAnim .38s ease; }
@keyframes tremoAnim {
  0%, 100% { transform: translate(0, 0);    }
  14%      { transform: translate(-4px, 2px);  }
  28%      { transform: translate( 4px,-3px);  }
  42%      { transform: translate(-3px, 3px);  }
  57%      { transform: translate( 4px, 1px);  }
  71%      { transform: translate(-3px,-2px);  }
  85%      { transform: translate( 2px, 2px);  }
}
```

```js
// Imperative shake — bypasses React render cycle for instant response
const doShake = useCallback(() => {
  const el = document.getElementById('shake-wrap');
  if (!el) return;
  el.classList.remove('tremor');
  void el.offsetWidth;           // force reflow to restart animation
  el.classList.add('tremor');
  setTimeout(() => el.classList.remove('tremor'), 420);
}, []);
```

> **Why imperative?** Adding/removing a class outside React avoids the render-cycle delay that would make the shake feel sluggish. The `void el.offsetWidth` forces a reflow so removing and re-adding the same class restarts the animation.

### Dark Flash

```css
.dark-flash {
  position: absolute; inset: 0; z-index: 8;
  border-radius: 26px; pointer-events: none;
  animation: flashOut .4s ease-out forwards;
}
@keyframes flashOut {
  0%   { opacity: 0; }
  18%  { opacity: 1; }
  100% { opacity: 0; }
}
```

```jsx
// Trigger: setFlashActive(true) → setTimeout 440ms → setFlashActive(false)
function DarkFlash({ active }) {
  return active
    ? <div className="dark-flash" style={{ background: 'rgba(155,0,24,.22)' }}/>
    : null;
}
```

---

## 7. Phase System

```js
// Derived from bossHp — no separate state needed
const phase = bossHp > BOSS_MAX * 0.6 ? 'AMEAÇA'
            : bossHp > BOSS_MAX * 0.3 ? 'FÚRIA'
            :                            'DESESPERO';

// Intent selection per phase
function pickIntent(turn, phase) {
  if (phase === 'AMEAÇA') return turn % 4 === 0 ? INTENTS.heavy   : INTENTS.light;
  if (phase === 'FÚRIA')  return turn % 2 === 0 ? INTENTS.corrupt : INTENTS.heavy;
  return                         turn % 3 === 0 ? INTENTS.corrupt : INTENTS.rage;
}
```

### Phase Change Detection

```jsx
const prevPhaseRef = useRef('AMEAÇA');

useEffect(() => {
  if (phase === prevPhaseRef.current) return;
  prevPhaseRef.current = phase;

  if (phase === 'FÚRIA') {
    showSpeech('Isso é tudo?! Sinta minha FÚRIA!');
    setBanner('MODO FÚRIA');
    doShake(); doFlash();
    setTimeout(() => setBanner(null), 1450);
  } else if (phase === 'DESESPERO') {
    showSpeech('IMPOSSÍVEL! Como você ousou...');
    setBanner('MODO DESESPERO');
    doShake(); doFlash();
    setTimeout(() => setBanner(null), 1650);
  }
}, [phase]); // runs whenever bossHp crosses a threshold
```

### Phase Badge

```css
.phase-badge {
  position: absolute; left: 50%; transform: translateX(-50%);
  top: 56px; z-index: 9;
  display: flex; align-items: center; gap: 6px;
  font-size: 9px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
  color: var(--txt-mute);
  background: rgba(4,2,14,.75); border: 1px solid rgba(255,255,255,.06);
  border-radius: 999px; padding: 3px 10px;
  pointer-events: none;
}
.phase-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

/* AMEAÇA */  .phase-dot.a { background: #ff4d62; box-shadow: 0 0 6px rgba(255,77,98,.8); }
/* FÚRIA  */  .phase-dot.f { background: #ff8030; box-shadow: 0 0 7px rgba(255,128,48,.9); }
/* DESESPERO */ .phase-dot.d { background: #ff0030; animation: critDot .6s ease-in-out infinite alternate; }
@keyframes critDot {
  from { box-shadow: 0 0  4px rgba(255,0,48,.6); }
  to   { box-shadow: 0 0 14px rgba(255,0,48,1);  }
}
```

---

## 8. Intent Chips

```css
.intent {
  margin-top: 8px;
  display: inline-flex; align-items: center; gap: 6px;
  border-radius: 8px; padding: 4px 8px;
  font-size: 11px; font-weight: 700;
}
.intent .v { font-weight: 900; }

/* ATK */
.intent.atk {
  background: rgba(192,39,58,.15);
  border: 1px solid rgba(192,39,58,.42);
  color: #ff8898;
}

/* CORRUPT — purple, box-shadow glow pulse */
.intent.corrupt {
  background: rgba(110,0,155,.2);
  border: 1px solid rgba(150,0,200,.42);
  color: #d090ff;
  animation: corruptPulse 1.4s ease-in-out infinite;
}
@keyframes corruptPulse {
  0%, 100% { box-shadow: none; }
  50%      { box-shadow: 0 0 16px rgba(150,0,200,.45); }
}

/* RAGE — orange, scale pulse */
.intent.rage {
  background: rgba(255,80,20,.15);
  border: 1px solid rgba(255,80,20,.48);
  color: #ffb088;
  animation: ragePulse .75s ease-in-out infinite;
}
@keyframes ragePulse {
  0%, 100% { opacity: .88; }
  50%      { opacity: 1; transform: scale(1.02); }
}
```

```jsx
const INTENTS = {
  light:   { type: 'atk',     label: 'Investida Sombria', value: 12, icon: '💀' },
  heavy:   { type: 'atk',     label: 'Golpe Devastador',  value: 20, icon: '⚔'  },
  corrupt: { type: 'corrupt', label: 'CORROMPIMENTO',     value: 2,  icon: '☠'  },
  rage:    { type: 'rage',    label: 'FÚRIA TOTAL',       value: 28, icon: '⚡'  },
};

// In JSX:
<div className={`intent ${
  intent.type === 'corrupt' ? 'corrupt' :
  intent.type === 'rage'    ? 'rage'    : 'atk'
}`}>
  <span>{intent.icon}</span>
  {intent.label}
  <span className="v">
    {intent.type === 'corrupt' ? `×${intent.value}` : `-${intent.value}`}
  </span>
</div>
```

---

## 9. Boss Nameplate Glow

```css
.plate.enemy {
  border-color: rgba(192,39,58,.42);
  animation: bossGlow 3.5s ease-in-out infinite;
}
@keyframes bossGlow {
  0%, 100% {
    box-shadow:
      0 0  0  1px rgba(192,39,58,.10),
      0 10px 30px rgba(0,0,0,.85),
      0 0 22px rgba(192,39,58,.10);
  }
  50% {
    box-shadow:
      0 0  0  1px rgba(192,39,58,.28),
      0 10px 30px rgba(0,0,0,.85),
      0 0 44px rgba(192,39,58,.28);
  }
}

/* Skull icon pulse */
.boss-skull {
  font-size: 13px;
  animation: skullPulse 2.5s ease-in-out infinite;
}
@keyframes skullPulse {
  0%, 100% { opacity: .55; }
  50%      { opacity: 1; text-shadow: 0 0 10px rgba(255,70,90,.8); }
}
```

---

## 10. Stale Closure Pattern (React)

When callbacks (`endTurn`, `doCorrupt`) need to read state that changes over time, use refs to avoid stale closures:

```jsx
const handRef   = useRef(hand);
const bossHpRef = useRef(bossHp);
const intentRef = useRef(intent);

useEffect(() => { handRef.current   = hand;   }, [hand]);
useEffect(() => { bossHpRef.current = bossHp; }, [bossHp]);
useEffect(() => { intentRef.current = intent; }, [intent]);

// Inside callbacks, read .current instead of the state variable:
const doCorrupt = useCallback(count => {
  const cur = handRef.current; // always fresh, no dep needed
  // ...
}, [doFlash, doShake]); // no 'hand' in deps
```

---

## 11. HP Bar

```css
.hpbar {
  position: relative; height: 18px; border-radius: 9px;
  background: #050210; border: 1px solid rgba(0,0,0,.8);
  overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,.85);
}
.hpbar .fill {
  position: absolute; inset: 0; border-radius: 9px;
  transition: width .5s cubic-bezier(.2, .8, .2, 1);
}
/* Boss fill — crimson */
.fill.boss-fill   { background: linear-gradient(180deg, #ff5068, #c0273a 60%, #8f0e20); }
/* Player fill states */
.fill.player-fill { background: linear-gradient(180deg, #6fe6d4, #3ad6c2 60%, #1ea193); }
.fill.low         { background: linear-gradient(180deg, #ffb36b, #ff7a3d 60%, #d2541f); }
.fill.crit        { background: linear-gradient(180deg, #ff8f8f, #ff4d4d 60%, #c62f2f); }
/* Gloss overlay */
.hpbar .glo {
  position: absolute; top: 0; left: 0; height: 50%; width: 100%;
  border-radius: 9px 9px 0 0;
  background: linear-gradient(180deg, rgba(255,255,255,.2), transparent);
  pointer-events: none;
}
```

```jsx
function HpBar({ cur, max, isBoss }) {
  const pct = Math.max(0, Math.min(100, cur / max * 100));
  const cls = isBoss ? 'boss-fill'
            : pct < 25 ? 'crit'
            : pct < 55 ? 'low'
            :             'player-fill';
  return (
    <div className="hpbar">
      <div className={`fill ${cls}`} style={{ width: pct + '%' }}/>
      <div className="glo"/>
      <div className="txt">{Math.max(0, Math.round(cur))} / {max}</div>
    </div>
  );
}
```

---

## 12. Turn Banner

```css
.turn-flash {
  position: absolute; inset: 0; z-index: 55;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.turn-flash .b {
  font-family: 'Russo One', sans-serif;
  font-size: 28px; letter-spacing: 1px; color: #fff;
  text-shadow: 0 4px 16px rgba(192,39,58,.7), 0 0 26px rgba(110,0,155,.6);
  animation: turnB 1.15s ease forwards; opacity: 0;
}
@keyframes turnB {
  0%   { opacity: 0; transform: scale(.8);  }
  25%  { opacity: 1; transform: scale(1);   }
  75%  { opacity: 1;                        }
  100% { opacity: 0; transform: scale(1.05);}
}
```

```jsx
// In App state: const [banner, setBanner] = useState(null);
// Usage:
setBanner(`TURNO ${nt}`);
setTimeout(() => setBanner(null), 1150);

// In JSX:
{banner && <div className="turn-flash"><div className="b">{banner}</div></div>}
```

---

## 13. Checklist for Implementation

- [ ] CSS tokens defined on `:root`
- [ ] `#shake-wrap` div wraps the phone (not `#phone-scale`)
- [ ] `doShake()` uses imperative classList with `void el.offsetWidth` reflow trick
- [ ] `SpeechBubble` receives a changing `key` prop — never add bubble-content to deps
- [ ] Corruption overlay is a **sibling** to `<Card>`, not a child — same transform string
- [ ] `prevPhaseRef` initialized to `'AMEAÇA'` to prevent false phase-change on mount
- [ ] All boss HP thresholds use `BOSS_MAX` constant, not magic numbers
- [ ] `seededRNG(0xf065)` used inside `useMemo(() => ..., [])` for fog — never regenerate
- [ ] Fog `animationDuration` multiplied by `speed` factor per phase
- [ ] Intent chip class is `corrupt` / `rage` / `atk` — not the full intent label
