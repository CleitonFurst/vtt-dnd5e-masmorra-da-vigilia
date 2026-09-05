import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useVttStore, type DiceShowItem } from '../store';

/** Animação central de dados: um dado gigante quica e gira no centro da tela
 *  durante a rolagem e então revela o valor, o total e o veredito. */
export function DiceShow() {
  const queue = useVttStore((s) => s.diceShow);
  const shift = useVttStore((s) => s.shiftDiceShow);
  const [item, setItem] = useState<DiceShowItem | null>(null);
  const [phase, setPhase] = useState<'rolling' | 'reveal'>('rolling');
  const [vals, setVals] = useState<number[]>([]);
  const busyRef = useRef<DiceShowItem | null>(null);

  useEffect(() => {
    if (busyRef.current || queue.length === 0) return;
    const next = queue[0];
    busyRef.current = next;
    shift();
    setItem(next);
    setPhase('rolling');
    setVals(next.dice.map(() => 1));
  }, [queue, shift]);

  useEffect(() => {
    if (!item) return;
    const rollMs = 1750;
    const holdMs = 1100;
    const t1 = window.setTimeout(() => setPhase('reveal'), rollMs);
    const t2 = window.setTimeout(() => {
      setItem(null);
      busyRef.current = null;
    }, rollMs + holdMs);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [item]);

  useEffect(() => {
    if (!item || phase !== 'rolling') return;
    // Rolagem com desaceleração natural: ticks cada vez mais lentos até o dado "pousar".
    const delays = [60, 70, 90, 115, 145, 185, 235, 300, 370, 450];
    let tick = 0;
    let timer = 0;
    const loop = (): void => {
      tick += 1;
      setVals(item.dice.map((d) => 1 + Math.floor(Math.random() * d.sides)));
      if (tick < delays.length) {
        timer = window.setTimeout(loop, delays[tick]);
      }
    };
    timer = window.setTimeout(loop, delays[0]);
    return () => window.clearTimeout(timer);
  }, [item, phase]);

  useEffect(() => {
    if (!item || phase !== 'reveal') return;
    setVals(item.dice.map((d) => d.value));
  }, [item, phase]);

  if (!item) return null;
  const tone = item.verdict?.tone ?? 'neutral';

  return (
    <div className="dice-show" key={item.id} aria-hidden="true">
      <div className="dice-shade" />
      <div className="dice-stage">
        <div className="ds-ring" />
        <div className="ds-head">
          <span className="ds-emoji">{item.emoji ?? '🎲'}</span>
          <strong>{item.title}</strong>
          {item.sub && <em>{item.sub}</em>}
          {phase === 'rolling' && <em className="ds-hint">Rolando…</em>}
        </div>

        <div className="ds-dice-row" style={{ '--ds-count': item.dice.length } as CSSProperties}>
          {item.dice.map((d, i) => (
            <div key={i} className={`ds-die ${phase === 'reveal' ? 'landed' : 'rolling'}`}>
              <span className="ds-die-num">{vals[i] ?? d.value}</span>
              <span className="ds-die-sides">d{d.sides}</span>
            </div>
          ))}
        </div>

        {phase === 'reveal' && (
          <div className="ds-result">
            <div className="ds-total-row">
              <strong className="ds-total">{item.total}</strong>
              {item.totalLabel && <span className="ds-total-label">{item.totalLabel}</span>}
            </div>
            {item.verdict && (
              <span className={`ds-verdict tone-${tone}`}>{item.verdict.label}</span>
            )}
            {item.detailText && <em className="ds-detail">{item.detailText}</em>}
          </div>
        )}
      </div>
    </div>
  );
}