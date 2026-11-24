import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, CheckSquare, Copy, GitCompareArrows, ImagePlus, Images, Trash2, X } from 'lucide-react';
import type { StudioAsset } from '../../types/studio';

export interface AssetMenuTarget {
  id: string;
  x: number;
  y: number;
}

interface AssetActionMenuProps {
  asset: StudioAsset;
  position: AssetMenuTarget;
  onDismiss: () => void;
  onSelect?: (id: string) => void;
  onOpen: (id: string) => void;
  onInspect: (id: string) => void;
  onCompare: (id: string) => void;
  onAddReference: (id: string) => void;
  onToggleKeeper: (id: string) => void;
  onDelete: (id: string) => void;
  onToast: (message: string, detail?: string) => void;
}

export function AssetActionMenu({
  asset, position, onDismiss, onSelect, onOpen, onInspect, onCompare,
  onAddReference, onToggleKeeper, onDelete, onToast,
}: AssetActionMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const originalFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    originalFocus.current = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const handlePointer = (event: globalThis.PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onDismiss();
    };
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
        originalFocus.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointer, true);
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointer, true);
      document.removeEventListener('keydown', handleKey, true);
    };
  }, [onDismiss]);

  function keys(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(asset.prompt);
      onToast('Prompt copied', asset.title);
    } catch {
      onToast('Clipboard unavailable', 'Allow clipboard access in this browser.');
    }
  }

  function act(callback: () => void) {
    onDismiss();
    callback();
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={`Actions for ${asset.title}`}
      className="ark-asset-menu"
      style={{ left: Math.max(8, Math.min(position.x, window.innerWidth - 235)), top: Math.max(8, Math.min(position.y, window.innerHeight - 340)) }}
      onKeyDown={keys}
    >
      <div className="ark-asset-menu-head"><span>{asset.title}</span><button type="button" aria-label="Close actions" onClick={onDismiss}><X size={13}/></button></div>
      {onSelect && (
        <button type="button" role="menuitem" onClick={() => act(() => onSelect(asset.id))}><CheckSquare size={15}/> Select (Multi-select)</button>
      )}
      <button type="button" role="menuitem" onClick={() => act(() => onOpen(asset.id))}><Images size={15}/> Open in workspace</button>
      <button type="button" role="menuitem" onClick={() => act(() => onInspect(asset.id))}><Images size={15}/> Asset details</button>
      <button type="button" role="menuitem" onClick={() => act(() => onCompare(asset.id))}><GitCompareArrows size={15}/> Compare with main</button>
      <button type="button" role="menuitem" onClick={() => act(() => onAddReference(asset.id))}><ImagePlus size={15}/> Send to reference</button>
      <button type="button" role="menuitem" onClick={() => act(() => onToggleKeeper(asset.id))}><Bookmark size={15}/> {asset.keeper ? 'Remove Keeper' : 'Mark as Keeper'}</button>
      <button type="button" role="menuitem" onClick={() => { onDismiss(); void copyPrompt(); }}><Copy size={15}/> Copy prompt</button>
      <div className="ark-asset-menu-sep" />
      <button type="button" role="menuitem" className="danger" onClick={() => act(() => onDelete(asset.id))}><Trash2 size={15}/> Move to Garbage Bin</button>
    </div>,
    document.body,
  );
}
