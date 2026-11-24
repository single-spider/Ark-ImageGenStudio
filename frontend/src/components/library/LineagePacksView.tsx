import { useMemo, useState } from 'react';
import type { MouseEvent, WheelEvent } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, Expand, Layers, Sparkles, X } from 'lucide-react';
import { LibraryTile } from './LibraryTile';
import type { StudioAsset } from '../../types/studio';

export interface LineagePack {
  key: string;
  refs: StudioAsset[];
  cards: StudioAsset[];
  keeperCount: number;
  latestTimestamp: number;
}

interface LineagePacksViewProps {
  visible: StudioAsset[];
  allAssets: StudioAsset[];
  activeId: string;
  selectedIds: string[];
  multiSelectMode: boolean;
  onToggleSelect: (id: string) => void;
  onOpenWorkspace: (id: string) => void;
  onInspect: (id: string) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>, id: string) => void;
}

export function LineagePacksView({
  visible,
  allAssets,
  activeId,
  selectedIds,
  multiSelectMode,
  onToggleSelect,
  onOpenWorkspace,
  onInspect,
  onContextMenu,
}: LineagePacksViewProps) {
  const [stacksOnly, setStacksOnly] = useState(true);
  const [cardIndices, setCardIndices] = useState<Record<string, number>>({});
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const byId = useMemo(() => {
    const map = new Map<string, StudioAsset>();
    for (const a of allAssets) map.set(a.id, a);
    for (const a of visible) map.set(a.id, a);
    return map;
  }, [allAssets, visible]);

  const packs = useMemo<LineagePack[]>(() => {
    const groups = new Map<string, StudioAsset[]>();
    for (const asset of visible) {
      const key = asset.lineageId || asset.id;
      const list = groups.get(key);
      if (list) list.push(asset);
      else groups.set(key, [asset]);
    }

    const result: LineagePack[] = [];
    for (const [key, groupItems] of groups.entries()) {
      const rootAsset = byId.get(key);
      const refMap = new Map<string, StudioAsset>();

      // If the root is a source/imported image and there are generated children, treat root as a reference
      const hasGenerated = groupItems.some((item) => item.id !== key || item.libraryCategory === 'generated');
      if (rootAsset && (rootAsset.libraryCategory === 'source' || (hasGenerated && groupItems.length > 1))) {
        refMap.set(rootAsset.id, rootAsset);
      }
      for (const item of groupItems) {
        for (const rid of item.refIds ?? []) {
          const refAsset = byId.get(rid);
          if (refAsset && refAsset.id !== item.id) {
            refMap.set(refAsset.id, refAsset);
          }
        }
        if (item.parentId) {
          const parentAsset = byId.get(item.parentId);
          if (parentAsset && parentAsset.id !== item.id && parentAsset.libraryCategory === 'source') {
            refMap.set(parentAsset.id, parentAsset);
          }
        }
      }

      const refs = Array.from(refMap.values());
      const refIdsSet = new Set(refs.map((r) => r.id));
      let cards = groupItems.filter((item) => !refIdsSet.has(item.id));
      if (cards.length === 0) cards = groupItems;

      // Keepers/finals first or newest first
      cards = [...cards].sort((a, b) => {
        if (a.keeper !== b.keeper) return a.keeper ? -1 : 1;
        return (b.timestamp ?? 0) - (a.timestamp ?? 0);
      });

      const latestTimestamp = Math.max(...groupItems.map((i) => i.timestamp ?? 0), 0);
      const keeperCount = cards.filter((c) => c.keeper).length;
      result.push({ key, refs, cards, keeperCount, latestTimestamp });
    }

    result.sort((a, b) => {
      if ((b.cards.length > 1) !== (a.cards.length > 1)) return b.cards.length > 1 ? 1 : -1;
      return b.latestTimestamp - a.latestTimestamp;
    });
    return result;
  }, [visible, byId]);

  const multiCount = useMemo(() => packs.filter((p) => p.cards.length > 1 || p.refs.length > 0).length, [packs]);
  const shownPacks = useMemo(
    () => (stacksOnly && multiCount > 0 ? packs.filter((p) => p.cards.length > 1 || p.refs.length > 0) : packs),
    [packs, stacksOnly, multiCount],
  );
  const expandedPack = useMemo(
    () => (expandedKey ? packs.find((p) => p.key === expandedKey) ?? null : null),
    [packs, expandedKey],
  );

  function shiftCard(packKey: string, count: number, delta: number) {
    if (count <= 1) return;
    setCardIndices((prev) => {
      const curr = prev[packKey] ?? 0;
      const next = (curr + delta + count) % count;
      return { ...prev, [packKey]: next };
    });
  }

  function handleDeckWheel(event: WheelEvent<HTMLDivElement>, pack: LineagePack) {
    if (pack.cards.length <= 1) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY > 0 || event.deltaX > 0 ? 1 : -1;
    shiftCard(pack.key, pack.cards.length, delta);
  }

  return (
    <div className="ark-packs-wrap">
      <div className="ark-packs-bar">
        <div className="ark-packs-summary">
          <Layers size={15} />
          <span>{shownPacks.length} lineage packs</span>
          <small>Scroll over any stack to flip cards · Click stack to expand</small>
        </div>
        <div className="ark-packs-filters">
          <button
            type="button"
            className={`ark-pack-filter-btn ${stacksOnly ? 'active' : ''}`}
            onClick={() => setStacksOnly(true)}
          >
            Lineage Stacks ({multiCount})
          </button>
          <button
            type="button"
            className={`ark-pack-filter-btn ${!stacksOnly ? 'active' : ''}`}
            onClick={() => setStacksOnly(false)}
          >
            All ({packs.length})
          </button>
        </div>
      </div>

      <div className="ark-packs-grid">
        {shownPacks.map((pack) => {
          const idx = (cardIndices[pack.key] ?? 0) % pack.cards.length;
          const topCard = pack.cards[idx];
          const stackLayers = pack.cards.slice(0, 4);

          return (
            <article key={pack.key} className="ark-pack-card">
              {/* Left: Reference Images */}
              <div className="ark-pack-refs">
                <div className="ark-pack-zone-label">
                  <span>REFERENCES</span>
                  <small>{pack.refs.length || 0}</small>
                </div>
                {pack.refs.length > 0 ? (
                  <div className={`ark-pack-ref-pair count-${Math.min(pack.refs.length, 2)}`}>
                    {pack.refs.slice(0, 2).map((refAsset, rIdx) => (
                      <button
                        key={refAsset.id}
                        type="button"
                        className="ark-pack-ref-slot"
                        title={`Open reference: ${refAsset.title}`}
                        onClick={() => onOpenWorkspace(refAsset.id)}
                        onContextMenu={(e) => onContextMenu(e, refAsset.id)}
                      >
                        <img src={refAsset.thumb} alt={refAsset.title} loading="lazy" />
                        {rIdx === 1 && pack.refs.length > 2 && (
                          <span className="ark-pack-ref-more">+{pack.refs.length - 2}</span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="ark-pack-ref-empty">
                    <Sparkles size={16} />
                    <span>{topCard.prompt ? topCard.prompt.slice(0, 84) + (topCard.prompt.length > 84 ? '…' : '') : 'Prompt-only generation'}</span>
                  </div>
                )}
              </div>

              {/* Right: Scrollable Stacked Deck */}
              <div
                className="ark-pack-deck-zone"
                onWheel={(e) => handleDeckWheel(e, pack)}
              >
                <div className="ark-pack-zone-label">
                  <span>STACK ({idx + 1}/{pack.cards.length})</span>
                  {pack.keeperCount > 0 && (
                    <small className="ark-pack-keeper-pill">
                      <Bookmark size={11} fill="currentColor" /> {pack.keeperCount}
                    </small>
                  )}
                </div>

                <div
                  className="ark-pack-deck"
                  onClick={() => {
                    if (multiSelectMode) {
                      onToggleSelect(topCard.id);
                    } else {
                      setExpandedKey(pack.key);
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onOpenWorkspace(topCard.id);
                  }}
                  onContextMenu={(e) => onContextMenu(e, topCard.id)}
                  title="Scroll to flip stack · Click to expand lineage · Double-click to open"
                >
                  {stackLayers.map((layerCard, layerIdx) => {
                    const isTop = layerIdx === 0;
                    const displayCard = isTop ? topCard : pack.cards[(idx + layerIdx) % pack.cards.length];
                    return (
                      <div
                        key={`${layerCard.id}-${layerIdx}`}
                        className={`ark-pack-layer ${isTop ? 'is-top' : ''} ${selectedIds.includes(topCard.id) && isTop ? 'is-selected' : ''}`}
                        style={{
                          zIndex: stackLayers.length - layerIdx,
                          transform: isTop
                            ? 'translate3d(0, 0, 0) rotate(0deg)'
                            : `translate3d(${-layerIdx * 7}px, ${-layerIdx * 4}px, 0) rotate(${-layerIdx * 2.4}deg)`,
                        }}
                      >
                        <img src={displayCard.thumb} alt={displayCard.title} loading="lazy" />
                        {isTop && (
                          <div className="ark-pack-top-overlay">
                            {topCard.keeper && (
                              <span className="ark-pack-top-keeper" title="Keeper">
                                <Bookmark size={12} fill="currentColor" />
                              </span>
                            )}
                            <span className="ark-pack-expand-hint">
                              <Expand size={12} /> Expand
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {pack.cards.length > 1 && (
                  <div className="ark-pack-deck-controls">
                    <button
                      type="button"
                      aria-label="Previous card in stack"
                      onClick={(e) => {
                        e.stopPropagation();
                        shiftCard(pack.key, pack.cards.length, -1);
                      }}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span>{topCard.model}</span>
                    <button
                      type="button"
                      aria-label="Next card in stack"
                      onClick={(e) => {
                        e.stopPropagation();
                        shiftCard(pack.key, pack.cards.length, 1);
                      }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Expanded Lineage Pack Drawer / Modal */}
      {expandedPack && (
        <div className="ark-pack-modal-backdrop" onClick={() => setExpandedKey(null)}>
          <div className="ark-pack-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ark-pack-modal-head">
              <div>
                <span className="section-kicker">LINEAGE PACK</span>
                <h2>{expandedPack.cards.length} iterations · {expandedPack.refs.length} references</h2>
              </div>
              <button type="button" className="ark-library-close" onClick={() => setExpandedKey(null)} aria-label="Close pack">
                <X size={18} />
              </button>
            </div>

            {expandedPack.refs.length > 0 && (
              <div className="ark-pack-modal-section">
                <h3>Reference Inputs</h3>
                <div className="ark-pack-modal-refs">
                  {expandedPack.refs.map((refAsset) => (
                    <LibraryTile
                      key={refAsset.id}
                      asset={refAsset}
                      size="full"
                      selected={multiSelectMode ? selectedIds.includes(refAsset.id) : refAsset.id === activeId}
                      onOpen={() => {
                        if (multiSelectMode) onToggleSelect(refAsset.id);
                        else onOpenWorkspace(refAsset.id);
                      }}
                      onInspect={() => onInspect(refAsset.id)}
                      onDoubleClick={() => { if (!multiSelectMode) onOpenWorkspace(refAsset.id); }}
                      onContextMenu={(event) => onContextMenu(event, refAsset.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="ark-pack-modal-section">
              <h3>Generated Stack ({expandedPack.cards.length})</h3>
              <div className="ark-pack-modal-cards">
                {expandedPack.cards.map((card) => (
                  <LibraryTile
                    key={card.id}
                    asset={card}
                    size="full"
                    selected={multiSelectMode ? selectedIds.includes(card.id) : card.id === activeId}
                    onOpen={() => {
                      if (multiSelectMode) onToggleSelect(card.id);
                      else onOpenWorkspace(card.id);
                    }}
                    onInspect={() => onInspect(card.id)}
                    onDoubleClick={() => { if (!multiSelectMode) onOpenWorkspace(card.id); }}
                    onContextMenu={(event) => onContextMenu(event, card.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
