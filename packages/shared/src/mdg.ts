import { ABILITY_KEYS, CLASS_PRESETS, type AbilityKey } from './rules';

/**
 * Parser do JSON exportado pelo Gerador MdG (https://ficha-mdg.vercel.app).
 * Formato: { app:"Gerador MdG", type:"gerador-mdg-character", version:1|2,
 *            character:{ name, class:{id,name}, abilities:[{id,label,abbreviation,value}],
 *                        resources:{ hitPoints?:{current,max} }, ... } }
 */

export interface MdGParsedSheet {
  name: string;
  classId: string;
  className: string;
  abilities: Record<AbilityKey, number>;
  hpMax?: number;
  warnings: string[];
}

export type MdGParseResult = { ok: true; sheet: MdGParsedSheet } | { ok: false; error: string };

const ABILITY_ALIASES: Record<AbilityKey, string[]> = {
  str: ['strength', 'str', 'for', 'forca', 'força'],
  dex: ['dexterity', 'dex', 'des', 'destreza'],
  con: ['constitution', 'con', 'constituicao', 'constituição'],
  int: ['intelligence', 'int', 'inteligencia', 'inteligência'],
  wis: ['wisdom', 'wis', 'sab', 'sabedoria'],
  cha: ['charisma', 'cha', 'car', 'carisma'],
};

/** apelidos de classe do ecossistema MdG/OSR → nossas classes 5e */
const CLASS_ALIASES: [RegExp, string][] = [
  [/guerreir|fight|warrior/i, 'guerreiro'],
  [/mago|magic|wizard|conjurador/i, 'mago'],
  [/cl[eé]rig|priest|cleric/i, 'clerigo'],
  [/ladin|ladra|thief|rogue/i, 'ladino'],
  [/bardo|bard/i, 'bardo'],
  [/druid/i, 'druida'],
  [/b[aá]rbar|barbar/i, 'barbaro'],
  [/paladin/i, 'paladino'],
  [/monge|monk/i, 'monge'],
  [/bruxo|warlock/i, 'bruxo'],
  [/feiticeir|sorcer/i, 'feiticeiro'],
  [/patrulheir|ranger|ca[çc]ador/i, 'ranger'],
];

function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function mapMdGClass(rawId: string, rawName: string): { id: string; name: string; matched: boolean } {
  for (const [re, id] of CLASS_ALIASES) {
    if (re.test(norm(rawName)) || re.test(norm(rawId))) {
      const cls = CLASS_PRESETS.find((c) => c.id === id);
      if (cls) return { id, name: cls.name, matched: true };
    }
  }
  return { id: '', name: rawName || '', matched: false };
}

export function parseMdGJson(text: string): MdGParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON inválido — cole exatamente o arquivo exportado pelo Gerador MdG.' };
  }

  const root = data as Record<string, unknown>;
  const type = norm(root.type);
  if (type !== 'gerador-mdg-character') {
    return { ok: false, error: `Arquivo não reconhecido (type="${String(root.type ?? '?')}"). Exporte pelo botão "Exportar → Gerador MdG".` };
  }

  const ch = root.character as Record<string, unknown> | undefined;
  if (!ch || typeof ch !== 'object') return { ok: false, error: 'Ficha sem o bloco "character".' };

  const warnings: string[] = [];
  const name = String(ch.name ?? '').trim().slice(0, 24);
  if (name.length < 2) return { ok: false, error: 'Ficha sem nome de personagem utilizável.' };

  const clsRaw = ch.class as Record<string, unknown> | undefined;
  const mapped = mapMdGClass(String(clsRaw?.id ?? ''), String(clsRaw?.name ?? ''));
  if (!mapped.matched && (clsRaw?.name || clsRaw?.id)) {
    warnings.push(`Classe "${clsRaw?.name ?? clsRaw?.id}" não existe em 5e aqui — usamos Guerreiro. Ajuste se preferir.`);
  }
  const classId = mapped.matched ? mapped.id : 'guerreiro';

  const list = Array.isArray(ch.abilities) ? (ch.abilities as Record<string, unknown>[]) : [];
  const abilities = {} as Record<AbilityKey, number>;
  const found = new Set<AbilityKey>();
  for (const a of list) {
    const ids = [norm(a.id), norm(a.abbreviation), norm(a.label)];
    const key = (Object.keys(ABILITY_ALIASES) as AbilityKey[]).find((k) => ids.some((s) => ABILITY_ALIASES[k].includes(s)));
    if (!key || found.has(key)) continue;
    const val = Number(a.value);
    if (!Number.isFinite(val)) continue;
    const clamped = Math.max(3, Math.min(18, Math.round(val)));
    if (clamped !== val) warnings.push(`${key.toUpperCase()} ${val} ajustado para ${clamped} (limite 3–18).`);
    abilities[key] = clamped;
    found.add(key);
  }
  for (const k of ABILITY_KEYS) {
    if (!found.has(k)) {
      abilities[k] = 10;
      warnings.push('Atributo ausente na ficha preenchido com 10.');
    }
  }

  let hpMax: number | undefined;
  const res = ch.resources as Record<string, unknown> | undefined;
  const hp = res?.hitPoints as Record<string, number> | undefined;
  if (hp && Number.isFinite(Number(hp.max)) && Number(hp.max) >= 1) hpMax = Math.round(Number(hp.max));

  return { ok: true, sheet: { name, classId, className: mapped.matched ? mapped.name : 'Guerreiro', abilities, hpMax, warnings } };
}
