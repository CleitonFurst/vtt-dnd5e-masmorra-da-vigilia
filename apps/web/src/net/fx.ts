/** Barramento de efeitos visuais: rede -> cena Pixi (sem acoplamento direto). */

export interface HpFloatFx {
  tokenId: string;
  delta: number;
  dead: boolean;
}

export interface TextFloatFx {
  tokenId: string;
  text: string;
  color: number;
}

const hpSubs = new Set<(f: HpFloatFx) => void>();
const textSubs = new Set<(f: TextFloatFx) => void>();

export function onHpFloat(fn: (f: HpFloatFx) => void): () => void {
  hpSubs.add(fn);
  return () => hpSubs.delete(fn);
}

export function onTextFloat(fn: (f: TextFloatFx) => void): () => void {
  textSubs.add(fn);
  return () => textSubs.delete(fn);
}

export function emitHpFloat(f: HpFloatFx): void {
  hpSubs.forEach((s) => s(f));
}

export function emitTextFloat(f: TextFloatFx): void {
  textSubs.forEach((s) => s(f));
}
