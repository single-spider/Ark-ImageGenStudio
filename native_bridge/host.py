"""Firefox Native Messaging host. Starts the existing local v2 FastAPI app.

Native messaging carries only control messages and startup credentials.
Images and JSON API responses use authenticated loopback HTTP instead.
"""
from __future__ import annotations

import json
import os
import secrets
import socket
import struct
import sys
import threading
import time
from pathlib import Path

WIRE = sys.stdout.buffer
sys.stdout = sys.stderr  # Protect binary native messaging framing from backend print().
EXTENSION_ID = "ark-local-bridge@single-spider.github.io"


def send(value):
    payload = json.dumps(value, separators=(",", ":")).encode("utf-8")
    WIRE.write(struct.pack("=I", len(payload)) + payload)
    WIRE.flush()


def receive():
    header = sys.stdin.buffer.read(4)
    if not header:
        return None
    if len(header) != 4:
        raise ValueError("Invalid native message header")
    size = struct.unpack("=I", header)[0]
    if size > 65536:
        raise ValueError("Native control message too large")
    data = sys.stdin.buffer.read(size)
    if len(data) != size:
        raise ValueError("Incomplete native message")
    return json.loads(data)


def allowed(method, path):
    import re
    if method == "GET":
        return (path in ("/api/bootstrap", "/api/assets")
                or re.fullmatch(r"/api/assets/[^/]+/chain", path)
                or path.startswith(("/library/", "/library-thumbnails/", "/generation_history/")))
    if method == "PATCH":
        return bool(re.fullmatch(r"/api/assets/[^/]+", path))
    return method == "POST" and (path in (
        "/api/assets/sync", "/api/assets/import", "/api/assets/batch",
        "/api/generate", "/api/dry-run")
        or bool(re.fullmatch(r"/api/jobs/[^/]+/cancel", path)))


def guarded(app, token):
    from starlette.responses import JSONResponse
    async def wrapper(scope, receive, send):
        if scope["type"] == "http":
            path = scope["path"]
            headers = dict(scope.get("headers", []))
            actual = headers.get(b"x-ark-token", b"")
            # No cookies or query-token authorization on this dedicated server.
            if (not secrets.compare_digest(actual, token.encode())
                    or not allowed(scope["method"], path)
                    or "\\" in path or ".." in path.split("/")):
                return await JSONResponse({"detail": "Bridge request denied"}, status_code=403)(scope, receive, send)
            async def no_cache(message):
                if message["type"] == "http.response.start":
                    message["headers"] = [(k, v) for k, v in message.get("headers", []) if k.lower() not in (b"cache-control", b"access-control-allow-origin", b"access-control-allow-credentials")]
                    message["headers"].extend([(b"cache-control", b"no-store"), (b"x-content-type-options", b"nosniff")])
                await send(message)
            return await app(scope, receive, no_cache)
        if scope["type"] == "websocket" and scope["path"] != "/ws":
            return await send({"type": "websocket.close", "code": 1008})
        return await app(scope, receive, send)
    return wrapper


def main():
    if len(sys.argv) < 2:
        raise RuntimeError("Backend path not supplied. Run install.ps1.")
    backend = Path(sys.argv[1]).resolve()
    if backend.name.lower() != "v2" or not (backend / "backend" / "app.py").is_file() or not (backend.parent / "image_library.py").is_file():
        raise RuntimeError("Expected existing v2 folder next to image_library.py.")
    if len(sys.argv) < 4 or sys.argv[-1] != EXTENSION_ID:
        raise RuntimeError("Native host must be launched by Ark Local Bridge.")
    first = receive()
    if not first or first.get("action") != "start":
        return
    sys.path.insert(0, str(backend.parent))
    os.chdir(backend.parent)
    token = secrets.token_urlsafe(32)
    os.environ["ARK_V2_TOKEN"] = token
    import uvicorn
    from v2.backend.app import app
    from v2.backend import db

    # Bind once before starting, avoiding a port-selection race.
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(("127.0.0.1", 0))
    sock.listen(128)
    port = sock.getsockname()[1]
    config = uvicorn.Config(guarded(app, token), host="127.0.0.1", port=port,
                            log_level="warning", access_log=False, lifespan="on",
                            ws_max_size=2 * 1024 * 1024)
    server = uvicorn.Server(config)
    worker = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    worker.start()
    try:
        deadline = time.monotonic() + 165
        while not server.started and worker.is_alive() and time.monotonic() < deadline:
            time.sleep(.1)
        if not server.started:
            raise RuntimeError("Backend failed to start; check bridge logs and Python dependencies.")
        send({"ready": True, "baseUrl": f"http://127.0.0.1:{port}", "token": token})
        while True:
            msg = receive()
            if msg is None:
                break
            if msg.get("action") == "open-folder" and os.name == "nt":
                os.startfile(str(db.LIBRARY_ROOT.resolve()))
    finally:
        server.should_exit = True
        worker.join(timeout=5)
        sock.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Keep tokens and provider credentials out of diagnostics.
        print(type(exc).__name__, str(exc), file=sys.stderr)
        send({"error": "Local backend startup failed. Verify the v2 path, Python environment and logs."})
