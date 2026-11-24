# Ark Local Bridge for Firefox (v0.1, experimental)

Use the current hosted Ark frontend with the existing Windows FastAPI library and queue. No local React build, Node server or PyWebView2 window is required.

## Prerequisites

- Windows, Firefox 128+ and the working local Ark backend, with its Python environment.
- The backend must be in its existing `v2` folder, alongside the legacy project's `image_library.py` (in the parent directory). This repository does not contain that helper. The native host uses the existing `v2.backend.app` imports and does not reimplement or move the library.
- Ensure the local backend source is compatible with this repo's `backend/` routes, especially Scratchpad and Garbage Bin. If your current checkout has a different name or location, use the working backend's actual path; the installer checks the legacy package layout rather than guessing.
- Close any running Ark desktop instance before connecting. The bridge starts the same backend lifecycle, which may index files, consolidate legacy media, create thumbnails and emit heartbeat. Do not run two backend instances against the same database or archive. Back up important local state before the first integration test.

## One-time installation

Download this repository (Code → Download ZIP) or the **ark-firefox-bridge** artifact from a successful validation workflow, extract it somewhere permanent, and open PowerShell in the extracted directory. Keep the extracted extension folder available.

Run (replace the example paths with your existing backend and Python interpreter):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\native_bridge\install.ps1 -BackendRoot "C:\path\to\original-project\v2" -PythonExe "C:\path\to\original-project\.venv\Scripts\python.exe"
```

If your working backend uses the Python on PATH, omit `-PythonExe`. The script checks dependencies, copies the host into `%LOCALAPPDATA%\ArkLocalBridge`, and registers a Firefox Native Messaging manifest under HKCU. No admin rights are required. It does not install Python packages, change the backend or copy library images. The supplied path must identify the real working backend, not an incomplete repo checkout. ASCII Windows paths are recommended for this initial batch launcher.

## Load and connect

1. In Firefox open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on** and select `extension/firefox/manifest.json`.
3. Open https://single-spider.github.io/Ark-ImageGenStudio/ (after the Pages deployment).
4. Click **Ark Local Bridge** in Firefox's extensions menu; read the access disclosure, then **Approve & connect**. Startup indexing may take time. Reopen the popup to check status.
5. The extension reloads that tab after startup. The app uses the actual local backend, and its footer shows **FIREFOX LOCAL BRIDGE**. Unlock the existing privacy cover if shown.
6. First verify thumbnails, full-size images, search and reference selection. Then try a Dry Run (writes a test image, no provider charge). Verify the result appears in your library before attempting a paid generation.

Temporary Firefox add-ons are removed at browser restart. Reload the manifest and approve the tab again. You do not need to reinstall the native host unless its path or implementation changes. A permanently installed extension will require Mozilla signing.

## Security boundary

The bridge accepts exactly the Ark project path on `single-spider.github.io`, and only the user-approved top-level tab. The popup alone starts the native host. Native messaging exchanges a startup credential over an extension-owned port. A dedicated loopback FastAPI instance is bound to a random port. The extension proxies allowlisted JSON requests and WebSocket events; it adds the backend token to permitted media requests from that tab. The native host independently checks the token and allowed HTTP methods/paths, including media. It refuses config writes and permanent deletion; responses are marked no-store. The provider key is removed from bootstrap in the extension, and provider settings inputs are hidden in bridge mode.

Allowed operations include asset reads, curation (which may modify mirrors), reference import, library sync, generation (including paid calls), test and cancellation. Permanent deletion and provider configuration are deliberately not allowed. A web page granted access can read and transmit local images and prompts, and invoke the allowed operations. **Only approve code you trust**; future Pages deployments and scripts executing in that origin inherit that trust. GitHub Pages projects on the same account share an origin, so the path check is defense in depth, not strong origin isolation. A dedicated origin and restrictive CSP are recommended before a general release. Do not approve if untrusted scripts are running in that origin. Never publish session credentials or provider keys.

Disconnect via extension popup after finishing jobs, or close/leave the approved tab. The extension revokes its grant, closes its native connection, and reloads the page into preview mode when applicable. Closing Firefox terminates the host; do not disconnect during a running generation. This is an experimental single-tab integration, not a persistent Windows service.

## Troubleshooting

- Native host not found: rerun installer, verify Python path and HKCU registration.
- Startup failed: inspect `%LOCALAPPDATA%\ArkLocalBridge\bridge.log` locally; do not post logs containing private metadata or secrets. Verify original `image_library.py`, Python dependencies, and close other backend instances.
- Mock mode: make sure the Pages build includes this change, the temporary add-on is loaded, and the Ark tab has been explicitly approved.
- Metadata loads but images fail: inspect the Firefox network panel for blocked loopback image requests, HTTPS-only/extension permissions and header injection; do not disable browser security globally. This path requires real Firefox testing.
- No generation results: verify local provider config via the original desktop app (with bridge disconnected), and test Dry Run first.

Uninstall: disconnect, remove the temporary add-on, then run `native_bridge\uninstall.ps1`. This removes registration and bridge files only.

## Verification scope

CI checks TypeScript/Vite, JavaScript syntax, manifest and native host policy, and creates the unpacked bridge artifact. CI does not start the actual Windows backend or perform Firefox integration, access personal images, or call BytePlus.
