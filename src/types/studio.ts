export type SemanticTabId = "main" | "reference" | "extra";

export type CanvasMode =
  | "inspect"
  | "compare"
  | "paint"
  | "mask"
  | "split"
  | "contact-sheet"
  | "adjust";

export type ContextualDeckTab =
  | "auto-tools"
  | "modding"
  | "queue"
  | "plugins"
  | "macros";

export type PromptStudioTab =
  | "compose"
  | "history"
  | "library"
  | "blocks"
  | "diff"
  | "wildcards";

export type ExplorerMode = "gallery" | "vault" | "collections";

export type CurationStatus = "draft" | "keeper" | "final" | "archived";

export type RefRole =
  | "base"
  | "character"
  | "creature"
  | "pose"
  | "anatomy"
  | "outfit"
  | "style";

export type VaultCategory =
  | "characters"
  | "creatures"
  | "poses"
  | "anatomy"
  | "outfits"
  | "environments"
  | "styles";

export type AspectRatioKey =
  | "1:1"
  | "3:4"
  | "4:3"
  | "16:9"
  | "9:16"
  | "2:3"
  | "3:2"
  | "21:9";

export type ResolutionTier = "1K" | "1.5K" | "2K" | "3K" | "4K";

export type CompareTarget = "parent" | "reference" | "extra";

export type PaintToolType =
  | "brush"
  | "eraser"
  | "arrow"
  | "rect"
  | "ellipse"
  | "text"
  | "crop";

export type PaintLayerType = "paint" | "callouts" | "mask";

export type MiddleZoneKey = "z2" | "z3" | "z5";

export type Zone2Tab = "slots" | "pinboard" | "kits";

export type ModInsertMode = "sole" | "join";

export interface RefCropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RefSlotItem {
  slotIndex: number;
  imageId: string;
  role: RefRole;
  muted: boolean;
  cropRect?: RefCropRect | null;
  note?: string;
}

export interface StudioImageMetadata {
  prompt?: string;
  structuredBlocks?: Record<string, string>;
  model?: string;
  model_code?: string;
  base_resolution?: string;
  aspect_ratio?: string;
  exact_pixels?: string;
  watermark?: boolean;
  type?: "generated" | "import" | "split" | "derivative" | "other";
  library_category?: "source" | "generated" | "others";
  originalName?: string;
  parent_id?: string | null;
  ref_id?: string | null;
  ref_ids?: string[];
  ref_roles?: Record<string, RefRole>;
}

export interface StudioImageRecord {
  id: string; // e.g. "output_20261119_...", "import_...", "split_...", "download_..."
  image_url: string;
  thumb_url: string;
  width: number;
  height: number;
  timestamp: number;
  file_version?: string;
  curation: CurationStatus;
  vaultCategories: VaultCategory[];
  vaultSubgroup?: string; // e.g. character name
  tags: string[];
  collectionIds: string[];
  metadata: StudioImageMetadata;
}

export interface LineageNodeEntry {
  parent: string;
  prompt?: string;
  extraRefs?: string[];
}

export interface LineageTree {
  sources: string[];
  lineage: Record<string, LineageNodeEntry>;
}

export interface CollectionPromptItem {
  id: string;
  name: string;
  text: string;
  sourceImageId?: string | null;
}

export interface CollectionRecord {
  id: string;
  name: string;
  images: string[];
  prompts: CollectionPromptItem[];
  defaultRefs: string[];
  createdAt: number;
}

export interface ModdingTagItem {
  id: string;
  label: string;
  soleText: string;
  joinText: string;
}

export interface ModdingCategoryPack {
  id: string;
  name: string;
  tags: ModdingTagItem[];
}

export type GenerationJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface GenerationJob {
  id: string;
  prompt: string;
  model: string;
  pxSize: string;
  refIds: string[];
  status: GenerationJobStatus;
  progress: number;
  createdAt: number;
  resultImageId?: string;
  error?: string;
}

export interface ViewportCamera {
  scale: number;
  x: number;
  y: number;
}

export interface LookAdjustState {
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: number;
}

export interface PaintState {
  tool: PaintToolType;
  color: string;
  brushSize: number;
  opacity: number;
  feather: number;
  activeLayer: PaintLayerType;
}

export interface SessionPinItem {
  imageId: string;
  role: RefRole;
}

export interface SavedRefKit {
  id: string;
  name: string;
  slots: RefSlotItem[];
}

export interface PromptHistoryEntry {
  id: string;
  text: string;
  timestamp: number;
  imageId?: string;
  familyRootId?: string;
}

export interface GalleryFilterState {
  search: string;
  curation: "all" | CurationStatus;
  vaultCategory: "all" | VaultCategory;
  stackBranches: boolean;
  collectionId: string;
  aspect: "all" | "portrait" | "landscape" | "square";
  columns: number;
}

export interface SorterStatus {
  inboxCount: number;
  watching: boolean;
  lastScanAt: number;
  inboxPath: string;
}

export interface StudioConfigPayload {
  selectedModel: string;
  selectedRes: string;
  selectedRatio: string;
  ratioLocked: boolean;
  batchCount: 1 | 2 | 3 | 4;
  watermark: boolean;
}

export interface SeedreamModelSpec {
  model_code: string;
  max_reference_images: number;
  resolutions: Partial<Record<ResolutionTier, Record<AspectRatioKey, string>>>;
}

export const ASPECT_RATIOS: readonly AspectRatioKey[] = [
  "1:1",
  "3:4",
  "4:3",
  "16:9",
  "9:16",
  "2:3",
  "3:2",
  "21:9",
] as const;

export const REF_ROLES: readonly RefRole[] = [
  "base",
  "character",
  "creature",
  "pose",
  "anatomy",
  "outfit",
  "style",
] as const;

export const VAULT_CATEGORIES: readonly VaultCategory[] = [
  "characters",
  "creatures",
  "poses",
  "anatomy",
  "outfits",
  "environments",
  "styles",
] as const;

const MATRIX_1K: Record<AspectRatioKey, string> = {
  "1:1": "1024x1024",
  "3:4": "864x1152",
  "4:3": "1152x864",
  "16:9": "1280x720",
  "9:16": "720x1280",
  "2:3": "832x1248",
  "3:2": "1248x832",
  "21:9": "1512x648",
};

const MATRIX_1_5K: Record<AspectRatioKey, string> = {
  "1:1": "1536x1536",
  "3:4": "1296x1728",
  "4:3": "1728x1296",
  "16:9": "1920x1080",
  "9:16": "1080x1920",
  "2:3": "1248x1872",
  "3:2": "1872x1248",
  "21:9": "2268x972",
};

const MATRIX_2K: Record<AspectRatioKey, string> = {
  "1:1": "2048x2048",
  "3:4": "1728x2304",
  "4:3": "2304x1728",
  "16:9": "2560x1440",
  "9:16": "1440x2560",
  "2:3": "1664x2496",
  "3:2": "2496x1664",
  "21:9": "3024x1296",
};

const MATRIX_3K: Record<AspectRatioKey, string> = {
  "1:1": "3072x3072",
  "3:4": "2592x3456",
  "4:3": "3456x2592",
  "16:9": "3840x2160",
  "9:16": "2160x3840",
  "2:3": "2496x3744",
  "3:2": "3744x2496",
  "21:9": "4536x1944",
};

const MATRIX_4K: Record<AspectRatioKey, string> = {
  "1:1": "4096x4096",
  "3:4": "3456x4608",
  "4:3": "4608x3456",
  "16:9": "5120x2880",
  "9:16": "2880x5120",
  "2:3": "3328x4992",
  "3:2": "4992x3328",
  "21:9": "6048x2592",
};

export const SEEDREAM_CONFIG = {
  "Seedream 5.5": {
    model_code: "dola-seedream-5-5-261028",
    max_reference_images: 10,
    resolutions: {
      "1K": MATRIX_1K,
      "1.5K": MATRIX_1_5K,
      "2K": MATRIX_2K,
    },
  },
  "Seedream 5.0 Pro": {
    model_code: "dola-seedream-5-0-pro-260628",
    max_reference_images: 10,
    resolutions: {
      "1K": MATRIX_1K,
      "1.5K": MATRIX_1_5K,
      "2K": MATRIX_2K,
    },
  },
  "Seedream 5.0 Lite": {
    model_code: "doubao-seedream-5-0-lite-260128",
    max_reference_images: 10,
    resolutions: {
      "2K": MATRIX_2K,
      "3K": MATRIX_3K,
    },
  },
  "Seedream 4.5": {
    model_code: "doubao-seedream-4-5-251128",
    max_reference_images: 10,
    resolutions: {
      "2K": MATRIX_2K,
      "4K": MATRIX_4K,
    },
  },
  "Seedream 4.0": {
    model_code: "doubao-seedream-4-0-250828",
    max_reference_images: 10,
    resolutions: {
      "1K": MATRIX_1K,
      "2K": MATRIX_2K,
      "4K": MATRIX_4K,
    },
  },
} as const satisfies Record<string, SeedreamModelSpec>;

export type SeedreamModelName = keyof typeof SEEDREAM_CONFIG;

export const SEEDREAM_MODELS = Object.keys(SEEDREAM_CONFIG) as SeedreamModelName[];

export function getModelResolutions(model: string): ResolutionTier[] {
  const spec =
    SEEDREAM_CONFIG[model as SeedreamModelName] ?? SEEDREAM_CONFIG["Seedream 5.5"];
  return Object.keys(spec.resolutions) as ResolutionTier[];
}

export function getExactPixels(
  model: string,
  res: string,
  ratio: string
): string {
  const spec =
    SEEDREAM_CONFIG[model as SeedreamModelName] ?? SEEDREAM_CONFIG["Seedream 5.5"];
  const resMap =
    spec.resolutions[res as keyof typeof spec.resolutions] ??
    Object.values(spec.resolutions)[0];
  const r = ratio as AspectRatioKey;
  return resMap?.[r] ?? "2048x2048";
}

export function parsePixelDimensions(pxSize: string): {
  width: number;
  height: number;
} {
  const [wStr, hStr] = pxSize.toLowerCase().split("x");
  const width = Number.parseInt(wStr ?? "2048", 10);
  const height = Number.parseInt(hStr ?? "2048", 10);
  return {
    width: Number.isFinite(width) && width > 0 ? width : 2048,
    height: Number.isFinite(height) && height > 0 ? height : 2048,
  };
}

export function inferClosestAspectRatio(
  width: number,
  height: number
): AspectRatioKey {
  if (width <= 0 || height <= 0) return "1:1";
  const target = width / height;
  const ratioValues: Record<AspectRatioKey, number> = {
    "1:1": 1,
    "3:4": 3 / 4,
    "4:3": 4 / 3,
    "16:9": 16 / 9,
    "9:16": 9 / 16,
    "2:3": 2 / 3,
    "3:2": 3 / 2,
    "21:9": 21 / 9,
  };
  let best: AspectRatioKey = "1:1";
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const key of ASPECT_RATIOS) {
    const diff = Math.abs(ratioValues[key] - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = key;
    }
  }
  return best;
}
