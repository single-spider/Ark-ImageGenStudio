import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, Check, Info, Search, Upload, X } from 'lucide-react';
import { filterLibrary, libraryAspect } from '../lib/library';
import type { ReferenceSlot, StudioAsset } from '../types/studio';

interface Props {
  anchor: HTMLElement;
  slot: ReferenceSlot;
  assets: StudioAsset[];
  onPick: (asset: StudioAsset) => void;
  onImport: (file: File) => void;
  onClose: () => void;
}

export function ReferencePicker({ anchor, slot, assets, onPick, onImport, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [position, setPosition] = useState({ left: 16, top: 16, width: 340, height: 360 });
  const [query, setQuery] = useState('');
  const [keepers, setKeepers] = useState(false);
  const [details, setDetails] = useState<string | null>(null);
  const [limit, setLimit] = useState(80);
  const results = useMemo(() => filterLibrary(assets, {
    search: query.replace(/^@/, '').replaceAll('/', ' '),
    scope: keepers ? 'keepers' : 'all',
  }), [assets, query, keepers]);
  const detail = assets.find((asset) => asset.id === details);

  useLayoutEffect(() => {
    function place() {
      const rect = anchor.getBoundingClientRect();
      const panel = anchor.closest('.controls-panel')?.getBoundingClientRect() ?? rect;
      const width = Math.min(368, window.innerWidth - 24);
      const height = Math.min(470, window.innerHeight - 24);
      const left = panel.left >= width + 20 ? panel.left - width - 10
        : panel.right + width + 20 <= window.innerWidth ? panel.right + 10
        : Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const top = Math.max(12, Math.min(rect.top, window.innerHeight - height - 12));
      setPosition({ left, top, width, height });
    }
    place();
    searchRef.current?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !anchor.contains(target)) closeRef.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        anchor.focus();
      }
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [anchor]);

  return createPortal(
    <div ref={ref} className="ark-reference-picker" role="dialog" aria-label={`Choose reference for ${slot.title}`} style={position}>
      <header className="ark-ref-picker-head">
        <div><span>REFERENCE / {slot.role.toUpperCase()}</span><strong>{slot.title}</strong></div>
        <button type="button" title="Close reference picker" aria-label="Close reference picker" onClick={() => { onClose(); anchor.focus(); }}><X size={17}/></button>
      </header>
      <label className="ark-ref-picker-search"><Search size={15}/><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setLimit(80); }} placeholder="Search images or collections…" aria-label="Search reference images"/></label>
      <div className="ark-ref-picker-actions">
        <button type="button" aria-pressed={!keepers} onClick={() => { setKeepers(false); setLimit(80); }}>All images</button>
        <button type="button" aria-pressed={keepers} onClick={() => { setKeepers(true); setLimit(80); }}><Bookmark size={13}/> Keepers</button>
        <label><Upload size={13}/> Import<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { onImport(file); anchor.focus(); } }}/></label>
      </div>
      <div className="ark-ref-picker-scroll">
        {results.length ? <div className="ark-ref-picker-grid">
          {results.slice(0, limit).map((asset) => {
            const selected = slot.assetId === asset.id || slot.src === asset.src || slot.src === asset.thumb;
            return <div key={asset.id} className={`ark-library-tile ark-ref-picker-tile ${selected ? 'is-selected' : ''}`} style={{ aspectRatio: libraryAspect(asset) }}>
              <img src={asset.thumb} alt="" loading="lazy" decoding="async"/>
              <button className="ark-tile-open" type="button" aria-label={`Use ${asset.title} as reference`} onClick={() => { onPick(asset); anchor.focus(); }}/>
              {selected && <span className="ark-tile-selected"><Check size={13}/></span>}
              {asset.keeper && <span className="ark-tile-keeper"><Bookmark size={12} fill="currentColor"/></span>}
              <button type="button" className="ark-tile-info" aria-label={`Details of ${asset.title}`} onClick={() => setDetails((id) => id === asset.id ? null : asset.id)}><Info size={15}/></button>
              <div className="ark-tile-hover"><span className="ark-tile-title">{asset.title}</span></div>
            </div>;
          })}
        </div> : <p className="ark-ref-picker-empty">No matching images.</p>}
        {results.length > limit && <button className="ark-ref-picker-more" type="button" onClick={() => setLimit((count) => count + 80)}>Show more images</button>}
      </div>
      {detail && <div className="ark-ref-picker-detail"><div><strong>{detail.title}</strong><span>{detail.model} · {detail.ratio}</span></div><button type="button" onClick={() => setDetails(null)} aria-label="Close image details"><X size={14}/></button></div>}
      <footer>{results.length} images · Select to assign this slot</footer>
    </div>,
    document.body
  );
}
