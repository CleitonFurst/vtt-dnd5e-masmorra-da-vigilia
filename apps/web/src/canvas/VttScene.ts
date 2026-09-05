import { Application, Container, Graphics, Rectangle, Text, Ticker } from 'pixi.js';
import { cellKey, type GameMap, type Token, type DrawStroke, type MapItem, type ItemCategory } from '@vtt/shared';
import type { Tool } from '../store';

export interface SceneSyncState {
  map: GameMap;
  tokens: Token[];
  items: import('@vtt/shared').MapItem[];
  selectedId: string | null;
  targetedId: string | null;
  drawings?: DrawStroke[];
  selectedDrawingId?: string | null;
  shapeFilled?: boolean;
}

export interface SceneCallbacks {
  getTool(): Tool;
  getDrawColor?(): number;
  getDrawSize?(): number;
  isDm(): boolean;
  canControl(token: Token): boolean;
  onTokenMove(id: string, x: number, y: number): void;
  onTokenClick(id: string): void;
  onItemMove(id: string, x: number, y: number): void;
  onItemRemove(id: string): void;
  onItemClick(item: { id: string; itemId: string; x: number; y: number; name: string }): void;
  onEmptyClick(): void;
  onWallAdd(x1: number, y1: number, x2: number, y2: number): void;
  onWallRemove(x1: number, y1: number, x2: number, y2: number): void;
  onOpenSheet(tokenId: string): void;
  onFogPaint(cells: string[], mode: 'hide' | 'reveal'): void;
  onDraw(stroke: DrawStroke): void;
  onDrawErase(ids: string[]): void;
  onDrawMove(id: string, dx: number, dy: number): void;
  onUndo(): void;
  onRedo(): void;
  getStickyBg?(): number;
}

interface DragState {
  tokenId: string;
  offsetX: number;
  offsetY: number;
  moved: boolean;
  /** ponto onde o dedo/mouse agarrou (para limiar de arrasto) */
  gx: number;
  gy: number;
}

const COLOR_BG = 0x14141b;
const COLOR_GRID = 0x262b36;
const COLOR_WALL = 0xeab308;

function segSegIntersect(
  p1x: number, p1y: number, p2x: number, p2y: number,
  p3x: number, p3y: number, p4x: number, p4y: number,
): boolean {
  const d = (p2x - p1x) * (p4y - p3y) - (p2y - p1y) * (p4x - p3x);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((p3x - p1x) * (p4y - p3y) - (p3y - p1y) * (p4x - p3x)) / d;
  const u = ((p3x - p1x) * (p2y - p1y) - (p3y - p1y) * (p2x - p1x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(v, max));

function distPointSeg(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

export class VttScene {
  private app = new Application();
  private ready = false;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private gridG = new Graphics();
  private terrainG = new Graphics();
  private terrainDone = false;
  private wallG = new Graphics();
  private fogG = new Graphics();
  private tokenLayer = new Container();
  private wallPreviewG = new Graphics();
  private inspectG = new Graphics();
  private itemLayer = new Container();
  private itemViews = new Map<string, Container>();
  private pulseG = new Graphics();
  private uiG = new Graphics();
  private fxLayer = new Container();

  private tokenViews = new Map<string, Container>();
  /** posições-alvo para interpolação suave (lerp por frame) */
  private desired = new Map<string, { x: number; y: number }>();
  /** assinatura visual renderizada por token — evita reconstruir a cada sync */
  private tokenMeta = new Map<string, string>();
  /** nº de traços no último redraw — evita redesenhar a tinta a cada sync */
  private lastInkLen = -1;
  private lastDrawingsRef: unknown = null;
  private lastSelectedDrawing: string | null = null;
  private syncState: SceneSyncState | null = null;
  private visibleCells = new Set<string>();

  private drag: DragState | null = null;
  private itemDrag: DragState | null = null;
  private wallStart: { x: number; y: number } | null = null;
  private paintingFog = false;
  private paintedCells = new Set<string>();

  /** desenho colaborativo: camada persistente + traço em andamento */
  private inkG = new Graphics();
  private inkTextLayer = new Container();
  private inkLiveG = new Graphics();
  private activeStroke: DrawStroke | null = null;
  /** borracha: caminho do cursor e traços marcados para apagar */
  private erasePath: { x: number; y: number }[] | null = null;
  private eraseMarked = new Set<string>();
  /** fantasma da célula de destino durante o arrasto de token */
  private dragGhostG = new Graphics();
  private dragBaseScale = 1;
  /** último destino pré-visualizado (já limitado pelo alcance em combate) */
  private dragGhostPos: { x: number; y: number } | null = null;

  /** preview de forma durante o arrasto (rect/circle/line) */
  private shapePreviewG = new Graphics();
  private shapeStart: { x: number; y: number } | null = null;

  /** seleção e arrasto de desenhos */
  private drawingDragG = new Graphics();
  private drawingDrag: { id: string; startPx: { x: number; y: number }; currentPx: { x: number; y: number } } | null = null;

  /** câmera livre: pan + zoom (o ajuste inicial mostra o mapa inteiro) */
  private cam = { x: 0, y: 0, scale: 1 };
  /** alvo da câmera: zoom/pan deslizam suavemente até ele */
  private camTarget = { x: 0, y: 0, scale: 1 };
  private camInit = false;
  private pan: { ssx: number; ssy: number; cx: number; cy: number; moved: boolean } | null = null;

  constructor(private callbacks: SceneCallbacks) {}

  async init(container: HTMLElement): Promise<void> {
    this.container = container;
    await this.app.init({
      background: COLOR_BG,
      antialias: true,
      resizeTo: container,
    });
    container.appendChild(this.app.canvas);
    this.app.canvas.style.display = 'block';

    this.app.stage.addChild(
      this.terrainG,
      this.gridG,
      this.wallG,
      this.fogG,
      this.dragGhostG,
      this.tokenLayer,
      this.inspectG,
      this.itemLayer,
      this.inkG,
      this.inkTextLayer,
      this.inkLiveG,
      this.wallPreviewG,
      this.shapePreviewG,
      this.drawingDragG,
      this.pulseG,
      this.uiG,
      this.fxLayer,
    );
    this.app.stage.eventMode = 'static';
    // área clicável cobre o MUNDO inteiro independente da câmera
    // (usar app.screen aqui quebrava cliques fora do canto superior-esquerdo)
    const R = 100_000;
    this.app.stage.hitArea = new Rectangle(-R, -R, R * 2, R * 2);

    this.app.stage.on('pointerdown', this.onPointerDown);
    this.app.stage.on('pointermove', this.onPointerMove);
    this.app.stage.on('pointerup', this.onPointerUp as (e: unknown) => void);
    this.app.stage.on('pointerupoutside', this.onPointerUp as (e: unknown) => void);

    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(container);
    this.app.ticker.add(this.onTick);
    this.app.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.app.canvas.addEventListener('contextmenu', this.onContextMenu);
    this.ready = true;
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (!this.ready) return;
    this.ready = false;
    this.app.ticker.remove(this.onTick);
    this.app.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.app.destroy(true, { children: true });
  }

  sync(state: SceneSyncState): void {
    if (!this.ready) return;
    this.syncState = state;
    if (!this.terrainDone) {
      this.drawTerrain(state.map);
      this.terrainDone = true;
    }
    this.computeVisibility(state);
    this.computeVisibility(state);
    this.drawGrid(state.map);
    this.drawWalls(state.map);
    this.drawTokens(state);
    this.drawItems(state);
    this.drawFog(state.map);
    // a tinta só é redesenhada quando a quantidade de traços ou seleção muda
    const n = state.drawings?.length ?? 0;
    const selDraw = state.selectedDrawingId ?? null;
    if (n !== this.lastInkLen || state.drawings !== this.lastDrawingsRef || selDraw !== this.lastSelectedDrawing) {
      this.lastInkLen = n;
      this.lastDrawingsRef = state.drawings;
      this.lastSelectedDrawing = selDraw;
      this.eraseMarked.clear();
      this.redrawInk();
    }
    this.updateRings(state);
    this.layout();
  }

  // -------------------------------------------------------------- coordenadas
  private get cellSize(): number {
    return this.syncState?.map.cellSize ?? 64;
  }

  private toWorld(e: { global: { x: number; y: number } }): { x: number; y: number } {
    const p = this.app.stage.toLocal(e.global);
    return { x: p.x, y: p.y };
  }

  // ------------------------------------------------------------------ câmera
  private applyCamera(): void {
    this.app.stage.scale.set(this.cam.scale);
    this.app.stage.position.set(this.cam.x, this.cam.y);
  }

  /** Enquadra o mapa inteiro (também é o estado inicial). */
  resetView(): void {
    if (!this.container) return;
    const cw = this.container.clientWidth || 1;
    const ch = this.container.clientHeight || 1;
    if (cw < 60 || ch < 60) {
      this.camInit = false; // mede de novo quando o container tiver tamanho real
      return;
    }
    const s = Math.min(cw / this.worldWidth(), ch / this.worldHeight()) * 0.96;
    this.cam = { scale: s, x: (cw - this.worldWidth() * s) / 2, y: (ch - this.worldHeight() * s) / 2 };
    this.camTarget = { ...this.cam };
    this.camInit = true;
    this.applyCamera();
  }

  zoomAt(factor: number, screenX?: number, screenY?: number): void {
    if (!this.container) return;
    const cw = this.container.clientWidth || 1;
    const ch = this.container.clientHeight || 1;
    const mx = screenX ?? cw / 2;
    const my = screenY ?? ch / 2;
    const fit = Math.min(cw / this.worldWidth(), ch / this.worldHeight());
    // âncora no ALVO: o ponto do mundo sob o cursor permanece fixo durante o glide
    const wx = (mx - this.camTarget.x) / this.camTarget.scale;
    const wy = (my - this.camTarget.y) / this.camTarget.scale;
    const ns = clamp(this.camTarget.scale * factor, fit * 0.5, 4.5);
    if (ns === this.camTarget.scale) return;
    this.camTarget.scale = ns;
    this.camTarget.x = mx - wx * ns;
    this.camTarget.y = my - wy * ns;
  }

  zoomIn(): void {
    this.zoomAt(1.25);
  }

  zoomOut(): void {
    this.zoomAt(1 / 1.25);
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    this.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left, e.clientY - rect.top);
  };

  private onContextMenu = (e: MouseEvent): void => {
    if (!this.syncState || !this.callbacks.isDm()) return;
    e.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const local = this.app.stage.toLocal({ x: screenX, y: screenY });
    const p = { x: local.x, y: local.y };
    const itemHit = this.itemAt(p);
    if (itemHit && confirm('Excluir este item do mapa?')) {
      this.callbacks.onItemRemove(itemHit.id);
    }
  };

  // ----------------------------------------------------------------- eventos
  /** mantém os eventos de ponteiro presos ao canvas mesmo sobre painéis da UI */
  private capturedPointerId: number | null = null;
  private inspectRects: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
  private inspectSig = '';

  private capturePointer(e: { pointerId?: number }): void {
    const pid = e.pointerId;
    const cv = this.app.canvas as HTMLCanvasElement;
    if (typeof pid !== 'number' || typeof cv.setPointerCapture !== 'function') return;
    try {
      cv.setPointerCapture(pid);
      this.capturedPointerId = pid;
    } catch {
      /* navegador recusou — segue sem captura */
    }
  }

  private releasePointer(): void {
    if (this.capturedPointerId === null) return;
    const cv = this.app.canvas as HTMLCanvasElement;
    try {
      cv.releasePointerCapture(this.capturedPointerId);
    } catch {
      /* já liberado */
    }
    this.capturedPointerId = null;
  }

  private onPointerDown = (e: any): void => {
    if (!this.syncState) return;
    if (e.button === 2) return;
    this.capturePointer(e);
    const tool = this.callbacks.getTool();
    const p = this.toWorld(e);

    if (tool === 'wall') {
      this.wallStart = { x: Math.round(p.x / this.cellSize) * this.cellSize, y: Math.round(p.y / this.cellSize) * this.cellSize };
      return;
    }
    if (tool === 'wallErase') {
      const seg = this.nearestWall(p, Math.max(12, this.cellSize * 0.35));
      if (seg) this.callbacks.onWallRemove(seg.x1, seg.y1, seg.x2, seg.y2);
      return;
    }
    if (tool === 'fogHide' || tool === 'fogReveal') {
      this.paintingFog = true;
      this.paintedCells.clear();
      this.paintCellAt(p);
      return;
    }
    if (tool === 'draw') {
      const color = this.callbacks.getDrawColor?.() ?? 0xeab308;
      const size = this.callbacks.getDrawSize?.() ?? 4;
      this.activeStroke = {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        points: [{ x: Math.round(p.x), y: Math.round(p.y) }],
        color,
        size,
        author: '',
      };
      this.inkLiveG.clear();
      this.renderStroke(this.inkLiveG, this.activeStroke);
      return;
    }
    if (tool === 'rect' || tool === 'circle' || tool === 'line') {
      this.shapeStart = { x: p.x, y: p.y };
      this.inkLiveG.clear();
      return;
    }
    if (tool === 'text') {
      this.spawnTextAt(p);
      return;
    }
    if (tool === 'sticky') {
      this.spawnStickyAt(p);
      return;
    }
    if (tool === 'erase') {
      this.erasePath = [p];
      this.eraseMarked.clear();
      this.eraseHitTest(p);
      this.drawEraseCursor(p);
      return;
    }

    const btn = this.inspectRects.find((r) => p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2);
    if (btn) {
      const tok = this.syncState?.tokens.find((t) => t.id === btn.id);
      if (tok && !tok.dead) {
        this.callbacks.onOpenSheet(btn.id);
        return;
      }
    }

    // ferramenta select: checar clique em desenho primeiro
    if (tool === 'select') {
      this.syncState.selectedDrawingId = null;
    }

    const hit = this.tokenAt(p);
    if (!hit) {
      const itemHit = this.itemAt(p);
      if (itemHit) {
        if (this.callbacks.isDm()) {
          this.itemDrag = { tokenId: itemHit.id, offsetX: p.x - itemHit.x, offsetY: p.y - itemHit.y, moved: false, gx: p.x, gy: p.y };
          const view = this.itemViews.get(itemHit.id);
          if (view) {
            this.dragBaseScale = view.scale.x;
            view.scale.set(this.dragBaseScale * 1.15);
            this.itemLayer.removeChild(view);
            this.itemLayer.addChild(view);
          }
          return;
        }
        this.callbacks.onItemClick({ id: itemHit.id, itemId: itemHit.itemId, x: itemHit.x, y: itemHit.y, name: itemHit.name });
        return;
      }
      // check drawing hit only if nothing else was hit
      if (tool === 'select') {
        const hitDrawing = this.drawingAt(p);
        if (hitDrawing) {
          this.syncState.selectedDrawingId = hitDrawing.id;
          this.drawingDrag = { id: hitDrawing.id, startPx: { x: p.x, y: p.y }, currentPx: { x: p.x, y: p.y } };
          return;
        }
      }
      // arrastar o vazio move a câmera; clique curto desseleciona
      this.pan = { ssx: e.screen.x, ssy: e.screen.y, cx: this.cam.x, cy: this.cam.y, moved: false };
      return;
    }
    if (this.callbacks.canControl(hit)) {
      this.drag = { tokenId: hit.id, offsetX: p.x - hit.x, offsetY: p.y - hit.y, moved: false, gx: p.x, gy: p.y };
      const view = this.tokenViews.get(hit.id);
      if (view) {
        this.dragBaseScale = view.scale.x;
        view.scale.set(this.dragBaseScale * 1.07);
        // traz o token arrastado para a frente da camada
        this.tokenLayer.removeChild(view);
        this.tokenLayer.addChild(view);
      }
    } else {
      this.callbacks.onTokenClick(hit.id);
    }
  };

  private onPointerMove = (e: any): void => {
    if (!this.syncState) return;
    const p = this.toWorld(e);

    if (this.pan) {
      const dx = e.screen.x - this.pan.ssx;
      const dy = e.screen.y - this.pan.ssy;
      if (Math.abs(dx) + Math.abs(dy) > 4) this.pan.moved = true;
      this.cam.x = this.pan.cx + dx;
      this.cam.y = this.pan.cy + dy;
      this.camTarget.x = this.cam.x;
      this.camTarget.y = this.cam.y;
      this.applyCamera();
      return;
    }

    // arrasto de desenho selecionado
    if (this.drawingDrag) {
      this.drawingDrag.currentPx = { x: p.x, y: p.y };
      const dx = p.x - this.drawingDrag.startPx.x;
      const dy = p.y - this.drawingDrag.startPx.y;
      const g = this.drawingDragG;
      g.clear();
      g.rect(0, 0, Math.abs(dx), Math.abs(dy)).stroke({ width: 2, color: 0x22c55e, alpha: 0.7 });
      return;
    }

    if (this.drag) {
      // limiar de 4px: clique não vira arrasto (nem queima movimento em combate)
      if (!this.drag.moved && Math.hypot(p.x - this.drag.gx, p.y - this.drag.gy) < 4) return;
      const token = this.syncState.tokens.find((t) => t.id === this.drag!.tokenId);
      const view = this.tokenViews.get(this.drag.tokenId);
      if (!token || !view) return;
      const size = token.sizeCells * this.cellSize;
      const nx = p.x - this.drag.offsetX;
      const ny = p.y - this.drag.offsetY;
      this.drag.moved = true;
      view.x = nx;
      view.y = ny;
      // fantasma da célula de encaixe
      const cs = this.cellSize;
      let sx = Math.round(nx / cs) * cs;
      let sy = Math.round(ny / cs) * cs;
      const ghostColor = COLOR_WALL;
      const g = this.dragGhostG;
      g.clear();
      g.rect(sx + 2, sy + 2, size - 4, size - 4).fill({ color: ghostColor, alpha: 0.18 });
      g.rect(sx + 2, sy + 2, size - 4, size - 4).stroke({ width: 2.5, color: ghostColor, alpha: 0.85 });
      this.dragGhostPos = { x: sx, y: sy };
      return;
    }

    if (this.itemDrag) {
      if (!this.itemDrag.moved && Math.hypot(p.x - this.itemDrag.gx, p.y - this.itemDrag.gy) < 4) return;
      const view = this.itemViews.get(this.itemDrag.tokenId);
      if (!view) return;
      const cs = this.cellSize;
      const nx = p.x - this.itemDrag.offsetX;
      const ny = p.y - this.itemDrag.offsetY;
      this.itemDrag.moved = true;
      view.x = nx;
      view.y = ny;
      return;
    }

    if (this.erasePath) {
      const last = this.erasePath[this.erasePath.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) > 4) {
        this.erasePath.push(p);
        this.eraseHitTest(p);
        this.drawEraseCursor(p);
      }
      return;
    }

    if (this.activeStroke) {
      const pts = this.activeStroke.points;
      const last = pts[pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) > 2) {
        pts.push({ x: Math.round(p.x), y: Math.round(p.y) });
        this.inkLiveG.clear();
        this.renderStroke(this.inkLiveG, this.activeStroke);
      }
      return;
    }

    if (this.shapeStart) {
      const tool = this.callbacks.getTool();
      const color = this.callbacks.getDrawColor?.() ?? 0xeab308;
      const size = this.callbacks.getDrawSize?.() ?? 4;
      const filled = this.syncState?.shapeFilled;
      const g = this.inkLiveG;
      g.clear();
      if (tool === 'rect') {
        const x = Math.min(this.shapeStart.x, p.x);
        const y = Math.min(this.shapeStart.y, p.y);
        const w = Math.abs(p.x - this.shapeStart.x);
        const h = Math.abs(p.y - this.shapeStart.y);
        if (filled) { g.rect(x, y, w, h); g.fill({ color, alpha: 0.35 }); }
        g.rect(x, y, w, h);
        g.stroke({ width: size, color, alpha: 0.75 });
      } else if (tool === 'circle') {
        const cx = (this.shapeStart.x + p.x) / 2;
        const cy = (this.shapeStart.y + p.y) / 2;
        const rx = Math.abs(p.x - this.shapeStart.x) / 2;
        const ry = Math.abs(p.y - this.shapeStart.y) / 2;
        if (filled) { g.ellipse(cx, cy, rx, ry); g.fill({ color, alpha: 0.35 }); }
        g.ellipse(cx, cy, rx, ry);
        g.stroke({ width: size, color, alpha: 0.75 });
      } else if (tool === 'line') {
        g.moveTo(this.shapeStart.x, this.shapeStart.y);
        g.lineTo(p.x, p.y);
        g.stroke({ width: size, color, alpha: 0.75, cap: 'round' });
      }
      return;
    }

    if (this.wallStart) {
      const g = this.wallPreviewG;
      g.clear();
      const ex = Math.round(p.x / this.cellSize) * this.cellSize;
      const ey = Math.round(p.y / this.cellSize) * this.cellSize;
      g.moveTo(this.wallStart.x, this.wallStart.y).lineTo(ex, ey).stroke({ width: 4, color: COLOR_WALL, alpha: 0.6 });
      return;
    }

    if (this.paintingFog) this.paintCellAt(p);
  };

  private onPointerUp = (e?: { global: { x: number; y: number } }): void => {
    this.releasePointer();
    if (this.drawingDrag) {
      const dd = this.drawingDrag;
      this.drawingDrag = null;
      this.drawingDragG.clear();
      const dx = Math.round(dd.currentPx.x - dd.startPx.x);
      const dy = Math.round(dd.currentPx.y - dd.startPx.y);
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        this.callbacks.onDrawMove(dd.id, dx, dy);
      }
      return;
    }
    if (this.erasePath) {
      this.erasePath = null;
      this.inkLiveG.clear();
      const ids = [...this.eraseMarked];
      this.eraseMarked.clear();
      if (ids.length > 0) this.callbacks.onDrawErase(ids);
      return;
    }

    if (this.activeStroke) {
      const s = this.activeStroke;
      this.activeStroke = null;
      this.inkLiveG.clear();
      if (s.points.length >= 1) this.callbacks.onDraw(s);
      return;
    }

    if (this.shapeStart) {
      const tool = this.callbacks.getTool();
      const color = this.callbacks.getDrawColor?.() ?? 0xeab308;
      const size = this.callbacks.getDrawSize?.() ?? 4;
      const start = this.shapeStart;
      this.shapeStart = null;
      this.inkLiveG.clear();
      const ep = e ? this.toWorld(e) : null;
      if (!ep) return;
      if (tool === 'rect') {
        const x = Math.min(start.x, ep.x);
        const y = Math.min(start.y, ep.y);
        const w = Math.abs(ep.x - start.x);
        const h = Math.abs(ep.y - start.y);
        if (w > 2 || h > 2) {
          this.callbacks.onDraw({
            id: Math.random().toString(36).slice(2) + Date.now().toString(36),
            points: [{ x: Math.round(start.x), y: Math.round(start.y) }, { x: Math.round(ep.x), y: Math.round(ep.y) }],
            color, size, author: '', shape: 'rect', filled: this.syncState?.shapeFilled,
          });
        }
      } else if (tool === 'circle') {
        if (Math.hypot(ep.x - start.x, ep.y - start.y) > 2) {
          this.callbacks.onDraw({
            id: Math.random().toString(36).slice(2) + Date.now().toString(36),
            points: [{ x: Math.round(start.x), y: Math.round(start.y) }, { x: Math.round(ep.x), y: Math.round(ep.y) }],
            color, size, author: '', shape: 'circle', filled: this.syncState?.shapeFilled,
          });
        }
      } else if (tool === 'line') {
        if (Math.hypot(ep.x - start.x, ep.y - start.y) > 2) {
          this.callbacks.onDraw({
            id: Math.random().toString(36).slice(2) + Date.now().toString(36),
            points: [{ x: Math.round(start.x), y: Math.round(start.y) }, { x: Math.round(ep.x), y: Math.round(ep.y) }],
            color, size, author: '', shape: 'line',
          });
        }
      }
      return;
    }

    if (this.pan) {
      const wasClick = !this.pan.moved;
      this.pan = null;
      if (wasClick) this.callbacks.onEmptyClick();
      return;
    }

    if (this.drag) {
      const d = this.drag;
      this.drag = null;
      this.dragGhostG.clear();
      const view = this.tokenViews.get(d.tokenId);
      if (view) view.scale.set(this.dragBaseScale || 1);
      const token = this.syncState?.tokens.find((t) => t.id === d.tokenId);
      if (view && token && d.moved) {
        const cs = this.cellSize;
        const size = token.sizeCells * cs;
        // usa o destino pré-visualizado quando existir (combate já limitado)
        let sx = Math.round(view.x / cs) * cs;
        let sy = Math.round(view.y / cs) * cs;
        if (this.dragGhostPos) {
          sx = this.dragGhostPos.x;
          sy = this.dragGhostPos.y;
        }
        this.dragGhostPos = null;
        view.x = sx;
        view.y = sy;
        this.callbacks.onTokenMove(d.tokenId, sx, sy);
      } else {
        this.dragGhostPos = null;
        this.callbacks.onTokenClick(d.tokenId);
      }
      return;
    }

    if (this.itemDrag) {
      const d = this.itemDrag;
      this.itemDrag = null;
      const view = this.itemViews.get(d.tokenId);
      if (view) view.scale.set(this.dragBaseScale || 1);
      if (view && d.moved) {
        const cs = this.cellSize;
        const sx = Math.round(view.x / cs) * cs;
        const sy = Math.round(view.y / cs) * cs;
        view.x = sx;
        view.y = sy;
        this.callbacks.onItemMove(d.tokenId, sx, sy);
      }
      return;
    }

    if (this.wallStart) {
      const start = this.wallStart;
      this.wallStart = null;
      this.wallPreviewG.clear();
      if (e) {
        const p = this.toWorld(e);
        const ex = Math.round(p.x / this.cellSize) * this.cellSize;
        const ey = Math.round(p.y / this.cellSize) * this.cellSize;
        if (Math.hypot(ex - start.x, ey - start.y) > 4) {
          this.callbacks.onWallAdd(start.x, start.y, ex, ey);
        }
      }
      return;
    }

    if (this.paintingFog) {
      this.paintingFog = false;
      const cells = [...this.paintedCells];
      this.paintedCells.clear();
      if (cells.length > 0) {
        const mode = this.callbacks.getTool() === 'fogHide' ? 'hide' : 'reveal';
        this.callbacks.onFogPaint(cells, mode);
      }
    }
  };

  private paintCellAt(p: { x: number; y: number }): void {
    const cs = this.cellSize;
    const cx = Math.floor(p.x / cs);
    const cy = Math.floor(p.y / cs);
    if (cx < 0 || cy < 0 || !this.syncState) return;
    if (cx >= this.syncState.map.widthCells || cy >= this.syncState.map.heightCells) return;
    this.paintedCells.add(cellKey(cx, cy));
  }

  // ---------------------------------------------------- desenho colaborativo

  /** cria um DrawStroke de texto via prompt e envia */
  private spawnTextAt(p: { x: number; y: number }): void {
    const text = prompt('Texto para colocar no mapa:');
    if (!text || !text.trim()) return;
    const color = this.callbacks.getDrawColor?.() ?? 0xeab308;
    this.callbacks.onDraw({
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      points: [{ x: Math.round(p.x), y: Math.round(p.y) }],
      color, size: 2, author: '', shape: 'text', text: text.trim(), fontSize: 18,
    });
  }

  /** cria um sticky note via prompt e envia */
  private spawnStickyAt(p: { x: number; y: number }): void {
    const text = prompt('Nota adesiva:');
    if (!text || !text.trim()) return;
    this.callbacks.onDraw({
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      points: [{ x: Math.round(p.x - 70), y: Math.round(p.y - 15) }, { x: Math.round(p.x + 70), y: Math.round(p.y + 55) }],
      color: 0x1f2937, size: 2, author: '', shape: 'sticky', text: text.trim(), fontSize: 14,
      stickyBg: this.callbacks.getStickyBg?.() ?? 0xfde68a,
    });
  }

  /** bounding box de um desenho (para hit-test) */
  private drawingBBox(d: DrawStroke): { x1: number; y1: number; x2: number; y2: number } {
    const pts = d.points;
    if (pts.length === 0) return { x1: 0, y1: 0, x2: 0, y2: 0 };
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const pt of pts) {
      if (pt.x < x1) x1 = pt.x;
      if (pt.y < y1) y1 = pt.y;
      if (pt.x > x2) x2 = pt.x;
      if (pt.y > y2) y2 = pt.y;
    }
    const pad = (d.size * 2) + 6;
    return { x1: x1 - pad, y1: y1 - pad, x2: x2 + pad, y2: y2 + pad };
  }

  /** retorna o desenho sob o ponto p (mais recente = cima) */
  private drawingAt(p: { x: number; y: number }): DrawStroke | null {
    if (!this.syncState) return null;
    const drawings = this.syncState.drawings ?? [];
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      const bb = this.drawingBBox(d);
      if (p.x >= bb.x1 && p.x <= bb.x2 && p.y >= bb.y1 && p.y <= bb.y2) return d;
    }
    return null;
  }

  private redrawInk(): void {
    this.inkG.clear();
    // destrói texto antigo do layer dedicado
    while (this.inkTextLayer.children.length > 0) {
      this.inkTextLayer.children[0].destroy({ children: true });
    }
    const selectedId = this.syncState?.selectedDrawingId ?? null;
    for (const s of this.syncState?.drawings ?? []) {
      if (this.eraseMarked.has(s.id)) continue;
      this.renderStroke(this.inkG, s);
      if (s.id === selectedId) {
        const bb = this.drawingBBox(s);
        this.inkG.rect(bb.x1, bb.y1, bb.x2 - bb.x1, bb.y2 - bb.y1);
        this.inkG.stroke({ width: 2, color: 0x22c55e, alpha: 0.8 });
      }
    }
  }

  /** curva suave estilo Paint + formas (rect, circle, line, text) */
  private renderStroke(
    g: Graphics,
    s: DrawStroke,
  ): void {
    const shape = s.shape ?? 'freehand';
    const pts = s.points;

    if (shape === 'text') {
      if (pts.length === 0 || !s.text) return;
      const label = new Text({
        text: s.text,
        style: {
          fontFamily: 'system-ui, sans-serif',
          fontSize: s.fontSize ?? 18,
          fill: s.color,
          stroke: { color: 0x000000, width: 3 },
        },
      });
      label.anchor.set(0, 0.5);
      label.x = pts[0].x;
      label.y = pts[0].y;
      label.eventMode = 'none';
      this.inkTextLayer.addChild(label);
      return;
    }

    if (shape === 'sticky' && pts.length >= 2 && s.text) {
      const x = Math.min(pts[0].x, pts[1].x);
      const y = Math.min(pts[0].y, pts[1].y);
      const w = Math.abs(pts[1].x - pts[0].x);
      const h = Math.abs(pts[1].y - pts[0].y);
      if (w < 1 && h < 1) return;
      // shadow
      g.roundRect(x + 3, y + 3, w, h, 6);
      g.fill({ color: 0x000000, alpha: 0.18 });
      // background
      g.roundRect(x, y, w, h, 6);
      g.fill({ color: s.stickyBg ?? 0xfde68a, alpha: 0.92 });
      g.stroke({ width: 1, color: 0x000000, alpha: 0.08 });
      // text
      const label = new Text({
        text: s.text,
        style: {
          fontFamily: 'system-ui, sans-serif',
          fontSize: s.fontSize ?? 14,
          fill: s.color,
          wordWrap: true,
          wordWrapWidth: w - 16,
        },
      });
      label.x = x + 8;
      label.y = y + 8;
      label.eventMode = 'none';
      this.inkTextLayer.addChild(label);
      return;
    }

    if (shape === 'rect' && pts.length >= 2) {
      const x = Math.min(pts[0].x, pts[1].x);
      const y = Math.min(pts[0].y, pts[1].y);
      const w = Math.abs(pts[1].x - pts[0].x);
      const h = Math.abs(pts[1].y - pts[0].y);
      if (w < 1 && h < 1) return;
      if (s.filled) {
        g.rect(x, y, w, h);
        g.fill({ color: s.color, alpha: 0.35 });
      }
      g.rect(x, y, w, h);
      g.stroke({ width: s.size * 2, color: s.color, alpha: 0.92 });
      return;
    }
    if (shape === 'circle' && pts.length >= 2) {
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      const rx = Math.abs(pts[1].x - pts[0].x) / 2;
      const ry = Math.abs(pts[1].y - pts[0].y) / 2;
      if (rx < 1 && ry < 1) return;
      if (s.filled) {
        g.ellipse(cx, cy, rx, ry);
        g.fill({ color: s.color, alpha: 0.35 });
      }
      g.ellipse(cx, cy, rx, ry);
      g.stroke({ width: s.size * 2, color: s.color, alpha: 0.92 });
      return;
    }
    if (shape === 'line' && pts.length >= 2) {
      g.moveTo(pts[0].x, pts[0].y);
      g.lineTo(pts[1].x, pts[1].y);
      g.stroke({ width: s.size * 2, color: s.color, cap: 'round', alpha: 0.92 });
      return;
    }

    // freehand (padrão)
    if (pts.length === 0) return;
    if (pts.length === 1) {
      g.circle(pts[0].x, pts[0].y, s.size);
      g.fill({ color: s.color, alpha: 0.92 });
      return;
    }
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      g.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    g.lineTo(last.x, last.y);
    g.stroke({ width: s.size * 2, color: s.color, cap: 'round', join: 'round', alpha: 0.92 });
  }

  // ------------------------------------------------------------- borracha
  private eraseHitTest(p: { x: number; y: number }): void {
    if (!this.syncState) return;
    const r = Math.max(10, (this.callbacks.getDrawSize?.() ?? 4) * 3);
    for (const s of this.syncState.drawings ?? []) {
      if (this.eraseMarked.has(s.id)) continue;
      const pts = s.points;
      if (pts.length === 1) {
        if (Math.hypot(pts[0].x - p.x, pts[0].y - p.y) < r + s.size * 2) this.eraseMarked.add(s.id);
        continue;
      }
      let hit = false;
      for (let i = 0; i < pts.length - 1 && !hit; i++) {
        if (distPointSeg(p.x, p.y, pts[i], pts[i + 1]) < r + s.size * 2) hit = true;
      }
      if (hit) this.eraseMarked.add(s.id);
    }
    this.redrawInk();
  }

  private drawEraseCursor(p: { x: number; y: number }): void {
    const g = this.inkLiveG;
    g.clear();
    const r = Math.max(10, (this.callbacks.getDrawSize?.() ?? 4) * 3);
    g.circle(p.x, p.y, r).stroke({ width: 1.5, color: 0xef4444, alpha: 0.85 });
  }

  private worldWidth(): number {
    return (this.syncState?.map.widthCells ?? 0) * this.cellSize;
  }

  private worldHeight(): number {
    return (this.syncState?.map.heightCells ?? 0) * this.cellSize;
  }

  private tokenAt(p: { x: number; y: number }): Token | null {
    if (!this.syncState) return null;
    const dm = this.callbacks.isDm();
    // testa de trás para frente usando a posição VISUAL (o que você vê é o que você pega)
    const children = [...this.tokenLayer.children].reverse();
    for (const view of children) {
      const t = this.syncState.tokens.find((tok) => this.tokenViews.get(tok.id) === view);
      if (!t) continue;
      if (t.hiddenFromPlayers && !dm) continue;
      const size = t.sizeCells * this.cellSize;
      // margem de 10px ao redor para facilitar agarrar tokens pequenos
      if (p.x >= view.x - 10 && p.x <= view.x + size + 10 && p.y >= view.y - 10 && p.y <= view.y + size + 10) {
        return t;
      }
    }
    return null;
  }

  private itemAt(p: { x: number; y: number }): import('@vtt/shared').MapItem | null {
    if (!this.syncState) return null;
    const cs = this.cellSize;
    for (const item of this.syncState.items) {
      if (p.x >= item.x - 10 && p.x <= item.x + cs + 10 && p.y >= item.y - 10 && p.y <= item.y + cs + 10) {
        return item;
      }
    }
    return null;
  }

  // ------------------------------------------------------------ visibilidade
  private computeVisibility(state: SceneSyncState): void {
    this.visibleCells.clear();
    const cs = state.map.cellSize;
    const anyVision = state.tokens.some((t) => t.kind === 'pc' && !t.dead && t.visionRangeCells > 0);
    if (!anyVision) return;

    for (const t of state.tokens) {
      if (t.kind !== 'pc' || t.dead || t.visionRangeCells <= 0) continue;
      const R = t.visionRangeCells;
      const cx0 = Math.floor(t.x / cs);
      const cy0 = Math.floor(t.y / cs);
      const ox = t.x + (t.sizeCells * cs) / 2;
      const oy = t.y + (t.sizeCells * cs) / 2;

      for (let cy = cy0 - R; cy <= cy0 + R; cy++) {
        for (let cx = cx0 - R; cx <= cx0 + R; cx++) {
          if (cx < 0 || cy < 0 || cx >= state.map.widthCells || cy >= state.map.heightCells) continue;
          const dx = cx - cx0;
          const dy = cy - cy0;
          if (dx * dx + dy * dy > (R + 0.5) * (R + 0.5)) continue;
          const key = cellKey(cx, cy);
          if (this.visibleCells.has(key)) continue;
          const tx = cx * cs + cs / 2;
          const ty = cy * cs + cs / 2;
          if (this.hasLineOfSight(ox, oy, tx, ty, state.map.walls)) this.visibleCells.add(key);
        }
      }
    }
  }

  private hasLineOfSight(x1: number, y1: number, x2: number, y2: number, walls: GameMap['walls']): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 16));
    let px = x1;
    let py = y1;
    for (let i = 1; i <= steps; i++) {
      const qx = x1 + ((x2 - x1) * i) / steps;
      const qy = y1 + ((y2 - y1) * i) / steps;
      for (const w of walls) {
        if (segSegIntersect(px, py, qx, qy, w.x1, w.y1, w.x2, w.y2)) return false;
      }
      px = qx;
      py = qy;
    }
    return true;
  }

  /** segmento de parede mais próximo do ponto (para a borracha de paredes) */
  private nearestWall(p: { x: number; y: number }, maxDist: number): GameMap['walls'][number] | null {
    if (!this.syncState) return null;
    let best: GameMap['walls'][number] | null = null;
    let bestDist = maxDist;
    for (const w of this.syncState.map.walls) {
      const d = this.distToSegment(p.x, p.y, w.x1, w.y1, w.x2, w.y2);
      if (d < bestDist) {
        bestDist = d;
        best = w;
      }
    }
    return best;
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  // ---------------------------------------------------------------- desenhos
  private layout(): void {
    if (!this.container || !this.syncState) return;
    // a câmera só é ajustada automaticamente enquanto o usuário não interferiu;
    // refaz também se a primeira medição veio degenerada (container 0 px)
    const degenerate = !this.camInit || this.cam.scale < 0.03;
    if (degenerate) this.resetView();
  }

  /** Cenário do mapa: EM BRANCO, apenas um fundo uniforme. */
  private drawTerrain(map: GameMap): void {
    this.terrainG
      .rect(0, 0, map.widthCells * map.cellSize, map.heightCells * map.cellSize)
      .fill({ color: 0x1c2230 });
  }

  private drawGrid(map: GameMap): void {
    const g = this.gridG;
    g.clear();
    const W = this.worldWidth();
    const H = this.worldHeight();
    g.rect(0, 0, W, H).fill(COLOR_BG);

    // piso de pedra: xadrez sutil com manchas determinísticas por célula
    const cs = map.cellSize;
    let hashState = 0;
    const hash = (cx: number, cy: number): number => {
      hashState = (cx * 374761393 + cy * 668265263) | 0;
      hashState = (hashState ^ (hashState >> 13)) * 1274126177;
      return ((hashState ^ (hashState >> 16)) >>> 0) / 4294967295;
    };
    for (let cy = 0; cy < map.heightCells; cy++) {
      for (let cx = 0; cx < map.widthCells; cx++) {
        const base = (cx + cy) % 2 === 0 ? 0x171b24 : 0x141820;
        g.rect(cx * cs, cy * cs, cs, cs).fill(base);
        const n = hash(cx, cy);
        if (n > 0.72) {
          g.rect(cx * cs + 3, cy * cs + 3, cs - 6, cs - 6).fill({ color: 0x1d2330, alpha: 0.25 + n * 0.35 });
        }
        if (n < 0.08) {
          g.circle(cx * cs + cs * (0.3 + n), cy * cs + cs * 0.62, cs * 0.09).fill({ color: 0x0c0e13, alpha: 0.5 });
        }
      }
    }

    for (let cx = 0; cx <= map.widthCells; cx++) {
      g.moveTo(cx * cs, 0).lineTo(cx * cs, H);
    }
    for (let cy = 0; cy <= map.heightCells; cy++) {
      g.moveTo(0, cy * cs).lineTo(W, cy * cs);
    }
    g.stroke({ width: 1, color: COLOR_GRID, alpha: 0.45 });
  }

  private drawWalls(map: GameMap): void {
    const g = this.wallG;
    g.clear();
    for (const w of map.walls) {
      g.moveTo(w.x1, w.y1).lineTo(w.x2, w.y2);
    }
    g.stroke({ width: 5, color: COLOR_WALL, cap: 'round' });
  }

  /** muda apenas quando a aparência do token precisa ser reconstruída */
  private tokenVisualKey(t: Token): string {
    return [t.color, t.sizeCells, t.hp, t.maxHp, t.dead, t.name, t.kind].join('|');
  }

  private drawTokens(state: SceneSyncState): void {
    const cs = state.map.cellSize;
    const dm = this.callbacks.isDm();
    const seen = new Set<string>();

    for (const t of state.tokens) {
      if (t.hiddenFromPlayers && !dm) continue;
      seen.add(t.id);
      const key = this.tokenVisualKey(t);

      if (!this.tokenViews.has(t.id) || this.tokenMeta.get(t.id) !== key) {
        // preserva a posição animada atual antes de destruir
        const old = this.tokenViews.get(t.id);
        const px = old ? old.x : t.x;
        const py = old ? old.y : t.y;
        if (old) {
          old.destroy({ children: true });
          this.tokenViews.delete(t.id);
        }

        const size = t.sizeCells * cs;
        const c = new Container();
        c.x = px;
        c.y = py;

        const body = new Graphics();
        const r = size / 2 - 4;
        const downed = t.dead || t.hp === 0;
        // sombra no chão
        body.circle(size / 2 + 1.5, size / 2 + 3, r).fill({ color: 0x000000, alpha: 0.35 });
        // corpo com brilho superior e anel por tipo (estilo CRPG)
        const rim = t.kind === 'pc' ? 0xf5d76e : t.kind === 'monster' ? 0xff6b6b : 0x9ca3af;
        body.circle(size / 2, size / 2, r).fill(t.color ?? '#6b7280');
        body.circle(size / 2 - r * 0.28, size / 2 - r * 0.34, r * 0.52).fill({ color: 0xffffff, alpha: 0.16 });
        body.circle(size / 2, size / 2, r).stroke({ width: 2.5, color: rim });
        if (t.dead) {
          c.alpha = 0.45;
          body.moveTo(size * 0.25, size * 0.25).lineTo(size * 0.75, size * 0.75);
          body.moveTo(size * 0.75, size * 0.25).lineTo(size * 0.25, size * 0.75);
          body.stroke({ width: 3, color: 0xff4444 });
        }
        c.addChild(body);

        // zona de ataque — se o token tiver attackRange, desenha um círculo ao redor
        if (t.attackRange && t.attackRange > 0) {
          const rangeG = new Graphics();
          const rangePx = t.attackRange * this.cellSize;
          rangeG.circle(size / 2, size / 2, rangePx / 2).fill({ color: 0xff0000, alpha: 0.15 });
          rangeG.stroke({ width: 2, color: 0xff0000, alpha: 0.5 });
          c.addChild(rangeG);
        }

        if (downed) {
          const mark = new Text({
            text: t.dead ? '☠' : '⬇',
            style: {
              fontFamily: 'system-ui, sans-serif',
              fontSize: t.dead ? 20 : 18,
              fontWeight: 'bold',
              fill: t.dead ? 0xff6b6b : 0xf59e0b,
              stroke: { color: 0x000000, width: 3 },
            },
          });
          mark.anchor.set(0.5);
          mark.position.set(size - 12, 12);
          c.addChild(mark);
        }

        if (t.maxHp > 0 && !t.dead) {
          const bar = new Graphics();
          bar.rect(4, size - 9, size - 8, 5).fill({ color: 0x11131a });
          const ratio = clamp(t.hp / t.maxHp, 0, 1);
          bar.rect(4, size - 9, (size - 8) * ratio, 5).fill({
            color: ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xeab308 : 0xef4444,
          });
          c.addChild(bar);
        }

        const label = this.buildNamePlate(t, size);
        c.addChild(label);

        // anéis de estado vivem DENTRO do container: deslizam junto com o token
        const mkRing = (color: number, width: number, pad: number, name: string): void => {
          const rg = new Graphics();
          rg.circle(size / 2, size / 2, size / 2 + pad).stroke({ width, color });
          rg.visible = false;
          rg.name = name;
          c.addChild(rg);
        };
        mkRing(0x22c55e, 3, 8, 'ring-sel');
        mkRing(0xef4444, 2.5, 15, 'ring-tgt');

        this.tokenLayer.addChild(c);
        this.tokenViews.set(t.id, c);
        this.tokenMeta.set(t.id, key);
        if (!this.desired.has(t.id)) this.desired.set(t.id, { x: t.x, y: t.y });
      }

      // sempre atualiza o alvo — a vista existente desliza até lá
      this.desired.set(t.id, { x: t.x, y: t.y });
    }

    // remove tokens que saíram do estado
    for (const id of [...this.tokenViews.keys()]) {
      if (!seen.has(id)) {
        this.tokenViews.get(id)?.destroy({ children: true });
        this.tokenViews.delete(id);
        this.tokenMeta.delete(id);
        this.desired.delete(id);
      }
    }
  }

  /** placa de nome legível; seus tokens ganham ★ dourada */
  private buildNamePlate(t: Token, size: number): Container {
    const mine = this.callbacks.canControl(t);
    const plate = new Container();
    const text = new Text({
      text: (mine ? '★ ' : '') + t.name,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 11,
        fontWeight: mine ? 'bold' : 'normal',
        fill: mine ? 0xf5d76e : t.kind === 'monster' ? 0xffc9c9 : 0xffffff,
        stroke: { color: 0x000000, width: 3 },
      },
    });
    const w = text.width + 12;
    const bg = new Graphics();
    bg.roundRect(-w / 2, -3, w, 17, 4).fill({ color: 0x0b0d12, alpha: 0.78 });
    text.position.set(-w / 2 + 6, -1);
    plate.addChild(bg, text);
    plate.position.set(size / 2, size + 3);
    return plate;
  }

  /** liga/desliga os anéis de acordo com seleção/alvo */
  private updateRings(state: SceneSyncState): void {
    for (const [id, view] of this.tokenViews) {
      const sel = view.getChildByName('ring-sel');
      const tgt = view.getChildByName('ring-tgt');
      if (sel) sel.visible = state.selectedId === id;
      if (tgt) tgt.visible = state.targetedId === id;
    }
  }

  private drawFog(map: GameMap): void {
    const g = this.fogG;
    g.clear();
    const hidden = new Set(map.fogHidden);
    const anyVision = (this.syncState?.tokens ?? []).some((t) => t.kind === 'pc' && !t.dead && t.visionRangeCells > 0);

    for (let cy = 0; cy < map.heightCells; cy++) {
      for (let cx = 0; cx < map.widthCells; cx++) {
        const key = cellKey(cx, cy);
        const x = cx * map.cellSize;
        const y = cy * map.cellSize;
        if (hidden.has(key)) {
          g.rect(x, y, map.cellSize, map.cellSize).fill({ color: 0x000000, alpha: 1 });
        } else if (anyVision && !this.visibleCells.has(key)) {
          g.rect(x, y, map.cellSize, map.cellSize).fill({ color: 0x000000, alpha: 0.55 });
        }
      }
    }
  }

  private static ITEM_EMOJI: Record<string, string> = {
    weapon: '⚔️',
    armor: '🛡️',
    shield: '🛡️',
    consumable: '🧪',
    scroll: '📜',
    utility: '📦',
    loot: '💰',
    grimoire: '📖',
  };

  private drawItems(state: SceneSyncState): void {
    const cs = state.map.cellSize;
    const seen = new Set<string>();
    for (const item of state.items) {
      seen.add(item.id);
      let view = this.itemViews.get(item.id);
      if (!view) {
        view = new Container();
        const emoji = VttScene.ITEM_EMOJI[item.category] ?? '📦';
        const icon = new Text({
          text: emoji,
          style: { fontFamily: 'system-ui, sans-serif', fontSize: 24 },
        });
        icon.anchor.set(0.5, 0.5);
        icon.position.set(cs / 2, cs / 2);
        const label = new Text({
          text: item.label ?? item.name,
          style: {
            fontFamily: 'system-ui, sans-serif',
            fontSize: 10,
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 3 },
          },
        });
        label.anchor.set(0.5, 0);
        label.position.set(cs / 2, cs - 2);
        view.addChild(icon, label);
        this.itemLayer.addChild(view);
        this.itemViews.set(item.id, view);
      }
      if (this.itemDrag?.tokenId !== item.id) {
        view.x = item.x;
        view.y = item.y;
      }
    }
    for (const [id, view] of this.itemViews) {
      if (!seen.has(id) && this.itemDrag?.tokenId !== id) {
        this.itemLayer.removeChild(view);
        view.destroy({ children: true });
        this.itemViews.delete(id);
      }
    }
  }

  private drawUi(state: SceneSyncState): void {
    // anéis agora vivem dentro de cada token (updateRings); mantido para limpeza
    this.uiG.clear();
    this.pulseG.clear();
    void state;
  }

  // ------------------------------------------------------------- animações
  private onTick = (ticker: Ticker): void => {
    // interpolação suave dos tokens em direção às posições-alvo
    for (const [id, view] of this.tokenViews) {
      if (this.drag?.tokenId === id) continue;
      const target = this.desired.get(id);
      if (!target) continue;
      const k = Math.min(1, ticker.deltaTime * 0.26);
      view.x += (target.x - view.x) * k;
      view.y += (target.y - view.y) * k;
    }
    // câmera desliza suavemente até o alvo (zoom com easing)
    const ck = Math.min(1, ticker.deltaTime * 0.22);
    const dx = this.camTarget.x - this.cam.x;
    const dy = this.camTarget.y - this.cam.y;
    const ds = this.camTarget.scale - this.cam.scale;
    if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05 || Math.abs(ds) > 0.0005) {
      this.cam.x += dx * ck;
      this.cam.y += dy * ck;
      this.cam.scale += ds * ck;
      this.applyCamera();
    }
    this.drawInspectButtons();
  };

  /** botão flutuante "ver ficha" acima de cada token (tamanho constante na tela) */
  private drawInspectButtons(): void {
    const s = this.syncState;
    if (!s) {
      if (this.inspectSig) {
        this.inspectG.clear();
        this.inspectRects = [];
        this.inspectSig = '';
      }
      return;
    }
    let sig = this.cam.scale.toFixed(4);
    for (const t of s.tokens) {
      const v = this.tokenViews.get(t.id);
      sig += `|${t.id}:${Math.round(v?.x ?? -1)},${Math.round(v?.y ?? -1)},${t.dead ? 0 : 1}`;
    }
    if (sig === this.inspectSig) return;
    this.inspectSig = sig;

    const g = this.inspectG;
    g.clear();
    this.inspectRects = [];
    const scale = Math.max(0.05, this.cam.scale);
    const bw = 22 / scale;
    const bh = 16 / scale;
    const gap = 7 / scale;
    for (const t of s.tokens) {
      if (t.dead) continue;
      const view = this.tokenViews.get(t.id);
      if (!view) continue;
      const vw = t.sizeCells * s.map.cellSize;
      const x = view.x + vw / 2 - bw / 2;
      const y = view.y - gap - bh;
      g.roundRect(x, y, bw, bh, bh * 0.28)
        .fill({ color: 0x10141c, alpha: 0.88 })
        .stroke({ width: 1.4 / scale, color: COLOR_WALL, alpha: 0.9 });
      g.moveTo(x + bw * 0.24, y + bh * 0.4).lineTo(x + bw * 0.76, y + bh * 0.4);
      g.moveTo(x + bw * 0.24, y + bh * 0.64).lineTo(x + bw * 0.76, y + bh * 0.64);
      g.stroke({ width: 1.2 / scale, color: 0xf3e5b8, alpha: 0.95 });
      this.inspectRects.push({ id: t.id, x1: x - 3 / scale, y1: y - 3 / scale, x2: x + bw + 3 / scale, y2: y + bh + 3 / scale });
    }
  }

  /** Texto flutuante que sobe e some sobre uma posição do mundo. */
  spawnFloatingText(x: number, y: number, text: string, color: number): void {
    if (!this.ready) return;
    const label = new Text({
      text,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 17,
        fontWeight: 'bold',
        fill: 0x000000,
        stroke: { color: 0xffffff, width: 4 },
      },
    });
    label.anchor.set(0.5);
    label.x = x;
    label.y = y;
    this.fxLayer.addChild(label);

    let elapsed = 0;
    const duration = 55; // ~0.9s a 60fps
    const step = (ticker: Ticker): void => {
      elapsed += ticker.deltaTime;
      label.y -= ticker.deltaTime * 0.9;
      label.alpha = Math.max(0, 1 - elapsed / duration);
      label.scale.set(1 + Math.min(elapsed, 8) * 0.02);
      if (elapsed >= duration) {
        this.app.ticker.remove(step);
        label.destroy();
      }
    };
    this.app.ticker.add(step);
  }
}
