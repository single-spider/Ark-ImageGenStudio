import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'motion/react';
import { ArkImageComparison } from './primitives/ArkImageComparison';
import { ArkImageLens } from './primitives/ArkImageLens';
import { ArkCanvasToolbar, CanvasToolbarDivider, CanvasToolbarGroup } from './primitives/ArkCanvasToolbar';
import { IterationDeck } from './IterationDeck';
import { GenerationMatrix } from './GenerationMatrix';
import { Info, ArrowLeftRight, Bookmark, Brush, Expand, GitCompareArrows, Hand, Layers3, Maximize2, Minus, Plus, RotateCcw, ScanSearch } from 'lucide-react';
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
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
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
          </>}
        </div>

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

        <div className="ark-canvas-overlay-tools">
          <ArkCanvasToolbar label="Canvas navigation and tools">
            <button type="button" title="Fit image" aria-label="Fit image" disabled={loading || emptyReference} onClick={resetView}><Maximize2 size={17}/><span>Fit</span></button>
            <button type="button" className="canvas-zoom-readout" title="Reset view" aria-label="Reset view" disabled={loading || emptyReference} onClick={resetView}>{Math.round(zoom)}%</button>
            <CanvasToolbarGroup>
              <button type="button" title="Zoom out" aria-label="Zoom out" disabled={loading || emptyReference} onClick={() => zoomAt(zoom / 1.25)}><Minus size={17}/></button>
              <button type="button" title="Zoom in" aria-label="Zoom in" disabled={loading || emptyReference} onClick={() => zoomAt(zoom * 1.25)}><Plus size={17}/></button>
            </CanvasToolbarGroup>
            <CanvasToolbarDivider/>
            {tools.map(({id,label,Icon}) => <button type="button" key={id} title={label} aria-label={label} aria-pressed={tool===id} disabled={loading || emptyReference || (id==='compare' && tab!=='main')} onClick={() => { onToolChange(id); setLens(null); }}><Icon size={18} strokeWidth={1.7}/></button>)}
            {!loading && !emptyReference && tool==='inspect' && <div className="ark-canvas-context"><CanvasToolbarGroup><span className="canvas-tool-value">{lensZoom.toFixed(1)}×</span><button type="button" title="Decrease lens zoom" aria-label="Decrease lens zoom" onClick={() => setLensZoom((value)=>Math.max(1.5,value-.25))}><Minus size={15}/></button><button type="button" title="Increase lens zoom" aria-label="Increase lens zoom" onClick={() => setLensZoom((value)=>Math.min(4,value+.25))}><Plus size={15}/></button></CanvasToolbarGroup></div>}
            {!loading && !emptyReference && tool==='compare' && tab==='main' && <button type="button" title="Swap comparison images" aria-label="Swap comparison images" onClick={() => setCompareSwapped((value)=>!value)}><ArrowLeftRight size={17}/></button>}
            {!loading && !emptyReference && tool==='mask' && <div className="ark-canvas-context"><CanvasToolbarGroup><span className="canvas-tool-value">{brushSize.toFixed(1)}</span><button type="button" title="Smaller brush" aria-label="Smaller brush" onClick={() => setBrushSize((value)=>Math.max(.5,Math.round((value-.4)*10)/10))}><Minus size={15}/></button><button type="button" title="Larger brush" aria-label="Larger brush" onClick={() => setBrushSize((value)=>Math.min(5,Math.round((value+.4)*10)/10))}><Plus size={15}/></button><button type="button" title="Undo mask stroke" aria-label="Undo mask stroke" onClick={() => setStrokes((current)=>current.slice(0,-1))}><RotateCcw size={15}/></button><button type="button" title="Clear mask" aria-label="Clear mask" onClick={() => {setStrokes([]);onToast('Mask cleared','Mask strokes reset.');}}><Brush size={15}/></button></CanvasToolbarGroup></div>}
            <CanvasToolbarDivider/>
            <button type="button" title={source.keeper?'Remove from Keepers':'Mark as Keeper'} aria-label={source.keeper?'Remove from Keepers':'Mark as Keeper'} aria-pressed={source.keeper} disabled={loading||emptyReference||!sourceInLibrary} onClick={() => onToggleKeeper(source.id)}><Bookmark size={17} fill={source.keeper?'currentColor':'none'}/></button>
            <button type="button" title="Image information" aria-label="Image information" disabled={loading||emptyReference} onClick={() => onToast(source.title,[source.model,source.ratio,source.exactPixels?.replace('x','×')].filter(Boolean).join(' · '))}><Info size={17}/></button>
          <button ref={drawerToggleRef} type="button" className="canvas-iterations-button" disabled={loading} aria-expanded={iterationsOpen && !loading} aria-controls={iterationsOpen ? 'canvas-iteration-drawer' : undefined} title={iterationsOpen ? 'Collapse iterations' : 'Show iterations'} onClick={(event) => {
            if (!iterationsOpen && event.detail === 0) {
              requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('#canvas-iteration-drawer .iteration-thumb')?.focus());
            }
            setIterationsOpen((open) => !open);
          }}>
            <Layers3 size={17}/><span>{lineageCount}</span>
          </button>

            <button type="button" title="Fullscreen" aria-label="Fullscreen" onClick={() => { if(document.fullscreenElement) { void document.exitFullscreen(); } else { void stageRef.current?.parentElement?.requestFullscreen?.(); } }}><Expand size={17}/></button>
          </ArkCanvasToolbar>
        </div>
      </div>
    </section>
  );
}
