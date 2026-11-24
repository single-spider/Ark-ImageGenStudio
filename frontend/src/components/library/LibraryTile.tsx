import type { MouseEvent } from 'react';
import { Bookmark, Check, Info, MoreHorizontal } from 'lucide-react';
import type { StudioAsset } from '../../types/studio';
import { libraryAspect } from '../../lib/library';

interface LibraryTileProps {
  asset: StudioAsset;
  selected?: boolean;
  fullRes?: boolean;
  size?: 'mini' | 'full';
  priority?: boolean;
  onOpen: () => void;
  onInspect: () => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onDoubleClick?: () => void;
}

export function LibraryTile({
  asset, selected = false, fullRes = false, size = 'mini', priority = false,
  onOpen, onInspect, onContextMenu, onDoubleClick,
}: LibraryTileProps) {
  return (
    <div
      className={`ark-library-tile ark-library-tile--${size} ${selected ? 'is-selected' : ''} ${fullRes ? 'is-focused' : ''}`}
      style={{ aspectRatio: libraryAspect(asset) }}
      onContextMenu={onContextMenu}
      data-asset-id={asset.id}
    >
      <img src={fullRes ? asset.src : asset.thumb} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" draggable={false} />
      <button
        type="button"
        className="ark-tile-open"
        aria-label={size === 'full' ? `Inspect ${asset.title}; double-click to open in workspace` : `Open ${asset.title} in workspace`}
        onClick={onOpen}
        onDoubleClick={onDoubleClick}
      />
      <div className="ark-tile-hover" aria-hidden="true">
        <span className="ark-tile-title">{asset.title}</span>
        <span className="ark-tile-subtitle">{asset.model}</span>
      </div>
      {asset.keeper && (
        <span className="ark-tile-keeper" aria-label="Keeper" title="Keeper"><Bookmark size={12} fill="currentColor" /></span>
      )}
      {selected && <span className="ark-tile-selected" aria-hidden="true"><Check size={13} /></span>}
      <button type="button" className="ark-tile-info" aria-label={`View detailed information for ${asset.title}`} title="Asset information" onClick={(event) => { event.stopPropagation(); onInspect(); }}><Info size={15} /></button>
      <button type="button" className="ark-tile-more" aria-label={`Actions for ${asset.title}`} title="More actions" onClick={(event) => { event.stopPropagation(); onContextMenu(event); }}><MoreHorizontal size={16} /></button>
    </div>
  );
}
