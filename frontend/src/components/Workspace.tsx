import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArkImageComparison } from './primitives/ArkImageComparison';
import { ArkImageLens } from './primitives/ArkImageLens';
import { arkMotion } from '../lib/motion';
import { IterationDeck } from './IterationDeck';
import { GenerationMatrix } from './GenerationMatrix';
import {
  Aperture, ArrowLeftRight, Bookmark, Brush, ChevronUp, Expand, GitCompareArrows,
  Hand, Layers3, Maximize2, Minus, Plus, RotateCcw, ScanSearch, SlidersHorizontal, ZoomIn, ZoomOut,
} from 'lucide-react';
import type { StudioAsset, WorkspaceTab, WorkspaceTool } from '../types/studio';

type Point = { x: number; y: number };
type Stroke = Point[];

interface WorkspaceProps {
  assets: StudioAsset[];
  lineage: StudioAsset[];
  lineageCount: number;
  activeAsset: StudioAsset;
  generating: boolean;
  generationModel: string;
  compareAsset: StudioAsset;
  referenceAsset: StudioAsset | null;
  tab: WorkspaceTab;
  tool: WorkspaceTool;
  zoom: number;
  onTabChange: (tab: WorkspaceTab) => void;
  onToolChange: (tool: WorkspaceTool) => void;
  onZoomChange: (zoom: number) => void;
  onSelectAsset: (id: string) => void;
  onCompareAsset: (id: string) => void;
  onBranchAsset: (id: string) => void;
  onSendToReference: (id: string) => void;
  onDeleteAsset: (id: string) => void;
  onToggleKeeper: (id: string) => void;
  onToast: (message: string, detail?: string) => void;
}

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'main', label: 'Main image' },
  { id: 'reference', label: 'Reference image' },
  { id: 'extra', label: 'Extra image' },
];

const tools: Array<{ id: WorkspaceTool; label: string; Icon: typeof Hand }> = [
  { id: 'pan', label: 'Pan image', Icon: Hand },
  { id: 'inspect', label: 'Detail lens', Icon: ScanSearch },
  { id: 'compare', label: 'Compare images', Icon: GitCompareArrows },
  { id: 'mask', label: 'Paint mask', Icon: Brush },
];

export function Workspace({
  assets, lineage, lineageCount, activeAsset, compareAsset, referenceAsset, generating, generationModel, tab, tool, zoom, onTabChange,
  onToolChange, onZoomChange, onSelectAsset, onCompareAsset, onBranchAsset,
  onSendToReference, onDeleteAsset, onToggleKeeper, onToast,
}: WorkspaceProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const transformRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef({ zoom, pan: { x: 0, y: 0 } });
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const [lens, setLens] = useState<Point | null>(null);
  const [lensZoom, setLensZoom] = useState(2);
  const [compareSwapped, setCompareSwapped] = useState(false);
  const [brushSize, setBrushSize] = useState(1.3);
  const reduceMotion = useReducedMotion();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [toolsOpen, setToolsOpen] = useState(false);
  const [iterationsOpen, setIterationsOpen] = useState(false);
  const drawerToggleRef = useRef<HTMLButtonElement>(null);

  const source = tab === 'main' ? activeAsset : tab === 'reference' ? referenceAsset ?? activeAsset : assets[2] ?? activeAsset;
  const loading = generating && tab === 'main';
  const emptyReference = tab === 'reference' && !referenceAsset;
  const sourceInLibrary = assets.some((asset) => asset.id === source.id);

  useEffect(() => {
    setStrokes([]);
    resetView();
    setLens(null);
  }, [source.id, source.src, tab]);

  useEffect(() => {
    if (loading) {
      drawingRef.current = false;
      dragRef.current = null;
      setToolsOpen(false);
      setIterationsOpen(false);
      setLens(null);
    }
  }, [loading]);

  // React wheel events can be passive; a native listener prevents page scrolling.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    function wheel(event: WheelEvent) {
      event.preventDefault();
      if (loading || emptyReference || drawingRef.current || dragRef.current || !event.deltaY) return;
      const bounds = stage!.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1);
      const next = viewRef.current.zoom * Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.0025);
      zoomAt(next, event.clientX - bounds.left - bounds.width / 2, event.clientY - bounds.top - bounds.height / 2);
    }
    stage.addEventListener('wheel', wheel, { passive: false });
    return () => stage.removeEventListener('wheel', wheel);
  }, [loading, emptyReference, tool, onZoomChange]);

  useEffect(() => {
    if (!toolsOpen) return;
    const closeOutside = (event: globalThis.PointerEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [toolsOpen]);

  function localPoint(event: ReactPointerEvent<HTMLDivElement>): Point {
    const rect = transformRef.current?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  }

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (loading || emptyReference || event.button !== 0) return;
    if (tool === 'mask') {
      drawingRef.current = true;
      setStrokes((current) => [...current, [localPoint(event)]]);
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (tool === 'pan') {
      dragRef.current = { x: event.clientX, y: event.clientY, startX: pan.x, startY: pan.y };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (loading || emptyReference) return;
    const point = localPoint(event);
    if (tool === 'inspect') setLens(point);
    if (tool === 'mask' && drawingRef.current) {
      setStrokes((current) => {
        const next = [...current];
        const last = next[next.length - 1];
        if (last) next[next.length - 1] = [...last, point];
        return next;
      });
    }
    if (tool === 'pan' && dragRef.current) {
      updatePan({
        x: dragRef.current.startX + event.clientX - dragRef.current.x,
        y: dragRef.current.startY + event.clientY - dragRef.current.y,
      });
    }
  }

  function pointerUp() {
    drawingRef.current = false;
    dragRef.current = null;
  }

  function updatePan(next: Point) {
    viewRef.current.pan = next;
    setPan(next);
  }

  function zoomAt(target: number, x = 0, y = 0) {
    const current = viewRef.current;
    const next = Math.max(25, Math.min(800, target));
    const factor = next / current.zoom;
    // Coordinates relative to the center-origin transform.
    const nextPan = { x: x - (x - current.pan.x) * factor, y: y - (y - current.pan.y) * factor };
    viewRef.current = { zoom: next, pan: nextPan };
    setPan(nextPan);
    onZoomChange(next);
    if (tool === 'inspect') setLens(null);
  }

  function resetView() {
    viewRef.current = { zoom: 100, pan: { x: 0, y: 0 } };
    setPan({ x: 0, y: 0 });
    onZoomChange(100);
  }

  const toolCursor = tool === 'mask' ? 'crosshair' : tool === 'inspect' ? 'none' : tool === 'pan' ? 'grab' : 'default';

  return (
    <section className="workspace-panel" aria-label="Image workspace">
      <div className="panel-heading workspace-heading">
        <div className="heading-left">
          <Aperture size={14} className="workspace-glyph" aria-hidden="true" />
          <span className="eyebrow">01 / Creative workspace</span>
          <span className="heading-separator" />
          <span className="heading-subtitle">Canvas</span>
        </div>
        <div className="workspace-meta"><span className="status-dot" /> {loading ? 'Generating' : 'Canvas ready'} <span className="meta-separator">/</span> {Math.round(zoom)}%</div>
      </div>

      <div className="workspace-tabs" role="tablist" aria-label="Image source">
        {tabs.map((item) => (
          <button
            type="button"
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={`workspace-tab ${tab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
          >
            {tab === item.id && <motion.span layoutId="workspace-tab-glow" className="tab-active-glow" transition={{ type: 'spring', stiffness: 360, damping: 34 }} />}
            <span>{item.label}</span>
          </button>
        ))}
        <div className="tabs-tail"><Layers3 size={13} /> 03 surfaces</div>
      </div>

      <div className="image-shell">
        <div
          ref={stageRef}
          className={`image-stage mode-${tool}`}
          style={{ cursor: loading || emptyReference ? 'default' : toolCursor }}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onPointerLeave={() => setLens(null)}
          onDoubleClick={(event) => {
            if (loading || emptyReference || tool !== 'pan') return;
            if (zoom >= 200) return resetView();
            const bounds = event.currentTarget.getBoundingClientRect();
            zoomAt(200, event.clientX - bounds.left - bounds.width / 2, event.clientY - bounds.top - bounds.height / 2);
          }}
          aria-label="Interactive image canvas"
        >
          {loading ? <GenerationMatrix model={generationModel}/> : emptyReference ? <div className="canvas-reference-empty">Choose an image in References to preview it here.</div> : <>
          <div className="stage-ambient" style={{ backgroundImage: `url("${source.src}")` }} />
          <div ref={transformRef} className="stage-image-transform" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})` }}>
            {tool === 'compare' && tab === 'main' ? (
              <ArkImageComparison
                baseSrc={compareSwapped ? compareAsset.src : source.src}
                revealSrc={compareSwapped ? source.src : compareAsset.src}
                baseLabel={compareSwapped ? compareAsset.title : source.title}
                revealLabel={compareSwapped ? source.title : compareAsset.title}
              />
            ) : tool === 'inspect' ? (
              <ArkImageLens src={source.src} alt={source.title} position={lens} zoomFactor={lensZoom} />
            ) : (
              <img className="stage-image" src={source.src} alt={source.title} draggable={false} />
            )}
          {tool === 'mask' && (
            <svg className="mask-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Painted mask overlay">
              {strokes.map((stroke, index) => (
                <polyline key={index} points={stroke.map((p) => `${p.x},${p.y}`).join(' ')} stroke="var(--accent)" strokeWidth={brushSize} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".9" />
              ))}
            </svg>
          )}
          </div>
          <div className="image-top-overlay">
            <span className="image-index canvas-glass">ARK / {source.id.slice(-8)}</span>
          </div>
          </>}
        </div>

        {!loading && !emptyReference && <div className="canvas-top-dock" aria-label="Canvas quick actions">
          <span className="image-flag canvas-glass" role="status">
            <span className="flag-pip" />
            {tool === 'mask' ? 'Mask editing' : tool === 'inspect' ? 'Detail inspection' : tool === 'compare' ? 'A / B comparison' : 'Canvas view'}
          </span>
          <button
            type="button"
            className={`image-keeper canvas-glass ${source.keeper ? 'is-keeper' : ''}`}
            title={source.keeper ? 'Remove this image from Keepers' : 'Mark this image as Keeper'}
            aria-label={source.keeper ? 'Remove from Keepers' : 'Mark as Keeper'}
            aria-pressed={source.keeper}
            disabled={!sourceInLibrary}
            onClick={() => onToggleKeeper(source.id)}
          >
            <Bookmark size={17} strokeWidth={1.8} fill={source.keeper ? 'currentColor' : 'none'} />
          </button>
          <motion.div layout ref={toolbarRef} className="floating-toolbar canvas-glass" aria-label="Image tools" transition={arkMotion.toolbar}>
            <button type="button" className="toolbar-head" title={toolsOpen ? 'Collapse canvas tools' : 'Open canvas tools'} aria-label={toolsOpen ? 'Collapse tools' : 'Expand tools'} aria-expanded={toolsOpen} onClick={() => setToolsOpen((open) => !open)}>
              <SlidersHorizontal size={17} strokeWidth={1.8} />
              <span className="toolbar-head-text">Tools</span>
            </button>
          <AnimatePresence initial={false}>
            {toolsOpen && (
              <motion.div
                key="toolbar-body"
                className="toolbar-body-wrapper"
                initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
              >
                <div className="toolbar-body">
                  {tools.map(({ id, label, Icon }) => (
                    <button type="button" key={id} title={label} aria-label={label} aria-pressed={tool === id} className={`tool-button ${tool === id ? 'selected' : ''}`} onClick={() => { onToolChange(id); setLens(null); }}>
                      <Icon size={17} strokeWidth={1.8} />
                    </button>
                  ))}
                  <span className="tool-divider" />
                  {tool === 'inspect' && (
                    <div className="toolbar-context" aria-label="Lens zoom">
                      <span className="toolbar-mode-title">{lensZoom.toFixed(1)}×</span>
                      <button type="button" className="tool-button" aria-label="Decrease lens zoom" title="Decrease lens zoom" onClick={() => setLensZoom((value) => Math.max(1.5, value - 0.25))}><ZoomOut size={15} /></button>
                      <button type="button" className="tool-button" aria-label="Increase lens zoom" title="Increase lens zoom" onClick={() => setLensZoom((value) => Math.min(4, value + 0.25))}><ZoomIn size={15} /></button>
                    </div>
                  )}
                  {tool === 'compare' && (
                    <div className="toolbar-context">
                      <button type="button" className="tool-button" aria-label="Swap comparison images" title="Swap A/B sides" onClick={() => setCompareSwapped((value) => !value)}><ArrowLeftRight size={16} /></button>
                    </div>
                  )}
                  {tool === 'mask' && (
                    <div className="toolbar-context" aria-label="Mask brush">
                      <span className="toolbar-mode-title">{brushSize.toFixed(1)}</span>
                      <button type="button" className="tool-button" aria-label="Decrease brush size" title="Smaller brush" onClick={() => setBrushSize((value) => Math.max(0.5, Math.round((value - 0.4) * 10) / 10))}><Minus size={15} /></button>
                      <button type="button" className="tool-button" aria-label="Increase brush size" title="Larger brush" onClick={() => setBrushSize((value) => Math.min(5, Math.round((value + 0.4) * 10) / 10))}><Plus size={15} /></button>
                    </div>
                  )}
                  <span className="tool-divider" />
                  <button type="button" className="tool-button" title="Fit image" aria-label="Fit image" onClick={resetView}><Maximize2 size={16} /></button>
                  <button type="button" className="tool-button" title="Fullscreen" aria-label="Fullscreen" onClick={() => { void stageRef.current?.requestFullscreen?.(); }}><Expand size={16} /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </motion.div>
        </div>}

        {iterationsOpen && !loading && (
          <div className="canvas-iteration-drawer" id="canvas-iteration-drawer" role="region" aria-label="Iteration drawer"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !event.defaultPrevented) {
                event.stopPropagation();
                setIterationsOpen(false);
                drawerToggleRef.current?.focus();
              }
            }}>
            <IterationDeck
              assets={lineage}
              totalCount={lineageCount}
              activeId={activeAsset.id}
              onSelect={onSelectAsset}
              onCompare={onCompareAsset}
              onBranch={onBranchAsset}
              onSendToReference={onSendToReference}
              onToggleKeeper={onToggleKeeper}
              onDelete={onDeleteAsset}
            />
          </div>
        )}

        <div className="viewport-foot">
          <div className="canvas-footer-identity">
            <h2 className="canvas-footer-title" title={source.title}>{loading ? 'Generating image…' : emptyReference ? 'No reference selected' : source.title}</h2>
            <div className="foot-image-meta"><span className="mono-dot" /> {loading ? generationModel + ' · Generating…' : emptyReference ? 'Reference workspace' : <>{source.model} <span className="meta-separator">/</span> {source.ratio}{source.exactPixels ? <> <span className="meta-separator">/</span> {source.exactPixels.replace('x', '×')}</> : null}</>}</div>
          </div>
          <button ref={drawerToggleRef} type="button" className={`iteration-drawer-toggle ${iterationsOpen ? 'is-open' : ''}`} disabled={loading} aria-expanded={iterationsOpen && !loading} aria-controls={iterationsOpen ? 'canvas-iteration-drawer' : undefined} title={iterationsOpen ? 'Collapse iterations' : 'Show iterations'} onClick={(event) => {
            if (!iterationsOpen && event.detail === 0) {
              requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('#canvas-iteration-drawer .iteration-thumb')?.focus());
            }
            setIterationsOpen((open) => !open);
          }}>
            <Layers3 size={14}/><span>Iterations</span><span className="drawer-count">{lineageCount}</span><ChevronUp size={13} className="drawer-chevron"/>
          </button>
          <div className="viewport-zoom">
            {tool === 'mask' && (
              <>
                <button type="button" title="Undo mask stroke" onClick={() => setStrokes((current) => current.slice(0, -1))}><RotateCcw size={14} /></button>
                <button type="button" title="Clear mask" onClick={() => { setStrokes([]); onToast('Mask cleared', 'Mask strokes reset.'); }}><Brush size={14} /></button>
                <span className="zoom-separator" />
              </>
            )}
            <button type="button" title="Zoom out" aria-label="Zoom out" disabled={loading || emptyReference} onClick={() => zoomAt(zoom / 1.25)}><ZoomOut size={15} /></button>
            <button type="button" className="zoom-readout" disabled={loading || emptyReference} onClick={resetView} title="Reset zoom">{Math.round(zoom)}%</button>
            <button type="button" title="Zoom in" aria-label="Zoom in" disabled={loading || emptyReference} onClick={() => zoomAt(zoom * 1.25)}><ZoomIn size={15} /></button>

          </div>
        </div>
      </div>
    </section>
  );
}
