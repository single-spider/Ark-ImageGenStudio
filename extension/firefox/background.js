/* All privileged operations originate here. Approval belongs to one top-level Ark tab. */
const HOST = 'ark_local_bridge';
const PAGE = 'https://single-spider.github.io/Ark-ImageGenStudio/';
let native = null, connection = null, socket = null, approvedTab = null;
let status = 'Disconnected', startPromise = null, reconnectTimer = null;
const isArk = url => { try { const u = new URL(url); return u.origin === new URL(PAGE).origin && u.pathname.startsWith('/Ark-ImageGenStudio/'); } catch { return false; } };
const mediaPath = path => /^\/(library|library-thumbnails|generation_history)\//.test(path) && !path.split('/').some(p => p === '..');
function allowed(method, path) {
  if (method === 'GET') return path === '/api/bootstrap' || path === '/api/assets' || /^\/api\/assets\/[^/]+\/chain$/.test(path);
  if (method === 'PATCH') return /^\/api\/assets\/[^/]+$/.test(path);
  return method === 'POST' && (['/api/assets/sync','/api/assets/import','/api/assets/batch','/api/generate','/api/dry-run'].includes(path) || /^\/api\/jobs\/[^/]+\/cancel$/.test(path));
}
function publish(text) {
  status = text;
  browser.browserAction.setBadgeText({ text: connection ? 'ON' : '' }).catch(() => {});
}
function disconnect(reload = true) {
  const tab = approvedTab;
  approvedTab = null;
  connection = null;
  clearTimeout(reconnectTimer);
  if (socket) { socket.onclose = null; socket.close(); socket = null; }
  if (native) { const p = native; native = null; try { p.disconnect(); } catch {} }
  publish('Disconnected');
  if (reload && tab !== null) browser.tabs.sendMessage(tab, { type: 'bridge-disconnected' }).catch(() => {});
}
function events() {
  if (!connection || approvedTab === null) return;
  const u = new URL('/ws', connection.baseUrl);
  u.protocol = 'ws:'; u.searchParams.set('token', connection.token);
  socket = new WebSocket(u);
  socket.onmessage = ev => {
    try { if (approvedTab !== null) browser.tabs.sendMessage(approvedTab, { type:'bridge-event', event: JSON.parse(ev.data) }).catch(() => {}); } catch {}
  };
  socket.onclose = () => {
    if (connection) reconnectTimer = setTimeout(events, 1500);
  };
}
async function connect(tab) {
  if (!isArk(tab?.url)) throw Error('Open the Ark Studio website first.');
  if (startPromise) throw Error('Bridge already starting.');
  if (connection && approvedTab === tab.id) return;
  disconnect();
  publish('Starting local backend…');
  const p = browser.runtime.connectNative(HOST);
  native = p;
  startPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Backend startup timed out. Check local bridge logs.')), 180000);
    p.onMessage.addListener(msg => {
      clearTimeout(timer);
      if (msg?.error) { reject(Error(String(msg.error))); return; }
      if (msg?.ready && /^http:\/\/127\.0\.0\.1:\d+$/.test(msg.baseUrl) && typeof msg.token === 'string' && msg.token.length >= 32) resolve(msg);
    });
    p.onDisconnect.addListener(() => {
      clearTimeout(timer);
      reject(Error(p.error?.message || 'Native host closed. Run install.ps1 first.'));
      if (native === p) disconnect();
    });
    p.postMessage({ action:'start' });
  });
  try {
    const ready = await startPromise;
    const current = await browser.tabs.get(tab.id);
    if (native !== p || !isArk(current.url)) throw Error('Ark tab navigated away.');
    connection = { baseUrl: ready.baseUrl, token: ready.token };
    approvedTab = tab.id;
    publish('Connected to local library');
    events();
    await browser.tabs.reload(tab.id);
  } catch (error) {
    disconnect(false);
    publish(String(error.message || error));
    throw error;
  } finally { startPromise = null; }
}
browser.tabs.onRemoved.addListener(id => { if (id === approvedTab) disconnect(false); });
browser.tabs.onUpdated.addListener((id, change) => {
  if (id === approvedTab && change.url && !isArk(change.url)) disconnect(false);
});
browser.runtime.onMessage.addListener(async (msg, sender) => {
  try {
    if (msg?.type === 'popup-status' || msg?.type === 'popup-connect' || msg?.type === 'popup-disconnect') {
      // Popup commands must come from the extension's own popup, never a content script.
      if (sender.tab || sender.url !== browser.runtime.getURL('popup.html')) throw Error('Invalid popup sender.');
      const [tab] = await browser.tabs.query({ active:true, currentWindow:true });
      if (msg.type === 'popup-connect') await connect(tab);
      if (msg.type === 'popup-disconnect') disconnect();
      return { ok:true, status, connected: !!connection && approvedTab === tab?.id, starting: !!startPromise };
    }
    if (msg?.type !== 'page-rpc' || sender.frameId !== 0 || sender.tab?.id !== approvedTab || !isArk(sender.url) || !isArk(sender.tab.url) || !connection) return { ok:false, error:'Approve this Ark tab using the Firefox extension.' };
    if (msg.action === 'hello') return { ok:true, value:{ baseUrl: connection.baseUrl } };
    if (msg.action === 'open-folder') { native.postMessage({ action:'open-folder' }); return { ok:true, value:null }; }
    if (msg.action !== 'request' || typeof msg.route !== 'string' || !msg.route.startsWith('/api/') || msg.route.includes('\\')) throw Error('Invalid bridge request.');
    const u = new URL(msg.route, connection.baseUrl);
    const method = String(msg.method);
    if (u.origin !== connection.baseUrl || !allowed(method, u.pathname)) throw Error('Operation unavailable in Browser Bridge mode.');
    const body = msg.body === undefined ? undefined : JSON.stringify(msg.body);
    if (body && body.length > 40 * 1024 * 1024) throw Error('Import exceeds bridge request limit.');
    const r = await fetch(u.href, { method, headers:{ 'x-ark-token':connection.token, 'Content-Type':'application/json', Accept:'application/json' }, body, credentials:'omit', redirect:'error', cache:'no-store' });
    if (!r.ok) throw Error('Local backend request failed (HTTP ' + r.status + ').');
    const value = await r.json();
    // Only non-secret presentation metadata can leave the local process.
    if (u.pathname === '/api/bootstrap') value.config = { model: value.config?.model };
    return { ok:true, value };
  } catch (error) { return { ok:false, error:String(error.message || error) }; }
});
// Authenticate only media requests from the explicitly approved Ark document.
// All API requests use the privileged fetch above, not page-supplied credentials.
browser.webRequest.onBeforeSendHeaders.addListener(details => {
  if (!connection || details.tabId !== approvedTab || details.frameId !== 0 || !isArk(details.documentUrl || details.originUrl)) return {};
  const u = new URL(details.url);
  if (u.origin !== connection.baseUrl || !mediaPath(u.pathname)) return {};
  const headers = (details.requestHeaders || []).filter(h => h.name.toLowerCase() !== 'x-ark-token');
  headers.push({ name:'x-ark-token', value:connection.token });
  return { requestHeaders:headers };
}, { urls:['http://127.0.0.1/*'], types:['image','xmlhttprequest','media','other'] }, ['blocking','requestHeaders']);
