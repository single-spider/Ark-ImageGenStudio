import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Bookmark, Check, CopyPlus, GitBranch, GitCompareArrows, ImagePlus,
  MoreHorizontal, Trash2,
} from 'lucide-react';
import { arkMotion } from '../lib/motion';
import type { StudioAsset } from '../types/studio';

type MenuAction = 'open' | 'compare' | 'branch' | 'reference' | 'keeper' | 'delete';

interface MenuState {
  id: string;
  x: number;
  y: number;
}

interface ScrubState {
  pointerId: number;
  startX: number;
  startY: number;
  crossedThreshold: boolean;
  lastId: string;
  cardCenters: Array<{ id: string; x: number }>;
}

interface IterationDeckProps {
  /** Stable lineage window; its order must not change when selecting a card. */
  assets: StudioAsset[];
  totalCount: number;
  activeId: string;
  onSelect: (id: string) => void;
  onCompare: (id: string) => void;
  onBranch: (id: string) => void;
  onSendToReference: (id: string) => void;
  onToggleKeeper: (id: string) => void;
  onDelete: (id: string) => void;
}

const actions: Array<{ id: MenuAction; label: string; icon: typeof Bookmark }> = [
  { id: 'open', label: 'Set as main image', icon: Check },
  { id: 'compare', label: 'Compare with main', icon: GitCompareArrows },
  { id: 'branch', label: 'Branch from here', icon: GitBranch },
  { id: 'reference', label: 'Send to reference', icon: ImagePlus },
  { id: 'keeper', label: 'Toggle Keeper', icon: Bookmark },
  { id: 'delete', label: 'Remove from preview', icon: Trash2 },
];

export function IterationDeck({
  assets, totalCount, activeId, onSelect, onCompare, onBranch,
  onSendToReference, onToggleKeeper, onDelete,
}: IterationDeckProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const scrub = useRef<ScrubState | null>(null);
  const suppressClick = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);

  const menuAsset = assets.find((asset) => asset.id === menu?.id);
  const previewing = menu !== null || expanded;

  useEffect(() => {
    if (!menu) return;
    const dismissOutside = (event: globalThis.PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)
        && !(event.target as HTMLElement).closest?.('.iteration-thumb')) {
        setMenu(null);
      }
    };
    const dismissEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setMenu(null);
        lastTrigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismissOutside, true);
    document.addEventListener('keydown', dismissEscape, true);
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
      document.removeEventListener('keydown', dismissEscape, true);
    };
  }, [menu]);

  function openMenu(event: MouseEvent<HTMLButtonElement>, id: string) {
    event.preventDefault();
    event.stopPropagation();
    lastTrigger.current = event.currentTarget;
    setExpanded(true);
    setMenu({
      id,
      x: Math.max(8, Math.min(event.clientX || event.currentTarget.getBoundingClientRect().right, window.innerWidth - 224)),
      y: Math.max(8, Math.min(event.clientY || event.currentTarget.getBoundingClientRect().top, window.innerHeight - 290)),
    });
  }

  function runAction(action: MenuAction, id: string) {
    setMenu(null);
    switch (action) {
      case 'open': onSelect(id); break;
      case 'compare': onCompare(id); break;
      case 'branch': onBranch(id); break;
      case 'reference': onSendToReference(id); break;
      case 'keeper': onToggleKeeper(id); break;
      case 'delete': onDelete(id); break;
    }
    rootRef.current?.querySelector<HTMLButtonElement>(`[data-asset-id="${CSS.escape(id)}"]`)?.focus();
  }

  function menuKeys(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    switch (event.key) {
      case 'ArrowDown': next = (current + 1) % items.length; break;
      case 'ArrowUp': next = (current - 1 + items.length) % items.length; break;
      case 'Home': next = 0; break;
      case 'End': next = items.length - 1; break;
    }
    if (next >= 0) {
      event.preventDefault();
      items[next]?.focus();
    }
  }

  function beginScrub(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0 || menu) return;
    const centers = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('.iteration-thumb') ?? [])
      .map((node) => ({ id: node.dataset.assetId ?? '', x: node.getBoundingClientRect().left + node.getBoundingClientRect().width / 2 }));
    scrub.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      crossedThreshold: false,
      lastId: id,
      cardCenters: centers,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveScrub(event: PointerEvent<HTMLButtonElement>) {
    const state = scrub.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
    if (!state.crossedThreshold && distance < 9) return;
    state.crossedThreshold = true;
    suppressClick.current = true;
    if (!state.cardCenters.length) return;
    const nearest = state.cardCenters.reduce((best, candidate) =>
      Math.abs(candidate.x - event.clientX) < Math.abs(best.x - event.clientX) ? candidate : best);
    if (nearest.id && nearest.id !== state.lastId) {
      state.lastId = nearest.id;
      onSelect(nearest.id);
    }
  }

  function finishScrub(event: PointerEvent<HTMLButtonElement>) {
    if (scrub.current?.pointerId !== event.pointerId) return;
    const wasDragging = scrub.current.crossedThreshold;
    scrub.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (wasDragging) {
      // Suppress the synthetic click after pointer release, then reset for next gesture.
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    }
  }

  function cardKeys(event: KeyboardEvent<HTMLButtonElement>, index: number, asset: StudioAsset) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenu(null);
      setExpanded(false);
      event.currentTarget.blur();
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = index + (event.key === 'ArrowRight' ? 1 : -1);
      const target = assets[next];
      if (target) {
        onSelect(target.id);
        listRef.current?.querySelectorAll<HTMLButtonElement>('.iteration-thumb')[next]?.focus();
      }
    } else if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      onCompare(asset.id);
    } else if (event.key === 'F10' && event.shiftKey) {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      lastTrigger.current = event.currentTarget;
      setMenu({ id: asset.id, x: Math.min(bounds.right, window.innerWidth - 224), y: Math.min(bounds.top, window.innerHeight - 290) });
    }
  }

  if (!assets.length) return null;

  return (
    <div
      className="floating-iterations iteration-deck"
      ref={rootRef}
      aria-label="Iteration lineage"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => { if (!menu && !scrub.current) setExpanded(false); }}
      onFocusCapture={() => setExpanded(true)}
      onBlurCapture={(event) => {
        if (!menu && !event.currentTarget.contains(event.relatedTarget as Node)) setExpanded(false);
      }}
    >
      <div className="iteration-heading">
        <span>ITERATIONS</span>
        <span className="iteration-count">{String(assets.length).padStart(2, '0')} / {String(totalCount).padStart(2, '0')}</span>
      </div>
      <div className="iteration-list iteration-deck-list" ref={listRef} role="group" aria-label="Lineage frames">
        {assets.map((asset, index) => {
          const selected = asset.id === activeId;
          return (
            <motion.button
              type="button"
              key={asset.id}
              data-asset-id={asset.id}
              className={`iteration-thumb iteration-deck-card ${selected ? 'selected' : ''}`}
              title={`${asset.title} · Click to select · Double-click for Keeper · Right-click for actions`}
              aria-label={`Iteration ${index + 1} of ${totalCount}: ${asset.title}${asset.keeper ? ', Keeper' : ''}`}
              aria-pressed={selected}
              initial={false}
              animate={reduceMotion ? undefined : {
                x: previewing ? 0 : -index * 12,
                y: selected ? -7 : 0,
                rotate: previewing ? 0 : (index % 2 === 0 ? -1.1 : 1.1),
                scale: selected ? 1.03 : 1,
              }}
              transition={arkMotion.iteration}
              style={{ zIndex: selected ? 20 : assets.length - index }}
              onPointerDown={(event) => beginScrub(event, asset.id)}
              onPointerMove={moveScrub}
              onPointerUp={finishScrub}
              onPointerCancel={finishScrub}
              onClick={(event) => {
                if (suppressClick.current) {
                  event.preventDefault();
                  return;
                }
                if (event.shiftKey) {
                  event.preventDefault();
                  onCompare(asset.id);
                } else {
                  onSelect(asset.id);
                }
              }}
              onDoubleClick={(event) => {
                event.preventDefault();
                onToggleKeeper(asset.id);
              }}
              onContextMenu={(event) => openMenu(event, asset.id)}
              onKeyDown={(event) => cardKeys(event, index, asset)}
            >
              <img src={asset.thumb} alt="" draggable={false} />
              <span className="iteration-number">{String(index + 1).padStart(2, '0')}</span>
              {asset.keeper && <Bookmark className="iteration-bookmark" size={12} fill="currentColor" />}
              {selected && <span className="iteration-selected-mark" aria-hidden="true"><Check size={10} /></span>}
            </motion.button>
          );
        })}
      </div>
      <div className="iteration-hint">Drag to scrub <span>·</span> Double-click to keep <span>·</span> Right-click for actions</div>

      {menu && menuAsset && (
        <div
          ref={menuRef}
          className="iteration-context-menu"
          role="menu"
          aria-label={`Actions for ${menuAsset.title}`}
          style={{ left: menu.x, top: menu.y }}
          onKeyDown={menuKeys}
        >
          <div className="iteration-menu-heading"><MoreHorizontal size={15} /><span>{menuAsset.title}</span></div>
          {actions.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              className={id === 'delete' ? 'danger' : ''}
              onClick={() => runAction(id, menuAsset.id)}
              disabled={id === 'delete' && totalCount === 1 && assets.length === 1}
            >
              <Icon size={15} />
              <span>{id === 'keeper' ? (menuAsset.keeper ? 'Remove Keeper' : 'Mark as Keeper') : label}</span>
              {id === 'compare' && <span className="iteration-action-shortcut">⇧ Click</span>}
              {id === 'branch' && <CopyPlus size={12} className="iteration-action-trail" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
