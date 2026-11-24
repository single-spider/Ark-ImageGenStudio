const status = document.getElementById('status');
const connect = document.getElementById('connect');
const disconnect = document.getElementById('disconnect');
async function update(type) {
  connect.disabled = true; disconnect.disabled = true;
  try {
    const r = await browser.runtime.sendMessage({ type });
    status.textContent = r.status || r.error || 'Unknown status';
    connect.disabled = !!r.connected || !!r.starting;
    disconnect.disabled = !r.connected && !r.starting;
  } catch (error) { status.textContent = String(error); connect.disabled = false; }
}
connect.onclick = () => { status.textContent = 'Starting backend…'; void update('popup-connect'); };
disconnect.onclick = () => void update('popup-disconnect');
void update('popup-status');
