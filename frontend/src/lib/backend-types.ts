/**
 * Read-only types extracted from user-provided:
 *   v2/backend/app.py, db.py, jobs.py and v2/frontend/src/types/studio.ts.
 * Schema reviewed 2026-11-21. Do not edit existing filesystem ID rules.
 * Source code from the ZIP is deliberately not vendored in this public repo.
 */

export type BackendCurationState = 'draft' | 'keeper' | 'final' | 'scratchpad' | 'trash' | 'archived';

export interface BackendAsset {
  id: string;
  image_url: string;
  thumb_url: string;
  library_category: string;
  asset_type: string;
  width: number;
  height: number;
  aspect_ratio: number;
  /** Milliseconds since Unix epoch, from timestamp_ms in SQLite. */
  timestamp: number;
  prompt: string;
  model: string;
  model_code: string;
  exact_pixels: string;
  original_name: string;
  curation_state: BackendCurationState;
  vault_category: string | null;
  vault_tags: string[];
  metadata: Record<string, unknown>;
  parent_id?: string | null;
  root_id?: string;
  ref_ids?: string[];
  child_count?: number;
}

export interface BackendChainNode {
  asset: BackendAsset;
  children: BackendAsset[];
  child_count: number;
  satellite_refs: BackendAsset[];
}

export interface BackendAssetChain {
  root_id: string;
  active_id: string;
  nodes: BackendChainNode[];
}

export interface BackendJob {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error' | 'canceled';
  prompt?: string;
  model_name?: string;
  model_code?: string;
  px_size?: string;
  ref_ids?: string[];
  result_asset_id: string | null;
  error: string | null;
  created_at?: number;
  updated_at: number;
}

export interface BackendAssetList {
  items: BackendAsset[];
  /** Current backend count is response length, not total matching DB count. */
  count: number;
}

export interface BackendBootstrap {
  config: Record<string, unknown>;
  presets: Record<string, string>;
  collections: {
    collections: Record<string, unknown>;
    activeCollectionId: string | null;
    hideCollectedInAll: boolean;
  };
  vault_categories: Array<{ id: string; name: string; icon: string; color: string; sort_order: number }>;
  mod_packs: Array<Record<string, unknown>>;
  jobs: BackendJob[];
  sorter: Record<string, unknown>;
  total_assets: number;
}

export interface BackendWorkflowLog {
  id: string;
  ts: number;
  level: 'info' | 'warn' | 'error';
  job_id: string | null;
  message: string;
  detail: string;
}

export interface BackendAssetQuery {
  space?: 'all' | 'keepers' | 'finals' | 'vault' | 'generations' | 'others' | 'originals' | 'scratchpad' | 'trash' | 'archived';
  search?: string;
  vault_category?: string;
  collection_id?: string;
  aspect?: 'portrait' | 'landscape' | 'square' | '';
  model?: string;
  sort?: 'newest' | 'oldest' | 'name';
  limit?: number;
}

export interface BackendSocketEvent {
  type: 'job_update' | 'asset_added' | 'asset_updated' | 'asset_deleted' | 'library_synced' | string;
  payload: Record<string, unknown>;
}
