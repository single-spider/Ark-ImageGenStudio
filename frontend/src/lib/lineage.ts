import type { StudioAsset } from '../types/studio';

/**
 * Preview lineage groups are explicit and independent of gallery order.
 * Existing backend IDs are never rewritten to encode parent/chain relationships.
 */
export function getLineage(assets: StudioAsset[], active: StudioAsset): StudioAsset[] {
  const chain = active.lineageId ?? active.id;
  return assets.filter((asset) => (asset.lineageId ?? asset.id) === chain);
}

/** Keep a small stable viewport of frames while allowing longer chains. */
export function getLineageWindow(lineage: StudioAsset[], activeId: string, maxVisible = 6): StudioAsset[] {
  if (lineage.length <= maxVisible) return lineage;
  const index = Math.max(0, lineage.findIndex((asset) => asset.id === activeId));
  const start = Math.max(0, Math.min(lineage.length - maxVisible, index - 2));
  return lineage.slice(start, start + maxVisible);
}
