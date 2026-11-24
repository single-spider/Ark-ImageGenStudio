/* The page never sees the native port, session credential, or extension API. */
const ORIGIN = 'https://single-spider.github.io';
const isArk = () => window.top === window && location.origin === ORIGIN && location.pathname.startsWith('/Ark-ImageGenStudio/');
window.addEventListener('message', async event => {
  const msg = event.data;
  if (!isArk() || event.source !== window || event.origin !== ORIGIN || msg?.channel !== 'ark-bridge-request-v1') return;
  if (typeof msg.id !== 'string' || msg.id.length > 80 || !['hello', 'request', 'open-folder'].includes(msg.action)) return;
  let result;
  try {
    result = await browser.runtime.sendMessage({ type: 'page-rpc', action: msg.action, method: msg.method, route: msg.route, body: msg.body });
  } catch {
    result = { ok: false, error: 'Local Bridge unavailable.' };
  }
  window.postMessage({ channel: 'ark-bridge-response-v1', id: msg.id, ...result }, ORIGIN);
});
browser.runtime.onMessage.addListener(msg => {
  if (!isArk()) return;
  if (msg.type === 'bridge-event') window.postMessage({ channel: 'ark-bridge-event-v1', event: msg.event }, ORIGIN);
  if (msg.type === 'bridge-disconnected') window.location.reload();
});
