/**
 * Local FastAPI + WebSocket + PyWebView2 desktop client.
 * Falls back cleanly to null when hosted on static GitHub Pages.
 */
import type {
  BackendAsset,
  BackendAssetChain,
  BackendAssetList,
  BackendAssetQuery,
  BackendBootstrap,
  BackendJob,
  BackendSocketEvent,
} from './backend-types';

export interface LocalBackendConnection {
  baseUrl: string;
  token: string;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function detectLocalBackend(location = window.location): LocalBackendConnection | null {
  if (!LOOPBACK_HOSTS.has(location.hostname.toLowerCase())) return null;
  if (location.protocol !== 'http:') return null;

  const query = new URLSearchParams(location.search);
  const apiPort = query.get('apiPort');
  const token = query.get('token') ?? '';

  if (apiPort !== null) {
    const port = Number(apiPort);
    if (!/^\d+$/.test(apiPort) || !Number.isInteger(port) || port < 1 || port > 65535 || !token) return null;
    return { baseUrl: `http://127.0.0.1:${port}`, token };
  }

  if (location.port === '5173') return null;
  return { baseUrl: location.origin, token };
}

export function createDesktopBackend(connection: LocalBackendConnection) {
  const baseUrl = new URL(connection.baseUrl);
  if (!LOOPBACK_HOSTS.has(baseUrl.hostname.toLowerCase()) || baseUrl.protocol !== 'http:') {
    throw new Error('Ark backend connections are restricted to local loopback HTTP.');
  }

  async function request<T>(method: string, route: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const headers = new Headers({ Accept: 'application/json' });
    if (connection.token) headers.set('x-ark-token', connection.token);
    if (body !== undefined) headers.set('Content-Type', 'application/json');

    const result = await fetch(new URL(route, baseUrl), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal,
    });
    if (!result.ok) {
      const detail = await result.text().catch(() => '');
      throw new Error(detail || `Backend request failed (HTTP ${result.status}).`);
    }
    return result.json() as Promise<T>;
  }

  function assetUrl(relativeUrl: string): string {
    if (!relativeUrl) return '';
    const url = new URL(relativeUrl, baseUrl);
    if (url.origin !== baseUrl.origin || !['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Unexpected off-origin asset URL from local backend.');
    }
    return url.href;
  }

  return {
    connection: { baseUrl: baseUrl.origin },
    assetUrl,
    bootstrap: (signal?: AbortSignal) => request<BackendBootstrap>('GET', '/api/bootstrap', undefined, signal),
    listAssets: (query: BackendAssetQuery = {}, signal?: AbortSignal) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== '') params.set(key, String(value));
      }
      return request<BackendAssetList>('GET', `/api/assets?${params.toString()}`, undefined, signal);
    },
    syncAssets: () => request<{ total: number; removed: number }>('POST', '/api/assets/sync'),
    getChain: (assetId: string, signal?: AbortSignal) =>
      request<BackendAssetChain>('GET', `/api/assets/${encodeURIComponent(assetId)}/chain`, undefined, signal),
    patchAsset: (assetId: string, patch: { curation_state?: string; vault_category?: string | null; clear_vault?: boolean }) =>
      request<{ asset: BackendAsset }>('PATCH', `/api/assets/${encodeURIComponent(assetId)}`, patch),
    batchPatch: (payload: { ids: string[]; curation_state?: string; vault_category?: string; clear_vault?: boolean }) =>
      request<{ updated: string[] }>('POST', '/api/assets/batch', payload),
    emptyTrash: () =>
      request<{ deleted: string[] }>('POST', '/api/assets/empty-trash'),
    importAsset: (base64_data: string, filename: string, vault_category?: string | null) =>
      request<{ asset: BackendAsset }>('POST', '/api/assets/import', { base64_data, filename, vault_category }),
    deleteAsset: (assetId: string) =>
      request<{ ok: boolean }>('DELETE', `/api/assets/${encodeURIComponent(assetId)}`),
    generate: (payload: {
      prompt: string;
      model_name: string;
      model_code: string;
      px_size: string;
      base_res: string;
      aspect_ratio: string;
      watermark?: boolean;
      dry_run?: boolean;
      batch?: number;
      ref_ids: string[];
      ref_roles: Record<string, string>;
    }) => request<{ jobs: BackendJob[] }>('POST', '/api/generate', payload),
    cancelJob: (jobId: string) =>
      request<{ ok: boolean }>('POST', `/api/jobs/${encodeURIComponent(jobId)}/cancel`),
    saveConfig: (cfg: Record<string, unknown>) =>
      request<{ ok: boolean }>('POST', '/api/config', cfg),
    dryRun: () => request<{ success: boolean; message?: string; error?: string }>('POST', '/api/dry-run'),
    connectEvents: (onEvent: (event: BackendSocketEvent) => void) => {
      const url = new URL('/ws', baseUrl);
      url.protocol = 'ws:';
      if (connection.token) url.searchParams.set('token', connection.token);
      const socket = new WebSocket(url);
      socket.onmessage = (msg) => {
        try {
          const event = JSON.parse(String(msg.data)) as BackendSocketEvent;
          if (event && typeof event.type === 'string' && typeof event.payload === 'object' && event.payload) {
            onEvent(event);
          }
        } catch {
          // Ignore malformed events
        }
      };
      return () => socket.close();
    },
  };
}

export type DesktopBackendClient = ReturnType<typeof createDesktopBackend>;

export function nativeOpenFolder(): void {
  const w = window as unknown as { pywebview?: { api?: { open_library_folder?: () => void } } };
  w.pywebview?.api?.open_library_folder?.();
}

export function nativeSaveAs(assetId: string): Promise<{ success: boolean; path?: string; error?: string }> | null {
  const w = window as unknown as { pywebview?: { api?: { save_image_as?: (id: string) => Promise<{ success: boolean; path?: string; error?: string }> } } };
  return w.pywebview?.api?.save_image_as ? w.pywebview.api.save_image_as(assetId) : null;
}
