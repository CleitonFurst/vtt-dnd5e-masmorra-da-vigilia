import type { RollDetail, SystemRoll } from './types';
import type { CheckRequest } from './events';

// ------------------------------------------------------------ fórmulas livres

export interface FormulaPart {
  dice: number;
  sides: number;
  modifier: number;
  keep: 'all' | 'high' | 'low';
}

/** Analisa fórmulas do tipo Xdy+Z com suporte a kh/kl (ex.: 4d6kh3+2). */
export function parseFormula(formula: string): FormulaPart | null {
  const m = /^\s*(\d{1,2})d(4|6|8|10|12|20|100)(?:\s*(kh|kl)\s*(\d{1,2}))?(?:\s*([+-]\s*\d{1,3}))?\s*$/.exec(formula);
  if (!m) return null;
  const dice = Number(m[1]);
  const sides = Number(m[2]);
  if (dice < 1 || dice > 30) return null;
  if ((m[3] === 'kh' || m[3] === 'kl') && (!m[4] || Number(m[4]) < 1 || Number(m[4]) > dice)) return null;
  return { dice, sides, keep: m[3] === 'kh' ? 'high' : m[3] === 'kl' ? 'low' : 'all', modifier: m[5] ? Number(m[5].replace(/\s+/g, '')) : 0 };
}

export function formatRollFormula(part: FormulaPart): string {
  const kept = part.keep === 'all' ? '' : part.keep === 'high' ? `kh${part.dice}` : `kl${part.dice}`;
  return `${part.dice}d${part.sides}${kept}${part.modifier !== 0 ? (part.modifier > 0 ? '+' : '') + part.modifier : ''}`;
}

const d = (sides: number): number => Math.floor(Math.random() * sides) + 1;

export interface RollResult {
  total: number;
  detail: RollDetail;
}

export function rollFormula(formula: string): RollResult | null {
  const part = parseFormula(formula);
  if (!part) return null;
  let values = Array.from({ length: part.dice }, () => d(part.sides));
  if (part.keep !== 'all') {
    const n = Math.max(1, Math.min(part.dice, Number(/k[hl](\d+)/.exec(formula)?.[1] ?? 3)));
    values = [...values].sort((a, b) => (part.keep === 'high' ? b - a : a - b)).slice(0, n);
  }
  const total = values.reduce((a, b) => a + b, 0) + part.modifier;
  return {
    total,
    detail: { groups: [{ label: formula.trim(), sides: part.sides, values }], modifier: part.modifier },
  };
}

// ------------------------------------------- d20 (Pathfinder: sem vantagem/desvantagem)

const rollD20 = (): number => d(20);

type D20Outcome = 'critical-success' | 'success' | 'failure' | 'critical-failure' | 'neutral';

export function rollD20Check(
  mode: 'normal' | 'adv' | 'dis',
  dc?: number,
): { dice: number[]; total: number; outcome: D20Outcome; margin?: number } {
  let dice: number[];
  let die: number;
  if (mode === 'normal') {
    die = rollD20();
    dice = [die];
  } else {
    const [a, b] = [rollD20(), rollD20()];
    die = mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
    dice = [a, b];
  }

  // nat20 e nat1 têm precedência sobre a CD (regra do SRD)
  if (die === 20) return { dice, total: die, outcome: 'critical-success', margin: undefined };
  if (die === 1) return { dice, total: die, outcome: 'critical-failure', margin: undefined };

  if (dc === undefined) return { dice, total: die, outcome: 'neutral', margin: undefined };
  const margin = die - dc;
  return { dice, total: die, outcome: margin >= 0 ? 'success' : 'failure', margin };
}

/** Pilha de d10s estilo Storyteller. */
function rollPoolCheck(poolSize: number, difficulty: number): SystemRoll & { system: 'pool' } {
  const values = Array.from({ length: poolSize }, () => d(10));
  const successes = values.filter((v) => v >= difficulty).length;
  return { system: 'pool', poolSize, difficulty, successes, dramatic: values.every((v) => v === 10), botch: successes === 0 };
}

/** Percentil estilo Call of Cthulhu. */
function rollPercentileCheck(skillValue: number, bonusDice = 0, penaltyDice = 0): SystemRoll & { system: 'percentile' } {
  const tensRolls = Array.from({ length: Math.max(1, bonusDice, penaltyDice) }, () => d(10));
  let tens = tensRolls[0];
  if (bonusDice > 0) tens = Math.min(...tensRolls);
  else if (penaltyDice > 0) tens = Math.max(...tensRolls);
  const units = d(10) % 10;
  const roll = tens === 10 ? 100 : tens * 10 + units;

  let grade: 'regular' | 'hard' | 'extreme' | 'fumble' | 'failure';
  if (roll === 100 || (skillValue < 50 && roll >= 96)) grade = 'fumble';
  else if (roll <= skillValue / 5) grade = 'extreme';
  else if (roll <= skillValue / 2) grade = 'hard';
  else if (roll <= skillValue) grade = 'regular';
  else grade = 'failure';
  return { system: 'percentile', skillValue, roll, grade };
}

/** 2d6 graduado estilo PbtA. */
function rollFixedCheck(modifier: number): SystemRoll & { system: 'fixed' } {
  const [a, b] = [d(6), d(6)];
  const total = a + b + modifier;
  return { system: 'fixed', total, outcome: total >= 10 ? 'full' : total >= 7 ? 'partial' : 'fail' };
}

/** Executa qualquer CheckRequest no servidor e classifica o resultado. */
export function resolveCheck(req: CheckRequest): { check: SystemRoll; detail: RollDetail; total: number; label: string } {
  switch (req.kind) {
    case 'd20': {
      const r = rollD20Check('normal', req.dc);
      return {
        check: {
          system: 'd20',
          die: r.dice[0],
          total: r.total + req.modifier,
          dc: req.dc,
          margin: r.margin,
          outcome: r.outcome,
        },
        detail: { groups: [{ label: 'd20', sides: 20, values: r.dice }], modifier: req.modifier },
        total: r.total + req.modifier,
        label: req.label ?? 'Teste',
      };
    }
    case 'pool': {
      const check = rollPoolCheck(req.poolSize, req.difficulty);
      return {
        check,
        detail: { groups: [{ label: 'pilha d10', sides: 10, values: [] }], modifier: 0 },
        total: check.successes,
        label: 'Pilha',
      };
    }
    case 'percentile': {
      const check = rollPercentileCheck(req.skillValue, req.bonusDice ?? 0, req.penaltyDice ?? 0);
      return {
        check,
        detail: { groups: [{ label: 'd%', sides: 100, values: [check.roll] }], modifier: 0 },
        total: check.roll,
        label: 'Percentil',
      };
    }
    case 'fixed': {
      const check = rollFixedCheck(req.modifier);
      return {
        check,
        detail: { groups: [{ label: '2d6', sides: 6, values: [] }], modifier: req.modifier },
        total: check.total,
        label: 'Graduado',
      };
    }
  }
}
