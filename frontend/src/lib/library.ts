import type { StudioAsset } from '../types/studio';

export type LibraryScope = 'all' | 'keepers' | 'recent' | 'imports' | 'generations';
export type LibrarySort = 'newest' | 'oldest' | 'title' | 'model';

interface LibraryQuery {
  search?: string;
  scope?: LibraryScope;
  collection?: string;
  model?: string;
  sort?: LibrarySort;
  recentLimit?: number;
}

/** All library surfaces share the same filtering rules and asset IDs. */
export function filterLibrary(assets: StudioAsset[], query: LibraryQuery): StudioAsset[] {
  const { scope = 'all', collection, model, search = '', sort = 'newest', recentLimit = 12 } = query;
  const needle = search.trim().toLocaleLowerCase();
  const matches = assets.filter((asset) => {
    if (scope === 'keepers' && !asset.keeper) return false;
    if (scope === 'imports' && asset.collection !== 'Imports' && !asset.id.startsWith('demo-import-')) return false;
    if (scope === 'generations' && asset.collection !== 'New Generations' && !asset.id.startsWith('demo-generated-')) return false;
    if (collection && collection !== 'All collections' && asset.collection !== collection) return false;
    if (model && model !== 'All models' && asset.model !== model) return false;
    if (!needle) return true;
    return [asset.title, asset.prompt, asset.collection, asset.model, asset.id, String(asset.seed)]
      .join(' ').toLocaleLowerCase().includes(needle);
  });

  const ordered = matches.slice().sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'model') return a.model.localeCompare(b.model) || a.title.localeCompare(b.title);
    const order = b.createdAt.localeCompare(a.createdAt);
    return sort === 'oldest' ? -order : order;
  });

  return scope === 'recent' ? ordered.slice(0, recentLimit) : ordered;
}

const ratios: Record<StudioAsset['ratio'], number> = {
  '1:1': 1,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  '3:2': 3 / 2,
  '2:3': 2 / 3,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '21:9': 21 / 9,
};

/** Single ratio source for mini tiles and the virtualized library. */
export function libraryAspect(asset: StudioAsset) {
  return ratios[asset.ratio] ?? 4 / 3;
}

/**
 * Optional 5,000-item browser stress test, clearly labeled.
 * Synthetic entries always resolve to their original preview asset before actions.
 * The real disk library is never touched.
 */
export function createStressLibrary(assets: StudioAsset[], count = 5000): StudioAsset[] {
  if (!assets.length) return [];
  return Array.from({ length: count }, (_, index) => {
    const source = assets[index % assets.length];
    return {
      ...source,
      id: `stress-${index}::${source.id}`,
      title: `${source.title} / Study ${String(index + 1).padStart(4, '0')}`,
    };
  });
}

export function resolveLibraryAssetId(id: string): string {
  return id.startsWith('stress-') ? id.slice(id.indexOf('::') + 2) : id;
}
