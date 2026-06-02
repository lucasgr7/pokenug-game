/* ============================================================
   app.jsx — Pokémon battle screen (interactive prototype)
   ============================================================ */
const { useState, useEffect, useRef, useCallback } = React;

const MAX_ENERGY = 3;

/* base deck — spans the whole rarity ladder so the
   type/rarity split is visible right in the hand */
const DECK = [
{ name: "Investida", type: "normal", rarity: "starter", cost: 1, kind: "atk", value: 6 },
{ name: "Muralha de Pedra", type: "rock", rarity: "epic", cost: 1, kind: "def", value: 8 },
{ name: "Eco Mental", type: "psychic", rarity: "legendary", cost: 0, kind: "util", value: 4 },
{ name: "Captura", type: "normal", rarity: "common", cost: 2, kind: "util", value: 1 },
{ name: "Jato d'Água", type: "water", rarity: "rare", cost: 2, kind: "atk", value: 9 }];

let UID = 0;
const freshHand = () => DECK.map((c) => ({ ...c, uid: ++UID }));

/* ---- small inline nav icons ---- */
const NAV = {
  mapa: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>,
  jobs: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 3l7 7-3 3-7-7zM11 6 4 13l-1 8 8-1 7-7" /></svg>,
  deck: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M9 7h6M9 11h6" /></svg>,
  merc: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V5M4 15l5-5 4 3 7-8" /><path d="M16 5h4v4" /></svg>,
  loja: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 7h15l-1.5 9H7L5 7zM5 7 4 3H2" /><circle cx="8" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></svg>
};

/* meta chip icons */
const ICN = {
  deckpile: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M3 8v10a2 2 0 0 0 2 2h9" /></svg>,
  discard: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" /></svg>,
  sleep: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M8 6h6l-6 7h6" /></svg>
};

function HpBar({ cur, max }) {
  const pct = Math.max(0, Math.min(100, cur / max * 100));
  const cls = pct < 25 ? "crit" : pct < 55 ? "low" : "";
  return (
    <div className="hpbar">
      <div className={`fill ${cls}`} style={{ width: pct + "%" }} />
      <div className="glo" />
      <div className="txt">{Math.max(0, Math.round(cur))} / {max}</div>
    </div>);

}

function InspectModal({ card, energy, onPlay, onClose }) {
  const affordable = card.cost <= energy;
  useEffect(() => {
    const h = (e) => {if (e.key === 'Escape') onClose();};
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="m-close" onClick={onClose} aria-label="Fechar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6l-12 12" /></svg>
        </button>
        <div className="m-card-wrap">
          <Card card={card} affordable={true} className="big"
          style={{ position: 'relative', left: 'auto', bottom: 'auto', width: 236, height: 380, transform: 'none' }}
          onClick={() => {}} />
        </div>
        <button className="m-play" disabled={!affordable}
        onClick={() => {onPlay(card);}}>
          {affordable ?
          <React.Fragment>Jogar <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></React.Fragment> :
          'Energia insuficiente'}
        </button>
      </div>
    </div>);

}

function App() {
  const [hand, setHand] = useState(freshHand);
  const [energy, setEnergy] = useState(MAX_ENERGY);
  const [inspecting, setInspecting] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [enemyHp, setEnemyHp] = useState(40);
  const [playerHp, setPlayerHp] = useState(233);
  const [block, setBlock] = useState(0);
  const [discard, setDiscard] = useState(0);
  const [turn, setTurn] = useState(1);
  const [auto, setAuto] = useState(false);
  const [log, setLog] = useState("Início da batalha…");
  const [floaters, setFloaters] = useState([]);
  const [spentPip, setSpentPip] = useState(-1);
  const [banner, setBanner] = useState(null);
  const playingRef = useRef(false);

  const enemyMax = 40,playerMax = 330;

  const addFloat = (x, y, text, color) => {
    const id = ++UID;
    setFloaters((f) => [...f, { id, x, y, text, color }]);
    setTimeout(() => setFloaters((f) => f.filter((z) => z.id !== id)), 1000);
  };

  const playCard = useCallback((card) => {
    if (playingRef.current) return;
    if (card.cost > energy) {
      setHand((h) => h.map((c) => c.uid === card.uid ? { ...c, _shake: Date.now() } : c));
      setLog("⚡ Energia insuficiente!");
      return;
    }
    playingRef.current = true;
    setInspecting(null);
    setHand((h) => h.map((c) => c.uid === card.uid ? { ...c, _playing: true } : c));

    // spend energy (pip pop on the last spent)
    setEnergy((e) => {const ne = e - card.cost;setSpentPip(ne);setTimeout(() => setSpentPip(-1), 350);return ne;});

    // resolve effect
    if (card.kind === "atk") {
      setEnemyHp((hp) => Math.max(0, hp - card.value));
      addFloat(297, 150, "-" + card.value, "#ff7a5f");
      setLog(`${card.name} causou ${card.value} de dano!`);
    } else if (card.kind === "def") {
      setBlock((b) => b + card.value);
      addFloat(93, 470, "+" + card.value, "#6fe6d4");
      setLog(`${card.name}: +${card.value} de bloqueio.`);
    } else {
      addFloat(93, 470, "\u2726", "#c9a3ff");
      setLog(`${card.name} ativada.`);
    }

    setTimeout(() => {
      setHand((h) => h.filter((c) => c.uid !== card.uid));
      setDiscard((d) => d + 1);
      playingRef.current = false;
    }, 460);
  }, [energy]);

  const onCardClick = (card) => {
    if (card._playing) return;
    setInspecting(card.uid);
  };

  const endTurn = useCallback(() => {
    if (playingRef.current) return;
    setInspecting(null);
    // enemy acts on its telegraphed intent
    const dmg = 8;
    setTimeout(() => {
      setBlock((b) => {
        const through = Math.max(0, dmg - b);
        if (through > 0) {
          setPlayerHp((hp) => Math.max(0, hp - through));
          addFloat(93, 470, "-" + through, "#ff5d5d");
        } else {
          addFloat(93, 470, "BLOQUEADO", "#6fe6d4");
        }
        return 0;
      });
      setLog("Pidgey usou Investida Aérea!");
    }, 250);
    // new turn
    setTimeout(() => {
      setEnergy(MAX_ENERGY);
      setHand(freshHand());
      setDiscard(0);
      setTurn((t) => {const nt = t + 1;setBanner("TURNO " + nt);setTimeout(() => setBanner(null), 1100);return nt;});
    }, 700);
  }, []);

  /* AUTO play loop */
  useEffect(() => {
    if (!auto) return;
    const iv = setInterval(() => {
      if (playingRef.current) return;
      setHand((curHand) => {
        const playable = curHand.find((c) => !c._playing && c.cost <= energy);
        if (playable) {setTimeout(() => playCard(playable), 0);} else
        {setTimeout(() => endTurn(), 0);}
        return curHand;
      });
    }, 1100);
    return () => clearInterval(iv);
  }, [auto, energy, playCard, endTurn]);

  /* fan geometry */
  const n = hand.length;
  const mid = (n - 1) / 2;

  return (
    <React.Fragment>
      {/* status bar */}
      <div className="statusbar">
        <div className="sb-l" style={{ fontWeight: 700 }}>17:12</div>
        <div className="sb-r">
          <svg className="sb-icn" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M2 8.5C5 5 9 3.2 12 3.2S19 5 22 8.5M5 12c2-2.3 4.5-3.5 7-3.5S17 9.7 19 12M8.5 15.5c1-1.1 2.2-1.7 3.5-1.7s2.5.6 3.5 1.7M12 19h0" /></svg>
          <svg className="sb-icn" viewBox="0 0 24 24" fill="#fff"><path d="M2 17h3v4H2zM7 13h3v8H7zM12 9h3v12h-3zM17 5h3v16h-3z" /></svg>
          <div className="battery"><div className="cell"><div className="fill" /></div><span className="pct">79</span></div>
        </div>
      </div>

      {/* arena */}
      <div className="arena">
        <div className="floor enemy" />
        <div className="floor player" />

        {/* enemy sprite */}
        <div className="sprite-wrap enemy-sprite">
          <div className="platform" />
          <div className="disc" />
          <image-slot id="sprite-pidgey" fit="contain" placeholder="sprite Pidgey"
          style={{ width: "150px", height: "150px" }}></image-slot>
        </div>
        {/* player sprite */}
        <div className="sprite-wrap player-sprite">
          <div className="platform" />
          <div className="disc" />
          <image-slot id="sprite-metapod" fit="contain" placeholder="sprite Metapod"
          style={{ width: "150px", height: "150px" }}></image-slot>
        </div>

        {/* enemy nameplate */}
        <div className="plate enemy">
          <div className="row1">
            <div className="nm">Pidgey <span className="star-main"><Star size={13} color="#ffcf3a" /></span></div>
            <div className="lvl">Nv. 4</div>
          </div>
          <HpBar cur={enemyHp} max={enemyMax} />
          <div className="intent buff">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            INTENÇÃO <span className="v">+3</span>
          </div>
        </div>

        {/* player nameplate */}
        <div className="plate player">
          <div className="row1">
            <div className="nm">Metapod
              {block > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#6fe6d4', fontWeight: 800 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" /></svg>{block}</span>}
            </div>
            <div className="lvl" style={{ color: "#7ee9d8", borderColor: "#1e5e57", background: "rgba(58,214,194,.14)" }}>★ PRINCIPAL</div>
          </div>
          <HpBar cur={playerHp} max={playerMax} />
          <div className="energy-row">
            <span className="lbl">ENERGIA</span>
            {[0, 1, 2].map((i) =>
            <div key={i} className={`pip ${i < energy ? 'on' : ''} ${i === spentPip ? 'spent' : ''}`} style={{ borderColor: "rgb(149, 149, 217)" }} />
            )}
          </div>
        </div>

        {/* floating damage numbers */}
        {floaters.map((f) =>
        <div key={f.id} className="dmg-float" style={{ left: f.x, top: f.y, color: f.color, transform: 'translateX(-50%)' }}>{f.text}</div>
        )}

        {/* log */}
        <div className="log"><span className="line" key={log}>{log}</span></div>

        {/* action bar */}
        <div className="actionbar">
          <div className="meta-chips">
            <div className="chip">{ICN.deckpile}{hand.length}</div>
            <div className="chip">{ICN.discard}{discard}</div>
            <div className="chip">{ICN.sleep}0</div>
          </div>
          <div className={`auto-toggle ${auto ? 'on' : ''}`} onClick={() => setAuto((a) => !a)}>
            <div className="switch"><div className="knob" /></div>AUTO
          </div>
          <div className={`endturn ${playingRef.current ? 'dim' : ''}`} onClick={endTurn}>
            Fim de turno
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </div>
        </div>

        {/* hand */}
        <div className="hand">
          {hand.map((card, i) => {
            const lifted = hovered === card.uid && !card._playing;
            const x = (i - mid) * 66;
            const rot = (i - mid) * 7;
            const yArc = Math.abs(i - mid) * 16;
            let transform;
            if (lifted) {
              transform = `translateX(calc(-50% + ${x}px)) translateY(-50px) rotate(0deg) scale(1.15)`;
            } else {
              transform = `translateX(calc(-50% + ${x}px)) translateY(${yArc}px) rotate(${rot}deg)`;
            }
            return (
              <Card key={card.uid}
              card={card}
              affordable={card.cost <= energy}
              className={`${lifted ? 'lift' : ''} ${card._playing ? 'playing' : ''} ${card._shake ? 'shake' : ''}`}
              style={{ transform, zIndex: lifted ? 60 : i }}
              onClick={() => onCardClick(card)}
              onMouseEnter={() => setHovered(card.uid)}
              onMouseLeave={() => setHovered(null)}
              refEl={null} />);


          })}
        </div>

        {banner && <div className="turn-flash"><div className="b">{banner}</div></div>}
      </div>

      {/* bottom nav */}
      <div className="navbar">
        <div className="nav-i">{NAV.mapa}Mapa</div>
        <div className="nav-i">{NAV.jobs}Jobs</div>
        <div className="nav-i active">{NAV.deck}Deck</div>
        <div className="nav-i">{NAV.merc}Mercado</div>
        <div className="nav-i">{NAV.loja}Loja</div>
        <div className="gesture" />
      </div>

      {/* inspect modal */}
      {inspecting && hand.find((c) => c.uid === inspecting) &&
      <InspectModal
        card={hand.find((c) => c.uid === inspecting)}
        energy={energy}
        onPlay={(c) => playCard(c)}
        onClose={() => setInspecting(null)} />

      }
    </React.Fragment>);

}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);