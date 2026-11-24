import type { GenerationRequest, StudioAsset } from '../types/studio';
import { mockAssets } from '../data/mock';

export interface StudioApi {
  generate(request: GenerationRequest): Promise<StudioAsset>;
}

/**
 * Browser-preview adapter only. It deliberately makes no external generation request.
 * Replace after inspecting the authoritative FastAPI routes and TypeScript contracts.
 */
export const mockStudioApi: StudioApi = {
  async generate(request) {
    await new Promise<void>((resolve) => setTimeout(resolve, 2800));
    const candidate = mockAssets[Math.floor(Math.random() * mockAssets.length)];
    return {
      ...candidate,
      id: `demo-generated-${Date.now()}`,
      title: 'Untitled iteration',
      prompt: request.prompt.trim() || candidate.prompt,
      seed: request.seed.trim() ? Number(request.seed) || candidate.seed : Math.floor(Math.random() * 900000) + 100000,
      model: request.model,
      ratio: request.ratio,
      createdAt: new Date().toISOString().slice(0, 10),
      collection: 'New Generations',
      keeper: false,
      lineageId: request.lineageId ?? `demo-generated-${Date.now()}`,
      parentId: request.parentAssetId,
    };
  },
};
