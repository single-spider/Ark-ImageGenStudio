import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { FolderTree, Grid2X2, ImagePlus, Images, Maximize2, PanelRightClose, Search, X } from 'lucide-react';
import { AssetActionMenu } from './library/AssetActionMenu';
import type { AssetMenuTarget } from './library/AssetActionMenu';
import { LibraryTile } from './library/LibraryTile';
import { filterLibrary } from '../lib/library';
import type { GalleryFilter, StudioAsset } from '../types/studio';

interface GalleryProps {
  assets: StudioAsset[];
  activeId: string;
  selectedIds: string[];
  multiSelectMode: boolean;
  onToggleSelect: (id: string) => void;
  onStartMultiSelect: (id: string) => void;
  onSelect: (id: string) => void;
  onInspect: (id: string) => void;
  onOpenFullLibrary: () => void;
  onCollapse: () => void;
  onToggleKeeper: (id: string) => void;
  onCompare: (id: string) => void;
  onAddReference: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: (file: File) => void;
  onToast: (message: string, detail?: string) => void;
}

/**
 * Mini Library: an optional dense visual tray for quick workspace selection.
 * Full metadata is deliberately delegated to the Full Library inspector.
 */
export function Gallery({
  assets, activeId, selectedIds, multiSelectMode, onToggleSelect, onStartMultiSelect,
  onSelect, onInspect, onOpenFullLibrary, onCollapse,
  onToggleKeeper, onCompare, onAddReference, onDelete, onImport, onToast,
}: GalleryProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [columns, setColumns] = useState<1 | 2 | 3 | 4>(() => {
    try {
      const saved = Number(window.localStorage.getItem('ark-mini-columns'));
      return saved === 1 || saved === 2 || saved === 3 || saved === 4 ? saved : 2;
    } catch {
      return 2;
    }
  });
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [collection, setCollection] = useState('All collections');
  const [menu, setMenu] = useState<AssetMenuTarget | null>(null);
  const dismissMenu = useCallback(() => setMenu(null), []);

  const collections = useMemo(() => [...new Set(assets.map((asset) => asset.collection))], [assets]);
  const visible = useMemo(() => filterLibrary(assets, {
    search, scope: filter, collection, recentLimit: 8,
  }), [assets, collection, filter, search]);

  function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onImport(file);
    event.target.value = '';
  }

  function openMenu(event: MouseEvent<HTMLElement>, id: string) {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ id, x: event.clientX || event.currentTarget.getBoundingClientRect().right, y: event.clientY || event.currentTarget.getBoundingClientRect().top });
  }

  const menuAsset = assets.find((asset) => asset.id === menu?.id);

  return (
    <aside className="gallery-panel mini-library-panel" aria-label="Mini Library">
      <div className="panel-heading gallery-heading">
        <h2>Library</h2>
        <div className="mini-library-heading-actions">
        <label className="gallery-import-button" title="Import local image into preview" aria-label="Import local image"><ImagePlus size={17}/><input type="file" accept="image/*" onChange={importFile}/></label>
          <button type="button" title="Open Full Library" aria-label="Open Full Library" onClick={onOpenFullLibrary}><Maximize2 size={15}/></button>
          <button type="button" title="Collapse Mini Library (L)" aria-label="Collapse Mini Library" onClick={onCollapse}><PanelRightClose size={16}/></button>
        </div>
      </div>

      <div className="gallery-search">
        <Search size={16}/>
        <input type="search" aria-label="Search Mini Library" placeholder="Search images…" value={search} onChange={(event) => setSearch(event.target.value)}/>
        {search ? <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><X size={14}/></button> : <span className="search-key">/</span>}
      </div>

      <div className="gallery-filters">
        {([['all', 'All'], ['keepers', 'Keepers'], ['recent', 'Recent']] as Array<[GalleryFilter, string]>).map(([id, label]) => (
          <button type="button" key={id} className={filter === id ? 'active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
        ))}
        <span className="filter-spacer"/>
        <button type="button" className={foldersOpen ? 'active-icon' : ''} title="Filter collections" aria-label="Toggle collection filters" onClick={() => setFoldersOpen((value) => !value)}><FolderTree size={16}/></button>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} title="Tile size (columns)">
          {([1, 2, 3, 4] as const).map((col) => (
            <button
              key={col}
              type="button"
              className={columns === col ? 'active' : ''}
              aria-pressed={columns === col}
              onClick={() => {
                setColumns(col);
                try { window.localStorage.setItem('ark-mini-columns', String(col)); } catch { /* optional */ }
              }}
              style={{ padding: '2px 5px', fontSize: 10 }}
            >
              {col === 1 ? 'XL' : col === 2 ? 'L' : col === 3 ? 'M' : 'S'}
            </button>
          ))}
        </div>
      </div>

      {foldersOpen && (
        <div className="gallery-folders" aria-label="Mini Library collections">
          <button type="button" className={collection === 'All collections' ? 'active' : ''} onClick={() => setCollection('All collections')}>All collections <span>{assets.length}</span></button>
          {collections.map((name) => (
            <button type="button" key={name} className={collection === name ? 'active' : ''} onClick={() => setCollection(name)}>{name}<span>{assets.filter((asset) => asset.collection === name).length}</span></button>
          ))}
        </div>
      )}

      <div className="gallery-results-head"><span><Grid2X2 size={13}/> {visible.length} IMAGES</span></div>
      <div className="gallery-scroll">
        {visible.length ? (
          <div className={`ark-mini-masonry columns-${columns}`}>
            {visible.map((asset, index) => (
              <div className="ark-mini-masonry-item" key={asset.id}>
                <LibraryTile
                  asset={asset}
                  selected={multiSelectMode ? selectedIds.includes(asset.id) : activeId === asset.id}
                  size="mini"
                  priority={index < 4}
                  onOpen={() => (multiSelectMode ? onToggleSelect(asset.id) : onSelect(asset.id))}
                  onInspect={() => onInspect(asset.id)}
                  onContextMenu={(event) => openMenu(event, asset.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="gallery-empty">
            <Images size={25}/><strong>No matching images</strong><span>Try another search or collection.</span>
            <button type="button" onClick={() => { setSearch(''); setFilter('all'); setCollection('All collections'); }}>Clear filters</button>
          </div>
        )}
      </div>
      {menu && menuAsset && (
        <AssetActionMenu
          asset={menuAsset} position={menu} onDismiss={dismissMenu}
          onSelect={onStartMultiSelect}
          onOpen={onSelect} onInspect={onInspect}
          onCompare={onCompare} onAddReference={onAddReference}
          onToggleKeeper={onToggleKeeper} onDelete={onDelete} onToast={onToast}
        />
      )}
    </aside>
  );
}
