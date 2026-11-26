export type StudioTheme = 'nocturne' | 'mineral' | 'ember' | 'graphite' | 'slate';
export type WorkspaceTab = 'main' | 'reference' | 'extra';
export type WorkspaceTool = 'pan' | 'inspect' | 'compare' | 'mask';
export type GalleryFilter = 'all' | 'keepers' | 'recent';
export type AspectRatio = '1:1' | '4:3' | '3:4' | '3:2' | '2:3' | '16:9' | '9:16' | '21:9';
export type CurationState = 'draft' | 'keeper' | 'final' | 'scratchpad' | 'trash' | 'archived';

export interface StudioAsset {
  id: string;
  src: string;
  thumb: string;
  title: string;
  prompt: string;
  seed: number;
  model: string;
  createdAt: string;
  collection: string;
  ratio: AspectRatio;
  keeper: boolean;
  curationState?: CurationState;
  vaultCategory?: string | null;
  exactPixels?: string;
  modelCode?: string;
  refIds?: string[];
  /** Optional ancestry metadata; never encoded into the existing image ID. */
  parentId?: string;
  lineageId?: string;
  libraryCategory?: string;
  timestamp?: number;
}

export interface ReferenceSlot {
  id: string;
  title: string;
  role: string;
  src: string | null;
  assetId?: string;
  enabled: boolean;
}

export interface GenerationRequest {
  prompt: string;
  negativePrompt: string;
  model: string;
  ratio: AspectRatio;
  resolution: string;
  seed: string;
  creativity: number;
  parentAssetId?: string;
  lineageId?: string;
}

export interface StudioNotice {
  id: number;
  message: string;
  detail?: string;
  tone?: 'success' | 'info' | 'warning';
}

export interface SeedreamModelConfig {
  model_code: string;
  default_resolution: string;
  max_reference_images: number;
  resolutions: Record<string, Record<string, string>>;
}

export const SEEDREAM_MODELS: Record<string, SeedreamModelConfig> = {
  'Seedream 5.5': {
    model_code: 'dola-seedream-5-5-261028',
    default_resolution: '2K',
    max_reference_images: 10,
    resolutions: {
      '1K': { '1:1': '1024x1024', '4:3': '1152x864', '3:4': '864x1152', '16:9': '1424x800', '9:16': '800x1424', '3:2': '1248x832', '2:3': '832x1248', '21:9': '1568x672' },
      '1.5K': { '1:1': '1536x1536', '4:3': '1792x1344', '3:4': '1344x1792', '16:9': '2048x1152', '9:16': '1152x2048', '3:2': '1872x1248', '2:3': '1248x1872', '21:9': '2352x1008' },
      '2K': { '1:1': '2048x2048', '4:3': '2368x1776', '3:4': '1776x2368', '16:9': '2816x1584', '9:16': '1584x2816', '3:2': '2496x1664', '2:3': '1664x2496', '21:9': '3136x1344' },
    },
  },
  'Seedream 5.0 Pro': {
    model_code: 'dola-seedream-5-0-pro-260628',
    default_resolution: '2K',
    max_reference_images: 10,
    resolutions: {
      '1K': { '1:1': '1024x1024', '4:3': '1152x864', '3:4': '864x1152', '16:9': '1424x800', '9:16': '800x1424', '3:2': '1248x832', '2:3': '832x1248', '21:9': '1568x672' },
      '1.5K': { '1:1': '1536x1536', '4:3': '1792x1344', '3:4': '1344x1792', '16:9': '2048x1152', '9:16': '1152x2048', '3:2': '1872x1248', '2:3': '1248x1872', '21:9': '2352x1008' },
      '2K': { '1:1': '2048x2048', '4:3': '2368x1776', '3:4': '1776x2368', '16:9': '2816x1584', '9:16': '1584x2816', '3:2': '2496x1664', '2:3': '1664x2496', '21:9': '3136x1344' },
    },
  },
  'Seedream 5.0 Lite': {
    model_code: 'seedream-5-0-lite-260128',
    default_resolution: '2K',
    max_reference_images: 1,
    resolutions: {
      '2K': { '1:1': '2048x2048', '3:4': '1728x2304', '4:3': '2304x1728', '16:9': '2848x1600', '9:16': '1600x2848', '3:2': '2496x1664', '2:3': '1664x2496', '21:9': '3136x1344' },
      '3K': { '1:1': '3072x3072', '3:4': '2592x3456', '4:3': '3456x2592', '16:9': '4096x2304', '9:16': '2304x4096', '2:3': '2496x3744', '3:2': '3744x2496', '21:9': '4704x2016' },
    },
  },
  'Seedream 4.5': {
    model_code: 'seedream-4-5-251128',
    default_resolution: '2K',
    max_reference_images: 1,
    resolutions: {
      '2K': { '1:1': '2048x2048', '3:4': '1728x2304', '4:3': '2304x1728', '16:9': '2848x1600', '9:16': '1600x2848', '3:2': '2496x1664', '2:3': '1664x2496', '21:9': '3136x1344' },
      '4K': { '1:1': '4096x4096', '3:4': '3520x4704', '4:3': '4704x3520', '16:9': '5504x3040', '9:16': '3040x5504', '2:3': '3328x4992', '3:2': '4992x3328', '21:9': '6240x2656' },
    },
  },
  'Seedream 4.0': {
    model_code: 'seedream-4-0-250828',
    default_resolution: '2K',
    max_reference_images: 1,
    resolutions: {
      '1K': { '1:1': '1024x1024', '3:4': '864x1152', '4:3': '1152x864', '16:9': '1312x736', '9:16': '736x1312', '2:3': '832x1248', '3:2': '1248x832', '21:9': '1568x672' },
      '2K': { '1:1': '2048x2048', '3:4': '1728x2304', '4:3': '2304x1728', '16:9': '2848x1600', '9:16': '1600x2848', '3:2': '2496x1664', '2:3': '1664x2496', '21:9': '3136x1344' },
      '4K': { '1:1': '4096x4096', '3:4': '3520x4704', '4:3': '4704x3520', '16:9': '5504x3040', '9:16': '3040x5504', '2:3': '3328x4992', '3:2': '4992x3328', '21:9': '6240x2656' },
    },
  },
};
