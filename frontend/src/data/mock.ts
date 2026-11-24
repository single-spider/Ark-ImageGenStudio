import type { ReferenceSlot, StudioAsset } from '../types/studio';

const image = (id: string, width = 1400) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=86`;

const source: Array<[string, string, string, string, number, string, string]> = [
  ['photo-1448375240586-882707db888b', 'The Quiet Between', 'Nocturnal woodland study with delicate shafts of light and wet moss.', 'Nocturne', 472119, '4:3', '2026-11-20'],
  ['photo-1511497584788-876760111969', 'Emerald Silence', 'A towering evergreen forest fading into fog.', 'Nocturne', 472120, '4:3', '2026-11-20'],
  ['photo-1470252649378-9c29740c9fa8', 'Last Light', 'Warm sunlight over a quiet misty valley.', 'Landscape', 309481, '16:9', '2026-11-19'],
  ['photo-1501785888041-af3ef285b470', 'Northern Drift', 'An alpine lake beneath cloud-heavy peaks.', 'Landscape', 309482, '3:2', '2026-11-19'],
  ['photo-1500530855697-b586d89ba3ee', 'Wild Expanse', 'A cinematic open landscape in the evening.', 'Landscape', 309483, '3:2', '2026-11-19'],
  ['photo-1441974231531-c6227db76b6e', 'Deep Canopy', 'Filtered sunlight through an ancient forest.', 'Nocturne', 472121, '4:3', '2026-11-18'],
  ['photo-1518837695005-2083093ee35b', 'The Blue Hour', 'Ocean waves moving under an overcast sky.', 'Seascapes', 662401, '16:9', '2026-11-18'],
  ['photo-1470770841072-f978cf4d019e', 'Distant Echo', 'A quiet mountain reflected in still water.', 'Landscape', 309484, '3:2', '2026-11-17'],
  ['photo-1519681393784-d120267933ba', 'Nightfall', 'Snow peaks under a star-filled sky.', 'Night Studies', 891122, '3:2', '2026-11-17'],
  ['photo-1473448912268-2022ce9509d8', 'Fern Cathedral', 'Sunlit path through lush old-growth woodland.', 'Nocturne', 472122, '4:3', '2026-11-16'],
  ['photo-1433086966358-54859d0ed716', 'Hidden Falls', 'Waterfall enclosed by dense forest.', 'Landscape', 309485, '3:2', '2026-11-16'],
  ['photo-1464822759023-fed622ff2c3b', 'Above the Clouds', 'Dramatic mountain peaks disappearing into clouds.', 'Landscape', 309486, '3:2', '2026-11-15'],
  ['photo-1472214103451-9374bd1c798e', 'Open Field', 'Rolling grassland under a gentle summer sky.', 'Landscape', 309487, '16:9', '2026-11-14'],
  ['photo-1426604966848-d7adac402bff', 'Stillwater', 'Quiet mountain wilderness with glassy lake.', 'Landscape', 309488, '3:2', '2026-11-13'],
  ['photo-1531366936337-7c912a4589a7', 'Aurora Study', 'Northern lights across a winter night.', 'Night Studies', 891123, '16:9', '2026-11-12'],
  ['photo-1500534623283-312aade485b7', 'Soft Horizons', 'Hazy mountains layered into the distance.', 'Landscape', 309489, '16:9', '2026-11-11'],
];

export const mockAssets: StudioAsset[] = source.map(([photo, title, prompt, collection, seed, ratio, createdAt], index) => ({
  id: `demo-${String(index + 1).padStart(3, '0')}`,
  src: image(photo),
  thumb: image(photo, 480),
  title,
  prompt,
  seed,
  model: index % 3 === 0 ? 'Seedream 4.5' : 'Seedream 4.0',
  createdAt,
  collection,
  ratio: ratio as StudioAsset['ratio'],
  keeper: [0, 2, 6, 8, 13].includes(index),
  lineageId: `demo-study-${Math.floor(index / 6) + 1}`,
  parentId: index % 6 === 0 ? undefined : `demo-${String(index).padStart(3, '0')}`,
}));

export const initialReferences: ReferenceSlot[] = [
  { id: 'ref-1', title: 'Composition', role: 'Structure', src: mockAssets[3].thumb, enabled: true },
  { id: 'ref-2', title: 'Atmosphere', role: 'Style', src: mockAssets[1].thumb, enabled: true },
  { id: 'ref-3', title: 'Detail', role: 'Detail', src: mockAssets[8].thumb, enabled: false },
];

export const promptPresets = [
  'Cinematic light',
  'Fine grain',
  'Atmospheric fog',
  'Natural texture',
  'Deep contrast',
];
