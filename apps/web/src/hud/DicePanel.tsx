import { useMemo, useRef, useState } from 'react';
import type { CheckRequest, SystemRoll } from '@vtt/shared';
import { getSocket } from '../net/socket';
import { useVttStore } from '../store';

type Sys = 'd20' | 'pool' | 'pct' | 'fixed';

const DICE = [4, 6, 8, 10, 12, 20, 100] as const;

export function DicePanel() {
  const [sys, setSys] = useState<Sys>('d20');
  const [privateRoll, setPrivateRoll] = useState(false);

  const [modifier, setModifier] = useState('0');
  const [dc, setDc] = useState('');

  const [poolSize, setPoolSize] = useState(6);
  const [difficulty, setDifficulty] = useState(6);

  const [skillValue, setSkillValue] = useState(50);
  const [extra, setExtra] = useState<'' | 'bonus' | 'penalty'>('');

  const [fixedMod, setFixedMod] = useState('0');
  const [quick, setQuick] = useState('');

  const rolls = useVttStore((s) => s.snapshot?.rolls ?? []);
  const meName = useVttStore((s) => s.me?.name);
  const socket = getSocket();

  const myLatest = useMemo(() => [...rolls].reverse().find((r) => r.check && r.roller === meName), [rolls, meName]);

  const lastAction = useRef<null | (() => void)>(null);
  const [hasLast, setHasLast] = useState(false);

  const emit = (payload: Record<string, unknown>): void => {
    const fn = (): void => {
      socket.emit('dice:check', { ...payload, visibility: privateRoll ? 'dm' : 'all' } as CheckRequest);
    };
    lastAction.current = fn;
    setHasLast(true);
    fn();
  };

  const rollFormula = (formula: string, label?: string): void => {
    const fn = (): void => {
      socket.emit('dice:roll', { formula, label, visibility: privateRoll ? 'dm' : 'all' });
    };
    lastAction.current = fn;
    setHasLast(true);
    fn();
  };

  const intOr = (raw: string, fb: number): number => {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : fb;
  };

  return (
    <div className="dice-panel-v2">
      <label className="toggle private">
        <input type="checkbox" checked={privateRoll} onChange={(e) => setPrivateRoll(e.target.checked)} />
        Rolagem privada (só a Mestra vê)
      </label>

      <div className="sys-picker">
        <button className={sys === 'd20' ? 'active' : ''} onClick={() => setSys('d20')}>
          <span className="sys-die">d20</span>
          Teste
        </button>
        <button className={sys === 'pool' ? 'active' : ''} onClick={() => setSys('pool')}>
          <span className="sys-die">Nd10</span>
          Pilha
        </button>
        <button className={sys === 'pct' ? 'active' : ''} onClick={() => setSys('pct')}>
          <span className="sys-die">d%</span>
          Percentil
        </button>
        <button className={sys === 'fixed' ? 'active' : ''} onClick={() => setSys('fixed')}>
          <span className="sys-die">2d6</span>
          Graduado
        </button>
      </div>

      <div className="roll-fields">
        {sys === 'd20' && (
          <>
            <div className="two-fields">
              <label>
                Modificador
                <input value={modifier} onChange={(e) => setModifier(e.target.value)} inputMode="numeric" />
              </label>
              <label>
                CD <em>(opcional)</em>
                <input value={dc} onChange={(e) => setDc(e.target.value)} placeholder="—" inputMode="numeric" />
              </label>
            </div>
            <p className="hint">Natural 20 = crítico automático · Natural 1 = falha automática.</p>
          </>
        )}

        {sys === 'pool' && (
          <>
            <p className="hint">Cada d10 que atingir a dificuldade conta 1 sucesso.</p>
            <div className="two-fields">
              <label>
                Quantidade de dados
                <span className="stepper big">
                  <button onClick={() => setPoolSize((v) => Math.max(1, v - 1))}>−</button>
                  <strong>{poolSize}</strong>
                  <button onClick={() => setPoolSize((v) => Math.min(30, v + 1))}>+</button>
                </span>
              </label>
              <label>
                Dificuldade (padrão 6)
                <input
                  value={difficulty}
                  onChange={(e) => setDifficulty(Math.max(2, Math.min(10, intOr(e.target.value, 6))))}
                  inputMode="numeric"
                />
              </label>
            </div>
          </>
        )}

        {sys === 'pct' && (
          <>
            <p className="hint">Sucesso se rolar ≤ perícia. Extremo ≤1/5 · Difícil ≤1/2.</p>
            <div className="two-fields">
              <label>
                Valor da perícia
                <input
                  value={skillValue}
                  onChange={(e) => setSkillValue(Math.max(1, Math.min(99, intOr(e.target.value, 50))))}
                  inputMode="numeric"
                />
              </label>
              <label>
                Dado extra
                <select value={extra} onChange={(e) => setExtra(e.target.value as typeof extra)}>
                  <option value="">Nenhum</option>
                  <option value="bonus">Bônus</option>
                  <option value="penalty">Penalidade</option>
                </select>
              </label>
            </div>
          </>
        )}

        {sys === 'fixed' && (
          <>
            <p className="hint">10+ sucesso total · 7–9 parcial · 6− falha.</p>
            <div className="two-fields">
              <label>
                Modificador
                <input value={fixedMod} onChange={(e) => setFixedMod(e.target.value)} inputMode="numeric" />
              </label>
            </div>
          </>
        )}
      </div>

      <button
        className="btn-gold roll-big"
        onClick={() => {
          if (sys === 'd20')
            emit({ kind: 'd20', modifier: intOr(modifier, 0), dc: dc.trim() === '' ? undefined : Math.max(1, intOr(dc, 10)) });
          else if (sys === 'pool') emit({ kind: 'pool', poolSize, difficulty });
          else if (sys === 'pct')
            emit({
              kind: 'percentile',
              skillValue,
              bonusDice: extra === 'bonus' ? 1 : 0,
              penaltyDice: extra === 'penalty' ? 1 : 0,
            });
          else emit({ kind: 'fixed', modifier: intOr(fixedMod, 0) });
        }}
      >
        ⚄ ROLAR
      </button>

      {myLatest?.check && (
        <div key={myLatest.id} className={`result-card rc-${gradeOf(myLatest.check)}`}>
          <span className="rc-badge">{badgeText(myLatest.check)}</span>
          <span className="rc-total">{resultBig(myLatest.check)}</span>
          <span className="rc-sub">{myLatest.formula}</span>
          <em className="rc-dice">
            [{myLatest.detail.groups.map((g) => g.values.join(', ') || '—').join(' · ')}
            {myLatest.detail.modifier !== 0 ? ` ${myLatest.detail.modifier > 0 ? '+' : ''}${myLatest.detail.modifier}` : ''}]
          </em>
        </div>
      )}

      <form
        className="quick-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (quick.trim()) {
            rollFormula(quick.trim());
            setQuick('');
          }
        }}
      >
        <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Fórmula: 2d6+3, 4d6kh3…" />
        <button type="submit">Rolar</button>
      </form>

      <div className="quick-dice">
        {DICE.map((die) => (
          <button key={die} onClick={() => rollFormula(`1d${die}`, `d${die}`)}>
            d{die}
          </button>
        ))}
      </div>

      <div className="roll-actions">
        <button className="reroll-last" disabled={!hasLast} onClick={() => lastAction.current?.()} title="Repete a última rolagem exatamente igual">
          ⟲ Repetir última
        </button>
      </div>

      <h4 className="ornate">Histórico</h4>
      <ul className="roll-history">
        {rolls
          .slice(-12)
          .reverse()
          .map((r) => {
            const breakdown =
              r.detail.groups
                .map((g) => `${g.label}: ${g.values.join(', ') || '—'}`)
                .join(' · ') || '—';
            const mod = r.detail.modifier !== 0 ? ` · ${r.detail.modifier > 0 ? '+' : ''}${r.detail.modifier}` : '';
            const reactionLabel = r.detail.groups.find((g) => /^(Defesa|Escudo|Bloqueio|Esquiva|Interceptação)$/.test(g.label ?? ''))?.label ?? null;
            return (
              <li key={r.id} className={`rh-item ${r.visibility === 'dm' ? 'priv' : ''} ${reactionLabel ? 'react' : ''}`}>
                <div className="rh-top">
                  <span className="rh-who">
                    {r.roller}: {r.formula}
                    {r.visibility === 'dm' ? ' · privada' : ''}
                  </span>
                  {r.check ? (
                    <span className={`badge sm ${gradeOf(r.check)}`}>{badgeText(r.check)}</span>
                  ) : null}
                </div>
                <div className="rh-detail">
                  <em>
                    [{breakdown}
                    {mod}]
                  </em>
                  <span className="rh-total">
                    ={' '}
                    <strong className={r.check ? `t-${gradeOf(r.check)}` : ''}>
                      {r.check ? resultBig(r.check) : r.total}
                    </strong>
                  </span>
                </div>
                {reactionLabel && (
                  <div className="rh-extra">
                    Reação: {reactionLabel}
                  </div>
                )}
              </li>
            );
          })}
      </ul>
    </div>
  );
}

function resultBig(check: SystemRoll): string {
  switch (check.system) {
    case 'd20': return `${check.total}`;
    case 'pool': return `${check.successes}`;
    case 'percentile': return `${check.roll}`;
    case 'fixed': return `${check.total}`;
  }
}

type Grade = 'crit-good' | 'good' | 'partial' | 'bad' | 'crit-bad' | 'neutral';

function gradeOf(check: SystemRoll): Grade {
  switch (check.system) {
    case 'd20':
      return check.outcome === 'critical-success'
        ? 'crit-good'
        : check.outcome === 'success'
          ? 'good'
          : check.outcome === 'failure'
            ? 'bad'
            : check.outcome === 'critical-failure'
              ? 'crit-bad'
              : 'neutral';
    case 'pool':
      return check.dramatic ? 'crit-good' : check.botch ? 'crit-bad' : check.successes >= 3 ? 'good' : check.successes >= 1 ? 'partial' : 'bad';
    case 'percentile':
      return check.grade === 'extreme'
        ? 'crit-good'
        : check.grade === 'hard'
          ? 'good'
          : check.grade === 'regular'
            ? 'partial'
            : check.grade === 'fumble'
              ? 'crit-bad'
              : 'bad';
    case 'fixed':
      return check.outcome === 'full' ? 'good' : check.outcome === 'partial' ? 'partial' : 'bad';
  }
}

function badgeText(check: SystemRoll): string {
  switch (check.system) {
    case 'd20': {
      if (check.outcome === 'critical-success') return 'CRÍTICO!';
      if (check.outcome === 'critical-failure') return 'DESASTRE';
      if (check.outcome === 'neutral') return 'TOTAL';
      const m = check.margin ?? 0;
      return `${check.outcome === 'success' ? 'SUCESSO' : 'FALHA'} ${m >= 0 ? '+' : ''}${m}`;
    }
    case 'pool':
      if (check.dramatic) return 'DRAMÁTICO!';
      if (check.botch) return 'FALHA TOTAL';
      return `${check.successes} SUCESSO${check.successes === 1 ? '' : 'S'}`;
    case 'percentile':
      switch (check.grade) {
        case 'extreme': return 'EXTREMO';
        case 'hard': return 'DIFÍCIL';
        case 'regular': return 'NORMAL';
        case 'fumble': return 'DESASTRE';
        default: return 'FALHA';
      }
    case 'fixed':
      return check.outcome === 'full' ? 'SUCESSO TOTAL' : check.outcome === 'partial' ? 'PARCIAL' : 'FALHA';
  }
}
