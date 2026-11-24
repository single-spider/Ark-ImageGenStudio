import type { BackendAsset } from './backend-types';
import type { AspectRatio, StudioAsset } from '../types/studio';
import type { DesktopBackendClient } from './backend-client';

const ratios: Array<[AspectRatio, number]> = [
  ['1:1', 1],
  ['4:3', 4 / 3],
  ['3:4', 3 / 4],
  ['3:2', 3 / 2],
  ['2:3', 2 / 3],
  ['16:9', 16 / 9],
  ['9:16', 9 / 16],
  ['21:9', 21 / 9],
];

function approximateRatio(aspect: number): AspectRatio {
  if (!Number.isFinite(aspect) || aspect <= 0) return '1:1';
  return ratios.reduce((closest, candidate) =>
    Math.abs(candidate[1] - aspect) < Math.abs(closest[1] - aspect) ? candidate : closest,
  )[0];
}

export function backendAssetToStudio(asset: BackendAsset, client: DesktopBackendClient): StudioAsset {
  const seed =
    typeof asset.metadata?.seed === 'number' && Number.isFinite(asset.metadata.seed)
      ? asset.metadata.seed
      : 0;
  const metaRefIds = Array.isArray(asset.metadata?.ref_ids)
    ? (asset.metadata.ref_ids as string[])
    : typeof asset.metadata?.ref_id === 'string'
      ? [asset.metadata.ref_id]
      : [];
  const refIds = Array.from(new Set([...(asset.ref_ids ?? []), ...metaRefIds].filter(Boolean)));

  return {
    id: asset.id,
    src: client.assetUrl(asset.image_url),
    thumb: client.assetUrl(asset.thumb_url),
    title: asset.original_name || asset.id,
    prompt: asset.prompt || '',
    seed,
    model: asset.model || (asset.library_category === 'source' ? 'Imported' : 'Unknown'),
    createdAt: Number.isFinite(asset.timestamp)
      ? new Date(asset.timestamp).toISOString().slice(0, 10)
      : 'Unknown',
    collection: asset.vault_category ?? (asset.library_category === 'generated' ? 'Generated' : asset.library_category === 'source' ? 'Source Images' : 'Others'),
    ratio: approximateRatio(asset.aspect_ratio),
    keeper: asset.curation_state === 'keeper' || asset.curation_state === 'final',
    curationState: asset.curation_state,
    vaultCategory: asset.vault_category,
    exactPixels: asset.exact_pixels,
    modelCode: asset.model_code,
    refIds,
    parentId: asset.parent_id || refIds[0],
    lineageId: asset.root_id || asset.id,
    libraryCategory: asset.library_category,
    timestamp: asset.timestamp,
  };
}
