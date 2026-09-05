/** Conteúdo SRD (D&D 5e) para invocação rápida e referência. */

export interface SRDAbilities {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface SRDAttack {
  name: string;
  bonus: number;
  dmgDice: string;
  dmgMod: number;
  rangeCells: number;
}

export interface SRDMonster {
  id: string;
  name: string;
  cr: string;
  hp: number;
  ac: number;
  color: string;
  sizeCells: number;
  abil?: SRDAbilities;
  attacks: SRDAttack[];
}

export const SRD_MONSTERS: SRDMonster[] = [
  { id: 'goblin', name: 'Goblin', cr: '1/4', hp: 7, ac: 15, color: '#c0392b', sizeCells: 1,
    abil: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    attacks: [{ name: 'Cimitarra', bonus: 4, dmgDice: '1d6', dmgMod: 2, rangeCells: 1 }] },
  { id: 'orc', name: 'Orc Bruto', cr: '1/2', hp: 15, ac: 13, color: '#8e44ad', sizeCells: 1,
    abil: { str: 16, dex: 12, con: 16, int: 7, wis: 9, cha: 7 },
    attacks: [{ name: 'Machado grande', bonus: 5, dmgDice: '1d12', dmgMod: 3, rangeCells: 1 }] },
  { id: 'kobold', name: 'Kobold', cr: '1/8', hp: 5, ac: 12, color: '#d35400', sizeCells: 1,
    abil: { str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8 },
    attacks: [{ name: 'Adaga', bonus: 4, dmgDice: '1d4', dmgMod: 2, rangeCells: 1 }] },
  { id: 'hobgoblin', name: 'Hobgoblin', cr: '1/2', hp: 11, ac: 18, color: '#a93226', sizeCells: 1,
    abil: { str: 13, dex: 12, con: 12, int: 10, wis: 10, cha: 9 },
    attacks: [{ name: 'Espada longa', bonus: 3, dmgDice: '1d8', dmgMod: 1, rangeCells: 1 }] },
  { id: 'gnoll', name: 'Gnoll', cr: '1/2', hp: 22, ac: 15, color: '#b7950b', sizeCells: 1,
    abil: { str: 14, dex: 12, con: 11, int: 6, wis: 10, cha: 7 },
    attacks: [{ name: 'Lança', bonus: 4, dmgDice: '1d6', dmgMod: 2, rangeCells: 1 }] },
  { id: 'ogre', name: 'Ogro', cr: '2', hp: 59, ac: 11, color: '#6c3483', sizeCells: 2,
    abil: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
    attacks: [{ name: 'Clava grande', bonus: 6, dmgDice: '2d8', dmgMod: 4, rangeCells: 1 }] },
  { id: 'ghoul', name: 'Carniçal', cr: '1', hp: 22, ac: 12, color: '#7d6608', sizeCells: 1,
    abil: { str: 13, dex: 15, con: 10, int: 7, wis: 10, cha: 6 },
    attacks: [{ name: 'Garra', bonus: 4, dmgDice: '1d6', dmgMod: 2, rangeCells: 1 }, { name: 'Mordida', bonus: 4, dmgDice: '1d6', dmgMod: 2, rangeCells: 1 }] },
  { id: 'wolf-director', name: 'Lobo Dire', cr: '1/4', hp: 19, ac: 14, color: '#797d7f', sizeCells: 2,
    abil: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    attacks: [{ name: 'Mordida', bonus: 5, dmgDice: '2d6', dmgMod: 3, rangeCells: 1 }] },
  { id: 'skeleton', name: 'Esqueleto', cr: '1/4', hp: 13, ac: 13, color: '#94a3b8', sizeCells: 1,
    abil: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
    attacks: [{ name: 'Cimitarra', bonus: 4, dmgDice: '1d6', dmgMod: 2, rangeCells: 1 }] },
  { id: 'zombie', name: 'Zumbi', cr: '1/4', hp: 22, ac: 8, color: '#4a6741', sizeCells: 1,
    abil: { str: 12, dex: 6, con: 16, int: 3, wis: 8, cha: 5 },
    attacks: [{ name: 'Esmagar', bonus: 4, dmgDice: '1d6', dmgMod: 2, rangeCells: 1 }] },
  { id: 'gelatinous-cube', name: 'Cubo Gelatinoso', cr: '2', hp: 84, ac: 6, color: '#58d68d', sizeCells: 2,
    abil: { str: 14, dex: 3, con: 14, int: 1, wis: 6, cha: 2 },
    attacks: [{ name: 'Pseudópode', bonus: 6, dmgDice: '3d6', dmgMod: 3, rangeCells: 1 }] },
  { id: 'wight', name: 'Espectro Maligno (Wight)', cr: '3', hp: 45, ac: 14, color: '#7dd3fc', sizeCells: 1,
    abil: { str: 15, dex: 14, con: 15, int: 10, wis: 12, cha: 15 },
    attacks: [{ name: 'Espada grande', bonus: 4, dmgDice: '2d6', dmgMod: 4, rangeCells: 1 }, { name: 'Drenar vida', bonus: 4, dmgDice: '1d6', dmgMod: 2, rangeCells: 1 }] },
  { id: 'lobo', name: 'Lobo', cr: '1/4', hp: 11, ac: 13, color: '#a3a375', sizeCells: 1,
    abil: { str: 12, dex: 14, con: 12, int: 3, wis: 12, cha: 6 },
    attacks: [{ name: 'Mordida', bonus: 4, dmgDice: '1d6', dmgMod: 2, rangeCells: 1 }] },
  { id: 'espectro', name: 'Espectro', cr: '1', hp: 22, ac: 12, color: '#7dd3fc', sizeCells: 1,
    abil: { str: 8, dex: 16, con: 12, int: 10, wis: 12, cha: 15 },
    attacks: [{ name: 'Toque gélido', bonus: 4, dmgDice: '1d6', dmgMod: 3, rangeCells: 1 }] },

  // --- Novos monstros SRD ---
  { id: 'aranha-gigante', name: 'Aranha Gigante', cr: '1', hp: 26, ac: 14, color: '#1c1917', sizeCells: 2,
    abil: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
    attacks: [{ name: 'Garra', bonus: 5, dmgDice: '1d8', dmgMod: 3, rangeCells: 1 }, { name: 'Mordida', bonus: 5, dmgDice: '1d8', dmgMod: 3, rangeCells: 1 }] },
  { id: 'troll', name: 'Troll', cr: '5', hp: 84, ac: 15, color: '#365314', sizeCells: 2,
    abil: { str: 18, dex: 13, con: 17, int: 7, wis: 9, cha: 7 },
    attacks: [{ name: 'Garra', bonus: 7, dmgDice: '2d6', dmgMod: 4, rangeCells: 1 }, { name: 'Mordida', bonus: 7, dmgDice: '2d8', dmgMod: 4, rangeCells: 1 }] },
  { id: 'basilisco', name: 'Basilisco', cr: '3', hp: 52, ac: 15, color: '#78350f', sizeCells: 2,
    abil: { str: 16, dex: 12, con: 15, int: 2, wis: 8, cha: 7 },
    attacks: [{ name: 'Mordida', bonus: 7, dmgDice: '2d8', dmgMod: 3, rangeCells: 1 }] },
  { id: 'cyclops', name: 'Cyclops', cr: '8', hp: 138, ac: 14, color: '#6b7280', sizeCells: 2,
    abil: { str: 22, dex: 11, con: 20, int: 8, wis: 7, cha: 10 },
    attacks: [{ name: 'Punho', bonus: 13, dmgDice: '4d6', dmgMod: 6, rangeCells: 1 }, { name: 'Funda', bonus: 9, dmgDice: '2d6', dmgMod: 2, rangeCells: 6 }] },
  { id: 'mind-flayer', name: 'Mind Flayer', cr: '7', hp: 71, ac: 15, color: '#4c1d95', sizeCells: 1,
    abil: { str: 11, dex: 12, con: 12, int: 19, wis: 17, cha: 17 },
    attacks: [{ name: 'Tentáculos', bonus: 5, dmgDice: '2d6', dmgMod: 2, rangeCells: 1 }, { name: 'Lanço mental', bonus: 5, dmgDice: '3d6', dmgMod: 3, rangeCells: 3 }] },
  { id: 'vampiro', name: 'Vampiro', cr: '5', hp: 144, ac: 16, color: '#881337', sizeCells: 1,
    abil: { str: 18, dex: 18, con: 18, int: 17, wis: 15, cha: 18 },
    attacks: [{ name: 'Golpe', bonus: 9, dmgDice: '1d8', dmgMod: 4, rangeCells: 1 }, { name: 'Envolvimento', bonus: 9, dmgDice: '2d6', dmgMod: 4, rangeCells: 1 }] },
];

// ------------------------------------------------------------------ magias

export interface SpellMech {
  /** ataque = rola d20 vs CA · auto = dano garantido · heal = cura/reanima */
  kind: 'attack' | 'auto' | 'heal';
  targets: 'enemy' | 'ally';
  /** dados por rolagem, ex.: '1d6' */
  dice: string;
  /** nº de rolagens separadas (ex.: mísseis mágicos = 3) */
  times?: number;
  /** soma o modificador de conjuração ao total */
  scaleWithCaster?: boolean;
  /** bônus fixo aplicado por rolagem */
  bonusMod?: number;
}

export interface SRDSpell {
  slug: string;
  name: string;
  level: number;
  classes: string[];
  mech?: SpellMech;
  blurb?: string;
}

export const SPELLCASTING_ABILITY: Record<string, 'int' | 'wis' | 'cha'> = {
  mago: 'int',
  clerigo: 'wis',
  druida: 'wis',
  bardo: 'cha',
  paladino: 'cha',
  feiticeiro: 'cha',
  ranger: 'wis',
};

export const SRD_SPELLS: SRDSpell[] = [
  // ============================================================ truques (nv 0)
  // Mago
  { slug: 'raio-de-fogo', name: 'Raio de Fogo', level: 0, classes: ['mago'],
    mech: { kind: 'attack', targets: 'enemy', dice: '1d10' }, blurb: 'Raio flamejante de energia arcana.' },
  { slug: 'luz', name: 'Luz', level: 0, classes: ['mago', 'clerigo', 'druida', 'bardo'],
    mech: { kind: 'auto', targets: 'ally', dice: '0' }, blurb: 'Faz um objeto brilhar como tocha.' },
  { slug: 'メッセージ', name: 'Mensagem', level: 0, classes: ['mago', 'ladino', 'bardo'],
    mech: { kind: 'auto', targets: 'ally', dice: '0' }, blurb: 'Murmura uma mensagem ao alvo.' },
  { slug: 'ardoncar', name: 'Arde-fror', level: 0, classes: ['mago', 'druida'],
    mech: { kind: 'auto', targets: 'enemy', dice: '1d10' }, blurb: 'Toque de chamas que queima o alvo.' },
  { slug: 'protecao-leve', name: 'Proteção Contra o Lede', level: 0, classes: ['mago'],
    mech: { kind: 'auto', targets: 'ally', dice: '0' }, blurb: 'Gera um campo de força contra projéteis.' },

  // Clérigo
  { slug: 'chama-sagrada', name: 'Chama Sagrada', level: 0, classes: ['clerigo'],
    mech: { kind: 'attack', targets: 'enemy', dice: '1d8' }, blurb: 'Chama divina que ignora coberturas.' },
  { slug: '_guida', name: 'Guia', level: 0, classes: ['clerigo', 'druida', 'bardo'],
    mech: { kind: 'auto', targets: 'ally', dice: '0' }, blurb: '+1d4 em próximo teste de atributo.' },
  { slug: 'pressionar-maos', name: 'Pressão de Mãos', level: 0, classes: ['clerigo'],
    mech: { kind: 'attack', targets: 'enemy', dice: '1d10' }, blurb: 'Força psíquica empurra o alvo.' },

  // Druida
  { slug: 'chicote-espinhoso', name: 'Chicote Espinhoso', level: 0, classes: ['druida'],
    mech: { kind: 'attack', targets: 'enemy', dice: '1d6' }, blurb: 'Ramo espinhoso açoita o alvo.' },
  { slug: 'produzir-chama', name: 'Produzir Chama', level: 0, classes: ['druida'],
    mech: { kind: 'auto', targets: 'enemy', dice: '1d8' }, blurb: 'Criar uma chama pontiaguda de energia.' },

  // Bardo
  { slug: 'insulto-vicioso', name: 'Insúltio Vicioso', level: 0, classes: ['bardo'],
    mech: { kind: 'auto', targets: 'enemy', dice: '1d4' }, blurb: 'Dano psíquico verbal devastador.' },
  { slug: 'tagarelice', name: 'Tagarelice', level: 0, classes: ['bardo'],
    mech: { kind: 'attack', targets: 'enemy', dice: '1d4' }, blurb: 'Ouve murmúrios mágicos que confundem.' },

  // Ladino (truques arcane)
  { slug: 'golpe-ardente', name: 'Golpe Ardente', level: 0, classes: ['mago', 'ladino'],
    mech: { kind: 'auto', targets: 'enemy', dice: '1d6' }, blurb: 'Ataque envolto em chamas fracas.' },

  // ============================================================ nível 1
  // Mago
  { slug: 'misseis-magicos', name: 'Mísseis Mágicos', level: 1, classes: ['mago'],
    mech: { kind: 'auto', targets: 'enemy', dice: '1d4', times: 3, bonusMod: 1 },
    blurb: '3 mísseis de força que nunca erram.' },
  { slug: 'escudo', name: 'Escudo', level: 1, classes: ['mago'],
    mech: { kind: 'auto', targets: 'ally', dice: '0' }, blurb: 'Reação: +5 CA até próximo turno.' },
  { slug: 'absorver-elementos', name: 'Absorver Elementos', level: 1, classes: ['mago', 'druida'],
    mech: { kind: 'auto', targets: 'ally', dice: '0' }, blurb: 'Absorve dano elemental e devolve no próximo golpe.' },
  { slug: 'arma-a-brilho', name: 'Arma a Brilho', level: 1, classes: ['mago', 'bardo'],
    mech: { kind: 'auto', targets: 'ally', dice: '2d6' }, blurb: 'Envolve uma arma em energia reluzente.' },
  { slug: 'detectar-magia', name: 'Detectar Magia', level: 1, classes: ['mago', 'clerigo', 'paladino'],
    mech: { kind: 'auto', targets: 'ally', dice: '0' }, blurb: 'Sente presença de magia num raio de 9m.' },

  // Clérigo
  { slug: 'curar-ferimentos', name: 'Curar Ferimentos', level: 1,
    classes: ['clerigo', 'druida', 'bardo', 'paladino'],
    mech: { kind: 'heal', targets: 'ally', dice: '1d8', scaleWithCaster: true },
    blurb: 'Cura por toque; reanima quem estiver caído.' },
  { slug: 'protecao-contra-bem-e-mal', name: 'Proteção contra Bem e Mal', level: 1, classes: ['clerigo', 'paladino', 'mago'],
    blurb: 'Escudo contra aberrações, celestiais, elementais, fadas, mortos-vivos e corruptores.' },
  { slug: 'guia-divino', name: 'Guia Divino', level: 1, classes: ['clerigo', 'paladino'],
    mech: { kind: 'auto', targets: 'ally', dice: '0' }, blurb: '+1d4 em um teste de ataque ou habilidade.' },
  { slug: 'comando', name: 'Comando', level: 1, classes: ['clerigo', 'paladino'],
    mech: { kind: 'auto', targets: 'enemy', dice: '0' }, blurb: 'Ordem mágica: "Ataque", "Corre", "Solta".' },
  { slug: 'escudo-da-fe', name: 'Escudo da Fé', level: 1, classes: ['clerigo'],
    mech: { kind: 'auto', targets: 'ally', dice: '0' }, blurb: '+2 CA para o alvo.' },

  // Druida
  { slug: 'bom-arbusto', name: 'Bom Arbusto', level: 1, classes: ['druida'],
    mech: { kind: 'auto', targets: 'ally', dice: '0' }, blurb: 'Planta encantada cura 1d8+mod ao tocar.' },
  { slug: 'ferrugem', name: 'Ferrugem', level: 1, classes: ['druida'],
    mech: { kind: 'attack', targets: 'enemy', dice: '2d6' }, blurb: 'Mofa e ferrugem corroem o alvo.' },
  { slug: 'enxame-derroticos', name: 'Enxame de Insetos', level: 1, classes: ['druida'],
    mech: { kind: 'auto', targets: 'enemy', dice: '1d6', times: 2 }, blurb: 'Nuvem de insetos mordedores.' },

  // Bardo
  { slug: 'enciair', name: 'Encantar Pessoa', level: 1, classes: ['bardo'],
    mech: { kind: 'attack', targets: 'enemy', dice: '0' }, blurb: 'Faz o alvo simpatizar mágicamente.' },
  { slug: 'inspirar-coragem', name: 'Inspirar Coragem', level: 1, classes: ['bardo'],
    mech: { kind: 'auto', targets: 'ally', dice: '0' }, blurb: '+1d4 em ataques e testes de resistência.' },
  { slug: 'hidden-step', name: 'Passos Ocultos', level: 1, classes: ['bardo', 'druida'],
    mech: { kind: 'auto', targets: 'ally', dice: '0' }, blurb: 'Torna-se invisível até se mover ou agir.' },

  // Paladino
  { slug: 'divine-favor', name: 'Favor Divino', level: 1, classes: ['paladino'],
    mech: { kind: 'auto', targets: 'ally', dice: '0' }, blurb: '+1d4 radiante nos ataques com arma.' },
  { slug: 'smite-evil', name: 'Golpe Abençoado', level: 1, classes: ['paladino'],
    mech: { kind: 'auto', targets: 'enemy', dice: '2d6' }, blurb: 'Dano radiante extra contra mortos-vivos e demônios.' },

  // Ladino (magias arcana nv 1 — specialty)
  { slug: 'sleep', name: 'Sono Mágico', level: 1, classes: ['mago', 'bardo'],
    mech: { kind: 'auto', targets: 'enemy', dice: '5d8' }, blurb: 'Coloca criaturas em sono mágico.' },
  { slug: 'mage-hand', name: 'Mão Arcana', level: 0, classes: ['mago', 'ladino', 'bardo'],
    mech: { kind: 'auto', targets: 'ally', dice: '0' }, blurb: 'Mão espectral que segura e move objetos.' },
];

/** Magias disponíveis para uma classe (ordenadas por nível). */
export function spellsForClass(classId: string): SRDSpell[] {
  return SRD_SPELLS.filter((s) => s.classes.includes(classId)).sort((a, b) => a.level - b.level);
}

// --------------------------------------------------------------- condições

export interface SRDCondition {
  id: string;
  name: string;
  description: string;
}

export const SRD_CONDITIONS: SRDCondition[] = [
  { id: 'envenenado', name: 'Envenenado', description: 'Desvantagem em ataques e testes de atributo.' },
  { id: 'aturdido', name: 'Atordoado', description: 'Incapacitado, não pode se mover; falha automática em Força/DEST.' },
  { id: 'caido', name: 'Caído', description: 'No chão; sofre desvantagem em ataques e atacantes próximos ganham vantagem.' },
  { id: 'cego', name: 'Cego', description: 'Falha em testes que exijam visão; ataques sofrem desvantagem e sofrem vantagem contra você.' },
  { id: 'surdo', name: 'Surdo', description: 'Falha automaticamente em testes que exigem audição.' },
  { id: 'apavorado', name: 'Apavorado', description: 'Desvantagem enquanto a fonte do medo estiver à vista; não pode se aproximar dela.' },
  { id: 'incapacitado', name: 'Incapacitado', description: 'Não pode realizar ações ou reações.' },
  { id: 'inconsciente', name: 'Inconsciente', description: 'Incapacitado, cai no chão e solta o que segura.' },
];

// ------------------------------------------------------------------ inventário

export interface SRDItem {
  id: string;
  name: string;
  category: import('./rules').ItemCategory;
  weight: number;
  blurb: string;
  stackable: boolean;
  maxStack: number;
  charges?: number;
  maxCharges?: number;
  equipable?: boolean;
  damageDice?: string;
  damageMod?: number;
  acBonus?: number;
  maxDex?: number;
  ranged?: boolean;
  useEffect?: { kind: 'heal' | 'spell' | 'buff' | 'damage'; spellSlug?: string; amount?: number };
}

export const INVENTORY_ITEMS: SRDItem[] = [
  { id: 'adaga', name: 'Adaga', category: 'weapon', weight: 1, blurb: 'Melee 1 cél., 1d4+2 cortante.', stackable: false, maxStack: 1, equipable: true, damageDice: '1d4', damageMod: 2 },
  { id: 'espada-curta', name: 'Espada Curta', category: 'weapon', weight: 3, blurb: 'Melee 1 cél., 1d6+2 perfurante.', stackable: false, maxStack: 1, equipable: true, damageDice: '1d6', damageMod: 2 },
  { id: 'espada-longa', name: 'Espada Longa', category: 'weapon', weight: 5, blurb: 'Melee 1 cél., 1d8+2 cortante.', stackable: false, maxStack: 1, equipable: true, damageDice: '1d8', damageMod: 2 },
  { id: 'machado', name: 'Machado de Guerra', category: 'weapon', weight: 4, blurb: 'Melee 1 cél., 1d12+3 cortante.', stackable: false, maxStack: 1, equipable: true, damageDice: '1d12', damageMod: 3 },
  { id: 'arco-curto', name: 'Arco Curto', category: 'weapon', weight: 2, blurb: 'Ranged 10 células, 1d6+2 perfurante.', stackable: false, maxStack: 1, equipable: true, damageDice: '1d6', damageMod: 2, ranged: true },
  { id: 'arco-composto', name: 'Arco Composto', category: 'weapon', weight: 4, blurb: 'Ranged 15 células, 1d8+2 perfurante.', stackable: false, maxStack: 1, equipable: true, damageDice: '1d8', damageMod: 2, ranged: true },
  { id: 'besta-leve', name: 'Besta Leve', category: 'weapon', weight: 4, blurb: 'Ranged 30 células, 1d8+2 perfurante.', stackable: false, maxStack: 1, equipable: true, damageDice: '1d8', damageMod: 2, ranged: true },
  { id: 'dardo', name: 'Dardo', category: 'weapon', weight: 1, blurb: 'Ranged 10 células, 1d4+2 perfurante.', stackable: true, maxStack: 10, equipable: true, damageDice: '1d4', damageMod: 2, ranged: true },
  { id: 'funda', name: 'Funda', category: 'weapon', weight: 2, blurb: 'Ranged 10 células, 1d6+2 contundente.', stackable: false, maxStack: 1, equipable: true, damageDice: '1d6', damageMod: 2, ranged: true },
  { id: 'cajado', name: 'Cajado', category: 'weapon', weight: 2, blurb: 'Melee 1 cél., 1d6+2 contundente.', stackable: false, maxStack: 1, equipable: true, damageDice: '1d6', damageMod: 2 },
  { id: 'armadura-couro', name: 'Armadura de Couro', category: 'armor', weight: 10, blurb: 'CA 11+DES. Max DES +6.', stackable: false, maxStack: 1, equipable: true, acBonus: 1, maxDex: 6 },
  { id: 'armadura-camisha', name: 'Camisa de Malha', category: 'armor', weight: 15, blurb: 'CA 13+DES. Max DES +4.', stackable: false, maxStack: 1, equipable: true, acBonus: 3, maxDex: 4 },
  { id: 'armadura-cota', name: 'Cota de Malha', category: 'armor', weight: 30, blurb: 'CA 15+DES. Max DES +2.', stackable: false, maxStack: 1, equipable: true, acBonus: 5, maxDex: 2 },
  { id: 'armadura-placas', name: 'Placas Completas', category: 'armor', weight: 45, blurb: 'CA 18+DES. Max DES +1.', stackable: false, maxStack: 1, equipable: true, acBonus: 7, maxDex: 1 },
  { id: 'escudo-toracal', name: 'Escudo Toracal', category: 'shield', weight: 45, blurb: '+4 CA. -2 Atletismo.', stackable: false, maxStack: 1, equipable: true, acBonus: 4 },
  { id: 'escudo-leve', name: 'Escudo Leve', category: 'shield', weight: 6, blurb: '+1 CA.', stackable: false, maxStack: 1, equipable: true, acBonus: 1 },
  { id: 'escudo-pesado', name: 'Escudo Pesado', category: 'shield', weight: 12, blurb: '+2 CA.', stackable: false, maxStack: 1, equipable: true, acBonus: 2 },
  { id: 'pocao-cura', name: 'Poção de Cura', category: 'consumable', weight: 1, blurb: '2d4+2 PV. Uso único.', stackable: true, maxStack: 5, charges: 1, maxCharges: 1, useEffect: { kind: 'heal', amount: 0 } },
  { id: 'pocao-menor', name: 'Poção Menor', category: 'consumable', weight: 1, blurb: '2d4 PV. Uso único.', stackable: true, maxStack: 5, charges: 1, maxCharges: 1, useEffect: { kind: 'heal', amount: 0 } },
  { id: 'antidoto', name: 'Antídoto', category: 'consumable', weight: 1, blurb: 'Cancela veneno. Uso único.', stackable: true, maxStack: 5, charges: 1, maxCharges: 1, useEffect: { kind: 'buff', amount: 0 } },
  { id: 'pao', name: 'Pão', category: 'consumable', weight: 1, blurb: '1d8+2 PV. Refeição leve.', stackable: true, maxStack: 5, charges: 1, maxCharges: 1, useEffect: { kind: 'heal', amount: 0 } },
  { id: 'agua', name: 'Jarra de Água', category: 'consumable', weight: 2, blurb: 'Satisfaz sede.', stackable: true, maxStack: 5, charges: -1, useEffect: { kind: 'heal', amount: 0 } },
  { id: 'torcha', name: 'Tocha', category: 'consumable', weight: 1, blurb: 'Ilumina 6 células por 1h.', stackable: true, maxStack: 10, charges: 1, maxCharges: 1, useEffect: { kind: 'buff', amount: 0 } },
  { id: 'fera', name: 'Fera', category: 'consumable', weight: 1, blurb: '1d6+2 contundente, 5m.', stackable: true, maxStack: 5, charges: 1, maxCharges: 1, useEffect: { kind: 'damage', amount: 6 } },
  { id: 'perg-escudo', name: 'Pergaminho de Escudo', category: 'scroll', weight: 0, blurb: '1 uso: Escudo (+4 CA).', stackable: true, maxStack: 5, charges: 1, maxCharges: 1, useEffect: { kind: 'spell', spellSlug: 'escudo', amount: 0 } },
  { id: 'perg-curar', name: 'Pergaminho de Curar Ferimentos', category: 'scroll', weight: 0, blurb: '1 uso: Curar Ferimentos (1d8+mod).', stackable: true, maxStack: 5, charges: 1, maxCharges: 1, useEffect: { kind: 'spell', spellSlug: 'curar-ferimentos', amount: 0 } },
  { id: 'perg-misseis', name: 'Pergaminho de Mísseis Mágicos', category: 'scroll', weight: 0, blurb: '1 uso: 3 mísseis mágicos.', stackable: true, maxStack: 5, charges: 1, maxCharges: 1, useEffect: { kind: 'spell', spellSlug: 'misseis-magicos', amount: 0 } },
  { id: 'perg-raio-fogo', name: 'Pergaminho de Raio de Fogo', category: 'scroll', weight: 0, blurb: '1 uso: Raio de Fogo (1d10).', stackable: true, maxStack: 5, charges: 1, maxCharges: 1, useEffect: { kind: 'spell', spellSlug: 'raio-de-fogo', amount: 0 } },
  { id: 'perg-invisibilidade', name: 'Pergaminho de Invisibilidade', category: 'scroll', weight: 0, blurb: '1 uso: Invisibilidade (1h).', stackable: true, maxStack: 5, charges: 1, maxCharges: 1, useEffect: { kind: 'buff', amount: 0 } },
  { id: 'grimorio-fogo', name: 'Grimório de Fogo', category: 'grimoire', weight: 3, blurb: 'Concede Raio de Fogo permanente.', stackable: false, maxStack: 1, equipable: true },
  { id: 'grimorio-gelo', name: 'Grimório de Gelo', category: 'grimoire', weight: 3, blurb: 'Concede Chicote Espinhoso permanente.', stackable: false, maxStack: 1, equipable: true },
  { id: 'grimorio-luz', name: 'Grimório de Luz', category: 'grimoire', weight: 3, blurb: 'Concede Luz permanente.', stackable: false, maxStack: 1, equipable: true },
  { id: 'moeda-prata', name: 'Moeda de Prata', category: 'loot', weight: 0, blurb: 'Pilha de 100.', stackable: true, maxStack: 100, charges: -1 },
  { id: 'moeda-ouro', name: 'Moeda de Ouro', category: 'loot', weight: 0, blurb: 'Pilha de 50.', stackable: true, maxStack: 50, charges: -1 },
  { id: 'pedra-premiada', name: 'Pedra Premiada', category: 'loot', weight: 0, blurb: 'Valor 100-500 moedas.', stackable: false, maxStack: 1, charges: -1 },
  { id: 'chave-iron', name: 'Chave de Ferro', category: 'loot', weight: 1, blurb: 'Abre trancas comuns.', stackable: true, maxStack: 5, charges: -1 },
];
