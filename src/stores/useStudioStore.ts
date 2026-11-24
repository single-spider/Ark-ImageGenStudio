import { create } from "zustand";
import { toast } from "sonner";
import {
  SEEDREAM_CONFIG,
  getExactPixels,
  getModelResolutions,
  inferClosestAspectRatio,
  type AspectRatioKey,
  type CanvasMode,
  type CollectionRecord,
  type CompareTarget,
  type ContextualDeckTab,
  type CurationStatus,
  type ExplorerMode,
  type GalleryFilterState,
  type GenerationJob,
  type LineageTree,
  type LookAdjustState,
  type MiddleZoneKey,
  type ModInsertMode,
  type ModdingCategoryPack,
  type ModdingTagItem,
  type PaintState,
  type PromptHistoryEntry,
  type PromptStudioTab,
  type RefCropRect,
  type RefRole,
  type RefSlotItem,
  type SavedRefKit,
  type SeedreamModelName,
  type SemanticTabId,
  type SessionPinItem,
  type StudioImageRecord,
  type VaultCategory,
  type ViewportCamera,
  type Zone2Tab,
} from "../types/studio";
import { studioApi } from "../services/studioApi";

const DEFAULT_CAMERA: ViewportCamera = { scale: 1, x: 0, y: 0 };

const DEFAULT_LOOK_ADJUST: LookAdjustState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grayscale: 0,
};

const DEFAULT_PAINT_STATE: PaintState = {
  tool: "brush",
  color: "#8B5CF6",
  brushSize: 28,
  opacity: 0.9,
  feather: 12,
  activeLayer: "paint",
};

const DEFAULT_GALLERY_FILTER: GalleryFilterState = {
  search: "",
  curation: "all",
  vaultCategory: "all",
  stackBranches: true,
  collectionId: "all",
  aspect: "all",
  columns: 3,
};

export function getLineageAncestors(
  imageId: string | null,
  tree: LineageTree
): string[] {
  if (!imageId) return [];
  const chain: string[] = [];
  const visited = new Set<string>();
  let current: string | undefined = imageId;
  while (current && !visited.has(current)) {
    visited.add(current);
    chain.unshift(current);
    current = tree.lineage[current]?.parent;
  }
  return chain;
}

export function getNodeChildren(
  parentId: string,
  tree: LineageTree
): string[] {
  return Object.entries(tree.lineage)
    .filter(([, node]) => node.parent === parentId)
    .map(([childId]) => childId);
}

export function getFamilyRootId(
  imageId: string | null,
  tree: LineageTree
): string | null {
  const ancestors = getLineageAncestors(imageId, tree);
  return ancestors[0] ?? null;
}

function buildImageMap(
  images: StudioImageRecord[]
): Record<string, StudioImageRecord> {
  const map: Record<string, StudioImageRecord> = {};
  for (const img of images) {
    map[img.id] = img;
  }
  return map;
}

function reindexSlots(slots: RefSlotItem[]): RefSlotItem[] {
  return slots.map((slot, idx) => ({ ...slot, slotIndex: idx + 1 }));
}

const activeJobTimers = new Map<string, ReturnType<typeof setInterval>>();

export interface StudioState {
  // Core Data
  images: StudioImageRecord[];
  imageMap: Record<string, StudioImageRecord>;
  tree: LineageTree;
  collections: CollectionRecord[];
  moddingPacks: ModdingCategoryPack[];
  jobs: GenerationJob[];
  isInitialized: boolean;
  isLoadingGallery: boolean;

  // Zone 1 State
  semanticTabs: Record<SemanticTabId, string | null>;
  activeTab: SemanticTabId;
  canvasMode: CanvasMode;
  compareTarget: CompareTarget;
  isHoldingPeek: boolean;
  viewportCamera: Record<SemanticTabId, ViewportCamera>;
  contactSheetCamera: ViewportCamera;
  contactSheetIds: string[];
  expandedIterationNodeId: string | null;
  wideCanvas: boolean;
  lookAdjust: LookAdjustState;
  paintState: PaintState;

  // Zone 2 State
  refSlots: RefSlotItem[];
  sessionPinboard: SessionPinItem[];
  savedKits: SavedRefKit[];
  zone2Tab: Zone2Tab;

  // Zone 3 State
  contextualTab: ContextualDeckTab;
  modInsertMode: ModInsertMode;
  activeModCategoryId: string;
  maximizedMiddleZone: MiddleZoneKey | null;
  autoFlexSignal: number;

  // Zone 4 State
  selectedModel: string;
  selectedRes: string;
  selectedRatio: string;
  ratioLocked: boolean;
  batchCount: 1 | 2 | 3 | 4;
  watermark: boolean;

  // Zone 5 State
  promptTab: PromptStudioTab;
  promptText: string;
  structuredBlocks: Record<string, string>;
  activeGuardrails: string[];
  promptHistory: PromptHistoryEntry[];

  // Zone 6 & Global State
  explorerMode: ExplorerMode;
  fullViewportGalleryOpen: boolean;
  galleryFilter: GalleryFilterState;
  selectedGalleryIds: string[];
  commandPaletteOpen: boolean;
  privacyLocked: boolean;
  sorterInboxCount: number;

  // Lifecycle Actions
  initStudio: () => Promise<void>;
  refreshSorterStatus: () => Promise<void>;

  // Zone 1 Actions
  setActiveTab: (tab: SemanticTabId) => void;
  openImageInTab: (tab: SemanticTabId, imageId: string | null) => void;
  openInMain: (imageId: string) => void;
  setCanvasMode: (mode: CanvasMode) => void;
  setCompareTarget: (target: CompareTarget) => void;
  setHoldingPeek: (holding: boolean) => void;
  setViewportCamera: (
    tab: SemanticTabId,
    camera: Partial<ViewportCamera>
  ) => void;
  resetViewportCamera: (tab?: SemanticTabId) => void;
  setContactSheetCamera: (camera: Partial<ViewportCamera>) => void;
  setContactSheetIds: (ids: string[]) => void;
  toggleContactSheetId: (imageId: string) => void;
  setExpandedIterationNodeId: (nodeId: string | null) => void;
  toggleExpandedIterationNode: (nodeId: string) => void;
  setWideCanvas: (wide: boolean) => void;
  toggleWideCanvas: () => void;
  updateLookAdjust: (patch: Partial<LookAdjustState>) => void;
  resetLookAdjust: () => void;
  updatePaintState: (patch: Partial<PaintState>) => void;
  savePaintDerivative: (compositeDataUrl: string, note?: string) => Promise<void>;
  runMaskRoundtrip: (maskDataUrl: string, promptOverride?: string) => Promise<void>;
  runSplitImage: (rows: number, cols: number, prefix?: string) => Promise<void>;

  // Zone 2 Actions
  addRefSlot: (imageId: string, role?: RefRole) => void;
  removeRefSlot: (slotIndex: number) => void;
  reorderRefSlots: (fromIndex: number, toIndex: number) => void;
  toggleMuteRefSlot: (slotIndex: number) => void;
  setRefSlotRole: (slotIndex: number, role: RefRole) => void;
  setRefSlotCrop: (slotIndex: number, cropRect: RefCropRect | null) => void;
  setRefSlotNote: (slotIndex: number, note: string) => void;
  clearRefSlots: () => void;
  pinToSessionBoard: (imageId: string, role?: RefRole) => void;
  unpinFromSessionBoard: (imageId: string) => void;
  promotePinToSlot: (imageId: string) => void;
  saveCurrentAsKit: (name: string) => void;
  loadKit: (kitId: string) => void;
  deleteKit: (kitId: string) => void;
  setZone2Tab: (tab: Zone2Tab) => void;

  // Zone 3 Actions
  setContextualTab: (tab: ContextualDeckTab) => void;
  setModInsertMode: (mode: ModInsertMode) => void;
  setActiveModCategoryId: (categoryId: string) => void;
  setMaximizedMiddleZone: (zone: MiddleZoneKey | null) => void;
  toggleMaximizedMiddleZone: (zone: MiddleZoneKey) => void;
  applyModdingTag: (tag: ModdingTagItem) => void;
  saveModdingPacks: (packs: ModdingCategoryPack[]) => Promise<void>;

  // Zone 4 Actions
  setSelectedModel: (model: string) => void;
  setSelectedRes: (res: string) => void;
  setSelectedRatio: (ratio: string) => void;
  toggleRatioLock: () => void;
  setBatchCount: (count: 1 | 2 | 3 | 4) => void;
  toggleWatermark: () => void;
  matchRatioFromImage: (imageId: string) => void;

  // Zone 5 Actions
  setPromptTab: (tab: PromptStudioTab) => void;
  setPromptText: (text: string) => void;
  setStructuredBlock: (key: string, value: string) => void;
  compileBlocksToPrompt: () => void;
  toggleGuardrail: (guardrail: string) => void;
  loadPromptFromImage: (imageId: string) => void;

  // Queue & Generation Actions
  submitGeneration: () => Promise<void>;
  cancelJob: (jobId: string) => void;
  retryJob: (jobId: string) => Promise<void>;
  clearCompletedJobs: () => void;

  // Curation, Vault & Collections Actions
  setCurationStatus: (imageId: string, curation: CurationStatus) => Promise<void>;
  toggleKeeper: (imageId: string) => Promise<void>;
  toggleFinal: (imageId: string) => Promise<void>;
  toggleArchived: (imageId: string) => Promise<void>;
  promoteToVault: (
    imageId: string,
    categories: VaultCategory[],
    subgroup?: string
  ) => Promise<void>;
  createCollection: (name: string, initialImageIds?: string[]) => Promise<void>;
  deleteCollection: (collectionId: string) => Promise<void>;
  addImagesToCollection: (
    collectionId: string,
    imageIds: string[]
  ) => Promise<void>;
  removeImageFromCollection: (
    collectionId: string,
    imageId: string
  ) => Promise<void>;
  savePromptToCollection: (
    collectionId: string,
    name: string,
    text: string,
    sourceImageId?: string | null
  ) => Promise<void>;
  loadCollectionDefaultRefs: (collectionId: string) => void;

  // Zone 6 & Global Actions
  setExplorerMode: (mode: ExplorerMode) => void;
  setFullViewportGalleryOpen: (open: boolean) => void;
  updateGalleryFilter: (patch: Partial<GalleryFilterState>) => void;
  resetGalleryFilter: () => void;
  toggleGallerySelection: (imageId: string) => void;
  clearGallerySelection: () => void;
  batchSetCuration: (curation: CurationStatus) => Promise<void>;
  setCommandPaletteOpen: (open: boolean) => void;
  setPrivacyLocked: (locked: boolean) => void;
  togglePrivacyLocked: () => void;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  // Core Data
  images: [],
  imageMap: {},
  tree: { sources: [], lineage: {} },
  collections: [],
  moddingPacks: [],
  jobs: [],
  isInitialized: false,
  isLoadingGallery: false,

  // Zone 1 State
  semanticTabs: { main: null, reference: null, extra: null },
  activeTab: "main",
  canvasMode: "inspect",
  compareTarget: "parent",
  isHoldingPeek: false,
  viewportCamera: {
    main: { ...DEFAULT_CAMERA },
    reference: { ...DEFAULT_CAMERA },
    extra: { ...DEFAULT_CAMERA },
  },
  contactSheetCamera: { ...DEFAULT_CAMERA },
  contactSheetIds: [],
  expandedIterationNodeId: null,
  wideCanvas: false,
  lookAdjust: { ...DEFAULT_LOOK_ADJUST },
  paintState: { ...DEFAULT_PAINT_STATE },

  // Zone 2 State
  refSlots: [],
  sessionPinboard: [],
  savedKits: [],
  zone2Tab: "slots",

  // Zone 3 State
  contextualTab: "modding",
  modInsertMode: "join",
  activeModCategoryId: "pack_lighting",
  maximizedMiddleZone: null,
  autoFlexSignal: 0,

  // Zone 4 State
  selectedModel: "Seedream 5.5",
  selectedRes: "2K",
  selectedRatio: "3:4",
  ratioLocked: false,
  batchCount: 1,
  watermark: false,

  // Zone 5 State
  promptTab: "compose",
  promptText:
    "Vespera obsidian valkyrie in cold silver rainfall, water beads glistening on matte carbon-steel armor, twin cyan-violet specular rim highlights, 85mm f/1.4",
  structuredBlocks: {
    subject: "Vespera obsidian valkyrie, rain-slick dark titanium plate",
    lighting: "Twin cyan and ultraviolet rim lights cutting through silver rain",
    camera: "85mm f/1.4 prime, crisp droplet bokeh, vertical editorial poster",
    environment: "Storm-drenched obsidian parapet, volumetric mist",
  },
  activeGuardrails: [
    "Preserve subject identity from Ref #1",
    "Avoid extra limbs or distorted fingers",
  ],
  promptHistory: [],

  // Zone 6 & Global State
  explorerMode: "gallery",
  fullViewportGalleryOpen: false,
  galleryFilter: { ...DEFAULT_GALLERY_FILTER },
  selectedGalleryIds: [],
  commandPaletteOpen: false,
  privacyLocked: false,
  sorterInboxCount: 0,

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================
  initStudio: async () => {
    if (get().isLoadingGallery || get().isInitialized) return;
    set({ isLoadingGallery: true });
    try {
      const [gallery, sorter] = await Promise.all([
        studioApi.getGallery(),
        studioApi.getSorterStatus(),
      ]);

      const imageMap = buildImageMap(gallery.images);
      const defaultMain =
        imageMap["output_20261117_142819_vespera_v2c"]?.id ??
        gallery.images[0]?.id ??
        null;
      const defaultRef =
        imageMap["import_20261116_091200_vespera_ref"]?.id ?? null;
      const defaultExtra =
        imageMap["import_20261114_152000_style_chiaroscuro_oil"]?.id ?? null;

      const initialSlots: RefSlotItem[] = [];
      if (defaultRef) {
        initialSlots.push({
          slotIndex: 1,
          imageId: defaultRef,
          role: "character",
          muted: false,
          cropRect: null,
          note: "Primary face & armor identity",
        });
      }
      if (imageMap["import_20261114_134000_outfit_obsidian_trench"]) {
        initialSlots.push({
          slotIndex: 2,
          imageId: "import_20261114_134000_outfit_obsidian_trench",
          role: "outfit",
          muted: false,
          cropRect: null,
          note: "Matte carbon-weave cloak",
        });
      }
      if (defaultExtra) {
        initialSlots.push({
          slotIndex: 3,
          imageId: defaultExtra,
          role: "style",
          muted: false,
          cropRect: null,
          note: "Chiaroscuro rim grading",
        });
      }

      const initialPins: SessionPinItem[] = [
        {
          imageId: "import_20261114_103000_pose_dynamic_leap",
          role: "pose",
        },
        {
          imageId: "import_20261114_111500_anatomy_hand_study",
          role: "anatomy",
        },
        {
          imageId: "import_20261116_180500_wyrm_sketch",
          role: "creature",
        },
      ].filter((p) => Boolean(imageMap[p.imageId]));

      const initialKits: SavedRefKit[] = [
        {
          id: "kit_vespera_hero",
          name: "Vespera Hero Kit",
          slots: structuredClone(initialSlots),
        },
        {
          id: "kit_wyrm_cinematic",
          name: "Aether Wyrm Widescreen",
          slots: [
            {
              slotIndex: 1,
              imageId: "import_20261116_180500_wyrm_sketch",
              role: "creature",
              muted: false,
            },
            {
              slotIndex: 2,
              imageId: "import_20261114_152000_style_chiaroscuro_oil",
              role: "style",
              muted: false,
            },
          ].filter((s) => Boolean(imageMap[s.imageId])),
        },
      ];

      const initialHistory: PromptHistoryEntry[] = gallery.images
        .filter((img) => Boolean(img.metadata.prompt))
        .slice(0, 12)
        .map((img) => ({
          id: `hist_${img.id}`,
          text: img.metadata.prompt ?? "",
          timestamp: img.timestamp,
          imageId: img.id,
          familyRootId: getFamilyRootId(img.id, gallery.tree) ?? undefined,
        }));

      const contactSheetSeed = [
        "output_20261117_142510_vespera_v2a",
        "output_20261117_142644_vespera_v2b",
        "output_20261117_142819_vespera_v2c",
        "output_20261117_143005_vespera_v2d",
      ].filter((id) => Boolean(imageMap[id]));

      set({
        images: gallery.images,
        imageMap,
        tree: gallery.tree,
        collections: gallery.collections,
        moddingPacks: gallery.moddingPacks,
        activeModCategoryId: gallery.moddingPacks[0]?.id ?? "pack_lighting",
        semanticTabs: {
          main: defaultMain,
          reference: defaultRef,
          extra: defaultExtra,
        },
        refSlots: initialSlots,
        sessionPinboard: initialPins,
        savedKits: initialKits,
        promptHistory: initialHistory,
        contactSheetIds: contactSheetSeed,
        sorterInboxCount: sorter.inboxCount,
        isInitialized: true,
        isLoadingGallery: false,
      });
    } catch (error) {
      set({ isLoadingGallery: false });
      toast.error(
        error instanceof Error
          ? `Failed to initialize studio: ${error.message}`
          : "Failed to initialize studio"
      );
    }
  },

  refreshSorterStatus: async () => {
    try {
      const status = await studioApi.getSorterStatus();
      set({ sorterInboxCount: status.inboxCount });
    } catch {
      // Keep previous count silently
    }
  },

  // ==========================================================================
  // ZONE 1 ACTIONS
  // ==========================================================================
  setActiveTab: (tab) => set({ activeTab: tab }),

  openImageInTab: (tab, imageId) =>
    set((state) => ({
      semanticTabs: { ...state.semanticTabs, [tab]: imageId },
      activeTab: tab,
      expandedIterationNodeId:
        tab === "main" ? null : state.expandedIterationNodeId,
    })),

  openInMain: (imageId) => {
    const state = get();
    const record = state.imageMap[imageId];
    if (!record) return;
    const nextRatio = state.ratioLocked
      ? state.selectedRatio
      : record.metadata.aspect_ratio ||
        inferClosestAspectRatio(record.width, record.height);

    set({
      semanticTabs: { ...state.semanticTabs, main: imageId },
      activeTab: "main",
      selectedRatio: nextRatio,
      expandedIterationNodeId: null,
    });
  },

  setCanvasMode: (mode) =>
    set((state) => {
      const entersToolMode =
        mode === "paint" || mode === "mask" || mode === "split";
      const leavesToolMode =
        (state.canvasMode === "paint" ||
          state.canvasMode === "mask" ||
          state.canvasMode === "split") &&
        !entersToolMode;
      return {
        canvasMode: mode,
        contextualTab: entersToolMode ? "auto-tools" : state.contextualTab,
        maximizedMiddleZone: entersToolMode ? null : state.maximizedMiddleZone,
        autoFlexSignal:
          entersToolMode || leavesToolMode
            ? state.autoFlexSignal + 1
            : state.autoFlexSignal,
        paintState:
          mode === "mask"
            ? { ...state.paintState, activeLayer: "mask" }
            : mode === "paint" && state.paintState.activeLayer === "mask"
              ? { ...state.paintState, activeLayer: "paint" }
              : state.paintState,
      };
    }),

  setCompareTarget: (target) => set({ compareTarget: target }),

  setHoldingPeek: (holding) => set({ isHoldingPeek: holding }),

  setViewportCamera: (tab, camera) =>
    set((state) => ({
      viewportCamera: {
        ...state.viewportCamera,
        [tab]: { ...state.viewportCamera[tab], ...camera },
      },
    })),

  resetViewportCamera: (tab) =>
    set((state) => {
      if (tab) {
        return {
          viewportCamera: {
            ...state.viewportCamera,
            [tab]: { ...DEFAULT_CAMERA },
          },
        };
      }
      return {
        viewportCamera: {
          main: { ...DEFAULT_CAMERA },
          reference: { ...DEFAULT_CAMERA },
          extra: { ...DEFAULT_CAMERA },
        },
        contactSheetCamera: { ...DEFAULT_CAMERA },
      };
    }),

  setContactSheetCamera: (camera) =>
    set((state) => ({
      contactSheetCamera: { ...state.contactSheetCamera, ...camera },
    })),

  setContactSheetIds: (ids) => set({ contactSheetIds: ids.slice(0, 6) }),

  toggleContactSheetId: (imageId) =>
    set((state) => {
      const exists = state.contactSheetIds.includes(imageId);
      if (exists) {
        return {
          contactSheetIds: state.contactSheetIds.filter((id) => id !== imageId),
        };
      }
      return {
        contactSheetIds: [...state.contactSheetIds, imageId].slice(0, 6),
      };
    }),

  setExpandedIterationNodeId: (nodeId) =>
    set({ expandedIterationNodeId: nodeId }),

  toggleExpandedIterationNode: (nodeId) =>
    set((state) => ({
      expandedIterationNodeId:
        state.expandedIterationNodeId === nodeId ? null : nodeId,
    })),

  setWideCanvas: (wide) => set({ wideCanvas: wide }),

  toggleWideCanvas: () => set((state) => ({ wideCanvas: !state.wideCanvas })),

  updateLookAdjust: (patch) =>
    set((state) => ({
      lookAdjust: { ...state.lookAdjust, ...patch },
    })),

  resetLookAdjust: () => set({ lookAdjust: { ...DEFAULT_LOOK_ADJUST } }),

  updatePaintState: (patch) =>
    set((state) => ({
      paintState: { ...state.paintState, ...patch },
    })),

  savePaintDerivative: async (compositeDataUrl, note) => {
    const state = get();
    const sourceId = state.semanticTabs[state.activeTab];
    if (!sourceId) {
      toast.error("No active image to save paint derivative from.");
      return;
    }
    try {
      const created = await studioApi.savePaintDerivative({
        sourceImageId: sourceId,
        compositeDataUrl,
        note,
      });
      set((s) => {
        const nextImages = [created, ...s.images];
        return {
          images: nextImages,
          imageMap: { ...s.imageMap, [created.id]: created },
          tree: {
            ...s.tree,
            lineage: {
              ...s.tree.lineage,
              [created.id]: {
                parent: sourceId,
                prompt: note || "Paint-over derivative",
              },
            },
          },
          semanticTabs: { ...s.semanticTabs, main: created.id },
          activeTab: "main",
          canvasMode: "inspect",
          autoFlexSignal: s.autoFlexSignal + 1,
        };
      });
      toast.success("Saved paint-over derivative into lineage tree.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save paint derivative"
      );
    }
  },

  runMaskRoundtrip: async (maskDataUrl, promptOverride) => {
    const state = get();
    const sourceId = state.semanticTabs[state.activeTab];
    if (!sourceId) {
      toast.error("Load an image before running mask inpaint.");
      return;
    }
    const prompt = (promptOverride ?? state.promptText).trim();
    const pxSize = getExactPixels(
      state.selectedModel,
      state.selectedRes,
      state.selectedRatio
    );
    try {
      const created = await studioApi.compositeMaskRoundtrip({
        sourceImageId: sourceId,
        maskDataUrl,
        prompt: prompt || "Seamless mask inpaint refinement",
        feather: state.paintState.feather,
        model: state.selectedModel,
        exact_pixels: pxSize,
      });
      set((s) => ({
        images: [created, ...s.images],
        imageMap: { ...s.imageMap, [created.id]: created },
        tree: {
          ...s.tree,
          lineage: {
            ...s.tree.lineage,
            [created.id]: {
              parent: sourceId,
              prompt: `[Mask] ${prompt || "Inpaint composite"}`,
            },
          },
        },
        semanticTabs: { ...s.semanticTabs, main: created.id },
        activeTab: "main",
        canvasMode: "inspect",
        autoFlexSignal: s.autoFlexSignal + 1,
      }));
      toast.success("Mask roundtrip composite added to lineage.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Mask roundtrip failed"
      );
    }
  },

  runSplitImage: async (rows, cols, prefix) => {
    const state = get();
    const sourceId = state.semanticTabs[state.activeTab];
    if (!sourceId) {
      toast.error("Select an image to split.");
      return;
    }
    try {
      const tiles = await studioApi.splitImage({
        sourceImageId: sourceId,
        rows,
        cols,
        prefix,
      });
      set((s) => {
        const nextMap = { ...s.imageMap };
        const nextLineage = { ...s.tree.lineage };
        for (const tile of tiles) {
          nextMap[tile.id] = tile;
          nextLineage[tile.id] = { parent: sourceId };
        }
        return {
          images: [...tiles, ...s.images],
          imageMap: nextMap,
          tree: { ...s.tree, lineage: nextLineage },
          contactSheetIds: tiles.map((t) => t.id).slice(0, 6),
          canvasMode: "inspect",
          autoFlexSignal: s.autoFlexSignal + 1,
        };
      });
      toast.success(`Split into ${tiles.length} tiles and linked to parent.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to split image"
      );
    }
  },

  // ==========================================================================
  // ZONE 2 ACTIONS (REFERENCES)
  // ==========================================================================
  addRefSlot: (imageId, role) => {
    const state = get();
    const spec =
      SEEDREAM_CONFIG[state.selectedModel as SeedreamModelName] ??
      SEEDREAM_CONFIG["Seedream 5.5"];
    if (state.refSlots.some((s) => s.imageId === imageId)) {
      toast.info("Image is already assigned to an active reference slot.");
      return;
    }
    if (state.refSlots.length >= spec.max_reference_images) {
      toast.warning(
        `${state.selectedModel} supports up to ${spec.max_reference_images} reference slots.`
      );
      return;
    }
    const img = state.imageMap[imageId];
    const inferredRole: RefRole =
      role ??
      (img?.vaultCategories.includes("characters")
        ? "character"
        : img?.vaultCategories.includes("creatures")
          ? "creature"
          : img?.vaultCategories.includes("poses")
            ? "pose"
            : img?.vaultCategories.includes("anatomy")
              ? "anatomy"
              : img?.vaultCategories.includes("outfits")
                ? "outfit"
                : img?.vaultCategories.includes("styles")
                  ? "style"
                  : state.refSlots.length === 0
                    ? "base"
                    : "style");

    set({
      refSlots: reindexSlots([
        ...state.refSlots,
        {
          slotIndex: state.refSlots.length + 1,
          imageId,
          role: inferredRole,
          muted: false,
          cropRect: null,
        },
      ]),
    });
  },

  removeRefSlot: (slotIndex) =>
    set((state) => ({
      refSlots: reindexSlots(
        state.refSlots.filter((s) => s.slotIndex !== slotIndex)
      ),
    })),

  reorderRefSlots: (fromIndex, toIndex) =>
    set((state) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.refSlots.length ||
        toIndex >= state.refSlots.length ||
        fromIndex === toIndex
      ) {
        return state;
      }
      const next = [...state.refSlots];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { refSlots: reindexSlots(next) };
    }),

  toggleMuteRefSlot: (slotIndex) =>
    set((state) => ({
      refSlots: state.refSlots.map((slot) =>
        slot.slotIndex === slotIndex ? { ...slot, muted: !slot.muted } : slot
      ),
    })),

  setRefSlotRole: (slotIndex, role) =>
    set((state) => ({
      refSlots: state.refSlots.map((slot) =>
        slot.slotIndex === slotIndex ? { ...slot, role } : slot
      ),
    })),

  setRefSlotCrop: (slotIndex, cropRect) =>
    set((state) => ({
      refSlots: state.refSlots.map((slot) =>
        slot.slotIndex === slotIndex ? { ...slot, cropRect } : slot
      ),
    })),

  setRefSlotNote: (slotIndex, note) =>
    set((state) => ({
      refSlots: state.refSlots.map((slot) =>
        slot.slotIndex === slotIndex ? { ...slot, note } : slot
      ),
    })),

  clearRefSlots: () => set({ refSlots: [] }),

  pinToSessionBoard: (imageId, role = "style") =>
    set((state) => {
      if (state.sessionPinboard.some((p) => p.imageId === imageId)) {
        return state;
      }
      return {
        sessionPinboard: [...state.sessionPinboard, { imageId, role }],
      };
    }),

  unpinFromSessionBoard: (imageId) =>
    set((state) => ({
      sessionPinboard: state.sessionPinboard.filter(
        (p) => p.imageId !== imageId
      ),
    })),

  promotePinToSlot: (imageId) => {
    const pin = get().sessionPinboard.find((p) => p.imageId === imageId);
    get().addRefSlot(imageId, pin?.role);
  },

  saveCurrentAsKit: (name) => {
    const trimmed = name.trim();
    const state = get();
    if (!trimmed) {
      toast.error("Enter a kit name first.");
      return;
    }
    if (state.refSlots.length === 0) {
      toast.error("Add at least one reference slot before saving a kit.");
      return;
    }
    const newKit: SavedRefKit = {
      id: `kit_${Date.now()}`,
      name: trimmed,
      slots: structuredClone(state.refSlots),
    };
    set({ savedKits: [newKit, ...state.savedKits] });
    toast.success(`Saved kit "${trimmed}".`);
  },

  loadKit: (kitId) => {
    const kit = get().savedKits.find((k) => k.id === kitId);
    if (!kit) return;
    set({
      refSlots: reindexSlots(structuredClone(kit.slots)),
      zone2Tab: "slots",
    });
    toast.success(`Loaded "${kit.name}" (${kit.slots.length} refs).`);
  },

  deleteKit: (kitId) =>
    set((state) => ({
      savedKits: state.savedKits.filter((k) => k.id !== kitId),
    })),

  setZone2Tab: (tab) => set({ zone2Tab: tab }),

  // ==========================================================================
  // ZONE 3 ACTIONS (CONTEXTUAL DECK)
  // ==========================================================================
  setContextualTab: (tab) => set({ contextualTab: tab }),

  setModInsertMode: (mode) => set({ modInsertMode: mode }),

  setActiveModCategoryId: (categoryId) =>
    set({ activeModCategoryId: categoryId }),

  setMaximizedMiddleZone: (zone) =>
    set((state) => ({
      maximizedMiddleZone: zone,
      autoFlexSignal: state.autoFlexSignal + 1,
    })),

  toggleMaximizedMiddleZone: (zone) =>
    set((state) => ({
      maximizedMiddleZone: state.maximizedMiddleZone === zone ? null : zone,
      autoFlexSignal: state.autoFlexSignal + 1,
    })),

  applyModdingTag: (tag) =>
    set((state) => {
      if (state.modInsertMode === "sole") {
        return { promptText: tag.soleText };
      }
      const trimmed = state.promptText.trim();
      if (!trimmed) {
        return { promptText: tag.joinText };
      }
      if (trimmed.toLowerCase().includes(tag.joinText.toLowerCase())) {
        return state;
      }
      const separator = trimmed.endsWith(",") || trimmed.endsWith(".") ? " " : ", ";
      return { promptText: `${trimmed}${separator}${tag.joinText}` };
    }),

  saveModdingPacks: async (packs) => {
    try {
      const saved = await studioApi.saveModdingPacks(packs);
      set({ moddingPacks: saved });
      toast.success("Modding packs updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save modding packs"
      );
    }
  },

  // ==========================================================================
  // ZONE 4 ACTIONS (MODEL SETTINGS)
  // ==========================================================================
  setSelectedModel: (model) => {
    const state = get();
    const spec =
      SEEDREAM_CONFIG[model as SeedreamModelName] ??
      SEEDREAM_CONFIG["Seedream 5.5"];
    const validResolutions = getModelResolutions(model);
    const nextRes = validResolutions.includes(
      state.selectedRes as (typeof validResolutions)[number]
    )
      ? state.selectedRes
      : validResolutions[0];
    const trimmedSlots =
      state.refSlots.length > spec.max_reference_images
        ? reindexSlots(state.refSlots.slice(0, spec.max_reference_images))
        : state.refSlots;

    set({
      selectedModel: model,
      selectedRes: nextRes,
      refSlots: trimmedSlots,
    });
    void studioApi.saveConfig({
      selectedModel: model,
      selectedRes: nextRes,
      selectedRatio: state.selectedRatio,
      ratioLocked: state.ratioLocked,
      batchCount: state.batchCount,
      watermark: state.watermark,
    });
  },

  setSelectedRes: (res) => {
    const state = get();
    set({ selectedRes: res });
    void studioApi.saveConfig({
      selectedModel: state.selectedModel,
      selectedRes: res,
      selectedRatio: state.selectedRatio,
      ratioLocked: state.ratioLocked,
      batchCount: state.batchCount,
      watermark: state.watermark,
    });
  },

  setSelectedRatio: (ratio) => {
    const state = get();
    set({ selectedRatio: ratio });
    void studioApi.saveConfig({
      selectedModel: state.selectedModel,
      selectedRes: state.selectedRes,
      selectedRatio: ratio,
      ratioLocked: state.ratioLocked,
      batchCount: state.batchCount,
      watermark: state.watermark,
    });
  },

  toggleRatioLock: () =>
    set((state) => ({ ratioLocked: !state.ratioLocked })),

  setBatchCount: (count) => set({ batchCount: count }),

  toggleWatermark: () => set((state) => ({ watermark: !state.watermark })),

  matchRatioFromImage: (imageId) => {
    const img = get().imageMap[imageId];
    if (!img) return;
    const ratio =
      img.metadata.aspect_ratio ||
      inferClosestAspectRatio(img.width, img.height);
    get().setSelectedRatio(ratio);
  },

  // ==========================================================================
  // ZONE 5 ACTIONS (PROMPT STUDIO)
  // ==========================================================================
  setPromptTab: (tab) => set({ promptTab: tab }),

  setPromptText: (text) => set({ promptText: text }),

  setStructuredBlock: (key, value) =>
    set((state) => ({
      structuredBlocks: { ...state.structuredBlocks, [key]: value },
    })),

  compileBlocksToPrompt: () =>
    set((state) => {
      const parts = Object.values(state.structuredBlocks)
        .map((v) => v.trim())
        .filter(Boolean);
      return {
        promptText: parts.join(", "),
        promptTab: "compose",
      };
    }),

  toggleGuardrail: (guardrail) =>
    set((state) => {
      const exists = state.activeGuardrails.includes(guardrail);
      return {
        activeGuardrails: exists
          ? state.activeGuardrails.filter((g) => g !== guardrail)
          : [...state.activeGuardrails, guardrail],
      };
    }),

  loadPromptFromImage: (imageId) => {
    const img = get().imageMap[imageId];
    if (!img?.metadata.prompt) {
      toast.info("Selected image has no embedded prompt.");
      return;
    }
    set((state) => ({
      promptText: img.metadata.prompt ?? state.promptText,
      structuredBlocks: img.metadata.structuredBlocks
        ? { ...img.metadata.structuredBlocks }
        : state.structuredBlocks,
      promptTab: "compose",
    }));
  },

  // ==========================================================================
  // QUEUE & GENERATION ACTIONS
  // ==========================================================================
  submitGeneration: async () => {
    const state = get();
    const rawPrompt = state.promptText.trim();
    if (!rawPrompt) {
      toast.warning("Write a prompt before generating.");
      return;
    }

    const activeRefs = state.refSlots.filter((s) => !s.muted);
    const refIds = activeRefs.map((s) => s.imageId);
    const refRoles: Record<string, RefRole> = {};
    for (const slot of activeRefs) {
      refRoles[slot.imageId] = slot.role;
    }

    const pxSize = getExactPixels(
      state.selectedModel,
      state.selectedRes,
      state.selectedRatio
    );
    const parentId =
      state.semanticTabs.main ??
      activeRefs.find((s) => s.role === "base")?.imageId ??
      refIds[0] ??
      null;

    const fullPrompt =
      state.activeGuardrails.length > 0
        ? `${rawPrompt}. ${state.activeGuardrails.join(". ")}.`
        : rawPrompt;

    const now = Date.now();
    const batchJobs: GenerationJob[] = Array.from(
      { length: state.batchCount },
      (_, idx) => ({
        id: `job_${now}_${idx + 1}_${Math.random().toString(36).slice(2, 5)}`,
        prompt: rawPrompt,
        model: state.selectedModel,
        pxSize,
        refIds,
        status: idx === 0 ? "running" : "queued",
        progress: idx === 0 ? 10 : 0,
        createdAt: now + idx,
      })
    );

    set((s) => ({
      jobs: [...batchJobs, ...s.jobs],
      contextualTab: s.batchCount > 1 ? "queue" : s.contextualTab,
    }));

    toast.success(
      state.batchCount > 1
        ? `Queued batch of ${state.batchCount} renders (${pxSize}).`
        : `Generating ${state.selectedModel} (${pxSize})…`
    );

    let openedFirstResult = false;

    for (const job of batchJobs) {
      // Mark running
      set((s) => ({
        jobs: s.jobs.map((j) =>
          j.id === job.id && j.status !== "cancelled"
            ? { ...j, status: "running", progress: Math.max(j.progress, 12) }
            : j
        ),
      }));

      // Smooth simulated progress ticker
      const intervalId = setInterval(() => {
        const currentJob = get().jobs.find((j) => j.id === job.id);
        if (!currentJob || currentJob.status !== "running") {
          clearInterval(intervalId);
          activeJobTimers.delete(job.id);
          return;
        }
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === job.id && j.status === "running"
              ? { ...j, progress: Math.min(92, j.progress + 18) }
              : j
          ),
        }));
      }, 240);
      activeJobTimers.set(job.id, intervalId);

      // Simulate realistic network/inference window (~1.1s)
      await new Promise((r) => setTimeout(r, 950));

      const afterWaitJob = get().jobs.find((j) => j.id === job.id);
      if (!afterWaitJob || afterWaitJob.status === "cancelled") {
        clearInterval(intervalId);
        activeJobTimers.delete(job.id);
        continue;
      }

      try {
        const res = await studioApi.generateImage({
          prompt: fullPrompt,
          structuredBlocks: state.structuredBlocks,
          model: state.selectedModel,
          base_resolution: state.selectedRes,
          aspect_ratio: state.selectedRatio as AspectRatioKey,
          exact_pixels: pxSize,
          watermark: state.watermark,
          parent_id: parentId,
          ref_ids: refIds,
          ref_roles: refRoles,
        });

        clearInterval(intervalId);
        activeJobTimers.delete(job.id);

        const created = res.image;
        set((s) => {
          const nextTree: LineageTree = res.parentId
            ? {
                ...s.tree,
                lineage: {
                  ...s.tree.lineage,
                  [created.id]: {
                    parent: res.parentId,
                    prompt: rawPrompt,
                    extraRefs: refIds.filter((r) => r !== res.parentId),
                  },
                },
              }
            : {
                ...s.tree,
                sources: [created.id, ...s.tree.sources],
              };

          const shouldOpen = !openedFirstResult;
          openedFirstResult = true;

          return {
            images: [created, ...s.images],
            imageMap: { ...s.imageMap, [created.id]: created },
            tree: nextTree,
            semanticTabs: shouldOpen
              ? { ...s.semanticTabs, main: created.id }
              : s.semanticTabs,
            activeTab: shouldOpen ? "main" : s.activeTab,
            promptHistory: [
              {
                id: `hist_${created.id}`,
                text: rawPrompt,
                timestamp: created.timestamp,
                imageId: created.id,
                familyRootId:
                  getFamilyRootId(created.id, nextTree) ?? undefined,
              },
              ...s.promptHistory,
            ],
            jobs: s.jobs.map((j) =>
              j.id === job.id
                ? {
                    ...j,
                    status: "completed",
                    progress: 100,
                    resultImageId: created.id,
                  }
                : j
            ),
          };
        });
      } catch (error) {
        clearInterval(intervalId);
        activeJobTimers.delete(job.id);
        const msg =
          error instanceof Error ? error.message : "Generation failed";
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === job.id ? { ...j, status: "failed", error: msg } : j
          ),
        }));
        toast.error(msg);
      }
    }
  },

  cancelJob: (jobId) => {
    const timer = activeJobTimers.get(jobId);
    if (timer) {
      clearInterval(timer);
      activeJobTimers.delete(jobId);
    }
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId && (j.status === "queued" || j.status === "running")
          ? { ...j, status: "cancelled" }
          : j
      ),
    }));
  },

  retryJob: async (jobId) => {
    const job = get().jobs.find((j) => j.id === jobId);
    if (!job) return;
    set({
      promptText: job.prompt,
      selectedModel: job.model,
      batchCount: 1,
    });
    await get().submitGeneration();
  },

  clearCompletedJobs: () =>
    set((state) => ({
      jobs: state.jobs.filter(
        (j) => j.status === "queued" || j.status === "running"
      ),
    })),

  // ==========================================================================
  // CURATION, VAULT & COLLECTIONS
  // ==========================================================================
  setCurationStatus: async (imageId, curation) => {
    const prev = get().imageMap[imageId];
    if (!prev) return;
    set((state) => {
      const updated = { ...prev, curation };
      return {
        images: state.images.map((i) => (i.id === imageId ? updated : i)),
        imageMap: { ...state.imageMap, [imageId]: updated },
      };
    });
    try {
      await studioApi.updateCuration(imageId, curation);
    } catch (error) {
      set((state) => ({
        images: state.images.map((i) => (i.id === imageId ? prev : i)),
        imageMap: { ...state.imageMap, [imageId]: prev },
      }));
      toast.error(
        error instanceof Error ? error.message : "Failed to update curation"
      );
    }
  },

  toggleKeeper: async (imageId) => {
    const img = get().imageMap[imageId];
    if (!img) return;
    const next: CurationStatus = img.curation === "keeper" ? "draft" : "keeper";
    await get().setCurationStatus(imageId, next);
  },

  toggleFinal: async (imageId) => {
    const img = get().imageMap[imageId];
    if (!img) return;
    const next: CurationStatus = img.curation === "final" ? "keeper" : "final";
    await get().setCurationStatus(imageId, next);
  },

  toggleArchived: async (imageId) => {
    const img = get().imageMap[imageId];
    if (!img) return;
    const next: CurationStatus =
      img.curation === "archived" ? "draft" : "archived";
    await get().setCurationStatus(imageId, next);
  },

  promoteToVault: async (imageId, categories, subgroup) => {
    const prev = get().imageMap[imageId];
    if (!prev) return;
    const updated: StudioImageRecord = {
      ...prev,
      vaultCategories: [...categories],
      vaultSubgroup: subgroup ?? prev.vaultSubgroup,
    };
    set((state) => ({
      images: state.images.map((i) => (i.id === imageId ? updated : i)),
      imageMap: { ...state.imageMap, [imageId]: updated },
    }));
    try {
      await studioApi.assignVaultCategory(imageId, categories, subgroup);
      toast.success("Updated Vault categories.");
    } catch (error) {
      set((state) => ({
        images: state.images.map((i) => (i.id === imageId ? prev : i)),
        imageMap: { ...state.imageMap, [imageId]: prev },
      }));
      toast.error(
        error instanceof Error ? error.message : "Failed to update Vault"
      );
    }
  },

  createCollection: async (name, initialImageIds = []) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const nextCol: CollectionRecord = {
      id: `col_${Date.now()}`,
      name: trimmed,
      images: [...initialImageIds],
      prompts: [],
      defaultRefs: [],
      createdAt: Date.now(),
    };
    const nextCollections = [nextCol, ...get().collections];
    set({ collections: nextCollections });
    await studioApi.saveCollections(nextCollections);
    toast.success(`Created collection "${trimmed}".`);
  },

  deleteCollection: async (collectionId) => {
    const nextCollections = get().collections.filter(
      (c) => c.id !== collectionId
    );
    set((state) => ({
      collections: nextCollections,
      galleryFilter:
        state.galleryFilter.collectionId === collectionId
          ? { ...state.galleryFilter, collectionId: "all" }
          : state.galleryFilter,
    }));
    await studioApi.saveCollections(nextCollections);
  },

  addImagesToCollection: async (collectionId, imageIds) => {
    const nextCollections = get().collections.map((col) => {
      if (col.id !== collectionId) return col;
      const merged = Array.from(new Set([...col.images, ...imageIds]));
      return { ...col, images: merged };
    });
    set((state) => {
      const idSet = new Set(imageIds);
      const nextImages = state.images.map((img) =>
        idSet.has(img.id)
          ? {
              ...img,
              collectionIds: Array.from(
                new Set([...img.collectionIds, collectionId])
              ),
            }
          : img
      );
      return {
        collections: nextCollections,
        images: nextImages,
        imageMap: buildImageMap(nextImages),
      };
    });
    await studioApi.saveCollections(nextCollections);
  },

  removeImageFromCollection: async (collectionId, imageId) => {
    const nextCollections = get().collections.map((col) =>
      col.id === collectionId
        ? { ...col, images: col.images.filter((id) => id !== imageId) }
        : col
    );
    set((state) => {
      const nextImages = state.images.map((img) =>
        img.id === imageId
          ? {
              ...img,
              collectionIds: img.collectionIds.filter(
                (cid) => cid !== collectionId
              ),
            }
          : img
      );
      return {
        collections: nextCollections,
        images: nextImages,
        imageMap: buildImageMap(nextImages),
      };
    });
    await studioApi.saveCollections(nextCollections);
  },

  savePromptToCollection: async (
    collectionId,
    name,
    text,
    sourceImageId = null
  ) => {
    const trimmedName = name.trim();
    const trimmedText = text.trim();
    if (!trimmedName || !trimmedText) return;
    const nextCollections = get().collections.map((col) =>
      col.id === collectionId
        ? {
            ...col,
            prompts: [
              {
                id: `prm_${Date.now()}`,
                name: trimmedName,
                text: trimmedText,
                sourceImageId,
              },
              ...col.prompts,
            ],
          }
        : col
    );
    set({ collections: nextCollections });
    await studioApi.saveCollections(nextCollections);
    toast.success(`Saved prompt to collection.`);
  },

  loadCollectionDefaultRefs: (collectionId) => {
    const state = get();
    const col = state.collections.find((c) => c.id === collectionId);
    if (!col || col.defaultRefs.length === 0) {
      toast.info("Collection has no default reference kit.");
      return;
    }
    const slots: RefSlotItem[] = col.defaultRefs
      .filter((id) => Boolean(state.imageMap[id]))
      .slice(0, 10)
      .map((imageId, idx) => ({
        slotIndex: idx + 1,
        imageId,
        role: idx === 0 ? "base" : "style",
        muted: false,
      }));
    set({ refSlots: slots, zone2Tab: "slots" });
    toast.success(`Loaded ${slots.length} default refs from "${col.name}".`);
  },

  // ==========================================================================
  // ZONE 6 & GLOBAL ACTIONS
  // ==========================================================================
  setExplorerMode: (mode) => set({ explorerMode: mode }),

  setFullViewportGalleryOpen: (open) => set({ fullViewportGalleryOpen: open }),

  updateGalleryFilter: (patch) =>
    set((state) => ({
      galleryFilter: { ...state.galleryFilter, ...patch },
    })),

  resetGalleryFilter: () =>
    set({ galleryFilter: { ...DEFAULT_GALLERY_FILTER } }),

  toggleGallerySelection: (imageId) =>
    set((state) => {
      const exists = state.selectedGalleryIds.includes(imageId);
      return {
        selectedGalleryIds: exists
          ? state.selectedGalleryIds.filter((id) => id !== imageId)
          : [...state.selectedGalleryIds, imageId],
      };
    }),

  clearGallerySelection: () => set({ selectedGalleryIds: [] }),

  batchSetCuration: async (curation) => {
    const ids = [...get().selectedGalleryIds];
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => get().setCurationStatus(id, curation)));
    set({ selectedGalleryIds: [] });
    toast.success(`Marked ${ids.length} images as ${curation}.`);
  },

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  setPrivacyLocked: (locked) => set({ privacyLocked: locked }),

  togglePrivacyLocked: () =>
    set((state) => ({
      privacyLocked: !state.privacyLocked,
      isHoldingPeek: false,
    })),
}));
