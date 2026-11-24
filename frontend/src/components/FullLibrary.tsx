import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';
import {
  ArrowUpDown, Bookmark, CalendarDays, ChevronRight, Copy, Folder,
  FolderOpen, GitCompareArrows, ImagePlus, Images, Info, Layers, Layers3,
  LayoutGrid, Maximize2, Search, Sparkles, Trash2, X,
} from 'lucide-react';
import { AssetActionMenu } from './library/AssetActionMenu';
import type { AssetMenuTarget } from './library/AssetActionMenu';
import { LibraryTile } from './library/LibraryTile';
import { LineagePacksView } from './library/LineagePacksView';
import { filterLibrary, resolveLibraryAssetId } from '../lib/library';
import type { LibraryScope, LibrarySort } from '../lib/library';
import { solveOrganicMasonry } from '../lib/organicMasonry';
import type { StudioAsset } from '../types/studio';

interface FullLibraryProps {
  assets: StudioAsset[];
  scratchpadAssets: StudioAsset[];
  trashAssets: StudioAsset[];
  activeId: string;
  initialInspectId?: string | null;
  selectedIds: string[];
  multiSelectMode: boolean;
  onToggleSelect: (id: string) => void;
  onStartMultiSelect: (id: string) => void;
  onSpaceChange?: (space: 'scratchpad' | 'trash' | null) => void;
  onEmptyTrash: () => void;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCompare: (id: string) => void;
  onAddReference: (id: string) => void;
  onToggleKeeper: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: (file: File) => void;
  onToast: (message: string, detail?: string) => void;
}

const views: Array<{ id: LibraryScope; label: string; icon: typeof Images }> = [
  { id: 'all', label: 'All images', icon: Images },
  { id: 'keepers', label: 'Keepers', icon: Bookmark },
  { id: 'recent', label: 'Recently added', icon: CalendarDays },
  { id: 'imports', label: 'Imports', icon: ImagePlus },
  { id: 'generations', label: 'Generations', icon: Sparkles },
];

const GAP = 6;

export function FullLibrary({
  assets, scratchpadAssets, trashAssets, activeId, initialInspectId,
  selectedIds, multiSelectMode, onToggleSelect, onStartMultiSelect, onSpaceChange, onEmptyTrash, onClose,
  onSelect, onCompare, onAddReference, onToggleKeeper,
  onDelete, onImport, onToast,
}: FullLibraryProps) {
  const [scope, setScope] = useState<LibraryScope>('all');
  const [specialSpace, setSpecialSpace] = useState<'scratchpad' | 'trash' | null>(null);
  const [collection, setCollection] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [sort, setSort] = useState<LibrarySort>('newest');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'stacks'>('grid');
  const [tileSize, setTileSize] = useState<number>(() => {
    try {
      const saved = Number(window.localStorage.getItem('ark-full-tile-size'));
      return Number.isFinite(saved) && saved >= 120 && saved <= 360 ? saved : 210;
    } catch {
      return 210;
    }
  });
  const [inspectorOpen, setInspectorOpen] = useState(Boolean(initialInspectId));
  const [inspectedId, setInspectedId] = useState<string | null>(initialInspectId ?? null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [reflowing, setReflowing] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(760);
  const [menu, setMenu] = useState<AssetMenuTarget | null>(null);
  const [viewportWidth, setViewportWidth] = useState(940);
  const lastColsRef = useRef<Map<number, number>>(new Map());

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dismissMenu = useCallback(() => setMenu(null), []);

  const catalog = specialSpace === 'scratchpad' ? scratchpadAssets : specialSpace === 'trash' ? trashAssets : assets;
  const collections = useMemo(() => [...new Set(assets.map((asset) => asset.collection))].sort(), [assets]);
  const models = useMemo(() => [...new Set(assets.map((asset) => asset.model))].sort(), [assets]);
  const catalogById = useMemo(() => new Map(catalog.map((asset) => [asset.id, asset])), [catalog]);
  const collectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of catalog) counts.set(asset.collection, (counts.get(asset.collection) ?? 0) + 1);
    return counts;
  }, [catalog]);
  const scopeCounts = useMemo(() => {
    let keepers = 0;
    let imports = 0;
    let generations = 0;
    for (const asset of catalog) {
      if (asset.keeper) keepers += 1;
      if (asset.collection === 'Imports') imports += 1;
      if (asset.collection === 'New Generations') generations += 1;
    }
    return {
      all: catalog.length,
      keepers,
      recent: Math.min(36, catalog.length),
      imports,
      generations,
    } satisfies Record<LibraryScope, number>;
  }, [catalog]);

  const visible = useMemo(() => filterLibrary(catalog, {
    search, scope, collection: collection ?? undefined, model: model ?? undefined,
    sort, recentLimit: 36,
  }), [catalog, collection, model, scope, search, sort]);

  const selected = useMemo(() => catalogById.get(inspectedId ?? '')
    ?? assets.find((asset) => asset.id === resolveLibraryAssetId(inspectedId ?? ''))
    ?? null, [assets, catalogById, inspectedId]);

  const availableWidth = Math.max(340, viewportWidth - 30);
  const columns = Math.max(2, Math.min(9, Math.floor(availableWidth / tileSize)));
  const focusIdx = useMemo(() => (focusedId ? visible.findIndex((a) => a.id === focusedId) : -1), [focusedId, visible]);

  const masonry = useMemo(() => {
    const res = solveOrganicMasonry(visible, focusIdx, lastColsRef.current, availableWidth, columns, GAP);
    lastColsRef.current = res.nextCols;
    return res;
  }, [visible, focusIdx, availableWidth, columns]);

  useEffect(() => {
    setReflowing(true);
    const timer = window.setTimeout(() => setReflowing(false), 450);
    return () => window.clearTimeout(timer);
  }, [focusedId, columns]);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect?.width) setViewportWidth(rect.width);
      if (rect?.height) setViewportHeight(rect.height);
    });
    observer.observe(element);
    setViewportWidth(element.clientWidth);
    setViewportHeight(element.clientHeight);
    const onScroll = () => setScrollTop(element.scrollTop);
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', onScroll);
    };
  }, [inspectorOpen]);

  useEffect(() => {
    onSpaceChange?.(specialSpace);
  }, [specialSpace, onSpaceChange]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [scope, specialSpace, search, collection, model, sort]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = bodyOverflow;
      previous?.focus();
    };
  }, []);

  function selectScope(next: LibraryScope) {
    setSpecialSpace(null);
    setScope(next);
    setCollection(null);
    setModel(null);
  }

  function inspect(id: string) {
    setInspectedId(id);
    setInspectorOpen(true);
  }

  function openWorkspace(id: string) {
    onSelect(resolveLibraryAssetId(id));
    onClose();
  }

  function compareAsset(id: string) {
    onCompare(resolveLibraryAssetId(id));
    onClose();
  }

  function sendReference(id: string) {
    onAddReference(resolveLibraryAssetId(id));
    onToast('Sent to reference slot', 'The image is available in Studio Controls.');
  }

  function toggleKeeper(id: string) {
    onToggleKeeper(resolveLibraryAssetId(id));
  }

  function deletePreview(id: string) {
    onDelete(resolveLibraryAssetId(id));
    setInspectedId(null);
    setInspectorOpen(false);
  }

  function contextMenu(event: MouseEvent<HTMLElement>, id: string) {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ id, x: event.clientX || event.currentTarget.getBoundingClientRect().right, y: event.clientY || event.currentTarget.getBoundingClientRect().top });
  }

  function dialogKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !menu) {
      event.preventDefault();
      onClose();
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
    )).filter((node) => node.getBoundingClientRect().width > 0);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onImport(file);
      setSpecialSpace(null);
      setScope('all');
      setCollection(null);
      setModel(null);
      setSearch('');
    }
    event.target.value = '';
  }

  async function copyPrompt(asset: StudioAsset) {
    try {
      await navigator.clipboard.writeText(asset.prompt);
      onToast('Prompt copied', asset.title);
    } catch {
      onToast('Clipboard unavailable', 'Allow clipboard access in this browser.');
    }
  }

  const menuAsset = catalog.find((asset) => asset.id === menu?.id);
  const realCount = assets.length;

  return (
    <div ref={dialogRef} className="ark-full-library" role="dialog" aria-modal="true" aria-label="Full Image Library" onKeyDown={dialogKeys}>
      <header className="ark-library-topbar">
        <div className="ark-library-mark"><Layers3 size={20}/></div>
        <div className="ark-library-brand"><span>ARK / ARCHIVE</span><strong>Image Library</strong></div>
        <div className="ark-library-breadcrumb"><ChevronRight size={13}/>{specialSpace === 'scratchpad' ? 'Scratchpad' : specialSpace === 'trash' ? 'Garbage Bin' : collection ?? views.find((view) => view.id === scope)?.label}<span>/</span>{visible.length} images</div>
        <div className="ark-library-topbar-spacer"/>
        <div className="ark-library-topbar-meta"><span className="status-dot"/> LOCAL STUDIO <span>·</span> {realCount} assets</div>
        <label className="ark-library-import">
          <ImagePlus size={16}/><span>Import image</span>
          <input type="file" accept="image/*" onChange={importFile} aria-label="Import an image into library"/>
        </label>
        <button ref={closeRef} type="button" className="ark-library-close" onClick={onClose} title="Return to studio (Esc)" aria-label="Close Full Library"><X size={21}/></button>
      </header>

      <div className={`ark-library-shell ${inspectorOpen ? 'inspector-visible' : ''}`}>
        <nav className="ark-library-sidebar" aria-label="Library navigation">
          <div className="ark-sidebar-section-label">QUICK VIEWS</div>
          <div className="ark-sidebar-nav">
            {views.map(({ id, label, icon: Icon }) => (
              <button type="button" key={id} className={!specialSpace && scope === id && !collection && !model ? 'active' : ''} onClick={() => selectScope(id)}>
                <Icon size={16}/><span>{label}</span><small>{scopeCounts[id]}</small>
              </button>
            ))}
          </div>

          <div className="ark-sidebar-section-label">STAGING &amp; BIN</div>
          <div className="ark-sidebar-nav">
            <button type="button" className={specialSpace === 'scratchpad' ? 'active' : ''} onClick={() => { setSpecialSpace('scratchpad'); setCollection(null); setModel(null); }}>
              <Layers size={16} style={{ color: '#60a5fa' }}/><span>Scratchpad</span><small>{scratchpadAssets.length}</small>
            </button>
            <button type="button" className={specialSpace === 'trash' ? 'active' : ''} onClick={() => { setSpecialSpace('trash'); setCollection(null); setModel(null); }}>
              <Trash2 size={16} style={{ color: '#f87171' }}/><span>Garbage Bin</span><small>{trashAssets.length}</small>
            </button>
          </div>

          <div className="ark-sidebar-section-label">COLLECTIONS <span>{collections.length}</span></div>
          <div className="ark-sidebar-nav ark-sidebar-folders">
            {collections.map((name) => (
              <button type="button" key={name} className={collection === name ? 'active' : ''} onClick={() => { setSpecialSpace(null); setScope('all'); setCollection(name); setModel(null); }}>
                {collection === name ? <FolderOpen size={15}/> : <Folder size={15}/>}
                <span>{name}</span><small>{collectionCounts.get(name) ?? 0}</small>
              </button>
            ))}
          </div>

          <div className="ark-sidebar-section-label">IMAGE ENGINES</div>
          <div className="ark-sidebar-nav ark-sidebar-models">
            {models.map((name) => (
              <button type="button" key={name} className={model === name ? 'active' : ''} onClick={() => { setSpecialSpace(null); setScope('all'); setCollection(null); setModel(name); }}>
                <Layers3 size={14}/><span>{name}</span>
              </button>
            ))}
          </div>
          <div className="ark-library-sidebar-foot"><Info size={15}/><span>Right-click any image → Select to enter multi-select mode.</span></div>
        </nav>

        <main className="ark-library-main">
          <div className="ark-library-workhead">
            <div>
              <span className="section-kicker">VISUAL ASSET WORKSPACE</span>
              <h1>{specialSpace === 'scratchpad' ? 'Scratchpad' : specialSpace === 'trash' ? 'Garbage Bin' : collection ?? model ?? views.find((view) => view.id === scope)?.label}</h1>
              <p>{specialSpace === 'trash' ? 'Isolated from the main studio. Empty permanently or select to restore.' : specialSpace === 'scratchpad' ? 'Temporary staging area hidden from main views.' : 'Browse visually, inspect metadata, and send images straight into your studio.'}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {specialSpace === 'trash' && trashAssets.length > 0 && (
                <button type="button" className="ark-library-inspector-toggle" style={{ color: '#f87171', borderColor: 'rgba(248,113,113,0.35)' }} onClick={onEmptyTrash}>
                  <Trash2 size={15}/> Empty Bin ({trashAssets.length})
                </button>
              )}
              <button type="button" className="ark-library-inspector-toggle" onClick={() => {
                if (!inspectorOpen && !selected) setInspectedId(visible[0]?.id ?? null);
                setInspectorOpen((open) => !open);
              }}>
                <Info size={16}/>{inspectorOpen ? 'Hide details' : 'Show details'}
              </button>
            </div>
          </div>

          <div className="ark-library-tools">
            <label className="ark-library-global-search">
              <Search size={17}/>
              <input type="search" placeholder="Search titles, prompts, models, seeds or IDs…" aria-label="Search Full Library" value={search} onChange={(event) => setSearch(event.target.value)}/>
              {search && <button type="button" title="Clear search" aria-label="Clear search" onClick={() => setSearch('')}><X size={15}/></button>}
            </label>
            <label className="ark-library-sort">
              <ArrowUpDown size={15}/>
              <select aria-label="Sort images" value={sort} onChange={(event) => setSort(event.target.value as LibrarySort)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title">By title</option>
                <option value="model">By model</option>
              </select>
            </label>
            <label className="ark-library-sort" title="Adjust tile size" style={{ gap: 8 }}>
              <LayoutGrid size={15}/>
              <input
                type="range"
                min={120}
                max={340}
                step={10}
                value={tileSize}
                aria-label="Tile size"
                onChange={(event) => {
                  const v = Number(event.target.value);
                  setTileSize(v);
                  try { window.localStorage.setItem('ark-full-tile-size', String(v)); } catch { /* optional */ }
                }}
                style={{ width: 88, accentColor: 'currentColor' }}
              />
              <span style={{ fontSize: 11, opacity: 0.75, minWidth: 34 }}>{tileSize}px</span>
            </label>
            <div className="ark-view-mode-switch" role="group" aria-label="Library view mode">
              <button
                type="button"
                className={viewMode === 'grid' ? 'active' : ''}
                onClick={() => setViewMode('grid')}
                title="Masonry grid view"
              >
                <LayoutGrid size={14} /> Grid
              </button>
              <button
                type="button"
                className={viewMode === 'stacks' ? 'active' : ''}
                onClick={() => setViewMode('stacks')}
                title="Lineage stacks view"
              >
                <Layers size={14} /> Stacks
              </button>
            </div>
          </div>

          <div className="ark-library-grid-summary">
            <span><LayoutGrid size={14}/> {visible.length.toLocaleString()} IMAGES <span className="ark-library-summary-separator">/</span> {viewMode === 'stacks' ? 'LINEAGE PACKS' : `${columns} COLUMNS`}</span>
            <span>{viewMode === 'stacks' ? 'SCROLL OVER ANY STACK TO FLIP CARDS · CLICK TO EXPAND LINEAGE' : multiSelectMode ? 'MULTI-SELECT ACTIVE · CLICK IMAGES TO SELECT' : focusedId ? 'CLICK EXPANDED TILE TO COLLAPSE · DOUBLE-CLICK TO OPEN' : 'CLICK TO EXPAND IN-PLACE · DOUBLE-CLICK TO OPEN · RIGHT-CLICK FOR ACTIONS'}</span>
          </div>

          <div className="ark-library-scroller" ref={scrollerRef} tabIndex={0} aria-label="Scrollable image grid">
            {visible.length ? (
              viewMode === 'stacks' ? (
                <LineagePacksView
                  visible={visible}
                  allAssets={catalog}
                  activeId={activeId}
                  selectedIds={selectedIds}
                  multiSelectMode={multiSelectMode}
                  onToggleSelect={onToggleSelect}
                  onOpenWorkspace={openWorkspace}
                  onInspect={inspect}
                  onContextMenu={contextMenu}
                />
              ) : (
              <div className="ark-library-virtual-plane" style={{ height: masonry.totalH }}>
                {visible.map((asset, index) => {
                  const r = masonry.rects[index];
                  if (!r) return null;
                  if (r.y + r.h < scrollTop - 600 || r.y > scrollTop + viewportHeight + 600) return null;
                  const isFocused = asset.id === focusedId;
                  return (
                    <div
                      className={`ark-library-virtual-cell ${reflowing ? 'is-reflowing' : ''}`}
                      key={asset.id}
                      style={{
                        left: r.x,
                        top: r.y,
                        width: r.w,
                        height: r.h,
                        zIndex: isFocused ? 6 : 1,
                      }}
                    >
                      <LibraryTile
                        asset={asset}
                        size="full"
                        fullRes={isFocused}
                        selected={multiSelectMode ? selectedIds.includes(asset.id) : (inspectedId === asset.id || (!inspectorOpen && activeId === resolveLibraryAssetId(asset.id)))}
                        onOpen={() => {
                          if (multiSelectMode) {
                            onToggleSelect(asset.id);
                          } else {
                            setFocusedId((prev) => (prev === asset.id ? null : asset.id));
                            setInspectedId(asset.id);
                          }
                        }}
                        onInspect={() => inspect(asset.id)}
                        onDoubleClick={() => { if (!multiSelectMode) openWorkspace(asset.id); }}
                        onContextMenu={(event) => contextMenu(event, asset.id)}
                      />
                    </div>
                  );
                })}
              </div>
              )
            ) : (
              <div className="ark-library-empty">
                <Images size={32}/><h3>Nothing in this view</h3>
                <p>Try a different search, collection, or image engine.</p>
                <button type="button" onClick={() => { setScope('all'); setCollection(null); setModel(null); setSearch(''); }}>Clear all filters</button>
              </div>
            )}
          </div>

          <footer className="ark-library-footer">
            <span><span className="status-dot"/> {multiSelectMode ? `${selectedIds.length} selected · click tiles to toggle` : 'Local SQLite & Downloads/Images library'}</span>
            <span><Maximize2 size={13}/> {inspectorOpen ? 'Inspector active' : 'Image-only view'} <span className="ark-library-foot-dot">·</span> Esc to studio</span>
          </footer>
        </main>

        {inspectorOpen && (
          <aside className="ark-library-inspector" aria-label="Asset inspector">
            <div className="ark-inspector-heading"><span>IMAGE INSPECTOR</span><button type="button" title="Hide details" aria-label="Hide details panel" onClick={() => setInspectorOpen(false)}><X size={18}/></button></div>
            {selected ? (
              <div className="ark-inspector-scroll">
                <div className="ark-inspector-preview"><img src={selected.src} alt={selected.title}/></div>
                <div className="ark-inspector-title">
                  <span>SELECTED ASSET</span>
                  <h2>{selected.title}</h2>
                  {selected.keeper && <small><Bookmark size={13} fill="currentColor"/> Keeper</small>}
                </div>
                <div className="ark-inspector-primary-actions">
                  <button type="button" className="primary" onClick={() => openWorkspace(selected.id)}><Images size={15}/> Open in studio</button>
                  <button type="button" onClick={() => compareAsset(selected.id)} title="Compare with active canvas image"><GitCompareArrows size={16}/></button>
                  <button type="button" onClick={() => sendReference(selected.id)} title="Send to reference"><ImagePlus size={16}/></button>
                </div>
                <div className="ark-inspector-section-heading">TECHNICAL DETAILS</div>
                <dl className="ark-inspector-facts">
                  <div><dt>Model</dt><dd>{selected.model}</dd></div>
                  <div><dt>Aspect</dt><dd>{selected.ratio}</dd></div>
                  <div><dt>Seed</dt><dd>{selected.seed || 'Unknown'}</dd></div>
                  <div><dt>Created</dt><dd>{selected.createdAt}</dd></div>
                  <div><dt>Collection</dt><dd>{selected.collection}</dd></div>
                  <div><dt>Keeper</dt><dd>{selected.keeper ? 'Yes' : 'No'}</dd></div>
                </dl>
                <div className="ark-inspector-section-heading">PROMPT <button type="button" title="Copy prompt" aria-label="Copy prompt" onClick={() => { void copyPrompt(selected); }}><Copy size={15}/></button></div>
                <p className="ark-inspector-prompt">{selected.prompt || 'No prompt recorded for this image.'}</p>
                <div className="ark-inspector-section-heading">IDENTIFIERS</div>
                <dl className="ark-inspector-ids">
                  <div><dt>Asset ID</dt><dd>{resolveLibraryAssetId(selected.id)}</dd></div>
                  {selected.parentId && <div><dt>Parent ID</dt><dd>{selected.parentId}</dd></div>}
                  {selected.lineageId && <div><dt>Lineage</dt><dd>{selected.lineageId}</dd></div>}
                </dl>
                <div className="ark-inspector-secondary-actions">
                  <button type="button" onClick={() => toggleKeeper(selected.id)}><Bookmark size={15}/>{selected.keeper ? 'Remove Keeper' : 'Mark as Keeper'}</button>
                  <button type="button" className="danger" onClick={() => deletePreview(selected.id)}><Trash2 size={15}/> Move to Garbage Bin</button>
                </div>
              </div>
            ) : (
              <div className="ark-inspector-placeholder"><Info size={27}/><strong>Choose an image</strong><span>Select a tile or press its information symbol to view its details here.</span></div>
            )}
          </aside>
        )}
      </div>

      {menu && menuAsset && (
        <AssetActionMenu
          asset={menuAsset} position={menu} onDismiss={dismissMenu}
          onSelect={onStartMultiSelect}
          onOpen={openWorkspace} onInspect={inspect}
          onCompare={compareAsset} onAddReference={sendReference}
          onToggleKeeper={toggleKeeper} onDelete={deletePreview} onToast={onToast}
        />
      )}
    </div>
  );
}
