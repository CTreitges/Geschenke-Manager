import { Av, Bar, CardR, Check, GRAD, Ill, MiniGift, P, Phone, Ring, Sparkle } from "./primitives";

// Die Illustrationen der Tutorial-Seiten (viewBox 320×240). Kein Text außer
// Initialen; Bildbeschreibung kommt als `alt` aus pages.ts.
// Klassen .ill-drop/.ill-pop animieren nur auf der aktiven Seite (index.css).

type IllProps = { alt: string };

/** Seite 1: Geschenk in der Mitte, vier Freunde drumherum. */
export function IllWelcome({ alt }: IllProps) {
  return (
    <Ill alt={alt}>
      <circle cx="160" cy="124" r="96" fill="var(--ill-blob)" />
      <g stroke="var(--ill-line-strong)" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" fill="none">
        <path d="M80 80Q112 92 126 112" />
        <path d="M240 80Q208 92 194 112" />
        <path d="M72 176Q100 170 120 158" />
        <path d="M248 174Q220 170 200 158" />
      </g>
      <rect x="120" y="112" width="80" height="62" rx="8" fill={GRAD} />
      <rect x="112" y="96" width="96" height="22" rx="6" fill={GRAD} />
      <rect x="112" y="96" width="96" height="22" rx="6" fill="var(--ill-on-accent)" opacity=".14" />
      <rect x="154" y="96" width="12" height="78" fill="var(--ill-on-accent)" opacity=".85" />
      <path d="M160 96c-10-18-30-16-26-4 3 7 16 6 26 4zm0 0c10-18 30-16 26-4-3 7-16 6-26 4z" fill="var(--ill-bow)" />
      <Av x={64} y={70} r={18} c={P.anna} l="A" />
      <Av x={256} y={70} r={18} c={P.ben} l="B" />
      <Av x={56} y={180} r={16} c={P.mia} l="M" />
      <Av x={264} y={178} r={16} c={P.tom} l="T" />
      <Sparkle x={216} y={80} s={8} c="var(--ill-spark-2)" />
      <Sparkle x={234} y={100} s={5} c="var(--ill-spark-1)" />
      <Sparkle x={102} y={88} s={6} c="var(--ill-spark-3)" />
    </Ill>
  );
}

/** Seite 2: Übersicht mit anstehenden Geburtstagen, Push-Banner, Kalenderblatt. */
export function IllBirthdays({ alt }: IllProps) {
  const cards = [
    { y: 72, c: P.anna, l: "A", w: 44, active: true },
    { y: 112, c: P.tom, l: "T", w: 36, active: false },
    { y: 152, c: P.mia, l: "M", w: 40, active: false },
  ];
  return (
    <Ill alt={alt}>
      <Phone x={92} y={34}>
        {cards.map((k) => (
          <g key={k.l}>
            <CardR x={104} y={k.y} w={112} h={32} active={k.active} />
            <Av x={122} y={k.y + 16} r={10} c={k.c} l={k.l} />
            <Bar x={138} y={k.y + 8} w={k.w} strong />
            <Bar x={138} y={k.y + 20} w={28} />
            <rect x={186} y={k.y + 9} width={24} height={14} rx={7} fill={k.active ? "var(--ill-card)" : "var(--ill-soft)"} />
            <rect x={191} y={k.y + 14} width={14} height={4} rx={2} fill="var(--ill-accent)" opacity={k.active ? 0.8 : 0.45} />
          </g>
        ))}
      </Phone>

      {/* Push-Banner der App */}
      <g className="ill-drop">
        <rect x="68" y="12" width="184" height="44" rx="12" fill="var(--ill-card)" stroke="var(--ill-card-line)" />
        <rect x="79" y="22" width="24" height="24" rx="7" fill={GRAD} />
        <MiniGift x={91} y={33.5} />
        <Bar x={112} y={24} w={88} strong />
        <Bar x={112} y={37} w={120} />
      </g>

      {/* Kalenderblatt mit markiertem Tag */}
      <g>
        <rect x="26" y="128" width="50" height="54" rx="9" fill="var(--ill-card)" stroke="var(--ill-card-line)" />
        <path d="M26 137a9 9 0 0 1 9-9h32a9 9 0 0 1 9 9v6H26z" fill={GRAD} />
        <rect x="37" y="122" width="4" height="10" rx="2" fill="var(--ill-line-strong)" />
        <rect x="61" y="122" width="4" height="10" rx="2" fill="var(--ill-line-strong)" />
        {[0, 1, 2].map((row) =>
          [0, 1, 2].map((col) =>
            row === 1 && col === 1 ? null : (
              <circle key={`${row}-${col}`} cx={39 + col * 12} cy={153 + row * 10} r={2.5} fill="var(--ill-line)" />
            ),
          ),
        )}
        <circle cx="51" cy="163" r="6" fill="none" stroke={P.anna} strokeWidth="2" />
        <circle cx="51" cy="163" r="2.5" fill={P.anna} />
      </g>

      {/* Glocke rechts */}
      <g transform="translate(266 104)">
        <path d="M-10 7h20l-3-4v-7a7 7 0 0 0-14 0v7z" fill={GRAD} />
        <circle cx="0" cy="10.5" r="2.8" fill="var(--ill-grad-to)" />
        <path d="M13-9a15 15 0 0 1 3 9M-13-9a15 15 0 0 0-3 9" fill="none" stroke="var(--ill-accent)" strokeWidth="2" strokeLinecap="round" opacity=".5" />
      </g>
      <Sparkle x={282} y={146} s={6} c="var(--ill-spark-3)" />
    </Ill>
  );
}

/** Seite 3: Wunsch von der Wunschliste wandert in die Ideenliste. */
export function IllWishes({ alt }: IllProps) {
  const ideas = [
    { y: 92, w: 56, active: true },
    { y: 126, w: 46, active: false },
    { y: 160, w: 52, active: false },
  ];
  return (
    <Ill alt={alt}>
      {/* Wunschliste (links) */}
      <rect x="18" y="64" width="118" height="114" rx="14" fill="var(--ill-amber-soft)" stroke="var(--ill-amber)" strokeOpacity=".45" />
      <Av x={37} y={84} r={9} c={P.anna} l="A" />
      <Bar x={53} y={80} w={48} strong />
      {[102, 140].map((y, i) => (
        <g key={y}>
          <rect x="28" y={y} width="98" height="30" rx="8" fill="var(--ill-card)" />
          <MiniGift x={42} y={y + 14.5} fill="var(--ill-amber)" band="var(--ill-card)" />
          <Bar x={54} y={y + 7} w={i === 0 ? 34 : 44} strong />
          <Bar x={54} y={y + 18} w={22} />
          {i === 0 && <rect x="94" y={y + 9} width="26" height="12" rx="6" fill={GRAD} />}
        </g>
      ))}

      {/* Pfeil: Wunsch → Idee */}
      <path d="M122 106C142 82 160 80 176 90" fill="none" stroke={GRAD} strokeWidth="4" strokeLinecap="round" />
      <path d="M185 96l-12.5-0.5 5.5-9.5z" fill="var(--ill-grad-to)" />

      {/* Ideen des Geschenks (rechts) */}
      <rect x="186" y="36" width="118" height="168" rx="14" fill="var(--ill-card)" stroke="var(--ill-card-line)" />
      <Av x={205} y={58} r={9} c={P.ben} l="B" outline="var(--ill-card)" />
      <Av x={220} y={58} r={9} c={P.mia} l="M" outline="var(--ill-card)" />
      <Av x={235} y={58} r={9} c={P.lea} l="L" outline="var(--ill-card)" />
      {/* Budget pro Kopf: Münze + Betrag */}
      <rect x="250" y="49" width="46" height="18" rx="9" fill="var(--ill-soft)" />
      <circle cx="260" cy="58" r="5.5" fill="var(--ill-amber)" />
      <circle cx="260" cy="58" r="3" fill="none" stroke="var(--ill-on-accent)" strokeWidth="1.2" opacity=".85" />
      <rect x="269" y="56" width="20" height="4" rx="2" fill="var(--ill-accent)" opacity=".55" />
      <rect x="196" y="78" width="98" height="1" fill="var(--ill-card-line)" />
      {ideas.map((k) => (
        <g key={k.y}>
          <CardR x={194} y={k.y - 4} w={102} h={30} rx={8} active={k.active} fill={k.active ? undefined : "var(--ill-card)"} />
          <rect x="201" y={k.y + 6} width="10" height="10" rx="3" fill="none" stroke="var(--ill-line-strong)" strokeWidth="1.5" />
          <Bar x={218} y={k.y + 3} w={k.w} strong />
          <Bar x={218} y={k.y + 14} w={30} />
          {k.active ? (
            <circle className="ill-pop" cx="285" cy={k.y + 11} r="5" fill="var(--ill-amber)" />
          ) : (
            <rect x="276" y={k.y + 4} width="14" height="6" rx="3" fill="var(--ill-accent)" opacity=".4" />
          )}
        </g>
      ))}
      <Sparkle x={150} y={150} s={7} c="var(--ill-spark-2)" />
      <Sparkle x={164} y={170} s={4.5} c="var(--ill-spark-1)" />
    </Ill>
  );
}

/** Seite 4: Abstimmungs-Sheet mit Frist-Ring; Ideen pausiert. */
export function IllVote({ alt }: IllProps) {
  const options = [
    { y: 136, w: 54, share: 0.72, voted: true },
    { y: 172, w: 44, share: 0.45, voted: false },
    { y: 200, w: 50, share: 0.22, voted: true },
  ];
  return (
    <Ill alt={alt}>
      <Phone x={92} y={16}>
        <Bar x={108} y={40} w={56} strong />
        <CardR x={106} y={56} w={108} h={26} />
        <CardR x={106} y={88} w={108} h={26} />
        <rect x="98" y="22" width="124" height="248" rx="16" fill="var(--ill-scrim)" />
        {/* Bottom-Sheet mit Griff */}
        <rect x="98" y="94" width="124" height="160" rx="14" fill="var(--ill-card)" />
        <rect x="151" y="98" width="18" height="4" rx="2" fill="var(--ill-line)" />
        <Bar x={108} y={108} w={50} strong />
        <Bar x={108} y={121} w={34} />
        {/* Frist-Ring */}
        <circle cx="203" cy="117" r="10" fill="none" stroke="var(--ill-line)" strokeWidth="3" />
        <path d="M203 107A10 10 0 1 1 193 117" fill="none" stroke={GRAD} strokeWidth="3" strokeLinecap="round" />
        <path d="M203 117v-5M203 117h3.5" stroke="var(--ill-line-strong)" strokeWidth="1.6" strokeLinecap="round" />
        {options.map((o, i) => (
          <g key={o.y}>
            <Bar x={108} y={o.y} w={o.w} strong />
            <rect x="108" y={o.y + 12} width="78" height="5" rx="2.5" fill="var(--ill-line)" opacity=".55" />
            <rect x="108" y={o.y + 12} width={78 * o.share} height="5" rx="2.5" fill={i === 0 ? GRAD : "var(--ill-line-strong)"} />
            {o.voted ? (
              <g className={i === 0 ? "ill-pop" : undefined}>
                <Check x={205} y={o.y + 8} r={8} />
              </g>
            ) : (
              <circle cx="205" cy={o.y + 8} r="7.5" fill="none" stroke="var(--ill-line-strong)" strokeWidth="1.5" />
            )}
          </g>
        ))}
        {/* Wer für Option 1 gestimmt hat (Stimmen sind sichtbar) */}
        {[P.ben, P.mia, P.lea].map((c, k) => (
          <g key={c}>
            <circle cx={113 + k * 9} cy={159} r={6.2} fill="var(--ill-card)" />
            <circle cx={113 + k * 9} cy={159} r={5} fill={c} />
          </g>
        ))}
      </Phone>

      {/* Ideen-Karte mit Pause-Zeichen */}
      <g>
        <rect x="18" y="82" width="62" height="50" rx="11" fill="var(--ill-card)" stroke="var(--ill-card-line)" />
        <circle cx="36" cy="101" r="7.5" fill="var(--ill-amber)" />
        <rect x="32.5" y="108" width="7" height="6" rx="1.5" fill="var(--ill-line-strong)" />
        <Bar x={50} y={96} w={22} strong />
        <Bar x={50} y={108} w={16} />
        <circle cx="76" cy="130" r="11" fill="var(--ill-line-strong)" stroke="var(--ill-screen)" strokeWidth="2.5" />
        <rect x="71.5" y="125" width="3" height="10" rx="1.5" fill="var(--ill-on-accent)" />
        <rect x="77.5" y="125" width="3" height="10" rx="1.5" fill="var(--ill-on-accent)" />
      </g>
      <Sparkle x={256} y={96} s={8} c="var(--ill-spark-2)" />
      <Sparkle x={272} y={116} s={5} c="var(--ill-spark-1)" />
      <Sparkle x={248} y={140} s={5} c="var(--ill-spark-3)" />
    </Ill>
  );
}

/** Seite 5: verdeckte Geschenk-Karte für dich, zwei tuschelnde Freunde. */
export function IllSpoiler({ alt }: IllProps) {
  return (
    <Ill alt={alt}>
      <circle cx="160" cy="120" r="96" fill="var(--ill-blob)" />
      <CardR x={92} y={46} w={136} h={134} rx={16} />
      <Av x={114} y={70} r={12} c={P.lea} l="L" ring />
      <Bar x={134} y={62} w={62} strong />
      <Bar x={134} y={76} w={40} />
      <g opacity=".35">
        {[98, 120, 142].map((y) => (
          <g key={y}>
            <rect x="104" y={y} width="112" height="16" rx="6" fill="var(--ill-soft)" />
            <Bar x={110} y={y + 5} w={62} strong />
            <Bar x={190} y={y + 5} w={20} />
          </g>
        ))}
      </g>
      <rect x="98" y="90" width="124" height="82" rx="10" fill="var(--ill-frost)" />
      {/* Schild mit geschlossenem Auge */}
      <path d="M160 100l23 8v19c0 15-10 26-23 30-13-4-23-15-23-30v-19z" fill={GRAD} />
      <path d="M148 125q12 10 24 0" fill="none" stroke="var(--ill-on-accent)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M151 130l-2.5 4M160 132.5v4.5M169 130l2.5 4" stroke="var(--ill-on-accent)" strokeWidth="2.2" strokeLinecap="round" />

      {/* Tuschelnde Freunde */}
      <Av x={50} y={150} r={16} c={P.ben} l="B" />
      <Av x={270} y={150} r={16} c={P.mia} l="M" />
      <g fill="var(--ill-card)" stroke="var(--ill-card-line)">
        <path d="M34 104h40a10 10 0 0 1 10 10v2a10 10 0 0 1-10 10H56l-8 7 1-7h-15a10 10 0 0 1-10-10v-2a10 10 0 0 1 10-10z" />
        <path d="M246 104h40a10 10 0 0 1 10 10v2a10 10 0 0 1-10 10h-15l1 7-8-7h-18a10 10 0 0 1-10-10v-2a10 10 0 0 1 10-10z" />
      </g>
      <g fill="var(--ill-line-strong)">
        {[44, 54, 64, 256, 266, 276].map((x) => (
          <circle key={x} cx={x} cy="115" r="2.5" />
        ))}
      </g>
      <Sparkle x={236} y={40} s={8} c="var(--ill-spark-2)" />
      <Sparkle x={252} y={60} s={5} c="var(--ill-spark-1)" />
      <Sparkle x={80} y={50} s={6} c="var(--ill-spark-3)" />
    </Ill>
  );
}

/** Seite 6 (optional): App-Symbol landet auf dem Startbildschirm. */
export function IllInstall({ alt }: IllProps) {
  const cols = [104, 134, 164, 194];
  const rows = [80, 110, 140, 170, 200];
  return (
    <Ill alt={alt}>
      <Phone x={92} y={52}>
        {rows.map((y) =>
          cols.map((x) =>
            x === 164 && y === 110 ? null : (
              <rect key={`${x}-${y}`} x={x} y={y} width="22" height="22" rx="7" fill="var(--ill-line)" opacity=".7" />
            ),
          ),
        )}
        <Ring x={175} y={121} r={17} />
        <rect x="164" y="110" width="22" height="22" rx="7" fill={GRAD} />
        <MiniGift x={175} y={120.5} />
        <circle className="ill-pop" cx="186" cy="111" r="5.5" fill="var(--ill-badge)" stroke="var(--ill-screen)" strokeWidth="2" />
      </Phone>

      {/* Browserleiste mit Teilen-Symbol */}
      <rect x="24" y="14" width="160" height="26" rx="13" fill="var(--ill-card)" stroke="var(--ill-card-line)" />
      <circle cx="40" cy="27" r="4" fill="var(--ill-line)" />
      <Bar x={52} y={24} w={84} />
      <path d="M156 25v9h12v-9" fill="none" stroke="var(--ill-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M162 30v-11M158.5 22.5l3.5-3.5 3.5 3.5" fill="none" stroke="var(--ill-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

      {/* Pfeil zum App-Symbol */}
      <path d="M176 36C204 50 208 76 186 94" fill="none" stroke={GRAD} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="1 7" />
      <path d="M181 99l2.5-11 7.5 7z" fill="var(--ill-grad-to)" />

      <Sparkle x={258} y={120} s={8} c="var(--ill-spark-2)" />
      <Sparkle x={274} y={140} s={5} c="var(--ill-spark-1)" />
      <Sparkle x={56} y={130} s={6} c="var(--ill-spark-3)" />
    </Ill>
  );
}
