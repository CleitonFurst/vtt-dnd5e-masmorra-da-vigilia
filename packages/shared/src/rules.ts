/**
 * Regras básicas do Pathfinder Livro Básico (PT-BR).
 * O servidor valida tudo e deriva os valores (anti-cheat).
 */

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export const ABILITY_KEYS: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: 'Força',
  dex: 'Destreza',
  con: 'Constituição',
  int: 'Inteligência',
  wis: 'Sabedoria',
  cha: 'Carisma',
};

/** modificador de atributo: floor((valor − 10) / 2) */
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** proficiência (legado 5e, mantido para compatibilidade) */
export function deriveProf(level = 1): number {
  return 2 + Math.floor((level - 1) / 4);
}

/** progressão de BBA do Pathfinder: total = nível, média = ¾, baixa = ½ */
export type BbaProgression = 'full' | 'medium' | 'low';

export function deriveBba(progression: BbaProgression, level = 1): number {
  switch (progression) {
    case 'full': return level;
    case 'medium': return Math.floor((level * 3) / 4);
    case 'low': return Math.floor(level / 2);
  }
}

/** progressão de salvaguarda do Pathfinder: boa = 2 + ⌊nível/2⌋, fraca = ⌊nível/3⌋ */
export type SaveProgression = 'high' | 'low';

export function deriveSave(progression: SaveProgression, level = 1): number {
  return progression === 'high' ? 2 + Math.floor(level / 2) : Math.floor(level / 3);
}

// ------------------------------------------------------------------- raças

export interface RaceDef {
  id: string;
  name: string;
  /** categoria de tamanho do PF (afeta CA/ataques) */
  size: 'small' | 'medium';
  /** bônus de atributo da raça */
  mods: Partial<Record<AbilityKey, number>>;
  speedCells: number;
  vision: 'normal' | 'lowLight' | 'dark';
  blurb: string;
  /** traços raciais (ex.: visão no escuro, sorte) */
  traits: string[];
  /** slugs de magias/habilidades raciais especiais */
  racialAbilities?: string[];
}

export const RACES: RaceDef[] = [
  { id: 'humano', name: 'Humano', size: 'medium', mods: {}, speedCells: 6, vision: 'normal',
    blurb: '+2 em uma habilidade na criação do personagem. Versáteis e ambiciosos.',
    traits: ['Versatilidade (escolha +2 em um atributo)', 'Idiomas extras', 'Talentos Adicionais (1º nível)'] },
  { id: 'elfo', name: 'Elfo', size: 'medium', mods: { dex: 2, int: 2, con: -2 }, speedCells: 6, vision: 'lowLight',
    blurb: '+2 Destreza, +2 Inteligência, –2 Constituição. Graciosos no corpo e mente, físico frágil.',
    traits: ['Visão na penumbra', 'Sentidos Aguçados (Percepção baseada em audição ou visão)', 'Imunidades Élficas (imunes a magias de sono; +2 contra encantamentos)'] },
  { id: 'anao', name: 'Anão', size: 'medium', mods: { con: 2, wis: 2, cha: -2 }, speedCells: 4, vision: 'dark',
    blurb: '+2 Constituição, +2 Sabedoria, –2 Carisma. Resistentes e sábios, mas rabugentos.',
    traits: ['Visão no escuro (18m)', 'Resiliência Anã (vantagem contra veneno, magias similares a magia)', 'Ligação com Pedras (Percepção +2 para trabalhos de pedra)', 'Sentidos Aguçados (Percepção baseada em tato e paladar)', 'Ganância (Avaliação como perícia de classe para preço de itens não-mágicos com gemas/metais)', 'Robusto (+2 resistência contra venenos, magias e habilidades similares a magia)', 'Familiaridade com Armas (machado de batalha, picaretas pesadas e martelos de guerra)', 'Ódio (+1 em jogada de ataque contra orcs e goblinóides)', 'Estabilidade (+4 em manobra de combate para resistir a Encontrões ou Imobilização em pé sobre chão firme)'] },
  { id: 'halfling', name: 'Halfling', size: 'small', mods: { dex: 2, cha: 2, str: -2 }, speedCells: 4, vision: 'normal',
    blurb: '+2 Destreza, +2 Carisma, –2 Força. Ágeis e determinados, pequena estatura os torna mais fracos.',
    traits: ['Sorte de Halfling (+1 racial em todos os testes de resistência)', 'Destemido (+2 racial em resistência contra medo, acumula com Sorte de Halfling)', 'Corpo Pequeno (+1 tamanho na CA, +1 em jogadas de ataque, +4 em Furtividade)', 'Pés Firmes (+2 racial em Acrobacia e Escalar)'] },
  { id: 'gnomo', name: 'Gnomo', size: 'small', mods: { con: 2, cha: 2, str: -2 }, speedCells: 4, vision: 'lowLight',
    blurb: '+2 Constituição, +2 Carisma, –2 Força. Fisicamente fracos, surpreendentemente resistentes, naturalmente agradáveis.',
    traits: ['Obsessivo (+2 racial em uma perícia de Ofício ou Profissão à escolha)', 'Resistente a Ilusões (+2 racial em resistência contra magias/efeitos de ilusão)', 'Magia Gnoma (+1 à CD de testes de resistência contra ilusões; CAR 11+: 1/dia — falar com animais, globos de luz, prestidigitação, som fantasma; nível de conjurador = nível do gnomo; CD = 10 + nível da magia + modificador de CAR)'] },
  { id: 'meio-elfo', name: 'Meio-Elfo', size: 'medium', mods: {}, speedCells: 6, vision: 'lowLight',
    blurb: '+2 em uma habilidade na criação do personagem, representando natureza variada. Imunidades Élficas e Adaptação.',
    traits: ['Imunidades Élficas (imunes a sono; +2 contra magias de encantamento)', 'Adaptação (ganham o talento Foco em Perícia como bônus no 1º nível)', 'Sangue Élfico (contam como elfos para efeitos determinados pela raça)'] },
  { id: 'meio-orc', name: 'Meio-Orc', size: 'medium', mods: { str: 2, wis: 2, int: -2 }, speedCells: 6, vision: 'dark',
    blurb: '+2 Força, +2 Sabedoria, –2 Inteligência. Fisicamente fortes, atentos ao perigo, descendência orc afeta negativamente a inteligência.',
    traits: ['Visão no Escuro (enxergam 18 m no escuro)', 'Familiaridade em Arma (proficientes em machado grande e falcione; armas com "orc" no nome são comuns)', 'Ferocidade Orc (1/dia, quando reduzido a menos de 0 PV (mas não morto), continua lutando por mais uma rodada como se debilitado. No fim da rodada, a não ser que seja levado acima de 0 PV, cai inconsciente e começa a morrer)', 'Sangue Orc (considerados humanos e orcs para qualquer efeito relacionado à raça)'] },
  { id: 'draconato', name: 'Draconato', size: 'medium', mods: { str: 1, cha: 1 }, speedCells: 6, vision: 'normal',
    blurb: '+1 Força, +1 Carisma. Herdeiros do sangue dracônico.',
    traits: ['Arma de Sopro (1/long rest: 2d6 de dano em cone)', 'Resistência Elementar (baseado na linhagem)'] },
];

export const RACE_BY_ID = new Map(RACES.map((r) => [r.id, r]));

// ----------------------------------------------------------------- classes

export interface ClassPreset {
  id: string;
  name: string;
  hd: 6 | 8 | 10 | 12;
  /** atributos primários para sugerir na criação */
  primary: AbilityKey[];
  spellcasting: boolean;
  armorId: string;
  weaponId: string;
  blurb: string;
  /** progressão de BBA */
  bba: BbaProgression;
  /** progressão das salvaguardas (testes de resistência) */
  saves: { fort: SaveProgression; ref: SaveProgression; will: SaveProgression };
  /** pontos de perícia por nível (antes do mod. INT) */
  skillPointsPerLevel: number;
}

export const CLASS_PRESETS: ClassPreset[] = [
  {
    id: 'guerreiro',
    name: 'Guerreiro',
    hd: 10,
    primary: ['str', 'con'],
    spellcasting: false,
    armorId: 'cota-malha',
    weaponId: 'espada-longa',
    bba: 'full',
    saves: { fort: 'high', ref: 'low', will: 'low' },
    skillPointsPerLevel: 2,
    blurb: 'Mestre das armas e armaduras. d10 de vida.',
  },
  {
    id: 'mago',
    name: 'Mago',
    hd: 6,
    primary: ['int'],
    spellcasting: true,
    armorId: 'nenhuma',
    weaponId: 'adaga',
    bba: 'low',
    saves: { fort: 'low', ref: 'low', will: 'high' },
    skillPointsPerLevel: 2,
    blurb: 'Erudito arcano: magias devastadoras, pouca vida. d6.',
  },
  {
    id: 'ladino',
    name: 'Ladino',
    hd: 8,
    primary: ['dex'],
    spellcasting: false,
    armorId: 'couro-batido',
    weaponId: 'adaga',
    bba: 'medium',
    saves: { fort: 'low', ref: 'high', will: 'low' },
    skillPointsPerLevel: 8,
    blurb: 'Precisão letal, furtividade e golpes furtivos. d8.',
  },
  {
    id: 'clerigo',
    name: 'Clérigo',
    hd: 8,
    primary: ['wis', 'con'],
    spellcasting: true,
    armorId: 'cota-malha',
    weaponId: 'maca',
    bba: 'medium',
    saves: { fort: 'high', ref: 'low', will: 'high' },
    skillPointsPerLevel: 2,
    blurb: 'Canalizador divino: cura e bênçãos. d8.',
  },
  {
    id: 'barbaro',
    name: 'Bárbaro',
    hd: 12,
    primary: ['str', 'con'],
    spellcasting: false,
    armorId: 'nenhuma',
    weaponId: 'machado-grande',
    bba: 'full',
    saves: { fort: 'high', ref: 'low', will: 'low' },
    skillPointsPerLevel: 4,
    blurb: 'Fúria indomável e o maior dado de vida. d12.',
  },
  {
    id: 'bardo',
    name: 'Bardo',
    hd: 8,
    primary: ['cha', 'dex'],
    spellcasting: true,
    armorId: 'couro',
    weaponId: 'adaga',
    bba: 'medium',
    saves: { fort: 'low', ref: 'high', will: 'high' },
    skillPointsPerLevel: 6,
    blurb: 'Inspiração e versatilidade mágica. d8.',
  },
  {
    id: 'druida',
    name: 'Druida',
    hd: 8,
    primary: ['wis'],
    spellcasting: true,
    armorId: 'couro-batido',
    weaponId: 'bordao',
    bba: 'medium',
    saves: { fort: 'high', ref: 'low', will: 'high' },
    skillPointsPerLevel: 4,
    blurb: 'Guardião da natureza e suas magias. d8.',
  },
  {
    id: 'paladino',
    name: 'Paladino',
    hd: 10,
    primary: ['str', 'cha'],
    spellcasting: true,
    armorId: 'cota-malha',
    weaponId: 'espada-longa',
    bba: 'full',
    saves: { fort: 'high', ref: 'low', will: 'low' },
    skillPointsPerLevel: 2,
    blurb: 'Campeão sagrado com juramentos poderosos. d10.',
  },
  {
    id: 'feiticeiro',
    name: 'Feiticeiro',
    hd: 6,
    primary: ['cha'],
    spellcasting: true,
    armorId: 'nenhuma',
    weaponId: 'adaga',
    bba: 'low',
    saves: { fort: 'low', ref: 'low', will: 'high' },
    skillPointsPerLevel: 2,
    blurb: 'Conjurador arcano intuitivo, impulsionado por Carisma. d6.',
  },
  {
    id: 'monge',
    name: 'Monge',
    hd: 8,
    primary: ['wis', 'dex'],
    spellcasting: false,
    armorId: 'nenhuma',
    weaponId: 'bordao',
    bba: 'medium',
    saves: { fort: 'high', ref: 'high', will: 'high' },
    skillPointsPerLevel: 4,
    blurb: 'Disciplina, mobilidade e ataques desarmados. d8.',
  },
  {
    id: 'ranger',
    name: 'Ranger',
    hd: 10,
    primary: ['dex', 'wis'],
    spellcasting: true,
    armorId: 'couro-batido',
    weaponId: 'arco-curto',
    bba: 'full',
    saves: { fort: 'high', ref: 'high', will: 'low' },
    skillPointsPerLevel: 6,
    blurb: 'Caçador ágil, rastreador e guerreiro de fronteira. d10.',
  },
];

export const CLASS_BY_ID = new Map(CLASS_PRESETS.map((c) => [c.id, c]));

// ------------------------------------------------------------- equipamentos

export interface ArmorPreset {
  id: string;
  name: string;
  /** bônus somado a 10 + DES */
  acBonus: number;
  /** max DES permitido (PF p.1075) */
  maxDex?: number;
  stealthPenalty?: boolean;
  blurb: string;
}

export const ARMOR_PRESETS: ArmorPreset[] = [
  { id: 'nenhuma', name: 'Sem armadura', acBonus: 0, blurb: 'CA 10 + Des.' },
  { id: 'couro', name: 'Armadura de couro', acBonus: 1, maxDex: 6, blurb: 'Leve e silenciosa.' },
  { id: 'couro-batido', name: 'Couro batido', acBonus: 2, maxDex: 5, blurb: 'Rebites reforçados.' },
  { id: 'camisa-malha', name: 'Camisa de malha', acBonus: 3, maxDex: 4, blurb: 'Boa proteção leve.' },
  { id: 'cota-malha', name: 'Cota de malha', acBonus: 5, maxDex: 2, stealthPenalty: true, blurb: 'Pesada e ruidosa.' },
  { id: 'placas', name: 'Placas completas', acBonus: 7, maxDex: 1, stealthPenalty: true, blurb: 'A fortaleza ambulante.' },
];

export type WeaponCategory = 'simple-melee' | 'simple-ranged' | 'martial-melee' | 'martial-ranged';
export type WeaponProperty = 'finesse' | 'light' | 'thrown' | 'two-handed' | 'versatile' | 'loading' | 'reach' | 'heavy';

export interface WeaponPreset {
  id: string;
  name: string;
  dmg: string;
  ranged: boolean;
  category: WeaponCategory;
  properties: WeaponProperty[];
  /** alcance em células (1 célula = 5 pés). Melee: 1 (ou 2 com reach). Ranged: alcance normal. */
  rangeCells: number;
  /** alcance longo em células (ataque com desvantagem além do normal, até este limite). 0 = sem alcance longo. */
  longRangeCells?: number;
  /** classes que não são profientes com esta arma (martial) */
  nonProficient?: string[];
}

export const WEAPON_PRESETS: WeaponPreset[] = [
  // --- Simples corpo a corpo ---
  { id: 'adaga', name: 'Adaga', dmg: '1d4+mod', ranged: false, category: 'simple-melee', properties: ['finesse', 'light', 'thrown'], rangeCells: 1, longRangeCells: 4 },
  { id: 'clava', name: 'Clava', dmg: '1d6+mod', ranged: false, category: 'simple-melee', properties: ['light'], rangeCells: 1 },
  { id: 'maca', name: 'Maça', dmg: '1d6+mod', ranged: false, category: 'simple-melee', properties: [], rangeCells: 1 },
  { id: 'bordao', name: 'Bordão', dmg: '1d6+mod', ranged: false, category: 'simple-melee', properties: ['versatile'], rangeCells: 1 },
  { id: 'foice', name: 'Foice', dmg: '1d6+mod', ranged: false, category: 'simple-melee', properties: ['finesse', 'light'], rangeCells: 1 },
  { id: 'machadinha', name: 'Machadinha', dmg: '1d6+mod', ranged: false, category: 'simple-melee', properties: ['light', 'thrown'], rangeCells: 1, longRangeCells: 4 },
  { id: 'picareta', name: 'Picareta', dmg: '1d4+mod', ranged: false, category: 'simple-melee', properties: ['light'], rangeCells: 1 },
  { id: 'cenoura-morninga', name: 'Cenoura-morninga', dmg: '1d4+mod', ranged: false, category: 'simple-melee', properties: ['finesse', 'light', 'thrown'], rangeCells: 1, longRangeCells: 4 },

  // --- Simples à distância ---
  { id: 'besta-leve', name: 'Besta leve', dmg: '1d6+mod', ranged: true, category: 'simple-ranged', properties: ['loading'], rangeCells: 16, longRangeCells: 64 },
  { id: 'dardo', name: 'Dardo', dmg: '1d4+mod', ranged: true, category: 'simple-ranged', properties: ['finesse', 'light', 'thrown'], rangeCells: 4, longRangeCells: 12 },
  { id: 'funda', name: 'Funda', dmg: '1d4+mod', ranged: true, category: 'simple-ranged', properties: [], rangeCells: 6, longRangeCells: 24 },

  // --- Marcial corpo a corpo ---
  { id: 'espada-longa', name: 'Espada longa', dmg: '1d8+mod', ranged: false, category: 'martial-melee', properties: ['versatile'], rangeCells: 1, nonProficient: ['mago', 'ladino', 'druida', 'bardo'] },
  { id: 'espada-curta', name: 'Espada curta', dmg: '1d6+mod', ranged: false, category: 'martial-melee', properties: ['finesse', 'light'], rangeCells: 1, nonProficient: ['mago', 'druida'] },
  { id: 'machado-grande', name: 'Machado grande', dmg: '1d12+mod', ranged: false, category: 'martial-melee', properties: ['two-handed'], rangeCells: 1, nonProficient: ['mago', 'ladino', 'druida', 'bardo', 'clerigo'] },
  { id: 'lanca', name: 'Lança', dmg: '1d6+mod', ranged: false, category: 'martial-melee', properties: ['reach', 'versatile'], rangeCells: 2, nonProficient: ['mago', 'ladino', 'druida', 'bardo'] },
  { id: 'alabarda', name: 'Alabarda', dmg: '1d10+mod', ranged: false, category: 'martial-melee', properties: ['reach', 'two-handed'], rangeCells: 2, nonProficient: ['mago', 'ladino', 'druida', 'bardo', 'paladino'] },
  { id: 'maca-estrelada', name: 'Maça estrelada', dmg: '1d8+mod', ranged: false, category: 'martial-melee', properties: [], rangeCells: 1, nonProficient: ['mago', 'ladino', 'druida', 'bardo'] },
  { id: 'glaive', name: 'Glaive', dmg: '1d10+mod', ranged: false, category: 'martial-melee', properties: ['reach', 'two-handed'], rangeCells: 2, nonProficient: ['mago', 'ladino', 'druida', 'bardo', 'paladino'] },

  // --- Marcial à distância ---
  { id: 'arco-longo', name: 'Arco longo', dmg: '1d8+mod', ranged: true, category: 'martial-ranged', properties: ['two-handed'], rangeCells: 30, longRangeCells: 120, nonProficient: ['mago', 'clerigo', 'druida'] },
  { id: 'besta-mao', name: 'Besta de mão', dmg: '1d6+mod', ranged: true, category: 'martial-ranged', properties: ['light', 'loading'], rangeCells: 6, longRangeCells: 24, nonProficient: ['mago', 'druida'] },
  { id: 'rede', name: 'Rede', dmg: '—', ranged: true, category: 'martial-ranged', properties: ['thrown'], rangeCells: 5, nonProficient: ['mago', 'druida', 'bardo'] },
  { id: 'chicote', name: 'Chicote', dmg: '1d4+mod', ranged: false, category: 'martial-melee', properties: ['finesse', 'reach'], rangeCells: 2, nonProficient: ['mago', 'druida'] },

  // --- Simples à distância faltantes ---
  { id: 'arco-curto', name: 'Arco curto', dmg: '1d6+mod', ranged: true, category: 'simple-ranged', properties: [], rangeCells: 12, longRangeCells: 48 },

  // --- Marcial corpo a corpo faltantes ---
  { id: 'machado-mao', name: 'Machado de mão', dmg: '1d6+mod', ranged: false, category: 'martial-melee', properties: ['light', 'thrown'], rangeCells: 1, longRangeCells: 4, nonProficient: ['mago', 'druida'] },
  { id: 'espada-gigante', name: 'Espada gigante', dmg: '2d6+mod', ranged: false, category: 'martial-melee', properties: ['heavy', 'two-handed'], rangeCells: 1, nonProficient: ['mago', 'ladino', 'druida', 'bardo'] },
  { id: 'foice-gigante', name: 'Foice gigante', dmg: '2d4+mod', ranged: false, category: 'martial-melee', properties: ['heavy', 'two-handed', 'reach'], rangeCells: 2, nonProficient: ['mago', 'ladino', 'druida', 'bardo'] },
  { id: 'martelo-guerra', name: 'Martelo de guerra', dmg: '1d8+mod', ranged: false, category: 'martial-melee', properties: ['versatile'], rangeCells: 1, nonProficient: ['mago', 'ladino', 'druida', 'bardo'] },
  { id: 'rapieira', name: 'Rapieira', dmg: '1d8+mod', ranged: false, category: 'martial-melee', properties: ['finesse'], rangeCells: 1, nonProficient: ['mago', 'druida', 'clerigo', 'barbaro'] },
];

export const ARMOR_BY_ID = new Map(ARMOR_PRESETS.map((a) => [a.id, a]));
export const WEAPON_BY_ID = new Map(WEAPON_PRESETS.map((w) => [w.id, w]));

// --------------------------------------------------------------- itens

export type ItemCategory = 'weapon' | 'armor' | 'shield' | 'utility' | 'consumable' | 'scroll' | 'grimoire' | 'loot';

export interface ItemPreset {
  id: string;
  name: string;
  category: ItemCategory;
  acBonus?: number;
  spellSlug?: string;
  weight: number;
  blurb: string;
  /** classes que não são profientes com escudos pesados */
  nonProficient?: string[];
}

export const ITEM_PRESETS: ItemPreset[] = [
  // --- Escudos ---
  { id: 'escudo-leve', name: 'Escudo leve', category: 'shield', acBonus: 1, weight: 6, blurb: 'Escudo de madeira reforçado.' },
  { id: 'escudo-pesado', name: 'Escudo pesado', category: 'shield', acBonus: 2, weight: 12, blurb: 'Escudo metálico robusto.', nonProficient: ['mago', 'ladino', 'druida', 'bardo'] },
  { id: 'escudo-toracal', name: 'Escudo Toracal', category: 'shield', acBonus: 4, weight: 45, blurb: 'Escudo massivo. +4 CA, -2 Atletismo.', nonProficient: ['mago', 'ladino', 'druida', 'bardo'] },

  // --- Itens utilitários ---
  { id: 'tocha', name: 'Tocha', category: 'utility', weight: 1, blurb: 'Ilumina 3 células por 1 hora.' },
  { id: 'corda-seda', name: 'Corda de seda', category: 'utility', weight: 5, blurb: '30 metros de corda resistente.' },
  { id: 'grapico', name: 'Grapico', category: 'utility', weight: 2, blurb: '10 ganchos e tripas de escalada.' },
  { id: 'kit-primers', name: 'Kit de primeiros socorros', category: 'utility', weight: 3, blurb: 'Bandagens e ervas curativas.' },
  { id: 'racoes', name: 'Rações (1 dia)', category: 'utility', weight: 2, blurb: 'Comida seca para um dia.' },
  { id: 'cantil', name: 'Cantil', category: 'utility', weight: 2, blurb: '1L de água.' },
  { id: 'lanterna', name: 'Lanterna de bolso', category: 'utility', weight: 2, blurb: 'Ilumina 6 células. Precisa de óleo.' },
  { id: 'lampiao', name: 'Lamparina', category: 'utility', weight: 2, blurb: 'Ilumina 8 células. Precisa de óleo.' },
  { id: 'oleo', name: 'Frasco de óleo', category: 'utility', weight: 1, blurb: 'Combustível para lanterna/lamparina.' },
  { id: 'saco-corda', name: 'Saco de corda', category: 'utility', weight: 5, blurb: '50 metros de corda de cânhamo.' },

  // --- Pergaminhos ---
  { id: 'perg-escudo', name: 'Pergaminho de Escudo', category: 'scroll', spellSlug: 'escudo', weight: 0, blurb: '1 uso: Escudo (+4 CA).' },
  { id: 'perg-curar', name: 'Pergaminho de Curar Ferimentos', category: 'scroll', spellSlug: 'curar-ferimentos', weight: 0, blurb: '1 uso: Curar Ferimentos (1d8+mod).' },
  { id: 'perg-misseis', name: 'Pergaminho de Mísseis Mágicos', category: 'scroll', spellSlug: 'misseis-magicos', weight: 0, blurb: '1 uso: 3 mísseis mágicos.' },
  { id: 'perg-raio-fogo', name: 'Pergaminho de Raio de Fogo', category: 'scroll', spellSlug: 'raio-de-fogo', weight: 0, blurb: '1 uso: Raio de Fogo (1d10).' },

  // --- Grimórios ---
  { id: 'grimorio-fogo', name: 'Grimório de Fogo', category: 'grimoire', spellSlug: 'raio-de-fogo', weight: 3, blurb: 'Concede Raio de Fogo permanente.' },
  { id: 'grimorio-gelo', name: 'Grimório de Gelo', category: 'grimoire', spellSlug: 'chicote-espinhoso', weight: 3, blurb: 'Concede Chicote Espinhoso permanente.' },
  { id: 'grimorio-luz', name: 'Grimório de Luz', category: 'grimoire', spellSlug: 'luz', weight: 3, blurb: 'Concede Luz permanente.' },
  { id: 'grimorio-sombra', name: 'Grimório de Sombra', category: 'grimoire', spellSlug: 'golpe-ardente', weight: 3, blurb: 'Concede Golpe Ardente permanente.' },
];

export const ITEM_BY_ID = new Map(ITEM_PRESETS.map((i) => [i.id, i]));

// --------------------------------------------------------------- point buy

export const POINT_BUY_BUDGET = 15;

/** custo de point-buy Pathfinder para valor base de atributo (7–18) */
export function pointBuyCost(score: number): number {
  switch (score) {
    case 7: return -4;
    case 8: return -2;
    case 9: return -1;
    case 10: return 0;
    case 11: return 1;
    case 12: return 2;
    case 13: return 3;
    case 14: return 5;
    case 15: return 7;
    case 16: return 10;
    case 17: return 13;
    case 18: return 17;
    default: return Number.NaN;
  }
}

// ------------------------------------------------------------ criação/ficha

export interface SheetCreateInput {
  name: string;
  raceId: string;
  classId: string;
  /** valores BASE (antes dos bônus raciais), 7–18 — ou FINAIS quando mdg está presente */
  baseAbilities: Record<AbilityKey, number>;
  armorId?: string;
  weaponId?: string;
  shieldId?: string;
  /** magias conhecidas (slugs) — magos escolhem 2, clérigos 2, etc. */
  knownSpells?: string[];
  /** +2 humano/meio-elfo em uma habilidade (docs/pf-rules-building.md:68,79) */
  racialChoice?: AbilityKey;
  /** história breve do personagem */
  backstory?: string;
  /** marca importação do Gerador MdG: sem point-buy e sem aplicar raça */
  mdg?: { hpMax?: number };
}

export interface CreateError {
  field: string;
  message: string;
}

export interface DerivedSheet {
  abilities: Record<AbilityKey, number>;
  maxHp: number;
  ac: number;
  prof: number;
  /** bônus base de ataque (BBA) — PF */
  bba: number;
  /** bônus base das salvaguardas (testes de resistência) — PF */
  fort: number;
  ref: number;
  will: number;
  initiative: number;
  /** pontos de perícia totais disponíveis no nível atual */
  skillPoints: number;
  /** categoria de tamanho derivada da raça */
  sizeCategory: 'small' | 'medium';
  spellSlotsTotal: number;
  armorId: string;
  weaponId: string;
  shieldId: string;
  speedCells: number;
}

/** aplica os bônus raciais sobre os valores base */
export function applyRacialMods(base: Record<AbilityKey, number>, raceId: string, choice?: AbilityKey): Record<AbilityKey, number> {
  const out = { ...base };
  const race = RACE_BY_ID.get(raceId);
  if (!race) return out;
  for (const [k, v] of Object.entries(race.mods)) {
    out[k as AbilityKey] += v ?? 0;
  }
  if ((raceId === 'humano' || raceId === 'meio-elfo') && choice && ABILITY_KEYS.includes(choice)) {
    out[choice] += 2;
  }
  return out;
}

/** valida a entrada de criação e devolve erros em PT-BR */
export function validateCreateInput(input: SheetCreateInput): CreateError[] {
  const errors: CreateError[] = [];
  if (!input.name || input.name.trim().length < 2) errors.push({ field: 'name', message: 'Informe o nome do herói.' });
  const race = RACE_BY_ID.get(input.raceId);
  if (!race) errors.push({ field: 'raceId', message: 'Raça inválida.' });
  const cls = CLASS_BY_ID.get(input.classId);
  if (!cls) errors.push({ field: 'classId', message: 'Classe inválida.' });
  if (!race || !cls) return errors;

  const isImport = Boolean(input.mdg);
  let spent = 0;
  for (const k of ABILITY_KEYS) {
    const v = input.baseAbilities[k];
    if (isImport) {
      if (!Number.isInteger(v) || v < 3 || v > 18) errors.push({ field: `base.${k}`, message: `${ABILITY_LABELS[k]} importado deve estar entre 3 e 18.` });
    } else {
      const cost = pointBuyCost(v);
      if (!Number.isFinite(cost)) errors.push({ field: `base.${k}`, message: `${ABILITY_LABELS[k]} deve estar entre 7 e 18.` });
      else spent += cost;
    }
  }
  if (!isImport && spent > POINT_BUY_BUDGET) {
    errors.push({ field: 'base', message: `Point-buy excedido: ${spent}/${POINT_BUY_BUDGET} pontos.` });
  }
  if (isImport && input.mdg?.hpMax !== undefined && (!Number.isInteger(input.mdg.hpMax) || input.mdg.hpMax < 1 || input.mdg.hpMax > 200)) {
    errors.push({ field: 'mdg.hpMax', message: 'PV importado inválido.' });
  }

  if (input.armorId && !ARMOR_BY_ID.has(input.armorId)) errors.push({ field: 'armorId', message: 'Armadura inválida.' });
  if (input.weaponId && !WEAPON_BY_ID.has(input.weaponId)) errors.push({ field: 'weaponId', message: 'Arma inválida.' });
  if (input.shieldId && !ITEM_BY_ID.has(input.shieldId)) errors.push({ field: 'shieldId', message: 'Escudo inválido.' });
  if (input.racialChoice && !ABILITY_KEYS.includes(input.racialChoice)) {
    errors.push({ field: 'racialChoice', message: 'Escolha racial inválida.' });
  }

  return errors;
}

/** deriva todos os valores finais do herói nível 1 */
export function computeDerivedSheet(input: SheetCreateInput): DerivedSheet {
  const race = RACE_BY_ID.get(input.raceId)!;
  const cls = CLASS_BY_ID.get(input.classId)!;
  // importação MdG: atributos já são finais (sem bônus racial)
  const abilities = input.mdg ? { ...input.baseAbilities } : applyRacialMods(input.baseAbilities, input.raceId, input.racialChoice);

  const armor = ARMOR_BY_ID.get(input.armorId ?? cls.armorId) ?? ARMOR_BY_ID.get(cls.armorId)!;
  const weapon = WEAPON_BY_ID.get(input.weaponId ?? cls.weaponId) ?? WEAPON_BY_ID.get(cls.weaponId)!;
  const shield = ITEM_BY_ID.get(input.shieldId ?? '');

  const maxHp = Math.max(1, cls.hd + abilityMod(abilities.con));
  const sizeMod = race.size === 'small' ? 1 : 0;
  const ac = armorAc(abilities.dex, armor.acBonus, shield?.acBonus ?? 0, sizeMod, 0, armor.maxDex);
  const initiative = abilityMod(abilities.dex);
  const SLOTS_LVL1: Record<string, number> = { mago: 1, feiticeiro: 1, clerigo: 1, druida: 1, bardo: 1, paladino: 0, ranger: 0, barbaro: 0, guerreiro: 0, ladino: 0, monge: 0 };
  const spellSlotsTotal = SLOTS_LVL1[cls.id] ?? (cls.spellcasting ? 1 : 0);

  const level = 1;
  const bba = deriveBba(cls.bba, level);
  const fort = deriveSave(cls.saves.fort, level);
  const ref = deriveSave(cls.saves.ref, level);
  const will = deriveSave(cls.saves.will, level);
  const skillPoints = Math.max(1, cls.skillPointsPerLevel + abilityMod(abilities.int));

  return {
    abilities,
    maxHp,
    ac,
    prof: deriveProf(level),
    bba,
    fort,
    ref,
    will,
    initiative,
    skillPoints,
    sizeCategory: race.size,
    spellSlotsTotal,
    armorId: armor.id,
    weaponId: weapon.id,
    shieldId: shield?.id ?? '',
    speedCells: race.speedCells,
  };
}

/** CA = 10 + DES(capped) + armadura + escudo + tamanho (+ esquiva) — docs/pf-rules-building.md:1075 */
export function armorAc(dexScore: number, armorBonus: number, shieldBonus = 0, sizeMod = 0, dodgeBonus = 0, maxDex?: number): number {
  const dexMod = maxDex !== undefined ? Math.min(abilityMod(dexScore), maxDex) : abilityMod(dexScore);
  return 10 + dexMod + armorBonus + shieldBonus + sizeMod + dodgeBonus;
}
/** CA toque = 10 + DES(capped) + tamanho + esquiva — ignora armadura/escudo/natural docs/pf-rules-building.md:1075 */
export function touchAc(dexScore: number, sizeMod = 0, dodgeBonus = 0, maxDex?: number): number {
  const dexMod = maxDex !== undefined ? Math.min(abilityMod(dexScore), maxDex) : abilityMod(dexScore);
  return 10 + dexMod + sizeMod + dodgeBonus;
}
