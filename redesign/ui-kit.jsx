/* ============================================================
   ui-kit.jsx — design tokens, type glyphs, rarity, Card
   TYPE owns color (only around the icon). RARITY owns the
   metallic frame + star count. Two independent channels.
   ============================================================ */

/* ---- simple, clean type glyphs (basic shapes only) ---- */
const G = {
  normal: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 2.5l2.6 6.3 6.8.5-5.2 4.4 1.7 6.6L12 17.2 6.3 20.8l1.7-6.6L2.8 9.8l6.8-.5z"
        fill="currentColor"/>
    </svg>
  ),
  water: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 2.5C12 2.5 5 11 5 15.5a7 7 0 0 0 14 0C19 11 12 2.5 12 2.5z" fill="currentColor"/>
      <path d="M9 14.5a3 3 0 0 0 3 3.2" stroke="rgba(255,255,255,.7)" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  rock: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M5 14l4-7 6 1 4 6-3 6H7z" fill="currentColor"/>
      <path d="M9 7l1 7-5 0M15 8l4 6-7 7" stroke="rgba(0,0,0,.3)" strokeWidth="1.3" fill="none"/>
    </svg>
  ),
  psychic: (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2.2"/>
      <circle cx="12" cy="12" r="3.4" fill="currentColor"/>
      <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  fire: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 2.5c1.5 3.5-2.5 5-2.5 8.5 0 1 .6 2 1.5 2.3-.2-2 1-3.3 1-3.3.5 2.7 3.5 3.6 3.5 6.6a5.5 5.5 0 0 1-11 0C4 12 9 9 8.5 4.5 10.5 6 12 4 12 2.5z" fill="currentColor"/>
    </svg>
  ),
  grass: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M12 21c0-7 3-13 8-16-1 7-3 12-8 16z" fill="currentColor"/>
      <path d="M12 21c0-5-2-9-7-11 1 5 3 8 7 11z" fill="currentColor" opacity=".75"/>
    </svg>
  ),
  electric: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M13 2L5 13h5l-2 9 9-12h-5z" fill="currentColor"/>
    </svg>
  ),
};
/* fallback */
G.default = G.normal;

/* secondary stat icons (functional, small) */
const STAT_ICON = {
  atk: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l9 6-9 12-9-12z"/></svg>,
  def: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/></svg>,
  util: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>,
};

/* ---- TYPE palette (color lives ONLY around the icon) ---- */
const TYPES = {
  normal:   { label:"NORMAL",   color:"#b9b3a0" },
  water:    { label:"ÁGUA",     color:"#3aa0ff" },
  rock:     { label:"PEDRA",    color:"#c2944a" },
  psychic:  { label:"PSÍQUICO", color:"#ff5fa8" },
  fire:     { label:"FOGO",     color:"#ff7a3d" },
  grass:    { label:"GRAMA",    color:"#5fbf52" },
  electric: { label:"ELÉTRICO", color:"#f5c542" },
};

/* ---- RARITY ladder (neutral metals + star count) ---- */
const RARITY = {
  starter:    { label:"STARTER",    stars:0, metal:"#9a9ba6" },
  common:     { label:"COMUM",      stars:1, metal:"#aeb4c0" },
  rare:       { label:"RARO",       stars:2, metal:"#dbe6f4" },
  epic:       { label:"ÉPICO",      stars:3, metal:"#ffd884" },
  legendary:  { label:"LENDÁRIO",   stars:4, metal:"#eef0ff" },
};

const Star = ({size=12, color}) => (
  <svg className="s" width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/>
  </svg>
);

const TypeGlyph = ({type, size}) => {
  const t = TYPES[type] || TYPES.normal;
  const glyph = G[type] || G.default;
  return (
    <div className="c-art">
      <div className="halo" style={{
        background:`radial-gradient(circle at 50% 42%, ${t.color}cc, ${t.color}33 55%, transparent 72%)`
      }}/>
      <div className="ring" style={{color:t.color}}/>
      <div className="glyph" style={{color:t.color}}>{glyph}</div>
    </div>
  );
};

/* labels + colors for the description region (used in big card) */
const KIND_LABEL = { atk:"ATAQUE", def:"DEFESA", util:"UTILITÁRIO" };
const KIND_COLOR = { atk:"#ff8c5a", def:"#6fe6d4", util:"#c9a3ff" };
function describeEffect(card){
  if (card.kind==="atk")  return <React.Fragment>Causa <b>{card.value}</b> de dano</React.Fragment>;
  if (card.kind==="def")  return <React.Fragment>Ganha <b>{card.value}</b> de bloqueio</React.Fragment>;
  return <React.Fragment>Efeito especial <b>+{card.value}</b></React.Fragment>;
}

/* ---- the redesigned Card ---- */
function Card(props){
  const { card, style, className="", onClick, affordable=true, refEl, onMouseEnter, onMouseLeave } = props;
  const t = TYPES[card.type] || TYPES.normal;
  const r = RARITY[card.rarity] || RARITY.common;
  const stars = [];
  for(let i=0;i<r.stars;i++) stars.push(<Star key={i} color={r.metal}/>);

  return (
    <div ref={refEl}
      className={`card rar-${card.rarity} ${affordable?'':'unaffordable'} ${className}`}
      style={style} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="frame">
        <div className="inner">
          <div className="c-head">
            <div className="cost"><span>{card.cost}</span></div>
            <div className="rarity" title={r.label}>
              {r.stars>0 ? stars : <span style={{
                width:8,height:8,borderRadius:2,background:r.metal,opacity:.5,
                display:'inline-block',transform:'rotate(45deg)',marginTop:4
              }}/>}
            </div>
          </div>

          <div className="c-name"><div className="t">{card.name}</div></div>

          <div style={{flex:1,display:'flex',position:'relative'}}>
            <TypeGlyph type={card.type}/>
            <div className={`stat ${card.kind}`}>
              <span style={{
                color: card.kind==='atk' ? '#ff8c5a' : card.kind==='def' ? '#6fe6d4' : '#c9a3ff',
                display:'flex'
              }}>{STAT_ICON[card.kind]}</span>
              <span className="v">{card.value}</span>
            </div>
          </div>

          <div className="c-foot">
            <div className="typechip" style={{
              color:t.color,
              background:`linear-gradient(180deg, ${t.color}22, ${t.color}11)`,
              borderColor:`${t.color}66`
            }}>
              <span style={{color:t.color,display:'flex'}}>{G[card.type]||G.default}</span>
              {t.label}
            </div>
          </div>

          {/* description — hidden in compact, shown in .big variant via CSS */}
          <div className="c-desc">
            <div className="meta">
              <span style={{color:r.metal}}>{r.label}</span>
              <span className="dot"></span>
              <span style={{color:KIND_COLOR[card.kind]}}>{KIND_LABEL[card.kind]}</span>
              <span className="dot"></span>
              <span style={{color:t.color}}>{t.label}</span>
            </div>
            <div className="eff">
              <span className="icn" style={{color:KIND_COLOR[card.kind]}}>{STAT_ICON[card.kind]}</span>
              <span>{describeEffect(card)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* export to window for app.jsx */
Object.assign(window, { TYPES, RARITY, Card, Star, TypeGlyph, G, STAT_ICON, KIND_LABEL, KIND_COLOR, describeEffect });
