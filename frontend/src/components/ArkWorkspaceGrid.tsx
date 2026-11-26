import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
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
  controls: { minW: 5, minH: 5 },
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

  useLayoutEffect(() => { editingRef.current = editing; }, [editing]);
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
      disableDrag: !editingRef.current, disableResize: !editingRef.current,
      draggable: { handle: '.ark-grid-handle' },
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
    instance.current?.enableMove(editing);
    instance.current?.enableResize(editing);
  }, [editing, libraryOpen, resetToken]);

  function moveByKeyboard(event: KeyboardEvent<HTMLButtonElement>, id: Panel) {
    if (!editing || !instance.current || !gridRef.current) return;
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
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
    if (!validLayout(placements.map(item => item.id === id ? next : item), placements.map(item => item.id))) return;
    grid.update(el, next);
  }

  function panel(id: Panel, content: ReactNode, hidden = false) {
    return (
      <div key={id} className="ark-grid-item" data-panel={id} hidden={hidden}>
        <div className="grid-stack-item-content">
          <button type="button" className="ark-grid-handle" tabIndex={editing ? 0 : -1}
            aria-label={`Move ${titles[id]}`} title="Drag to move. Arrow keys move; Shift + arrows resize into free space."
            onKeyDown={event => moveByKeyboard(event, id)}><GripHorizontal size={15}/><span>{titles[id]}</span></button>
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
      </div>
    </main>
  );
}
