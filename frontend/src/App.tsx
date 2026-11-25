import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeftRight, Check, ChevronDown, CircleHelp, Eye, EyeOff, FolderOpen, Images, Monitor, Palette, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, RefreshCw, Settings, Shield, Sparkles, TestTube, X } from 'lucide-react';
import { Gallery } from './components/Gallery';
import { FullLibrary } from './components/FullLibrary';
import { MultiSelectBar } from './components/library/MultiSelectBar';
import { StudioControls } from './components/StudioControls';
import { Workspace } from './components/Workspace';
import { initialReferences, mockAssets } from './data/mock';
import { mockStudioApi } from './lib/api';
import { backendAssetToStudio } from './lib/backend-asset-mapper';
import { createBrowserBackend, createDesktopBackend, detectLocalBackend, nativeOpenFolder } from './lib/backend-client';
import type { BrowserBridgeConnection } from './lib/browser-bridge';
import { getLineage, getLineageWindow } from './lib/lineage';
import {
  SEEDREAM_MODELS,
  type AspectRatio, type ReferenceSlot, type StudioAsset, type StudioNotice, type StudioTheme,
  type WorkspaceTab, type WorkspaceTool,
} from './types/studio';

const defaultPrompt = 'An ancient forest after rainfall, soft shafts of amber light breaking through the canopy, fine atmospheric mist, deep emerald foliage, cinematic composition, exquisite natural texture, subtle film grain, rich shadow detail';

export default function App({ bridge = null }: { bridge?: BrowserBridgeConnection | null }) {
  const backend = useMemo(() => {
    if (bridge) return createBrowserBackend(bridge);
    const conn = detectLocalBackend();
    return conn ? createDesktopBackend(conn) : null;
  }, [bridge]);
  const isBrowserBridge = backend?.mode === 'browser-bridge';

  const [assets, setAssets] = useState<StudioAsset[]>(backend ? [] : mockAssets);
  const [activeId, setActiveId] = useState(mockAssets[0].id);
  const [compareId, setCompareId] = useState(mockAssets[1].id);
  const [references, setReferences] = useState<ReferenceSlot[]>(
    backend
      ? initialReferences.map((r) => ({ ...r, src: null, assetId: undefined, enabled: false }))
      : initialReferences,
  );
  const [referencePreviewId, setReferencePreviewId] = useState(initialReferences[0].id);
  const [tab, setTab] = useState<WorkspaceTab>('main');
  const [tool, setTool] = useState<WorkspaceTool>('pan');
  const [zoom, setZoom] = useState(100);
  const [theme, setTheme] = useState<StudioTheme>(() => {
    try {
      const saved = localStorage.getItem('ark-surface-theme');
      return saved === 'mineral' || saved === 'ember' || saved === 'graphite' ? saved : 'nocturne';
    } catch { return 'nocturne'; }
  });
  const [prompt, setPrompt] = useState(backend ? '' : defaultPrompt);
  const [negativePrompt, setNegativePrompt] = useState('Oversaturated, blurry, plastic textures, distorted geometry');
  const [model, setModel] = useState('Seedream 5.5');
  const [ratio, setRatio] = useState<AspectRatio>('3:4');
  const [resolution, setResolution] = useState('2K');
  const [seed, setSeed] = useState('');
  const [creativity, setCreativity] = useState(42);
  const [dryRun, setDryRun] = useState(false);
  const [rawConfig, setRawConfig] = useState<Record<string, unknown>>({});
  const [sorterLabel, setSorterLabel] = useState<string>('');
  const [privacyEnabled, setPrivacyEnabled] = useState<boolean>(() => {
    try { return window.localStorage.getItem('ark-privacy-enabled') !== 'false'; }
    catch { return true; }
  });
  const [covered, setCovered] = useState<boolean>(Boolean(backend) && (() => {
    try { return window.localStorage.getItem('ark-privacy-enabled') !== 'false'; }
    catch { return true; }
  })());
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [showTopApiKey, setShowTopApiKey] = useState(false);
  const [topApiKey, setTopApiKey] = useState('');
  const [topBaseUrl, setTopBaseUrl] = useState('');
  const [topProEp, setTopProEp] = useState('');
  const [scratchpadAssets, setScratchpadAssets] = useState<StudioAsset[]>([]);
  const [trashAssets, setTrashAssets] = useState<StudioAsset[]>([]);
  const [fullLibSpace, setFullLibSpace] = useState<'scratchpad' | 'trash' | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generationModel, setGenerationModel] = useState('Seedream 5.5');
  const [notice, setNotice] = useState<StudioNotice | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [miniLibraryOpen, setMiniLibraryOpen] = useState(() => {
    try { return window.localStorage.getItem('ark-mini-library-visible') !== 'false'; }
    catch { return true; }
  });
  const [miniLibrarySide, setMiniLibrarySide] = useState<'left' | 'right'>(() => {
    try { return window.localStorage.getItem('ark-mini-library-side') === 'left' ? 'left' : 'right'; }
    catch { return 'right'; }
  });
  const [fullLibraryOpen, setFullLibraryOpen] = useState(false);
  const [libraryInspectId, setLibraryInspectId] = useState<string | null>(null);
  const [branchOriginId, setBranchOriginId] = useState<string | null>(null);

  const activeAsset = assets.find((asset) => asset.id === activeId) ?? assets[0] ?? {
    ...mockAssets[0], id: 'empty-library', src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', thumb: '', title: 'No images in library', prompt: '', seed: 0, keeper: false,
  };
  const compareAsset = assets.find((asset) => asset.id === compareId) ?? assets[1] ?? activeAsset;
  const previewSlot = references.find((ref) => ref.id === referencePreviewId && ref.src) ?? references.find((ref) => ref.src);
  const referenceAsset: StudioAsset | null = previewSlot?.src ? (
    assets.find((asset) => asset.id === previewSlot.assetId || asset.src === previewSlot.src || asset.thumb === previewSlot.src)
    ?? { id: previewSlot.id, src: previewSlot.src, thumb: previewSlot.src, title: previewSlot.title, prompt: '', seed: 0, model: 'Reference image', createdAt: '', collection: 'References', ratio: '4:3', keeper: false }
  ) : null;
  const lineage = getLineage(assets, activeAsset);
  const visibleLineage = getLineageWindow(lineage, activeAsset.id);

  function toast(message: string, detail?: string) {
    setNotice({ id: Date.now(), message, detail, tone: 'success' });
  }

  const refreshBackendAssets = useCallback(async (selectNewest = false) => {
    if (!backend) return;
    try {
      const [mainList, scratchList, trashList] = await Promise.all([
        backend.listAssets({ limit: 5000 }),
        backend.listAssets({ space: 'scratchpad', limit: 2000 }),
        backend.listAssets({ space: 'trash', limit: 2000 }),
      ]);
      const mapped = mainList.items.map((item) => backendAssetToStudio(item, backend));
      setAssets(mapped);
      setScratchpadAssets(scratchList.items.map((item) => backendAssetToStudio(item, backend)));
      setTrashAssets(trashList.items.map((item) => backendAssetToStudio(item, backend)));
      if (mapped.length > 0) {
        setActiveId((prev) => (selectNewest || !mapped.some((a) => a.id === prev) ? mapped[0].id : prev));
        setCompareId((prev) => (mapped.some((a) => a.id === prev) ? prev : (mapped[1]?.id ?? mapped[0].id)));
      }
    } catch (err) {
      toast('Failed to load library', String(err));
    }
  }, [backend]);

  useEffect(() => {
    try { window.localStorage.setItem('ark-privacy-enabled', String(privacyEnabled)); }
    catch { /* optional */ }
  }, [privacyEnabled]);

  useEffect(() => {
    if (!backend) return;
    let active = true;
    void (async () => {
      try {
        const [boot] = await Promise.all([backend.bootstrap(), refreshBackendAssets(true)]);
        if (!active) return;
        setRawConfig(boot.config || {});
        setTopApiKey(String(boot.config?.api_key ?? ''));
        setTopBaseUrl(String(boot.config?.base_url ?? ''));
        setTopProEp(String(boot.config?.pro_endpoint_id ?? ''));
        if (typeof boot.config?.model === 'string' && SEEDREAM_MODELS[boot.config.model]) {
          setModel(boot.config.model);
        }
        if (typeof (boot.sorter as { label?: string })?.label === 'string') {
          setSorterLabel(String((boot.sorter as { label: string }).label));
        }
      } catch (err) {
        toast('Backend connection failed', String(err));
      }
    })();

    const disconnect = backend.connectEvents((ev) => {
      if (ev.type === 'job_update') {
        const p = ev.payload as { status?: string; error?: string };
        if (p.status === 'error') {
          setGenerating(false);
          toast('Generation failed', p.error || 'Unknown error');
        } else if (p.status === 'canceled') {
          setGenerating(false);
        }
      } else if (ev.type === 'asset_added') {
        const p = ev.payload as { asset?: { id: string }; job_id?: string };
        void refreshBackendAssets(Boolean(p.job_id)).then(() => {
          if (p.job_id) {
            setGenerating(false);
            if (p.asset?.id) {
              setActiveId(p.asset.id);
              setTab('main');
              setTool('pan');
            }
            toast('Generation complete', 'Added to your local library.');
          }
        });
      } else if (ev.type === 'asset_updated' || ev.type === 'asset_deleted' || ev.type === 'library_synced') {
        void refreshBackendAssets(false);
      }
    });
    return () => {
      active = false;
      disconnect();
    };
  }, [backend, refreshBackendAssets]);

  // Privacy cover on window blur + Ctrl+Shift+L in desktop mode
  useEffect(() => {
    if (!backend) return;
    const onBlur = () => {
      if (privacyEnabled) setCovered(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyL') {
        e.preventDefault();
        setCovered(true);
      }
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [backend, privacyEnabled]);

  function startMultiSelect(id: string) {
    setMultiSelectMode(true);
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function toggleSelectId(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function clearMultiSelect() {
    setMultiSelectMode(false);
    setSelectedIds([]);
  }

  async function moveSelectedTo(targetState: 'trash' | 'scratchpad' | 'draft') {
    if (!selectedIds.length) return;
    const ids = [...selectedIds];
    const idSet = new Set(ids);

    // Immediately remove from current UI views when moving to bin/scratchpad
    if (targetState === 'trash' || targetState === 'scratchpad') {
      const remaining = assets.filter((a) => !idSet.has(a.id));
      setAssets(remaining);
      setReferences((cur) =>
        cur.map((r) => (r.assetId && idSet.has(r.assetId) ? { ...r, src: null, assetId: undefined, enabled: false } : r)),
      );
      if (idSet.has(activeId) && remaining[0]) setActiveId(remaining[0].id);
      if (idSet.has(compareId) && remaining[0]) setCompareId(remaining[1]?.id ?? remaining[0].id);
    }

    clearMultiSelect();

    if (backend) {
      try {
        await backend.batchPatch({ ids, curation_state: targetState });
        await refreshBackendAssets(false);
      } catch (err) {
        toast('Batch move failed', String(err));
        await refreshBackendAssets(false);
        return;
      }
    }

    toast(
      targetState === 'trash'
        ? `Moved ${ids.length} to Garbage Bin`
        : targetState === 'scratchpad'
          ? `Moved ${ids.length} to Scratchpad`
          : `Restored ${ids.length} to Library`,
    );
  }

  async function handleEmptyTrash() {
    if (isBrowserBridge) { toast('Permanent deletion disabled', 'Use your local desktop app to empty the Garbage Bin.'); return; }
    if (!trashAssets.length) return;
    if (!window.confirm(`Permanently delete all ${trashAssets.length} images in Garbage Bin from disk?`)) return;
    if (backend) {
      try {
        await backend.emptyTrash();
        await refreshBackendAssets(false);
        toast('Garbage Bin emptied', 'Files permanently removed from disk.');
      } catch (err) {
        toast('Empty bin failed', String(err));
      }
    } else {
      setTrashAssets([]);
    }
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3900);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    try { window.localStorage.setItem('ark-mini-library-visible', String(miniLibraryOpen)); }
    catch { /* Browser storage is optional. */ }
  }, [miniLibraryOpen]);

  useEffect(() => {
    try { window.localStorage.setItem('ark-mini-library-side', miniLibrarySide); }
    catch { /* Browser storage is optional. */ }
  }, [miniLibrarySide]);

  useEffect(() => {
    document.documentElement.dataset.arkTheme = theme;
    try { localStorage.setItem('ark-surface-theme', theme); }
    catch { /* Storage is optional. */ }
  }, [theme]);

  function openFullLibrary(inspectId: string | null = null) {
    setLibraryInspectId(inspectId);
    setFullLibraryOpen(true);
  }

  function closeFullLibrary() {
    setFullLibraryOpen(false);
    setLibraryInspectId(null);
  }

  async function toggleKeeper(id: string) {
    const target = assets.find((a) => a.id === id);
    if (!target) return;
    const nextKeeper = !target.keeper;
    setAssets((current) => current.map((asset) => asset.id === id ? { ...asset, keeper: nextKeeper } : asset));
    if (backend) {
      try {
        await backend.patchAsset(id, { curation_state: nextKeeper ? 'keeper' : 'draft' });
      } catch (err) {
        setAssets((current) => current.map((asset) => asset.id === id ? { ...asset, keeper: !nextKeeper } : asset));
        toast('Keeper update failed', String(err));
      }
    }
  }

  function selectAsset(id: string) {
    setActiveId(id);
    setTab('main');
    setBranchOriginId(null);
  }

  function compareWith(id: string) {
    const choice = id === activeId
      ? (lineage.find((asset) => asset.id !== activeId) ?? assets.find((asset) => asset.id !== activeId))
      : assets.find((asset) => asset.id === id);
    if (!choice) return toast('No comparison available', 'Add another image to compare.');
    setCompareId(choice.id);
    setTool('compare');
    setTab('main');
    toast('A/B comparison ready', `Comparing with ${choice.title}.`);
  }

  function branchFrom(id: string) {
    const asset = assets.find((item) => item.id === id);
    if (!asset) return;
    setActiveId(asset.id);
    setBranchOriginId(asset.id);
    setPrompt(asset.prompt);
    setTab('main');
    setTool('pan');
    toast('Branch ready', 'Edit the inherited prompt, then generate a mock child iteration.');
  }

  function pickReference(slotId: string, asset: StudioAsset) {
    setReferences((current) => current.map((ref) => ref.id === slotId ? { ...ref, src: asset.src, assetId: asset.id, enabled: true } : ref));
    setReferencePreviewId(slotId);
    setTab('reference');
    setTool('pan');
  }

  function importReference(id: string, file: File) {
    if (backend) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await backend.importAsset(String(reader.result), file.name);
          const mapped = backendAssetToStudio(res.asset, backend);
          setAssets((current) => [mapped, ...current]);
          setReferences((current) => current.map((ref) => ref.id === id ? { ...ref, src: mapped.src, assetId: mapped.id, enabled: true } : ref));
          setReferencePreviewId(id);
          setTab('reference');
          setTool('pan');
          toast('Reference imported', file.name);
        } catch (err) {
          toast('Import failed', String(err));
        }
      };
      reader.readAsDataURL(file);
      return;
    }
    const src = URL.createObjectURL(file);
    setReferences((current) => current.map((ref) => ref.id === id ? { ...ref, src, assetId: undefined, enabled: true } : ref));
    setReferencePreviewId(id);
    setTab('reference');
    setTool('pan');
    toast('Reference imported', file.name);
  }

  function addReferenceSlot() {
    const maxSlots = SEEDREAM_MODELS[model]?.max_reference_images ?? 10;
    if (references.length >= maxSlots) return;
    const n = references.length + 1;
    setReferences((current) => [
      ...current,
      { id: `ref-${n}`, title: `Reference ${n}`, role: 'Detail', src: null, enabled: false },
    ]);
    return `ref-${n}`;
  }

  function addAsReference(id: string) {
    const asset = assets.find((item) => item.id === id);
    if (!asset) return;
    const slot = references.find((ref) => !ref.enabled || !ref.src) ?? references[references.length - 1];
    setReferences((current) => current.map((ref) => ref.id === slot.id ? { ...ref, src: asset.src, assetId: asset.id, enabled: true } : ref));
    setReferencePreviewId(slot.id);
    toast('Added to reference', asset.title);
  }

  function importGallery(file: File) {
    if (backend) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await backend.importAsset(String(reader.result), file.name);
          const mapped = backendAssetToStudio(res.asset, backend);
          setAssets((current) => [mapped, ...current]);
          setActiveId(mapped.id);
          setTab('main');
          setBranchOriginId(null);
          toast('Image imported', file.name);
        } catch (err) {
          toast('Import failed', String(err));
        }
      };
      reader.readAsDataURL(file);
      return;
    }
    const src = URL.createObjectURL(file);
    const id = `demo-import-${Date.now()}`;
    const asset: StudioAsset = {
      id, src, thumb: src, title: file.name.replace(/\.[^.]+$/, ''),
      prompt: 'Locally imported preview image', seed: 0, model: 'Local import',
      createdAt: new Date().toISOString().slice(0, 10), collection: 'Imports',
      ratio: '4:3', keeper: false, lineageId: id,
    };
    setAssets((current) => [asset, ...current]);
    setActiveId(asset.id);
    setTab('main');
    setBranchOriginId(null);
    toast('Image imported', 'Stored in browser memory for this session.');
  }

  async function deleteAsset(id: string) {
    if (assets.length <= 1) return toast('Keep one image', 'The workspace needs at least one image.');
    const remaining = assets.filter((a) => a.id !== id);
    setAssets(remaining);
    setReferences((cur) => cur.map((r) => (r.assetId === id ? { ...r, src: null, assetId: undefined, enabled: false } : r)));
    if (activeId === id && remaining[0]) setActiveId(remaining[0].id);
    if (compareId === id && remaining[0]) setCompareId(remaining[1]?.id ?? remaining[0].id);
    if (backend) {
      try {
        await backend.patchAsset(id, { curation_state: 'trash' });
        await refreshBackendAssets(false);
        toast('Moved to Garbage Bin', 'Removed from all active studio views.');
      } catch (err) {
        toast('Move to Garbage Bin failed', String(err));
      }
      return;
    }
    toast('Moved to Garbage Bin');
  }

  async function generate() {
    if (generating || !prompt.trim()) return;
    setGenerationModel(model);
    setGenerating(true);
    setTab('main');

    if (backend) {
      const mc = SEEDREAM_MODELS[model] ?? Object.values(SEEDREAM_MODELS)[0];
      const pxSize = mc.resolutions[resolution]?.[ratio] || mc.resolutions[mc.default_resolution]?.['1:1'] || '2048x2048';
      const activeRefs = references.filter((r) => r.enabled && r.assetId);
      const refIds = activeRefs.map((r) => r.assetId as string);
      const refRoles: Record<string, string> = {};
      for (const r of activeRefs) {
        if (r.assetId) refRoles[r.assetId] = r.role;
      }
      if (branchOriginId && !refIds.includes(branchOriginId)) {
        refIds.unshift(branchOriginId);
      }
      try {
        await backend.generate({
          prompt: prompt.trim(),
          model_name: model,
          model_code: mc.model_code,
          px_size: pxSize,
          base_res: resolution,
          aspect_ratio: ratio,
          dry_run: dryRun,
          batch: 1,
          ref_ids: refIds.slice(0, mc.max_reference_images),
          ref_roles: refRoles,
        });
        toast(dryRun ? 'Dry-run job queued' : 'Generation started', `${model} · ${pxSize.replace('x', '×')}`);
      } catch (err) {
        setGenerating(false);
        toast('Failed to queue generation', String(err));
      }
      return;
    }

    toast('Mock generation started', 'Simulating a result locally. No AI service is called.');
    try {
      const parent = assets.find((asset) => asset.id === (branchOriginId ?? activeId)) ?? activeAsset;
      const result = await mockStudioApi.generate({
        prompt, negativePrompt, model, ratio, resolution, seed, creativity,
        parentAssetId: parent.id,
        lineageId: parent.lineageId ?? parent.id,
      });
      setAssets((current) => [result, ...current]);
      setActiveId(result.id);
      setTab('main');
      setTool('pan');
      setBranchOriginId(null);
      toast('New preview iteration', 'Simulated image added to your session gallery.');
    } catch {
      toast('Preview generation failed', 'Try the simulation again.');
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const editing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      if (fullLibraryOpen || document.querySelector('dialog[open], .ark-reference-picker')) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void generate(); return; }
      if (event.key === 'Escape') {
        setHelpOpen(false);
        setAppSettingsOpen(false);
        if (multiSelectMode) clearMultiSelect();
        return;
      }
      if (editing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() === 'l') {
        event.preventDefault();
        setMiniLibraryOpen((open) => !open);
        return;
      }
      if (event.key.toLowerCase() === 'g') {
        event.preventDefault();
        openFullLibrary();
        return;
      }
      if (/^[1-6]$/.test(event.key)) {
        const selected = visibleLineage[Number(event.key) - 1];
        if (selected) selectAsset(selected.id);
      }
      if (event.key === '?') setHelpOpen(true);
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  });

  return (
    <div className="ark-app" data-theme={theme} data-mini-library={miniLibraryOpen ? "open" : "closed"}>
      <div className="app-content">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark"><span>A</span><span className="brand-mark-spark">✦</span></div>
            <div className="brand-type"><strong>ARK</strong><span>IMAGE STUDIO <i>V2</i></span></div>
          </div>
          <div className="ark-topbar-library-controls">
            <button type="button" className="ark-topbar-library-button" title="Open Full Library (G)" aria-label="Open Full Library" onClick={() => openFullLibrary()}>
              <Images size={16}/><span>Library</span>
            </button>
            <button type="button" className={`ark-topbar-library-button ${miniLibraryOpen ? 'active' : ''}`} title={miniLibraryOpen ? 'Collapse Mini Library (L)' : 'Show Mini Library (L)'} aria-label={miniLibraryOpen ? 'Collapse Mini Library' : 'Show Mini Library'} aria-pressed={miniLibraryOpen} onClick={() => setMiniLibraryOpen((open) => !open)}>
              {miniLibrarySide === 'left'
                ? (miniLibraryOpen ? <PanelLeftClose size={17}/> : <PanelLeftOpen size={17}/>)
                : (miniLibraryOpen ? <PanelRightClose size={17}/> : <PanelRightOpen size={17}/> )}
              <span>Mini</span>
            </button>
            <button type="button" className="ark-topbar-library-button mini-side-toggle" title={`Move Mini Library to ${miniLibrarySide === 'left' ? 'right' : 'left'}`} aria-label={`Move Mini Library to ${miniLibrarySide === 'left' ? 'right' : 'left'}`} onClick={() => setMiniLibrarySide((side) => side === 'left' ? 'right' : 'left')}>
              <ArrowLeftRight size={15}/>
            </button>
          </div>
          <div className="topbar-spacer" />
          <div className="theme-selector"><Palette size={15} /><select aria-label="Color theme" value={theme} onChange={(event) => setTheme(event.target.value as StudioTheme)}><option value="nocturne">Nocturne</option><option value="mineral">Mineral</option><option value="ember">Ember</option><option value="graphite">Graphite</option></select><ChevronDown size={12} /></div>
          {backend && !isBrowserBridge && /stopped|not responding|error|failed/i.test(sorterLabel) && <button type="button" className="topbar-icon studio-status-alert" title={sorterLabel} aria-label={sorterLabel} onClick={() => setAppSettingsOpen(true)}><CircleHelp size={17}/></button>}
          <button type="button" className="topbar-icon" title="Studio settings & privacy filter" aria-label="Studio settings" onClick={() => setAppSettingsOpen(true)}><Settings size={17} /></button>
          <button type="button" className="topbar-icon" title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts" onClick={() => setHelpOpen(true)}><CircleHelp size={18} /></button>
        </header>

        <main className={`studio-layout ${miniLibraryOpen ? '' : 'gallery-collapsed'}`} data-library-side={miniLibrarySide}>
          <Workspace
            assets={assets} activeAsset={activeAsset} compareAsset={compareAsset} referenceAsset={referenceAsset}
            generating={generating} generationModel={generationModel}
            tab={tab} tool={tool} zoom={zoom} onTabChange={setTab} onToolChange={setTool}
            onZoomChange={setZoom} onSelectAsset={selectAsset}
            lineage={visibleLineage} lineageCount={lineage.length}
            onCompareAsset={compareWith} onBranchAsset={branchFrom}
            onSendToReference={addAsReference} onDeleteAsset={deleteAsset}
            onToggleKeeper={toggleKeeper} onToast={toast}
          />
          <StudioControls
            assets={assets} references={references} onReferencePick={pickReference} prompt={prompt} negativePrompt={negativePrompt}
            model={model} ratio={ratio} resolution={resolution} seed={seed}
            creativity={creativity} generating={generating}
            isDesktopBackend={Boolean(backend)}
            dryRun={dryRun}
            apiConfig={isBrowserBridge ? undefined : {
              apiKey: String(rawConfig.api_key ?? ''),
              baseUrl: String(rawConfig.base_url ?? ''),
              proEndpointId: String(rawConfig.pro_endpoint_id ?? ''),
            }}
            onDryRunChange={setDryRun}
            onSaveApiConfig={isBrowserBridge ? undefined : async (cfg) => {
              if (!backend) return;
              const next = { ...rawConfig, api_key: cfg.apiKey.trim(), base_url: cfg.baseUrl.trim(), pro_endpoint_id: cfg.proEndpointId.trim(), model };
              setRawConfig(next);
              await backend.saveConfig(next);
              toast('API settings saved', 'Stored locally in ~/.ark-image-studio.');
            }}
            onTestApi={async () => {
              if (!backend) return;
              const res = await backend.dryRun();
              toast(res.success ? 'API connection OK' : 'API test failed', res.message || res.error);
            }}
            onAddReferenceSlot={addReferenceSlot}
            onReferenceImport={importReference}
            onReferenceToggle={(id) => setReferences((current) => current.map((ref) => ref.id === id ? { ...ref, enabled: !ref.enabled } : ref))}
            onReferenceClear={(id) => setReferences((current) => current.map((ref) => ref.id === id ? { ...ref, src: null, assetId: undefined, enabled: false } : ref))}
            onPromptChange={setPrompt} onNegativePromptChange={setNegativePrompt}
            onModelChange={(m) => {
              setModel(m);
              const mc = SEEDREAM_MODELS[m];
              if (mc && !mc.resolutions[resolution]) setResolution(mc.default_resolution);
            }}
            onRatioChange={setRatio}
            onResolutionChange={setResolution} onSeedChange={setSeed}
            onCreativityChange={setCreativity} onGenerate={() => { void generate(); }} onToast={toast}
          />
          <Gallery
            assets={assets} activeId={activeId}
            selectedIds={selectedIds}
            multiSelectMode={multiSelectMode}
            onToggleSelect={toggleSelectId}
            onStartMultiSelect={startMultiSelect}
            onSelect={selectAsset}
            onInspect={(id) => openFullLibrary(id)}
            onOpenFullLibrary={() => openFullLibrary()}
            onCollapse={() => setMiniLibraryOpen(false)}
            onToggleKeeper={toggleKeeper}
            onCompare={compareWith}
            onAddReference={addAsReference} onDelete={deleteAsset}
            onImport={importGallery} onToast={toast}
          />
        </main>

      </div>

      {fullLibraryOpen && (
        <FullLibrary
          assets={assets}
          scratchpadAssets={scratchpadAssets}
          trashAssets={trashAssets}
          activeId={activeId}
          initialInspectId={libraryInspectId}
          selectedIds={selectedIds}
          multiSelectMode={multiSelectMode}
          onToggleSelect={toggleSelectId}
          onStartMultiSelect={startMultiSelect}
          onSpaceChange={setFullLibSpace}
          onEmptyTrash={() => { void handleEmptyTrash(); }}
          onClose={closeFullLibrary}
          onSelect={selectAsset}
          onCompare={compareWith}
          onAddReference={addAsReference}
          onToggleKeeper={toggleKeeper}
          onDelete={deleteAsset}
          onImport={importGallery}
          onToast={toast}
        />
      )}

      {multiSelectMode && (
        <MultiSelectBar
          count={selectedIds.length}
          inBinOrScratchpad={Boolean(fullLibraryOpen && (fullLibSpace === 'trash' || fullLibSpace === 'scratchpad'))}
          onMoveToBin={() => { void moveSelectedTo('trash'); }}
          onMoveToScratchpad={() => { void moveSelectedTo('scratchpad'); }}
          onRestore={() => { void moveSelectedTo('draft'); }}
          onClear={clearMultiSelect}
        />
      )}

      <AnimatePresence>
        {notice && (
          <motion.div className="studio-toast" role="status" key={notice.id} initial={{ opacity: 0, y: 18, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .97 }} transition={{ duration: .22 }}>
            <div className="toast-icon"><Check size={17} /></div>
            <div><strong>{notice.message}</strong>{notice.detail && <span>{notice.detail}</span>}</div>
            <button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={15} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {helpOpen && (
          <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setHelpOpen(false)}>
            <motion.div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" initial={{ opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: .98 }} onMouseDown={(event) => event.stopPropagation()}>
              <div className="help-modal-head"><div><span className="section-kicker">WORKSPACE REFERENCE</span><h2 id="help-title">Keyboard & controls</h2></div><button type="button" aria-label="Close help" onClick={() => setHelpOpen(false)}><X size={18} /></button></div>
              <div className="help-shortcuts">
                <div><span>Generate image</span><kbd>Ctrl / ⌘ + Enter</kbd></div>
                <div><span>Select visible iteration</span><kbd>1 — 6</kbd></div>
                <div><span>Compare iteration with main</span><kbd>Shift + click</kbd></div>
                <div><span>Toggle Keeper</span><kbd>Double-click frame</kbd></div>
                <div><span>Lineage / multi-select menu</span><kbd>Right-click</kbd></div>
                <div><span>Toggle Mini Library</span><kbd>L</kbd></div>
                <div><span>Open Full Library</span><kbd>G</kbd></div>
                <div><span>Privacy Cover</span><kbd>Ctrl + Shift + L</kbd></div>
                <div><span>Close / exit multi-select</span><kbd>Esc</kbd></div>
              </div>
              <div className="help-note"><Sparkles size={17} /><span>Connected to local FastAPI + SQLite library under Downloads/Images.</span></div>
              <div className="help-footer"><Monitor size={14} /> Ark Image Studio v2</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {appSettingsOpen && (
          <motion.div className="modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setAppSettingsOpen(false)}>
            <motion.div className="help-modal" role="dialog" aria-modal="true" aria-labelledby="studio-settings-title" initial={{ opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: .98 }} onMouseDown={(event) => event.stopPropagation()}>
              <div className="help-modal-head"><div><h2 id="studio-settings-title">Settings &amp; Privacy</h2></div><button type="button" aria-label="Close settings" onClick={() => setAppSettingsOpen(false)}><X size={18} /></button></div>
              <p className="studio-connection-status" role="status">{isBrowserBridge ? 'Firefox local bridge connected' : backend ? (sorterLabel || 'Local backend connected') : 'Mock preview · no AI calls'} · {assets.length} images</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Shield size={16} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Privacy Cover on Focus Loss</div>
                      <div style={{ fontSize: 11, opacity: 0.6 }}>Auto-hide workspace on Alt+Tab / blur (Ctrl+Shift+L always locks)</div>
                    </div>
                  </div>
                  <input type="checkbox" checked={privacyEnabled} onChange={(e) => setPrivacyEnabled(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>Mini Library Placement</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="text-icon-button" onClick={() => setMiniLibraryOpen((v) => !v)} style={{ padding: '4px 10px', fontSize: 12 }}>
                      {miniLibraryOpen ? 'Hide Mini' : 'Show Mini'}
                    </button>
                    <button type="button" className="text-icon-button" onClick={() => setMiniLibrarySide((s) => s === 'left' ? 'right' : 'left')} style={{ padding: '4px 10px', fontSize: 12 }}>
                      Side: {miniLibrarySide === 'left' ? 'Left' : 'Right'}
                    </button>
                    {backend && (
                      <button type="button" className="text-icon-button" onClick={() => { setAppSettingsOpen(false); setCovered(true); }} style={{ padding: '4px 10px', fontSize: 12 }}>
                        Cover Now
                      </button>
                    )}
                  </div>
                </div>

                {backend && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, letterSpacing: '0.06em' }}>BYTEPLUS API &amp; LIBRARY</div>
                    {isBrowserBridge ? <p style={{fontSize:11}}>Provider settings are managed by your local backend. Use the Firefox extension to disconnect.</p> : <>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type={showTopApiKey ? 'text' : 'password'} value={topApiKey} onChange={(e) => setTopApiKey(e.target.value)} placeholder="Paste BytePlus Ark API key…" style={{ flex: 1, padding: '6px 10px', borderRadius: 7, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit', fontSize: 12 }} />
                      <button type="button" className="text-icon-button" onClick={() => setShowTopApiKey((v) => !v)}>{showTopApiKey ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input value={topBaseUrl} onChange={(e) => setTopBaseUrl(e.target.value)} placeholder="Base URL (optional)" style={{ flex: 1, padding: '6px 10px', borderRadius: 7, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit', fontSize: 12 }} />
                      <input value={topProEp} onChange={(e) => setTopProEp(e.target.value)} placeholder="Pro Endpoint ep-..." style={{ flex: 1, padding: '6px 10px', borderRadius: 7, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', color: 'inherit', fontSize: 12 }} />
                    </div>
                    </>}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="text-icon-button" onClick={nativeOpenFolder} style={{ padding: '5px 10px', fontSize: 12 }}><FolderOpen size={13}/> Open Folder</button>
                        <button type="button" className="text-icon-button" onClick={() => { void backend.syncAssets().then(() => refreshBackendAssets(false)).then(() => toast('Library synced')); }} style={{ padding: '5px 10px', fontSize: 12 }}><RefreshCw size={13}/> Re-sync</button>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="text-icon-button" onClick={() => { void backend.dryRun().then((r) => toast(r.success ? 'API OK' : 'API test failed', r.message || r.error)); }} style={{ padding: '5px 10px', fontSize: 12 }}><TestTube size={13}/> Test</button>
                        {!isBrowserBridge && <button type="button" className="text-icon-button" onClick={() => { const next = { ...rawConfig, api_key: topApiKey.trim(), base_url: topBaseUrl.trim(), pro_endpoint_id: topProEp.trim(), model }; setRawConfig(next); void backend.saveConfig(next).then(() => toast('Settings saved')); }} style={{ padding: '5px 10px', fontSize: 12, background: 'rgba(255,255,255,0.12)' }}><Check size={13}/> Save</button>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {backend && covered && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Workspace covered"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483647,
            background: '#080a09',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: '28px 32px',
              borderRadius: 16,
              background: 'rgba(18, 22, 20, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              maxWidth: 320,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Ark Studio Covered</div>
            <p style={{ fontSize: 12, opacity: 0.65, marginBottom: 18 }}>
              Generations and background sorter continue normally.
            </p>
            <button
              type="button"
              onClick={() => setCovered(false)}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                background: '#f5f2eb',
                color: '#0a0c0b',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Reveal Workspace
            </button>
            <div style={{ fontSize: 10, opacity: 0.45, marginTop: 12 }}>Ctrl + Shift + L</div>
          </div>
        </div>
      )}
    </div>
  );
}
