/** Page-side transport; credentials are held by the Firefox extension. */
export interface BrowserBridgeConnection { baseUrl: string }
const ORIGIN = 'https://single-spider.github.io';
export function isBridgePage() {
  return location.origin === ORIGIN && location.pathname.startsWith('/Ark-ImageGenStudio/');
}
export function bridgeRpc<T>(action: string, method?: string, route?: string, body?: unknown, timeout = 120000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const cleanup = () => { window.removeEventListener('message', receive); clearTimeout(timer); };
    function receive(event: MessageEvent) {
      if (event.source !== window || event.origin !== ORIGIN || event.data?.channel !== 'ark-bridge-response-v1' || event.data.id !== id) return;
      cleanup();
      if (event.data.ok) resolve(event.data.value as T);
      else reject(new Error(event.data.error || 'Local Bridge unavailable.'));
    }
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('Local Bridge did not respond.')); }, timeout);
    window.addEventListener('message', receive);
    window.postMessage({ channel:'ark-bridge-request-v1', id, action, method, route, body }, ORIGIN);
  });
}
export async function detectBrowserBridge(): Promise<BrowserBridgeConnection | null> {
  if (!isBridgePage()) return null;
  try {
    const value = await bridgeRpc<BrowserBridgeConnection>('hello', undefined, undefined, undefined, 900);
    return /^http:\/\/127\.0\.0\.1:\d+$/.test(value?.baseUrl) ? value : null;
  } catch { return null; }
}
export function bridgeEvents(onEvent: (event: import('./backend-types').BackendSocketEvent) => void) {
  const receive = (event: MessageEvent) => {
    if (event.source === window && event.origin === ORIGIN && event.data?.channel === 'ark-bridge-event-v1' && event.data.event?.type) onEvent(event.data.event);
  };
  window.addEventListener('message', receive);
  return () => window.removeEventListener('message', receive);
}
