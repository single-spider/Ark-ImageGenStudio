import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { GripHorizontal } from 'lucide-react';
import { GridStack, type GridStackWidget } from 'gridstack';

const COLS = 24;
const ROWS = 24;
const STORAGE = 'ark-workspace-grid-v1';
type Panel = 'canvas' | 'controls' | 'library';
type Side = 'left' | 'right';
type Placement = { id: Panel; x: number; y: number; w: number; h: number };
const limits: Record<Panel, { minW: number; minH: number }> = {
  canvas: { minW: 6, minH: 6 },
  controls: { minW: 5, minH: 8 },
  library: { minW: 4, minH: 5 },
};
const titles: Record<Panel, string> = { canvas: 'Canvas', controls: 'Studio controls', library: 'Library' };

function defaultLayout(open: boolean, side: Side): Placement[] {
  const ids: Panel[] = open
    ? side === 'left' ? ['library', 'canvas', 'controls'] : ['canvas', 'controls', 'library']
    : ['canvas', 'controls'];
  let x = 0;
  return ids.map(id => {
    const w = id === 'canvas' ? (open ? 12 : 18) : 6;
    const item = { id, x, y: 0, w, h: ROWS };
    x += w;
    return item;
  });
}
function overlaps(a: Placement, b: Placement) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function validLayout(items: unknown, ids: Panel[]): items is Placement[] {
  if (!Array.isArray(items) || items.length !== ids.length) return false;
  if (!items.every((item) => {
    if (!item || !ids.includes(item.id)) return false;
    const limit = limits[item.id as Panel];
    return [item.x, item.y, item.w, item.h].every(Number.isInteger)
      && item.x >= 0 && item.y >= 0 && item.w >= limit.minW && item.h >= limit.minH
      && item.x + item.w <= COLS && item.y + item.h <= ROWS;
  })) return false;
  if (new Set(items.map(item => item.id)).size !== ids.length) return false;
  return !items.some((a, i) => items.some((b, j) => i !== j && overlaps(a, b)));
}
// Reorder a contiguous row or column without changing any panel's dimensions.
function reorderBand(items: Placement[], source: Placement, target: Placement, axis: 'x' | 'y'): Placement[] | null {
  const cross = axis === 'x' ? 'y' : 'x';
  const size = axis === 'x' ? 'w' : 'h';
  const crossSize = axis === 'x' ? 'h' : 'w';
  if (source[cross] !== target[cross] || source[crossSize] !== target[crossSize]) return null;
  const band = items.filter(p => p[cross] === source[cross] && p[crossSize] === source[crossSize]).sort((a,b) => a[axis] - b[axis]);
  if (band.some((p,i) => i > 0 && band[i-1][axis] + band[i-1][size] !== p[axis])) return null;
  const from = band.findIndex(p => p.id === source.id);
  const to = band.findIndex(p => p.id === target.id);
  if (from < 0 || to < 0 || from === to) return null;
  let offset = band[0][axis];
  const order = [...band];
  order.splice(from, 1);
  order.splice(to, 0, source);
  const moved = order.map(p => {
    const result = { ...p, [axis]: offset };
    offset += p[size];
    return result;
  });
  return items.map(p => moved.find(q => q.id === p.id) ?? p);
}

function planMove(items: Placement[], id: Panel, proposed: Placement, targetId?: Panel): Placement[] | null {
  const source = items.find(p => p.id === id);
  if (!source) return null;
  const ids = items.map(p => p.id);
  const target = items.find(p => p.id === targetId && p.id !== id);
  if (!target) {
    const next = items.map(p => p.id === id ? proposed : p);
    return validLayout(next, ids) ? next : null;
  }
  // Preserve sizes for packed strips, including a wider canvas among sidebars.
  for (const axis of ['x','y'] as const) {
    const next = reorderBand(items, source, target, axis);
    if (next && validLayout(next, ids)) return next;
  }
  // For irregular layouts, exchange positions if both rectangles still fit.
  const positioned = items.map(p => p.id === id ? { ...p, x: target.x, y: target.y }
    : p.id === target.id ? { ...p, x: source.x, y: source.y } : p);
  if (validLayout(positioned, ids)) return positioned;
  // Otherwise exchange the occupied rectangles, respecting each panel's minimum.
  const exchanged = items.map(p => p.id === id ? { ...target, id }
    : p.id === target.id ? { ...source, id: target.id } : p);
  return validLayout(exchanged, ids) ? exchanged : null;
}
type MoveDrag = {
  id: Panel; pointerId: number; startX: number; startY: number;
  layout: Placement[]; source: Placement; next: Placement[] | null;
};
function storageKey(open: boolean) { return STORAGE + (open ? ':open' : ':closed'); }
function readLayout(open: boolean, side: Side): Placement[] {
  const defaults = defaultLayout(open, side);
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey(open)) || 'null');
    if (validLayout(raw, defaults.map(item => item.id))) return raw;
  } catch { /* corrupt or unavailable storage: use the default workspace */ }
  return defaults;
}
function snapshot(grid: GridStack): Placement[] {
  const saved = grid.save(false);
  if (!Array.isArray(saved)) return [];
  return saved.map((node: GridStackWidget) => ({
    id: node.id as Panel, x: node.x ?? 0, y: node.y ?? 0, w: node.w ?? 1, h: node.h ?? 1,
  }));
}

interface Props {
  libraryOpen: boolean;
  initialSide: Side;
  editing: boolean;
  resetToken: number;
  canvas: ReactNode;
  controls: ReactNode;
  library: ReactNode;
}

/** React owns panel content; GridStack owns only its outer rectangles.
 * Panels stay mounted when the library is hidden or a workspace is reset.
 */
export function ArkWorkspaceGrid({ libraryOpen, initialSide, editing, resetToken, canvas, controls, library }: Props) {
  const shellRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const instance = useRef<GridStack | null>(null);
  const lastReset = useRef(resetToken);
  const editingRef = useRef(editing);
  const dragRef = useRef<MoveDrag | null>(null);
  const [preview, setPreview] = useState<{ id: Panel; layout: Placement[] } | null>(null);

  useLayoutEffect(() => { editingRef.current = editing; if (!editing) { dragRef.current = null; setPreview(null); } }, [editing]);
  useLayoutEffect(() => {
    const el = gridRef.current;
    const shell = shellRef.current;
    if (!el || !shell) return;
    if (lastReset.current !== resetToken) {
      try { localStorage.removeItem(storageKey(libraryOpen)); } catch { /* optional */ }
      lastReset.current = resetToken;
    }
    const layout = readLayout(libraryOpen, initialSide);
    // Reset geometry on the existing DOM before GridStack reads it. React
    // retains ownership of the image, prompt, gallery and their local state.
    el.classList.add('grid-stack');
    for (const item of el.querySelectorAll<HTMLElement>(':scope > [data-panel]')) {
      const id = item.dataset.panel as Panel;
      const p = layout.find(node => node.id === id);
      item.classList.toggle('grid-stack-item', Boolean(p));
      if (!p) continue;
      const opts = { ...p, ...limits[id] };
      item.setAttribute('gs-id', id);
      for (const [key, value] of Object.entries(opts)) {
        if (key !== 'id') item.setAttribute('gs-' + key.toLowerCase(), String(value));
      }
      // GridStack reads the canonical minimum width/height attributes.
      item.setAttribute('gs-min-w', String(limits[id].minW));
      item.setAttribute('gs-min-h', String(limits[id].minH));
    }
    const grid = GridStack.init({
      column: COLS, row: ROWS, float: true, margin: 5, animate: false,
      cellHeight: Math.max(1, Math.floor(shell.clientHeight / ROWS)),
      // Pointer-controlled moves allow occupied-space reordering. GridStack still owns resizing and geometry.
      disableDrag: true, disableResize: !editingRef.current,
      resizable: { handles: 'n,ne,e,se,s,sw,w,nw', autoHide: false },
    }, el);
    instance.current = grid;
    const ids = layout.map(node => node.id);
    const persist = () => {
      if (!editingRef.current) return;
      const next = snapshot(grid);
      if (!validLayout(next, ids)) return;
      try { localStorage.setItem(storageKey(libraryOpen), JSON.stringify(next)); } catch { /* optional */ }
    };
    grid.on('change', persist);
    grid.on('dragstop', persist);
    grid.on('resizestop', persist);
    const observer = new ResizeObserver(() => {
      const h = Math.max(1, Math.floor(shell.clientHeight / ROWS));
      if (grid.getCellHeight() !== h) grid.cellHeight(h);
    });
    observer.observe(shell);
    return () => {
      observer.disconnect();
      grid.offAll();
      grid.destroy(false);
      instance.current = null;
    };
  }, [libraryOpen, initialSide, resetToken]);

  useLayoutEffect(() => {
    instance.current?.enableMove(false);
    instance.current?.enableResize(editing);
  }, [editing, libraryOpen, resetToken]);

  function applyMove(next: Placement[]) {
    const grid = instance.current;
    if (!grid) return;
    grid.load(next.map(p => ({ ...p, ...limits[p.id] })), false);
    const actual = snapshot(grid);
    if (validLayout(actual, next.map(p => p.id))) {
      try { localStorage.setItem(storageKey(libraryOpen), JSON.stringify(actual)); } catch { /* optional */ }
    }
  }

  function beginMove(event: PointerEvent<HTMLDivElement>, id: Panel) {
    if (!editing || !event.isPrimary || event.button !== 0 || !instance.current) return;
    const layout = snapshot(instance.current);
    const source = layout.find(p => p.id === id);
    if (!source) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, layout, source, next: null };
  }

  function updateMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const grid = instance.current;
    if (!drag || drag.pointerId !== event.pointerId || !grid || !gridRef.current) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) {
      drag.next = null; setPreview(null); return;
    }
    const bounds = gridRef.current.getBoundingClientRect();
    const cellW = bounds.width / COLS;
    const cellH = grid.getCellHeight();
    const x = (event.clientX - bounds.left) / cellW;
    const y = (event.clientY - bounds.top) / cellH;
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) {
      drag.next = null; setPreview(null); return;
    }
    const target = drag.layout.find(p => p.id !== drag.id && x >= p.x && x < p.x+p.w && y >= p.y && y < p.y+p.h);
    const proposed = {
      ...drag.source,
      x: Math.max(0, Math.min(COLS-drag.source.w, drag.source.x + Math.round((event.clientX-drag.startX)/cellW))),
      y: Math.max(0, Math.min(ROWS-drag.source.h, drag.source.y + Math.round((event.clientY-drag.startY)/cellH))),
    };
    drag.next = planMove(drag.layout, drag.id, proposed, target?.id);
    setPreview(drag.next ? { id: drag.id, layout: drag.next } : null);
  }

  function finishMove(event: PointerEvent<HTMLDivElement>, cancel = false) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!cancel) updateMove(event);
    dragRef.current = null;
    setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancel && drag.next) applyMove(drag.next);
  }

  function moveByKeyboard(event: KeyboardEvent<HTMLDivElement>, id: Panel) {
    if (!editing || !instance.current || !gridRef.current) return;
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const delta = directions[event.key];
    if (!delta) return;
    event.preventDefault();
    const grid = instance.current;
    const placements = snapshot(grid);
    const current = placements.find(item => item.id === id);
    const el = gridRef.current.querySelector<HTMLElement>(`[data-panel="${id}"]`);
    if (!current || !el) return;
    const [dx, dy] = delta;
    const next = event.shiftKey
      ? { ...current, w: current.w + dx, h: current.h + dy }
      : { ...current, x: current.x + dx, y: current.y + dy };
    if (event.shiftKey) {
      if (validLayout(placements.map(item => item.id === id ? next : item), placements.map(item => item.id))) grid.update(el, next);
      return;
    }
    const target = placements.find(p => p.id !== id && overlaps(next, p));
    const plan = planMove(placements, id, next, target?.id);
    if (plan) applyMove(plan);
  }

  function panel(id: Panel, content: ReactNode, hidden = false) {
    return (
      <div key={id} className="ark-grid-item" data-panel={id} hidden={hidden}>
        <div className="grid-stack-item-content">
          <div role="button" className="ark-grid-handle" tabIndex={editing ? 0 : -1}
            aria-label={`Move ${titles[id]}`} title="Drag to move or reorder panels. Arrow keys move; Shift + arrows resize."
            onPointerDown={event => beginMove(event, id)} onPointerMove={updateMove}
            onPointerUp={event => finishMove(event)} onPointerCancel={event => finishMove(event, true)}
            onLostPointerCapture={event => finishMove(event, true)}
            onKeyDown={event => { if (event.key === 'Escape') { dragRef.current = null; setPreview(null); } else moveByKeyboard(event, id); }}><GripHorizontal size={15}/><span>{titles[id]}</span></div>
          {content}
        </div>
      </div>
    );
  }
  return (
    <main className="ark-grid-shell" ref={shellRef} aria-label="Customizable studio workspace">
      <div className="grid-stack ark-workspace-grid" ref={gridRef} data-editing={editing}>
        {panel('canvas', canvas)}
        {panel('controls', controls)}
        {panel('library', library, !libraryOpen)}
        {editing && preview && preview.layout.filter(p => {
          const old = dragRef.current?.layout.find(q => q.id === p.id);
          return old && (old.x !== p.x || old.y !== p.y || old.w !== p.w || old.h !== p.h);
        }).map(p => <div key={p.id} aria-hidden="true" className={`ark-grid-drop-preview ${p.id === preview.id ? 'is-primary' : ''}`}
          style={{ left: `${p.x / COLS * 100}%`, top: `${p.y / ROWS * 100}%`, width: `${p.w / COLS * 100}%`, height: `${p.h / ROWS * 100}%` }}>
          <span>{p.id === preview.id ? `Move ${titles[p.id]} here` : titles[p.id]}</span>
        </div>)}
      </div>
    </main>
  );
}
