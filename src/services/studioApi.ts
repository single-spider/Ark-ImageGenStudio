import {
  SEEDREAM_CONFIG,
  parsePixelDimensions,
  type AspectRatioKey,
  type CollectionRecord,
  type CurationStatus,
  type LineageTree,
  type ModdingCategoryPack,
  type RefRole,
  type SeedreamModelName,
  type SorterStatus,
  type StudioConfigPayload,
  type StudioImageRecord,
  type VaultCategory,
} from "../types/studio";

export interface GalleryPayload {
  images: StudioImageRecord[];
  tree: LineageTree;
  collections: CollectionRecord[];
  moddingPacks: ModdingCategoryPack[];
}

export interface GenerateImageRequest {
  prompt: string;
  structuredBlocks?: Record<string, string>;
  model: string;
  base_resolution: string;
  aspect_ratio: AspectRatioKey | string;
  exact_pixels: string;
  watermark: boolean;
  parent_id?: string | null;
  ref_ids: string[];
  ref_roles: Record<string, RefRole>;
}

export interface GenerateImageResponse {
  image: StudioImageRecord;
  parentId: string | null;
}

export interface SplitImageRequest {
  sourceImageId: string;
  rows: number;
  cols: number;
  prefix?: string;
}

export interface MaskRoundtripRequest {
  sourceImageId: string;
  maskDataUrl: string;
  prompt: string;
  feather: number;
  model: string;
  exact_pixels: string;
}

export interface PaintDerivativeRequest {
  sourceImageId: string;
  compositeDataUrl: string;
  note?: string;
}

export interface StudioApi {
  getGallery(): Promise<GalleryPayload>;
  generateImage(payload: GenerateImageRequest): Promise<GenerateImageResponse>;
  splitImage(payload: SplitImageRequest): Promise<StudioImageRecord[]>;
  compositeMaskRoundtrip(
    payload: MaskRoundtripRequest
  ): Promise<StudioImageRecord>;
  savePaintDerivative(
    payload: PaintDerivativeRequest
  ): Promise<StudioImageRecord>;
  updateCuration(
    imageId: string,
    curation: CurationStatus
  ): Promise<StudioImageRecord>;
  assignVaultCategory(
    imageId: string,
    categories: VaultCategory[],
    subgroup?: string
  ): Promise<StudioImageRecord>;
  saveCollections(collections: CollectionRecord[]): Promise<CollectionRecord[]>;
  saveModdingPacks(
    packs: ModdingCategoryPack[]
  ): Promise<ModdingCategoryPack[]>;
  saveConfig(config: StudioConfigPayload): Promise<{ ok: boolean }>;
  getSorterStatus(): Promise<SorterStatus>;
}

interface ArtRenderSpec {
  width: number;
  height: number;
  label: string;
  sublabel: string;
  bgA: string;
  bgB: string;
  accentA: string;
  accentB: string;
  motif: "valkyrie" | "wyrm" | "citadel" | "pose" | "anatomy" | "outfit" | "style" | "bust";
  seed: number;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createStudioArtDataUri(spec: ArtRenderSpec): string {
  const { width, height, label, sublabel, bgA, bgB, accentA, accentB, motif, seed } = spec;
  const cx = Math.round(width * (0.42 + ((seed % 5) - 2) * 0.04));
  const cy = Math.round(height * (0.38 + ((seed % 3) - 1) * 0.05));
  const rx = Math.round(Math.min(width, height) * 0.36);
  const ry = Math.round(Math.min(width, height) * 0.42);
  const titleSize = Math.max(26, Math.round(Math.min(width, height) * 0.036));
  const subSize = Math.max(16, Math.round(titleSize * 0.56));
  const pad = Math.round(Math.min(width, height) * 0.05);

  let motifSvg = "";
  if (motif === "valkyrie") {
    motifSvg = `
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#glow)" opacity="0.72" />
      <path d="M ${cx} ${Math.round(height * 0.14)} L ${cx + Math.round(rx * 0.62)} ${Math.round(height * 0.74)} L ${cx} ${Math.round(height * 0.62)} L ${cx - Math.round(rx * 0.62)} ${Math.round(height * 0.74)} Z" fill="${accentA}" fill-opacity="0.22" stroke="${accentA}" stroke-opacity="0.7" stroke-width="${Math.max(2, Math.round(width * 0.0025))}" />
      <circle cx="${cx}" cy="${Math.round(height * 0.31)}" r="${Math.round(rx * 0.24)}" fill="none" stroke="${accentB}" stroke-width="${Math.max(3, Math.round(width * 0.003))}" stroke-opacity="0.85" />
      <path d="M ${cx - Math.round(rx * 0.92)} ${Math.round(height * 0.46)} Q ${cx} ${Math.round(height * 0.24)} ${cx + Math.round(rx * 0.92)} ${Math.round(height * 0.46)}" fill="none" stroke="${accentB}" stroke-opacity="0.45" stroke-width="${Math.max(2, Math.round(width * 0.002))}" />
    `;
  } else if (motif === "wyrm") {
    motifSvg = `
      <ellipse cx="${cx}" cy="${cy}" rx="${Math.round(width * 0.42)}" ry="${Math.round(height * 0.32)}" fill="url(#glow)" opacity="0.7" />
      <path d="M ${Math.round(width * 0.08)} ${Math.round(height * 0.72)} C ${Math.round(width * 0.28)} ${Math.round(height * 0.18)}, ${Math.round(width * 0.54)} ${Math.round(height * 0.88)}, ${Math.round(width * 0.92)} ${Math.round(height * 0.28)}" fill="none" stroke="${accentA}" stroke-width="${Math.max(10, Math.round(height * 0.025))}" stroke-linecap="round" stroke-opacity="0.72" />
      <path d="M ${Math.round(width * 0.12)} ${Math.round(height * 0.78)} C ${Math.round(width * 0.32)} ${Math.round(height * 0.28)}, ${Math.round(width * 0.58)} ${Math.round(height * 0.92)}, ${Math.round(width * 0.88)} ${Math.round(height * 0.36)}" fill="none" stroke="${accentB}" stroke-width="${Math.max(4, Math.round(height * 0.008))}" stroke-dasharray="18 14" stroke-opacity="0.85" />
    `;
  } else if (motif === "citadel") {
    motifSvg = `
      <rect x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.36)}" width="${Math.round(width * 0.16)}" height="${Math.round(height * 0.64)}" fill="${accentA}" fill-opacity="0.22" stroke="${accentA}" stroke-opacity="0.55" stroke-width="3" />
      <rect x="${Math.round(width * 0.34)}" y="${Math.round(height * 0.20)}" width="${Math.round(width * 0.24)}" height="${Math.round(height * 0.80)}" fill="${accentB}" fill-opacity="0.18" stroke="${accentB}" stroke-opacity="0.65" stroke-width="3" />
      <rect x="${Math.round(width * 0.64)}" y="${Math.round(height * 0.30)}" width="${Math.round(width * 0.20)}" height="${Math.round(height * 0.70)}" fill="${accentA}" fill-opacity="0.25" stroke="${accentA}" stroke-opacity="0.5" stroke-width="3" />
      <line x1="0" y1="${Math.round(height * 0.68)}" x2="${width}" y2="${Math.round(height * 0.68)}" stroke="${accentB}" stroke-opacity="0.55" stroke-width="3" />
    `;
  } else if (motif === "pose" || motif === "anatomy") {
    motifSvg = `
      <circle cx="${cx}" cy="${Math.round(height * 0.24)}" r="${Math.round(rx * 0.22)}" fill="${accentA}" fill-opacity="0.25" stroke="${accentA}" stroke-width="4" />
      <line x1="${cx}" y1="${Math.round(height * 0.33)}" x2="${cx}" y2="${Math.round(height * 0.60)}" stroke="${accentB}" stroke-width="6" stroke-linecap="round" />
      <line x1="${cx - Math.round(rx * 0.55)}" y1="${Math.round(height * 0.44)}" x2="${cx + Math.round(rx * 0.58)}" y2="${Math.round(height * 0.38)}" stroke="${accentA}" stroke-width="5" stroke-linecap="round" />
      <line x1="${cx}" y1="${Math.round(height * 0.60)}" x2="${cx - Math.round(rx * 0.40)}" y2="${Math.round(height * 0.84)}" stroke="${accentB}" stroke-width="5" stroke-linecap="round" />
      <line x1="${cx}" y1="${Math.round(height * 0.60)}" x2="${cx + Math.round(rx * 0.44)}" y2="${Math.round(height * 0.80)}" stroke="${accentA}" stroke-width="5" stroke-linecap="round" />
    `;
  } else if (motif === "outfit") {
    motifSvg = `
      <polygon points="${cx - Math.round(rx * 0.45)},${Math.round(height * 0.22)} ${cx + Math.round(rx * 0.45)},${Math.round(height * 0.22)} ${cx + Math.round(rx * 0.68)},${Math.round(height * 0.82)} ${cx - Math.round(rx * 0.68)},${Math.round(height * 0.82)}" fill="${accentA}" fill-opacity="0.2" stroke="${accentB}" stroke-width="4" />
      <line x1="${cx}" y1="${Math.round(height * 0.22)}" x2="${cx}" y2="${Math.round(height * 0.82)}" stroke="${accentA}" stroke-opacity="0.7" stroke-width="3" stroke-dasharray="12 10" />
    `;
  } else {
    motifSvg = `
      <circle cx="${cx}" cy="${cy}" r="${rx}" fill="url(#glow)" opacity="0.82" />
      <circle cx="${cx + Math.round(rx * 0.28)}" cy="${cy + Math.round(rx * 0.14)}" r="${Math.round(rx * 0.62)}" fill="none" stroke="${accentB}" stroke-width="4" stroke-opacity="0.65" />
      <rect x="${Math.round(width * 0.14)}" y="${Math.round(height * 0.14)}" width="${Math.round(width * 0.72)}" height="${Math.round(height * 0.72)}" rx="18" fill="none" stroke="${accentA}" stroke-opacity="0.35" stroke-width="3" />
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgA}" />
        <stop offset="100%" stop-color="${bgB}" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stop-color="${accentA}" stop-opacity="0.85" />
        <stop offset="55%" stop-color="${accentB}" stop-opacity="0.32" />
        <stop offset="100%" stop-color="${bgB}" stop-opacity="0" />
      </radialGradient>
      <pattern id="grid" width="${Math.max(48, Math.round(width / 18))}" height="${Math.max(48, Math.round(width / 18))}" patternUnits="userSpaceOnUse">
        <path d="M ${Math.max(48, Math.round(width / 18))} 0 L 0 0 0 ${Math.max(48, Math.round(width / 18))}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1.5" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)" />
    <rect width="100%" height="100%" fill="url(#grid)" />
    ${motifSvg}
    <rect x="${pad}" y="${height - pad - titleSize * 2.5}" width="${width - pad * 2}" height="${titleSize * 2.5}" rx="12" fill="rgba(10,12,16,0.58)" stroke="rgba(255,255,255,0.12)" stroke-width="2" />
    <text x="${pad + Math.round(titleSize * 0.6)}" y="${height - pad - titleSize * 1.28}" fill="#F3F4F6" font-family="Inter, system-ui, sans-serif" font-size="${titleSize}" font-weight="600">${escapeXml(label)}</text>
    <text x="${pad + Math.round(titleSize * 0.6)}" y="${height - pad - Math.round(titleSize * 0.42)}" fill="#9CA3AF" font-family="JetBrains Mono, monospace" font-size="${subSize}">${escapeXml(sublabel)}  •  ${width}x${height}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function makeArtPair(spec: ArtRenderSpec): { image_url: string; thumb_url: string } {
  const uri = createStudioArtDataUri(spec);
  return { image_url: uri, thumb_url: uri };
}

const BASE_TIME = 1794800000000; // Nov 2026 anchor

export const MOCK_IMAGES: StudioImageRecord[] = [
  // ==========================================================================
  // TREE 1: VESPERA — OBSIDIAN VALKYRIE (Root -> v1 -> 4 sibling variants -> v3 -> v4)
  // ==========================================================================
  {
    id: "import_20261116_091200_vespera_ref",
    ...makeArtPair({
      width: 1728,
      height: 2304,
      label: "Vespera — Source Concept Sheet",
      sublabel: "IMPORT • CHARACTER ROOT",
      bgA: "#0E1019",
      bgB: "#1C162A",
      accentA: "#8B5CF6",
      accentB: "#C4B5FD",
      motif: "valkyrie",
      seed: 1,
    }),
    width: 1728,
    height: 2304,
    timestamp: BASE_TIME - 86400000 * 4,
    file_version: "v1",
    curation: "keeper",
    vaultCategories: ["characters"],
    vaultSubgroup: "Vespera",
    tags: ["vespera", "valkyrie", "armor", "portrait", "concept"],
    collectionIds: ["col_vespera_keyart"],
    metadata: {
      originalName: "vespera_turnaround_master.png",
      type: "import",
      library_category: "source",
      aspect_ratio: "3:4",
      exact_pixels: "1728x2304",
      parent_id: null,
    },
  },
  {
    id: "output_20261117_141022_vespera_v1",
    ...makeArtPair({
      width: 1728,
      height: 2304,
      label: "Vespera — Studio Key Pass v1",
      sublabel: "SEEDREAM 5.5 • 2K",
      bgA: "#101322",
      bgB: "#201736",
      accentA: "#7C3AED",
      accentB: "#38BDF8",
      motif: "valkyrie",
      seed: 2,
    }),
    width: 1728,
    height: 2304,
    timestamp: BASE_TIME - 86400000 * 3,
    file_version: "v1",
    curation: "keeper",
    vaultCategories: ["characters"],
    vaultSubgroup: "Vespera",
    tags: ["vespera", "obsidian-plate", "editorial"],
    collectionIds: ["col_vespera_keyart"],
    metadata: {
      prompt:
        "Vespera obsidian valkyrie standing in dark slate cathedral, brushed titanium filigree pauldrons, dramatic softbox key light, 85mm cinema lens, crisp micro-scratches on armor",
      structuredBlocks: {
        subject: "Vespera, obsidian valkyrie in sculpted dark titanium plate",
        lighting: "Soft overhead studio key with cool cyan edge fill",
        camera: "85mm f/1.8 shallow depth of field, medium three-quarter framing",
        environment: "Monolithic dark slate nave with atmospheric haze",
      },
      model: "Seedream 5.5",
      model_code: SEEDREAM_CONFIG["Seedream 5.5"].model_code,
      base_resolution: "2K",
      aspect_ratio: "3:4",
      exact_pixels: "1728x2304",
      watermark: false,
      type: "generated",
      library_category: "generated",
      parent_id: "import_20261116_091200_vespera_ref",
      ref_id: "import_20261116_091200_vespera_ref",
      ref_ids: ["import_20261116_091200_vespera_ref"],
      ref_roles: { import_20261116_091200_vespera_ref: "character" },
    },
  },
  // 4 sibling variants branching off output_20261117_141022_vespera_v1
  {
    id: "output_20261117_142510_vespera_v2a",
    ...makeArtPair({
      width: 1728,
      height: 2304,
      label: "Vespera v2A — Violet Rim Lighting",
      sublabel: "BRANCH 1/4 • KEEPER",
      bgA: "#0D0B1B",
      bgB: "#2B144A",
      accentA: "#A78BFA",
      accentB: "#F472B6",
      motif: "valkyrie",
      seed: 3,
    }),
    width: 1728,
    height: 2304,
    timestamp: BASE_TIME - 86400000 * 2.6,
    file_version: "v2a",
    curation: "keeper",
    vaultCategories: ["characters", "styles"],
    vaultSubgroup: "Vespera",
    tags: ["vespera", "violet-rim", "moody"],
    collectionIds: ["col_vespera_keyart", "col_lighting_studies"],
    metadata: {
      prompt:
        "Vespera obsidian valkyrie, intense ultraviolet rim light tracing silver hair and pauldrons, volumetric twilight mist, chiaroscuro contrast, 85mm anamorphic",
      model: "Seedream 5.5",
      model_code: SEEDREAM_CONFIG["Seedream 5.5"].model_code,
      base_resolution: "2K",
      aspect_ratio: "3:4",
      exact_pixels: "1728x2304",
      watermark: false,
      type: "generated",
      library_category: "generated",
      parent_id: "output_20261117_141022_vespera_v1",
      ref_id: "output_20261117_141022_vespera_v1",
      ref_ids: [
        "output_20261117_141022_vespera_v1",
        "import_20261114_152000_style_chiaroscuro_oil",
      ],
      ref_roles: {
        output_20261117_141022_vespera_v1: "base",
        import_20261114_152000_style_chiaroscuro_oil: "style",
      },
    },
  },
  {
    id: "output_20261117_142644_vespera_v2b",
    ...makeArtPair({
      width: 1728,
      height: 2304,
      label: "Vespera v2B — Amber Furnace Glow",
      sublabel: "BRANCH 2/4 • DRAFT",
      bgA: "#16100B",
      bgB: "#331A0C",
      accentA: "#F59E0B",
      accentB: "#FB7185",
      motif: "valkyrie",
      seed: 4,
    }),
    width: 1728,
    height: 2304,
    timestamp: BASE_TIME - 86400000 * 2.55,
    file_version: "v2b",
    curation: "draft",
    vaultCategories: [],
    tags: ["vespera", "amber", "warm-key"],
    collectionIds: ["col_vespera_keyart"],
    metadata: {
      prompt:
        "Vespera obsidian valkyrie backlit by molten tungsten embers, warm amber edge reflection across dark steel cuirass, drifting ash motes, 85mm cinema prime",
      model: "Seedream 5.5",
      model_code: SEEDREAM_CONFIG["Seedream 5.5"].model_code,
      base_resolution: "2K",
      aspect_ratio: "3:4",
      exact_pixels: "1728x2304",
      watermark: false,
      type: "generated",
      library_category: "generated",
      parent_id: "output_20261117_141022_vespera_v1",
      ref_id: "output_20261117_141022_vespera_v1",
      ref_ids: ["output_20261117_141022_vespera_v1"],
      ref_roles: { output_20261117_141022_vespera_v1: "base" },
    },
  },
  {
    id: "output_20261117_142819_vespera_v2c",
    ...makeArtPair({
      width: 1728,
      height: 2304,
      label: "Vespera v2C — Silver Rain & Fog",
      sublabel: "BRANCH 3/4 • FINAL",
      bgA: "#0B111C",
      bgB: "#162538",
      accentA: "#38BDF8",
      accentB: "#8B5CF6",
      motif: "valkyrie",
      seed: 5,
    }),
    width: 1728,
    height: 2304,
    timestamp: BASE_TIME - 86400000 * 2.5,
    file_version: "v2c",
    curation: "final",
    vaultCategories: ["characters"],
    vaultSubgroup: "Vespera",
    tags: ["vespera", "rain", "final-keyart", "specular"],
    collectionIds: ["col_vespera_keyart", "col_lighting_studies"],
    metadata: {
      prompt:
        "Vespera obsidian valkyrie in cold silver rainfall, water beads glistening on matte carbon-steel armor, twin cyan-violet specular rim highlights, cinematic rain streaks, 85mm f/1.4",
      structuredBlocks: {
        subject: "Vespera obsidian valkyrie, rain-slick dark titanium plate",
        lighting: "Twin cyan and ultraviolet rim lights cutting through silver rain",
        camera: "85mm f/1.4 prime, crisp droplet bokeh, vertical editorial poster",
        environment: "Storm-drenched obsidian parapet, volumetric mist",
      },
      model: "Seedream 5.5",
      model_code: SEEDREAM_CONFIG["Seedream 5.5"].model_code,
      base_resolution: "2K",
      aspect_ratio: "3:4",
      exact_pixels: "1728x2304",
      watermark: false,
      type: "generated",
      library_category: "generated",
      parent_id: "output_20261117_141022_vespera_v1",
      ref_id: "output_20261117_141022_vespera_v1",
      ref_ids: [
        "output_20261117_141022_vespera_v1",
        "import_20261114_134000_outfit_obsidian_trench",
      ],
      ref_roles: {
        output_20261117_141022_vespera_v1: "base",
        import_20261114_134000_outfit_obsidian_trench: "outfit",
      },
    },
  },
  {
    id: "output_20261117_143005_vespera_v2d",
    ...makeArtPair({
      width: 1728,
      height: 2304,
      label: "Vespera v2D — High-Key Monochrome",
      sublabel: "BRANCH 4/4 • DRAFT",
      bgA: "#14161D",
      bgB: "#252936",
      accentA: "#E5E7EB",
      accentB: "#94A3B8",
      motif: "valkyrie",
      seed: 6,
    }),
    width: 1728,
    height: 2304,
    timestamp: BASE_TIME - 86400000 * 2.45,
    file_version: "v2d",
    curation: "draft",
    vaultCategories: [],
    tags: ["vespera", "monochrome", "silver-gelatin"],
    collectionIds: ["col_vespera_keyart"],
    metadata: {
      prompt:
        "Vespera obsidian valkyrie, Leica monochrome silver-gelatin portrait, razor-sharp tonal falloff, subtle film grain, medium format studio",
      model: "Seedream 5.0 Pro",
      model_code: SEEDREAM_CONFIG["Seedream 5.0 Pro"].model_code,
      base_resolution: "2K",
      aspect_ratio: "3:4",
      exact_pixels: "1728x2304",
      watermark: false,
      type: "generated",
      library_category: "generated",
      parent_id: "output_20261117_141022_vespera_v1",
      ref_id: "output_20261117_141022_vespera_v1",
      ref_ids: ["output_20261117_141022_vespera_v1"],
      ref_roles: { output_20261117_141022_vespera_v1: "base" },
    },
  },
  {
    id: "output_20261118_110412_vespera_v3_closeup",
    ...makeArtPair({
      width: 1664,
      height: 2496,
      label: "Vespera v3 — Visor & Collar Closeup",
      sublabel: "SEEDREAM 5.5 • 2:3 FINAL",
      bgA: "#0B0E18",
      bgB: "#1D1B36",
      accentA: "#38BDF8",
      accentB: "#A855F7",
      motif: "valkyrie",
      seed: 7,
    }),
    width: 1664,
    height: 2496,
    timestamp: BASE_TIME - 86400000 * 1.4,
    file_version: "v3",
    curation: "final",
    vaultCategories: ["characters"],
    vaultSubgroup: "Vespera",
    tags: ["vespera", "closeup", "visor", "macro-detail"],
    collectionIds: ["col_vespera_keyart"],
    metadata: {
      prompt:
        "Tight editorial closeup of Vespera visor filigree and rain-streaked collarbone armor, macro shallow focus, wet metallic reflections, cool sky rim",
      model: "Seedream 5.5",
      model_code: SEEDREAM_CONFIG["Seedream 5.5"].model_code,
      base_resolution: "2K",
      aspect_ratio: "2:3",
      exact_pixels: "1664x2496",
      watermark: false,
      type: "generated",
      library_category: "generated",
      parent_id: "output_20261117_142819_vespera_v2c",
      ref_id: "output_20261117_142819_vespera_v2c",
      ref_ids: ["output_20261117_142819_vespera_v2c"],
      ref_roles: { output_20261117_142819_vespera_v2c: "base" },
    },
  },
  {
    id: "output_20261118_112200_vespera_v4_paint",
    ...makeArtPair({
      width: 1664,
      height: 2496,
      label: "Vespera v4 — Specular Paint-Over",
      sublabel: "DERIVATIVE • PAINT LAYER",
      bgA: "#0A0F1D",
      bgB: "#22193F",
      accentA: "#60A5FA",
      accentB: "#F59E0B",
      motif: "valkyrie",
      seed: 8,
    }),
    width: 1664,
    height: 2496,
    timestamp: BASE_TIME - 86400000 * 1.2,
    file_version: "v4-paint",
    curation: "keeper",
    vaultCategories: ["characters"],
    vaultSubgroup: "Vespera",
    tags: ["vespera", "paint-over", "specular-fix"],
    collectionIds: ["col_vespera_keyart"],
    metadata: {
      prompt: "Manual paint-over specular accent pass on visor edge",
      type: "derivative",
      library_category: "generated",
      aspect_ratio: "2:3",
      exact_pixels: "1664x2496",
      parent_id: "output_20261118_110412_vespera_v3_closeup",
      ref_id: "output_20261118_110412_vespera_v3_closeup",
    },
  },

  // ==========================================================================
  // TREE 2: AETHER WYRM — BIOLUMINESCENT LEVIATHAN (Root -> base -> 5 sibling variants)
  // ==========================================================================
  {
    id: "import_20261116_180500_wyrm_sketch",
    ...makeArtPair({
      width: 2560,
      height: 1440,
      label: "Aether Wyrm — Silhouette Sketch",
      sublabel: "IMPORT • CREATURE ROOT",
      bgA: "#0C1219",
      bgB: "#12212E",
      accentA: "#14B8A6",
      accentB: "#38BDF8",
      motif: "wyrm",
      seed: 10,
    }),
    width: 2560,
    height: 1440,
    timestamp: BASE_TIME - 86400000 * 3.5,
    file_version: "v1",
    curation: "keeper",
    vaultCategories: ["creatures"],
    vaultSubgroup: "Aether Wyrm",
    tags: ["wyrm", "creature", "silhouette", "widescreen"],
    collectionIds: ["col_wyrm_concepts"],
    metadata: {
      originalName: "aether_wyrm_blocking_16x9.png",
      type: "import",
      library_category: "source",
      aspect_ratio: "16:9",
      exact_pixels: "2560x1440",
      parent_id: null,
    },
  },
  {
    id: "output_20261118_160010_wyrm_base",
    ...makeArtPair({
      width: 2560,
      height: 1440,
      label: "Aether Wyrm — Sculpted Render Base",
      sublabel: "SEEDREAM 5.5 • 16:9 KEEPER",
      bgA: "#09131F",
      bgB: "#15263B",
      accentA: "#22D3EE",
      accentB: "#8B5CF6",
      motif: "wyrm",
      seed: 11,
    }),
    width: 2560,
    height: 1440,
    timestamp: BASE_TIME - 86400000 * 1.1,
    file_version: "v1",
    curation: "keeper",
    vaultCategories: ["creatures"],
    vaultSubgroup: "Aether Wyrm",
    tags: ["wyrm", "bioluminescent", "epic-scale"],
    collectionIds: ["col_wyrm_concepts"],
    metadata: {
      prompt:
        "Colossal bioluminescent Aether Wyrm coiling through high-altitude twilight clouds, translucent opal fins, intricate obsidian scales, ultra-wide 24mm cinematic establishing shot",
      model: "Seedream 5.5",
      model_code: SEEDREAM_CONFIG["Seedream 5.5"].model_code,
      base_resolution: "2K",
      aspect_ratio: "16:9",
      exact_pixels: "2560x1440",
      watermark: false,
      type: "generated",
      library_category: "generated",
      parent_id: "import_20261116_180500_wyrm_sketch",
      ref_id: "import_20261116_180500_wyrm_sketch",
      ref_ids: ["import_20261116_180500_wyrm_sketch"],
      ref_roles: { import_20261116_180500_wyrm_sketch: "creature" },
    },
  },
  // 5 sibling variants branching off output_20261118_160010_wyrm_base
  {
    id: "output_20261118_161204_wyrm_var1",
    ...makeArtPair({
      width: 2560,
      height: 1440,
      label: "Wyrm Variant 1 — Storm Canyon",
      sublabel: "BRANCH 1/5 • DRAFT",
      bgA: "#0E131D",
      bgB: "#1E293B",
      accentA: "#60A5FA",
      accentB: "#CBD5E1",
      motif: "wyrm",
      seed: 12,
    }),
    width: 2560,
    height: 1440,
    timestamp: BASE_TIME - 86400000 * 0.95,
    file_version: "v2.1",
    curation: "draft",
    vaultCategories: ["creatures"],
    vaultSubgroup: "Aether Wyrm",
    tags: ["wyrm", "storm", "lightning"],
    collectionIds: ["col_wyrm_concepts"],
    metadata: {
      prompt:
        "Aether Wyrm gliding between jagged storm-cloud canyons, forked lightning illuminating translucent dorsal sails, dramatic atmospheric perspective",
      model: "Seedream 5.5",
      model_code: SEEDREAM_CONFIG["Seedream 5.5"].model_code,
      base_resolution: "2K",
      aspect_ratio: "16:9",
      exact_pixels: "2560x1440",
      watermark: false,
      type: "generated",
      library_category: "generated",
      parent_id: "output_20261118_160010_wyrm_base",
      ref_id: "output_20261118_160010_wyrm_base",
      ref_ids: ["output_20261118_160010_wyrm_base"],
      ref_roles: { output_20261118_160010_wyrm_base: "base" },
    },
  },
  {
    id: "output_20261118_161355_wyrm_var2",
    ...makeArtPair({
      width: 2560,
      height: 1440,
      label: "Wyrm Variant 2 — Abyssal Trench Glow",
      sublabel: "BRANCH 2/5 • KEEPER",
      bgA: "#040D1A",
      bgB: "#0B243B",
      accentA: "#06B6D4",
      accentB: "#34D399",
      motif: "wyrm",
      seed: 13,
    }),
    width: 2560,
    height: 1440,
    timestamp: BASE_TIME - 86400000 * 0.92,
    file_version: "v2.2",
    curation: "keeper",
    vaultCategories: ["creatures"],
    vaultSubgroup: "Aether Wyrm",
    tags: ["wyrm", "abyssal", "caustics", "teal"],
    collectionIds: ["col_wyrm_concepts", "col_lighting_studies"],
    metadata: {
      prompt:
        "Aether Wyrm submerged in midnight pelagic trench, emerald-cyan bioluminescent gills pulsing against ink-black water, floating marine snow particles",
      model: "Seedream 5.5",
      model_code: SEEDREAM_CONFIG["Seedream 5.5"].model_code,
      base_resolution: "2K",
      aspect_ratio: "16:9",
      exact_pixels: "2560x1440",
      watermark: false,
      type: "generated",
      library_category: "generated",
      parent_id: "output_20261118_160010_wyrm_base",
      ref_id: "output_20261118_160010_wyrm_base",
      ref_ids: ["output_20261118_160010_wyrm_base"],
      ref_roles: { output_20261118_160010_wyrm_base: "base" },
    },
  },
  {
    id: "output_20261118_161541_wyrm_var3",
    ...makeArtPair({
      width: 2560,
      height: 1440,
      label: "Wyrm Variant 3 — Volcanic Basalt Caldera",
      sublabel: "BRANCH 3/5 • FINAL",
      bgA: "#160A0B",
      bgB: "#311214",
      accentA: "#F97316",
      accentB: "#FACC15",
      motif: "wyrm",
      seed: 14,
    }),
    width: 2560,
    height: 1440,
    timestamp: BASE_TIME - 86400000 * 0.88,
    file_version: "v2.3",
    curation: "final",
    vaultCategories: ["creatures", "environments"],
    vaultSubgroup: "Aether Wyrm",
    tags: ["wyrm", "caldera", "magma", "hero-frame"],
    collectionIds: ["col_wyrm_concepts"],
    metadata: {
      prompt:
        "Aether Wyrm ascending from obsidian volcanic caldera, incandescent magma underlighting bronze-black scales, billowing smoke plumes, IMAX 65mm cinematography",
      model: "Seedream 5.5",
      model_code: SEEDREAM_CONFIG["Seedream 5.5"].model_code,
      base_resolution: "2K",
      aspect_ratio: "16:9",
      exact_pixels: "2560x1440",
      watermark: false,
      type: "generated",
      library_category: "generated",
      parent_id: "output_20261118_160010_wyrm_base",
      ref_id: "output_20261118_160010_wyrm_base",
      ref_ids: ["output_20261118_160010_wyrm_base"],
      ref_roles: { output_20261118_160010_wyrm_base: "base" },
    },
  },
  {
    id: "output_20261118_161802_wyrm_var4",
    ...makeArtPair({
      width: 2560,
      height: 1440,
      label: "Wyrm Variant 4 — Frost Spire Aurora",
      sublabel: "BRANCH 4/5 • DRAFT",
      bgA: "#08121E",
      bgB: "#1A1B3A",
      accentA: "#34D399",
      accentB: "#A78BFA",
      motif: "wyrm",
      seed: 15,
    }),
    width: 2560,
    height: 1440,
    timestamp: BASE_TIME - 86400000 * 0.85,
    file_version: "v2.4",
    curation: "draft",
    vaultCategories: [],
    tags: ["wyrm", "aurora", "glacier"],
    collectionIds: ["col_wyrm_concepts"],
    metadata: {
      prompt:
        "Aether Wyrm circling crystalline glacier spires under emerald and violet polar aurora, shimmering ice dust, crisp panoramic telephoto",
      model: "Seedream 5.0 Lite",
      model_code: SEEDREAM_CONFIG["Seedream 5.0 Lite"].model_code,
      base_resolution: "2K",
      aspect_ratio: "16:9",
      exact_pixels: "2560x1440",
      watermark: false,
      type: "generated",
      library_category: "generated",
      parent_id: "output_20261118_160010_wyrm_base",
      ref_id: "output_20261118_160010_wyrm_base",
      ref_ids: ["output_20261118_160010_wyrm_base"],
      ref_roles: { output_20261118_160010_wyrm_base: "base" },
    },
  },
  {
    id: "output_20261118_162119_wyrm_var5",
    ...makeArtPair({
      width: 2560,
      height: 1440,
      label: "Wyrm Variant 5 — Sumi Ink Wash",
      sublabel: "BRANCH 5/5 • ARCHIVED",
      bgA: "#111216",
      bgB: "#1F2229",
      accentA: "#D1D5DB",
      accentB: "#6B7280",
      motif: "wyrm",
      seed: 16,
    }),
    width: 2560,
    height: 1440,
    timestamp: BASE_TIME - 86400000 * 0.8,
    file_version: "v2.5",
    curation: "archived",
    vaultCategories: [],
    tags: ["wyrm", "sumi-e", "experimental"],
    collectionIds: ["col_wyrm_concepts"],
    metadata: {
      prompt:
        "Aether Wyrm rendered in aggressive Japanese sumi-e ink brush strokes on charcoal textured paper, stark negative space",
      model: "Seedream 4.5",
      model_code: SEEDREAM_CONFIG["Seedream 4.5"].model_code,
      base_resolution: "2K",
      aspect_ratio: "16:9",
      exact_pixels: "2560x1440",
      watermark: false,
      type: "generated",
      library_category: "generated",
      parent_id: "output_20261118_160010_wyrm_base",
      ref_id: "output_20261118_160010_wyrm_base",
      ref_ids: ["output_20261118_160010_wyrm_base"],
      ref_roles: { output_20261118_160010_wyrm_base: "base" },
    },
  },

  // ==========================================================================
  // TREE 3: OBSIDIAN CITADEL — SPLIT SHEET & ENVIRONMENT TILES
  // ==========================================================================
  {
    id: "import_20261115_210000_citadel_grid",
    ...makeArtPair({
      width: 2048,
      height: 2048,
      label: "Obsidian Citadel — 2x1 Contact Grid",
      sublabel: "IMPORT • SPLIT SOURCE",
      bgA: "#0E111A",
      bgB: "#1B2234",
      accentA: "#8B5CF6",
      accentB: "#38BDF8",
      motif: "citadel",
      seed: 20,
    }),
    width: 2048,
    height: 2048,
    timestamp: BASE_TIME - 86400000 * 5,
    file_version: "v1",
    curation: "keeper",
    vaultCategories: ["environments"],
    vaultSubgroup: "Obsidian Citadel",
    tags: ["citadel", "architecture", "brutalist", "grid"],
    collectionIds: ["col_lighting_studies"],
    metadata: {
      originalName: "citadel_panels_2x1.png",
      type: "import",
      library_category: "source",
      aspect_ratio: "1:1",
      exact_pixels: "2048x2048",
      parent_id: null,
    },
  },
  {
    id: "split_20261115_210411_citadel_tile1",
    ...makeArtPair({
      width: 2304,
      height: 1728,
      label: "Citadel Split 01 — Monolith Causeway",
      sublabel: "SPLIT TILE • 4:3 KEEPER",
      bgA: "#0C101B",
      bgB: "#1E2640",
      accentA: "#818CF8",
      accentB: "#38BDF8",
      motif: "citadel",
      seed: 21,
    }),
    width: 2304,
    height: 1728,
    timestamp: BASE_TIME - 86400000 * 4.9,
    file_version: "split-1",
    curation: "keeper",
    vaultCategories: ["environments"],
    vaultSubgroup: "Obsidian Citadel",
    tags: ["citadel", "split", "causeway"],
    collectionIds: ["col_lighting_studies"],
    metadata: {
      type: "split",
      library_category: "others",
      aspect_ratio: "4:3",
      exact_pixels: "2304x1728",
      parent_id: "import_20261115_210000_citadel_grid",
    },
  },
  {
    id: "split_20261115_210412_citadel_tile2",
    ...makeArtPair({
      width: 2304,
      height: 1728,
      label: "Citadel Split 02 — Spire Rotunda",
      sublabel: "SPLIT TILE • 4:3 DRAFT",
      bgA: "#11101C",
      bgB: "#251E3C",
      accentA: "#C084FC",
      accentB: "#F59E0B",
      motif: "citadel",
      seed: 22,
    }),
    width: 2304,
    height: 1728,
    timestamp: BASE_TIME - 86400000 * 4.88,
    file_version: "split-2",
    curation: "draft",
    vaultCategories: ["environments"],
    vaultSubgroup: "Obsidian Citadel",
    tags: ["citadel", "split", "rotunda"],
    collectionIds: ["col_lighting_studies"],
    metadata: {
      type: "split",
      library_category: "others",
      aspect_ratio: "4:3",
      exact_pixels: "2304x1728",
      parent_id: "import_20261115_210000_citadel_grid",
    },
  },

  // ==========================================================================
  // VAULT REFERENCE ASSETS (Poses, Anatomy, Outfits, Styles, Secondary Character)
  // ==========================================================================
  {
    id: "import_20261114_103000_pose_dynamic_leap",
    ...makeArtPair({
      width: 1664,
      height: 2496,
      label: "Dynamic Descent — Action Pose Ref",
      sublabel: "VAULT • POSES",
      bgA: "#11131D",
      bgB: "#1E1B2E",
      accentA: "#F472B6",
      accentB: "#8B5CF6",
      motif: "pose",
      seed: 30,
    }),
    width: 1664,
    height: 2496,
    timestamp: BASE_TIME - 86400000 * 6,
    file_version: "v1",
    curation: "keeper",
    vaultCategories: ["poses", "anatomy"],
    vaultSubgroup: "Aerial Combat",
    tags: ["pose", "dynamic", "foreshortening", "action"],
    collectionIds: [],
    metadata: {
      originalName: "pose_aerial_descent_04.png",
      type: "import",
      library_category: "source",
      aspect_ratio: "2:3",
      exact_pixels: "1664x2496",
      parent_id: null,
    },
  },
  {
    id: "import_20261114_111500_anatomy_hand_study",
    ...makeArtPair({
      width: 2048,
      height: 2048,
      label: "Gauntlet Grip — Hand Anatomy Study",
      sublabel: "VAULT • ANATOMY",
      bgA: "#13141B",
      bgB: "#211E2B",
      accentA: "#F59E0B",
      accentB: "#E5E7EB",
      motif: "anatomy",
      seed: 31,
    }),
    width: 2048,
    height: 2048,
    timestamp: BASE_TIME - 86400000 * 5.8,
    file_version: "v1",
    curation: "keeper",
    vaultCategories: ["anatomy"],
    vaultSubgroup: "Hands & Proportions",
    tags: ["anatomy", "hands", "proportion", "study"],
    collectionIds: [],
    metadata: {
      originalName: "hand_grip_anatomy_sheet.png",
      type: "import",
      library_category: "source",
      aspect_ratio: "1:1",
      exact_pixels: "2048x2048",
      parent_id: null,
    },
  },
  {
    id: "import_20261114_134000_outfit_obsidian_trench",
    ...makeArtPair({
      width: 1728,
      height: 2304,
      label: "Tech-Noir Obsidian Trench & Cape",
      sublabel: "VAULT • OUTFITS",
      bgA: "#0E1016",
      bgB: "#1C1E2B",
      accentA: "#A78BFA",
      accentB: "#64748B",
      motif: "outfit",
      seed: 32,
    }),
    width: 1728,
    height: 2304,
    timestamp: BASE_TIME - 86400000 * 5.6,
    file_version: "v1",
    curation: "keeper",
    vaultCategories: ["outfits"],
    vaultSubgroup: "Noir Armor",
    tags: ["outfit", "trench", "carbon-weave", "cape"],
    collectionIds: ["col_vespera_keyart"],
    metadata: {
      originalName: "obsidian_trench_design_v2.png",
      type: "import",
      library_category: "source",
      aspect_ratio: "3:4",
      exact_pixels: "1728x2304",
      parent_id: null,
    },
  },
  {
    id: "import_20261114_152000_style_chiaroscuro_oil",
    ...makeArtPair({
      width: 2304,
      height: 1728,
      label: "Chiaroscuro Impasto & Rim Palette",
      sublabel: "VAULT • STYLES",
      bgA: "#120F1C",
      bgB: "#291836",
      accentA: "#8B5CF6",
      accentB: "#F59E0B",
      motif: "style",
      seed: 33,
    }),
    width: 2304,
    height: 1728,
    timestamp: BASE_TIME - 86400000 * 5.4,
    file_version: "v1",
    curation: "final",
    vaultCategories: ["styles"],
    vaultSubgroup: "Painterly Chiaroscuro",
    tags: ["style", "chiaroscuro", "oil", "palette"],
    collectionIds: ["col_lighting_studies"],
    metadata: {
      originalName: "chiaroscuro_lighting_board.png",
      type: "import",
      library_category: "source",
      aspect_ratio: "4:3",
      exact_pixels: "2304x1728",
      parent_id: null,
    },
  },
  {
    id: "download_20261115_084500_char_kaelen_bust",
    ...makeArtPair({
      width: 1728,
      height: 2304,
      label: "Kaelen — Sentinel Character Sheet",
      sublabel: "DOWNLOAD • CHARACTERS",
      bgA: "#0E141B",
      bgB: "#1D2A38",
      accentA: "#38BDF8",
      accentB: "#F59E0B",
      motif: "bust",
      seed: 34,
    }),
    width: 1728,
    height: 2304,
    timestamp: BASE_TIME - 86400000 * 4.5,
    file_version: "v1",
    curation: "keeper",
    vaultCategories: ["characters"],
    vaultSubgroup: "Kaelen",
    tags: ["kaelen", "sentinel", "portrait", "character"],
    collectionIds: [],
    metadata: {
      originalName: "kaelen_bust_ref_hq.png",
      type: "import",
      library_category: "source",
      aspect_ratio: "3:4",
      exact_pixels: "1728x2304",
      parent_id: null,
    },
  },
  {
    id: "output_20261118_194000_panorama_skybridge",
    ...makeArtPair({
      width: 3024,
      height: 1296,
      label: "Obsidian Skybridge — 21:9 Matte",
      sublabel: "SEEDREAM 5.5 • 21:9 ULTRA-WIDE",
      bgA: "#090D16",
      bgB: "#1B1633",
      accentA: "#8B5CF6",
      accentB: "#38BDF8",
      motif: "citadel",
      seed: 35,
    }),
    width: 3024,
    height: 1296,
    timestamp: BASE_TIME - 86400000 * 0.4,
    file_version: "v1",
    curation: "keeper",
    vaultCategories: ["environments"],
    vaultSubgroup: "Obsidian Citadel",
    tags: ["panorama", "21:9", "matte-painting", "citadel"],
    collectionIds: ["col_lighting_studies"],
    metadata: {
      prompt:
        "Ultra-wide 21:9 matte painting of suspended obsidian skybridge spanning abyssal mist, distant violet beacon towers, low dramatic clouds",
      model: "Seedream 5.5",
      model_code: SEEDREAM_CONFIG["Seedream 5.5"].model_code,
      base_resolution: "2K",
      aspect_ratio: "21:9",
      exact_pixels: "3024x1296",
      watermark: false,
      type: "generated",
      library_category: "generated",
      parent_id: "split_20261115_210411_citadel_tile1",
      ref_id: "split_20261115_210411_citadel_tile1",
      ref_ids: ["split_20261115_210411_citadel_tile1"],
      ref_roles: { split_20261115_210411_citadel_tile1: "base" },
    },
  },
];

export const MOCK_TREE: LineageTree = {
  sources: [
    "import_20261116_091200_vespera_ref",
    "import_20261116_180500_wyrm_sketch",
    "import_20261115_210000_citadel_grid",
    "import_20261114_103000_pose_dynamic_leap",
    "import_20261114_111500_anatomy_hand_study",
    "import_20261114_134000_outfit_obsidian_trench",
    "import_20261114_152000_style_chiaroscuro_oil",
    "download_20261115_084500_char_kaelen_bust",
  ],
  lineage: {
    output_20261117_141022_vespera_v1: {
      parent: "import_20261116_091200_vespera_ref",
      prompt:
        "Vespera obsidian valkyrie standing in dark slate cathedral, brushed titanium filigree pauldrons, dramatic softbox key light, 85mm cinema lens",
    },
    output_20261117_142510_vespera_v2a: {
      parent: "output_20261117_141022_vespera_v1",
      prompt: "Intense ultraviolet rim light tracing silver hair and pauldrons",
      extraRefs: ["import_20261114_152000_style_chiaroscuro_oil"],
    },
    output_20261117_142644_vespera_v2b: {
      parent: "output_20261117_141022_vespera_v1",
      prompt: "Backlit by molten tungsten embers, warm amber edge reflection",
    },
    output_20261117_142819_vespera_v2c: {
      parent: "output_20261117_141022_vespera_v1",
      prompt:
        "Cold silver rainfall, water beads glistening on matte carbon-steel armor, twin cyan-violet specular rim highlights",
      extraRefs: ["import_20261114_134000_outfit_obsidian_trench"],
    },
    output_20261117_143005_vespera_v2d: {
      parent: "output_20261117_141022_vespera_v1",
      prompt: "Leica monochrome silver-gelatin portrait, razor-sharp tonal falloff",
    },
    output_20261118_110412_vespera_v3_closeup: {
      parent: "output_20261117_142819_vespera_v2c",
      prompt: "Tight editorial closeup of Vespera visor filigree and rain-streaked armor",
    },
    output_20261118_112200_vespera_v4_paint: {
      parent: "output_20261118_110412_vespera_v3_closeup",
      prompt: "Manual paint-over specular accent pass on visor edge",
    },
    output_20261118_160010_wyrm_base: {
      parent: "import_20261116_180500_wyrm_sketch",
      prompt:
        "Colossal bioluminescent Aether Wyrm coiling through high-altitude twilight clouds",
    },
    output_20261118_161204_wyrm_var1: {
      parent: "output_20261118_160010_wyrm_base",
      prompt: "Gliding between jagged storm-cloud canyons with forked lightning",
    },
    output_20261118_161355_wyrm_var2: {
      parent: "output_20261118_160010_wyrm_base",
      prompt: "Submerged in midnight pelagic trench, emerald-cyan bioluminescent gills",
    },
    output_20261118_161541_wyrm_var3: {
      parent: "output_20261118_160010_wyrm_base",
      prompt: "Ascending from obsidian volcanic caldera, incandescent magma underlighting",
    },
    output_20261118_161802_wyrm_var4: {
      parent: "output_20261118_160010_wyrm_base",
      prompt: "Circling crystalline glacier spires under emerald and violet aurora",
    },
    output_20261118_162119_wyrm_var5: {
      parent: "output_20261118_160010_wyrm_base",
      prompt: "Aggressive Japanese sumi-e ink brush strokes on charcoal textured paper",
    },
    split_20261115_210411_citadel_tile1: {
      parent: "import_20261115_210000_citadel_grid",
    },
    split_20261115_210412_citadel_tile2: {
      parent: "import_20261115_210000_citadel_grid",
    },
    output_20261118_194000_panorama_skybridge: {
      parent: "split_20261115_210411_citadel_tile1",
      prompt: "Ultra-wide 21:9 matte painting of suspended obsidian skybridge",
    },
  },
};

export const MOCK_COLLECTIONS: CollectionRecord[] = [
  {
    id: "col_vespera_keyart",
    name: "Vespera — Key Art Pack",
    images: [
      "import_20261116_091200_vespera_ref",
      "output_20261117_141022_vespera_v1",
      "output_20261117_142510_vespera_v2a",
      "output_20261117_142644_vespera_v2b",
      "output_20261117_142819_vespera_v2c",
      "output_20261117_143005_vespera_v2d",
      "output_20261118_110412_vespera_v3_closeup",
      "output_20261118_112200_vespera_v4_paint",
      "import_20261114_134000_outfit_obsidian_trench",
    ],
    prompts: [
      {
        id: "prm_vespera_rain",
        name: "Silver Rain Hero Poster",
        text: "Vespera obsidian valkyrie in cold silver rainfall, water beads glistening on matte carbon-steel armor, twin cyan-violet specular rim highlights, 85mm f/1.4",
        sourceImageId: "output_20261117_142819_vespera_v2c",
      },
      {
        id: "prm_vespera_closeup",
        name: "Macro Visor Editorial",
        text: "Tight editorial closeup of Vespera visor filigree and rain-streaked collarbone armor, macro shallow focus, wet metallic reflections",
        sourceImageId: "output_20261118_110412_vespera_v3_closeup",
      },
    ],
    defaultRefs: [
      "import_20261116_091200_vespera_ref",
      "import_20261114_134000_outfit_obsidian_trench",
      "import_20261114_152000_style_chiaroscuro_oil",
    ],
    createdAt: BASE_TIME - 86400000 * 4,
  },
  {
    id: "col_wyrm_concepts",
    name: "Aether Wyrm Concept Board",
    images: [
      "import_20261116_180500_wyrm_sketch",
      "output_20261118_160010_wyrm_base",
      "output_20261118_161204_wyrm_var1",
      "output_20261118_161355_wyrm_var2",
      "output_20261118_161541_wyrm_var3",
      "output_20261118_161802_wyrm_var4",
      "output_20261118_162119_wyrm_var5",
    ],
    prompts: [
      {
        id: "prm_wyrm_caldera",
        name: "Caldera Magma Reveal",
        text: "Colossal Aether Wyrm ascending from obsidian volcanic caldera, incandescent magma underlighting bronze-black scales, IMAX 65mm cinematography",
        sourceImageId: "output_20261118_161541_wyrm_var3",
      },
    ],
    defaultRefs: ["import_20261116_180500_wyrm_sketch"],
    createdAt: BASE_TIME - 86400000 * 3,
  },
  {
    id: "col_lighting_studies",
    name: "Lighting & Material Studies",
    images: [
      "import_20261114_152000_style_chiaroscuro_oil",
      "output_20261117_142510_vespera_v2a",
      "output_20261117_142819_vespera_v2c",
      "output_20261118_161355_wyrm_var2",
      "import_20261115_210000_citadel_grid",
      "split_20261115_210411_citadel_tile1",
      "split_20261115_210412_citadel_tile2",
      "output_20261118_194000_panorama_skybridge",
    ],
    prompts: [
      {
        id: "prm_chiaroscuro_rim",
        name: "Dual Cyan-Violet Rim Formula",
        text: "Preserve subject identity and pose exactly, relight with crisp dual cyan and ultraviolet rim highlights, deep obsidian shadows, damp micro-specular sheen",
        sourceImageId: "import_20261114_152000_style_chiaroscuro_oil",
      },
    ],
    defaultRefs: ["import_20261114_152000_style_chiaroscuro_oil"],
    createdAt: BASE_TIME - 86400000 * 2,
  },
];

export const MOCK_MODDING_PACKS: ModdingCategoryPack[] = [
  {
    id: "pack_lighting",
    name: "Lighting & Atmosphere",
    tags: [
      {
        id: "mod_violet_rim",
        label: "Ultraviolet Rim",
        soleText:
          "Relight the exact scene with dramatic ultraviolet rim lighting sculpting the silhouette against deep obsidian shadows.",
        joinText:
          "dramatic ultraviolet rim lighting sculpting the silhouette against deep obsidian shadows",
      },
      {
        id: "mod_silver_rain",
        label: "Silver Rain Sheen",
        soleText:
          "Add cold silver rainfall with glistening micro-droplets and damp specular reflections across every surface.",
        joinText:
          "cold silver rainfall with glistening water beads and damp specular reflections",
      },
      {
        id: "mod_tungsten_key",
        label: "Warm Tungsten Key",
        soleText:
          "Shift lighting to a cinematic warm tungsten key light with cool steel-blue shadow fill and subtle haze.",
        joinText:
          "cinematic warm tungsten key light with cool steel-blue ambient shadow fill",
      },
      {
        id: "mod_volumetric_fog",
        label: "Volumetric Godrays",
        soleText:
          "Introduce dense atmospheric haze pierced by crisp volumetric light shafts from high above.",
        joinText: "dense volumetric mist pierced by sharp overhead light shafts",
      },
    ],
  },
  {
    id: "pack_camera",
    name: "Camera & Optics",
    tags: [
      {
        id: "mod_85mm_prime",
        label: "85mm f/1.4 Portrait",
        soleText:
          "Reframe as an 85mm f/1.4 cinema prime portrait with buttery background compression and razor-sharp eye focus.",
        joinText:
          "shot on 85mm f/1.4 cinema prime, shallow depth of field, creamy optical bokeh",
      },
      {
        id: "mod_24mm_anamorphic",
        label: "24mm Anamorphic",
        soleText:
          "Expand the framing to a dramatic 24mm anamorphic wide angle with subtle horizontal flares and heroic scale.",
        joinText:
          "24mm anamorphic wide lens, expansive architectural scale, subtle optical vignette",
      },
      {
        id: "mod_macro_detail",
        label: "Macro Material Pass",
        soleText:
          "Move camera into a tight macro close-up emphasizing brushed metal micro-scratches, weave texture, and tactile realism.",
        joinText:
          "tight macro detail focus revealing brushed metal micro-scratches and fine weave texture",
      },
      {
        id: "mod_low_angle",
        label: "Heroic Low Angle",
        soleText:
          "Lower the camera angle looking upward to accentuate monumentality and commanding presence.",
        joinText: "commanding low-angle perspective looking upward for heroic scale",
      },
    ],
  },
  {
    id: "pack_material",
    name: "Materials & Finish",
    tags: [
      {
        id: "mod_obsidian_titanium",
        label: "Brushed Dark Titanium",
        soleText:
          "Upgrade all armor surfaces to anisotropic brushed dark titanium with subtle chamfered silver edge wear.",
        joinText:
          "anisotropic brushed dark titanium finish with subtle chamfered edge wear",
      },
      {
        id: "mod_impasto_oil",
        label: "Painterly Chiaroscuro",
        soleText:
          "Render the scene in rich museum-grade chiaroscuro oil brushwork with visible palette-knife specular strokes.",
        joinText:
          "rich chiaroscuro oil painting finish with expressive palette-knife highlights",
      },
      {
        id: "mod_35mm_grain",
        label: "35mm Kodak Grain",
        soleText:
          "Apply organic 35mm cinema film halation, fine analog grain, and natural highlight roll-off.",
        joinText:
          "organic 35mm film grain, subtle highlight halation, natural cinema tonal roll-off",
      },
    ],
  },
  {
    id: "pack_composition",
    name: "Composition & Edit",
    tags: [
      {
        id: "mod_preserve_identity",
        label: "Lock Identity & Pose",
        soleText:
          "Preserve the exact facial identity, proportions, and body pose of the primary reference without drift.",
        joinText:
          "preserving exact facial identity, proportions, and silhouette from reference #1",
      },
      {
        id: "mod_clean_backdrop",
        label: "Minimal Studio Void",
        soleText:
          "Replace the background with a clean obsidian-slate studio seamless backdrop with soft radial falloff.",
        joinText:
          "clean obsidian-slate studio cyclorama backdrop with smooth radial gradient falloff",
      },
      {
        id: "mod_outpaint_cinematic",
        label: "Cinematic Breathing Room",
        soleText:
          "Pull back slightly to introduce balanced negative space and editorial poster framing around the subject.",
        joinText:
          "balanced editorial negative space and rule-of-thirds poster composition",
      },
    ],
  },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stampId(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const rnd = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${y}${mo}${d}_${h}${mi}${s}_${rnd}`;
}

export function createMockStudioApi(): StudioApi {
  let dbImages: StudioImageRecord[] = structuredClone(MOCK_IMAGES);
  let dbTree: LineageTree = structuredClone(MOCK_TREE);
  let dbCollections: CollectionRecord[] = structuredClone(MOCK_COLLECTIONS);
  let dbModdingPacks: ModdingCategoryPack[] = structuredClone(MOCK_MODDING_PACKS);
  let inboxCount = 3;

  const palettes: Array<[string, string, string, string]> = [
    ["#0C101E", "#1F1638", "#8B5CF6", "#38BDF8"],
    ["#0A141E", "#122B3B", "#22D3EE", "#A78BFA"],
    ["#150E16", "#2E162B", "#F472B6", "#F59E0B"],
    ["#0E1512", "#172E25", "#34D399", "#38BDF8"],
    ["#16110B", "#2D1C0E", "#F59E0B", "#FB7185"],
  ];

  return {
    async getGallery(): Promise<GalleryPayload> {
      await delay(90);
      return {
        images: structuredClone(dbImages),
        tree: structuredClone(dbTree),
        collections: structuredClone(dbCollections),
        moddingPacks: structuredClone(dbModdingPacks),
      };
    },

    async generateImage(
      payload: GenerateImageRequest
    ): Promise<GenerateImageResponse> {
      await delay(240);
      const { width, height } = parsePixelDimensions(payload.exact_pixels);
      const id = stampId("output");
      const seed = Math.floor(Math.random() * 1000);
      const [bgA, bgB, accentA, accentB] = palettes[seed % palettes.length];
      const shortPrompt =
        payload.prompt.trim().slice(0, 38) || "Untitled Studio Generation";
      const spec =
        SEEDREAM_CONFIG[payload.model as SeedreamModelName] ??
        SEEDREAM_CONFIG["Seedream 5.5"];
      const art = makeArtPair({
        width,
        height,
        label: shortPrompt,
        sublabel: `${payload.model.toUpperCase()} • ${payload.base_resolution}`,
        bgA,
        bgB,
        accentA,
        accentB,
        motif: width > height ? "wyrm" : "valkyrie",
        seed,
      });

      const record: StudioImageRecord = {
        id,
        ...art,
        width,
        height,
        timestamp: Date.now(),
        file_version: "v1",
        curation: "draft",
        vaultCategories: [],
        tags: ["generated", payload.model.toLowerCase().replace(/\s+/g, "-")],
        collectionIds: [],
        metadata: {
          prompt: payload.prompt,
          structuredBlocks: payload.structuredBlocks,
          model: payload.model,
          model_code: spec.model_code,
          base_resolution: payload.base_resolution,
          aspect_ratio: payload.aspect_ratio,
          exact_pixels: payload.exact_pixels,
          watermark: payload.watermark,
          type: "generated",
          library_category: "generated",
          parent_id: payload.parent_id ?? null,
          ref_id: payload.ref_ids[0] ?? null,
          ref_ids: [...payload.ref_ids],
          ref_roles: { ...payload.ref_roles },
        },
      };

      dbImages = [record, ...dbImages];
      if (payload.parent_id) {
        dbTree.lineage[id] = {
          parent: payload.parent_id,
          prompt: payload.prompt,
          extraRefs: payload.ref_ids.filter((r) => r !== payload.parent_id),
        };
      } else {
        dbTree.sources = [id, ...dbTree.sources];
      }

      return {
        image: structuredClone(record),
        parentId: payload.parent_id ?? null,
      };
    },

    async splitImage(payload: SplitImageRequest): Promise<StudioImageRecord[]> {
      await delay(180);
      const source = dbImages.find((img) => img.id === payload.sourceImageId);
      const rows = Math.max(1, Math.min(4, payload.rows));
      const cols = Math.max(1, Math.min(4, payload.cols));
      const tileW = Math.max(256, Math.round((source?.width ?? 2048) / cols));
      const tileH = Math.max(256, Math.round((source?.height ?? 2048) / rows));
      const created: StudioImageRecord[] = [];
      let index = 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const id = stampId(`split_r${r + 1}c${c + 1}`);
          const [bgA, bgB, accentA, accentB] =
            palettes[(index + r + c) % palettes.length];
          const art = makeArtPair({
            width: tileW,
            height: tileH,
            label: `${payload.prefix || "Split"} Tile ${index} (${r + 1}x${c + 1})`,
            sublabel: `SPLIT FROM ${payload.sourceImageId.slice(0, 14)}`,
            bgA,
            bgB,
            accentA,
            accentB,
            motif: "citadel",
            seed: index * 7,
          });

          const tile: StudioImageRecord = {
            id,
            ...art,
            width: tileW,
            height: tileH,
            timestamp: Date.now() + index,
            file_version: `tile-${index}`,
            curation: "draft",
            vaultCategories: [],
            tags: ["split", `${rows}x${cols}`],
            collectionIds: [],
            metadata: {
              type: "split",
              library_category: "others",
              exact_pixels: `${tileW}x${tileH}`,
              parent_id: payload.sourceImageId,
            },
          };
          created.push(tile);
          dbImages = [tile, ...dbImages];
          dbTree.lineage[id] = { parent: payload.sourceImageId };
          index += 1;
        }
      }
      return structuredClone(created);
    },

    async compositeMaskRoundtrip(
      payload: MaskRoundtripRequest
    ): Promise<StudioImageRecord> {
      await delay(260);
      const source = dbImages.find((img) => img.id === payload.sourceImageId);
      const { width, height } = parsePixelDimensions(
        payload.exact_pixels || source?.metadata.exact_pixels || "2048x2048"
      );
      const id = stampId("output_inpaint");
      const art = makeArtPair({
        width,
        height,
        label: payload.prompt.trim().slice(0, 34) || "Mask Inpaint Composite",
        sublabel: `INPAINT • FEATHER ${payload.feather}px`,
        bgA: "#0B1120",
        bgB: "#22183B",
        accentA: "#38BDF8",
        accentB: "#8B5CF6",
        motif: "valkyrie",
        seed: Date.now() % 97,
      });

      const record: StudioImageRecord = {
        id,
        ...art,
        width,
        height,
        timestamp: Date.now(),
        file_version: "inpaint",
        curation: "draft",
        vaultCategories: source ? [...source.vaultCategories] : [],
        vaultSubgroup: source?.vaultSubgroup,
        tags: ["inpaint", "mask-roundtrip"],
        collectionIds: source ? [...source.collectionIds] : [],
        metadata: {
          prompt: payload.prompt,
          model: payload.model,
          exact_pixels: `${width}x${height}`,
          type: "generated",
          library_category: "generated",
          parent_id: payload.sourceImageId,
          ref_id: payload.sourceImageId,
          ref_ids: [payload.sourceImageId],
          ref_roles: { [payload.sourceImageId]: "base" },
        },
      };

      dbImages = [record, ...dbImages];
      dbTree.lineage[id] = {
        parent: payload.sourceImageId,
        prompt: `[Mask Inpaint] ${payload.prompt}`,
      };
      return structuredClone(record);
    },

    async savePaintDerivative(
      payload: PaintDerivativeRequest
    ): Promise<StudioImageRecord> {
      await delay(140);
      const source = dbImages.find((img) => img.id === payload.sourceImageId);
      const width = source?.width ?? 1728;
      const height = source?.height ?? 2304;
      const id = stampId("output_paint");
      const fallbackArt = makeArtPair({
        width,
        height,
        label: payload.note || "Paint-Over Derivative",
        sublabel: "PAINT DERIVATIVE",
        bgA: "#0F1322",
        bgB: "#231B3E",
        accentA: "#F59E0B",
        accentB: "#8B5CF6",
        motif: "valkyrie",
        seed: Date.now() % 53,
      });
      const imageUrl = payload.compositeDataUrl.startsWith("data:image/")
        ? payload.compositeDataUrl
        : fallbackArt.image_url;

      const record: StudioImageRecord = {
        id,
        image_url: imageUrl,
        thumb_url: imageUrl,
        width,
        height,
        timestamp: Date.now(),
        file_version: "paint",
        curation: "draft",
        vaultCategories: source ? [...source.vaultCategories] : [],
        vaultSubgroup: source?.vaultSubgroup,
        tags: ["paint-over", "derivative"],
        collectionIds: source ? [...source.collectionIds] : [],
        metadata: {
          prompt: payload.note || "Paint-over annotation derivative",
          type: "derivative",
          library_category: "generated",
          aspect_ratio: source?.metadata.aspect_ratio,
          exact_pixels: `${width}x${height}`,
          parent_id: payload.sourceImageId,
          ref_id: payload.sourceImageId,
        },
      };

      dbImages = [record, ...dbImages];
      dbTree.lineage[id] = {
        parent: payload.sourceImageId,
        prompt: payload.note || "Paint-over derivative",
      };
      return structuredClone(record);
    },

    async updateCuration(
      imageId: string,
      curation: CurationStatus
    ): Promise<StudioImageRecord> {
      await delay(40);
      const idx = dbImages.findIndex((i) => i.id === imageId);
      if (idx === -1) {
        throw new Error(`Image not found: ${imageId}`);
      }
      dbImages[idx] = { ...dbImages[idx], curation };
      return structuredClone(dbImages[idx]);
    },

    async assignVaultCategory(
      imageId: string,
      categories: VaultCategory[],
      subgroup?: string
    ): Promise<StudioImageRecord> {
      await delay(40);
      const idx = dbImages.findIndex((i) => i.id === imageId);
      if (idx === -1) {
        throw new Error(`Image not found: ${imageId}`);
      }
      dbImages[idx] = {
        ...dbImages[idx],
        vaultCategories: [...categories],
        vaultSubgroup: subgroup ?? dbImages[idx].vaultSubgroup,
      };
      return structuredClone(dbImages[idx]);
    },

    async saveCollections(
      collections: CollectionRecord[]
    ): Promise<CollectionRecord[]> {
      await delay(50);
      dbCollections = structuredClone(collections);
      return structuredClone(dbCollections);
    },

    async saveModdingPacks(
      packs: ModdingCategoryPack[]
    ): Promise<ModdingCategoryPack[]> {
      await delay(50);
      dbModdingPacks = structuredClone(packs);
      return structuredClone(dbModdingPacks);
    },

    async saveConfig(_config: StudioConfigPayload): Promise<{ ok: boolean }> {
      await delay(30);
      return { ok: true };
    },

    async getSorterStatus(): Promise<SorterStatus> {
      await delay(40);
      return {
        inboxCount,
        watching: true,
        lastScanAt: Date.now(),
        inboxPath: "C:\\ArkImageStudio\\Inbox",
      };
    },
  };
}

export function createHttpStudioApi(baseUrl: string): StudioApi {
  const root = baseUrl.replace(/\/+$/, "");

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${root}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Studio API ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  }

  return {
    getGallery: () => request<GalleryPayload>("/api/gallery"),
    generateImage: (payload) =>
      request<GenerateImageResponse>("/api/generate", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    splitImage: (payload) =>
      request<StudioImageRecord[]>("/api/split", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    compositeMaskRoundtrip: (payload) =>
      request<StudioImageRecord>("/api/mask/roundtrip", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    savePaintDerivative: (payload) =>
      request<StudioImageRecord>("/api/paint/derivative", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateCuration: (imageId, curation) =>
      request<StudioImageRecord>(`/api/images/${encodeURIComponent(imageId)}/curation`, {
        method: "PATCH",
        body: JSON.stringify({ curation }),
      }),
    assignVaultCategory: (imageId, categories, subgroup) =>
      request<StudioImageRecord>(`/api/images/${encodeURIComponent(imageId)}/vault`, {
        method: "PATCH",
        body: JSON.stringify({ vaultCategories: categories, vaultSubgroup: subgroup }),
      }),
    saveCollections: (collections) =>
      request<CollectionRecord[]>("/api/collections", {
        method: "PUT",
        body: JSON.stringify({ collections }),
      }),
    saveModdingPacks: (packs) =>
      request<ModdingCategoryPack[]>("/api/modding-packs", {
        method: "PUT",
        body: JSON.stringify({ packs }),
      }),
    saveConfig: (config) =>
      request<{ ok: boolean }>("/api/config", {
        method: "PUT",
        body: JSON.stringify(config),
      }),
    getSorterStatus: () => request<SorterStatus>("/api/sorter/status"),
  };
}

const envApiBase =
  typeof import.meta !== "undefined" &&
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_ARK_API_URL;

export const studioApi: StudioApi = envApiBase
  ? createHttpStudioApi(envApiBase)
  : createMockStudioApi();
