"""Ark Image Studio v2 — Native PyWebView2 Desktop Entry Point."""
from __future__ import annotations

import os
import secrets
import socket
import sys
import threading
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from image_library import data_dir  # noqa: E402


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


class DesktopApi:
    def __init__(self) -> None:
        self._window = None

    def attach(self, window) -> None:
        self._window = window

    def save_image_as(self, asset_id: str) -> dict:
        import webview
        import shutil
        from v2.backend import db

        with db._db_lock:
            conn = db.get_conn()
            try:
                row = conn.execute("SELECT file_path, original_name FROM assets WHERE id = ?", (asset_id,)).fetchone()
            finally:
                conn.close()
        if not row or not os.path.isfile(row["file_path"]):
            return {"success": False, "error": "File not found"}
        src = Path(row["file_path"])
        result = self._window.create_file_dialog(
            webview.FileDialog.SAVE,
            save_filename=f"ark_{asset_id}{src.suffix}",
            file_types=("Images (*.jpg;*.jpeg;*.png;*.webp)", "All files (*.*)"),
        )
        dest = result[0] if isinstance(result, (tuple, list)) and result else (result or "")
        if dest:
            shutil.copy2(src, dest)
            return {"success": True, "path": dest}
        return {"success": False, "error": "Cancelled"}

    def open_library_folder(self) -> None:
        from v2.backend import db
        target = str(db.LIBRARY_ROOT.resolve())
        if os.name == "nt":
            os.startfile(target)


def main() -> None:
    dev_mode = "--dev" in sys.argv
    token = secrets.token_urlsafe(32)
    os.environ["ARK_V2_TOKEN"] = token
    port = _free_port()

    import uvicorn
    import webview
    from v2.backend.app import app

    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    threading.Thread(target=server.run, daemon=True).start()

    # Wait briefly for FastAPI startup
    for _ in range(40):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                break
        except OSError:
            time.sleep(0.05)

    url = (
        f"http://localhost:5173/?apiPort={port}&token={token}"
        if dev_mode
        else f"http://127.0.0.1:{port}/?session={token}&token={token}"
    )

    api = DesktopApi()
    state = data_dir()
    state.mkdir(parents=True, exist_ok=True)
    window = webview.create_window(
        "Ark Image Studio v2",
        url,
        js_api=api,
        width=1480,
        height=920,
        min_size=(1100, 700),
        background_color="#050507",
        confirm_close=True,
    )
    api.attach(window)
    webview.start(
        gui="edgechromium",
        debug=dev_mode,
        private_mode=True,
        storage_path=str(state / "webview2_v2"),
    )
    server.should_exit = True


if __name__ == "__main__":
    main()
