"""Ark Image Studio v2 FastAPI application, WebSocket push & filesystem watchdog."""
from __future__ import annotations

import asyncio
import base64
import json
import os
import secrets
import shutil
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from image_library import IMAGE_EXTENSIONS, atomic_json, contained_file, heartbeat, read_json, sorter_health
from v2.backend import db
from v2.backend.jobs import bus, queue

SESSION_TOKEN = os.environ.get("ARK_V2_TOKEN", "")
FRONTEND_DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"


class _LibraryWatcher(FileSystemEventHandler):
    def __init__(self) -> None:
        self._last_trigger = 0.0
        self._timer: threading.Timer | None = None
        self._lock = threading.Lock()

    def on_any_event(self, event: Any) -> None:
        if event.is_directory:
            return
        src = Path(getattr(event, "src_path", ""))
        if src.suffix.lower() not in IMAGE_EXTENSIONS:
            return
        if "Reference Vault" in src.parts or "Finals" in src.parts:
            return
        with self._lock:
            if self._timer:
                self._timer.cancel()
            self._timer = threading.Timer(0.45, self._run_sync)
            self._timer.daemon = True
            self._timer.start()

    @staticmethod
    def _run_sync() -> None:
        try:
            res = db.sync_library_to_db()
            bus.emit("library_synced", res)
        except Exception:
            pass


async def _heartbeat_and_wal_loop() -> None:
    tick = 0
    while True:
        try:
            heartbeat()
            if tick % 120 == 0:
                db.checkpoint_wal()
            tick += 1
        except Exception:
            pass
        await asyncio.sleep(1.5)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init_db()
    db.consolidate_legacy_media()
    db.sync_library_to_db()
    bus.set_loop(asyncio.get_running_loop())
    queue.start()

    observer = Observer()
    handler = _LibraryWatcher()
    for directory in db.LIBRARY_DIRS.values():
        if directory.is_dir():
            observer.schedule(handler, str(directory), recursive=False)
    observer.start()

    hb_task = asyncio.create_task(_heartbeat_and_wal_loop())
    try:
        yield
    finally:
        hb_task.cancel()
        observer.stop()
        observer.join(timeout=2)
        db.checkpoint_wal()


app = FastAPI(title="Ark Image Studio v2", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def session_gate(request: Request, call_next):
    if SESSION_TOKEN and request.client and request.client.host not in ("127.0.0.1", "::1"):
        return JSONResponse({"detail": "Forbidden"}, status_code=403)
    if SESSION_TOKEN and request.url.path.startswith("/api/"):
        header_tok = request.headers.get("x-ark-token", "")
        cookie_tok = request.cookies.get("ark_v2_session", "")
        query_tok = request.query_params.get("token", "")
        if not any(secrets.compare_digest(t, SESSION_TOKEN) for t in (header_tok, cookie_tok, query_tok) if t):
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    response = await call_next(request)
    if SESSION_TOKEN and request.query_params.get("session") == SESSION_TOKEN:
        response.set_cookie("ark_v2_session", SESSION_TOKEN, httponly=True, samesite="strict", path="/")
    return response


# ─── Static Asset Routes ───
@app.get("/library/{category}/{filename:path}")
def serve_library(category: str, filename: str):
    if category not in db.LIBRARY_DIRS:
        raise HTTPException(404)
    try:
        path = contained_file(db.LIBRARY_DIRS[category], filename)
    except ValueError:
        raise HTTPException(403)
    if not path.is_file():
        raise HTTPException(404)
    return FileResponse(path)


@app.get("/library-thumbnails/{filename:path}")
def serve_thumbnail(filename: str):
    try:
        path = contained_file(db.THUMBS_DIR, filename)
    except ValueError:
        raise HTTPException(403)
    if not path.is_file():
        raise HTTPException(404)
    return FileResponse(path)


@app.get("/generation_history/{filename:path}")
def serve_legacy_history(filename: str):
    try:
        path = contained_file(db.LEGACY_HISTORY_DIR, filename)
    except ValueError:
        target = (db.LEGACY_HISTORY_DIR / filename).resolve()
        if not str(target).startswith(str(db.LEGACY_HISTORY_DIR.resolve())):
            raise HTTPException(403)
        path = target
    if not path.is_file():
        raise HTTPException(404)
    return FileResponse(path)


# ─── Models ───
class AssetPatch(BaseModel):
    curation_state: str | None = None
    vault_category: str | None = None
    clear_vault: bool = False
    vault_tags: list[str] | None = None


class BatchAssetPatch(BaseModel):
    ids: list[str]
    curation_state: str | None = None
    vault_category: str | None = None
    clear_vault: bool = False


class GenerateRequest(BaseModel):
    prompt: str
    model_name: str
    model_code: str
    px_size: str
    base_res: str = "2K"
    aspect_ratio: str = "1:1"
    watermark: bool = False
    dry_run: bool = False
    batch: int = 1
    ref_ids: list[str] = []
    ref_roles: dict[str, str] = {}


class ImportRequest(BaseModel):
    base64_data: str
    filename: str = "pasted.png"
    vault_category: str | None = None


# ─── Bootstrap & Config Endpoints ───
@app.get("/api/bootstrap")
def api_bootstrap():
    cfg = read_json(db.CONFIG_PATH, {})
    presets = read_json(db.PRESETS_PATH, {})
    collections = read_json(db.COLLECTIONS_PATH, {"collections": {}, "activeCollectionId": None, "hideCollectedInAll": False})
    sorter_raw = read_json(db.DATA_DIR / "sorter-status.json", {})
    with db._db_lock:
        conn = db.get_conn()
        try:
            vault_cats = [dict(r) for r in conn.execute("SELECT * FROM vault_categories ORDER BY sort_order ASC").fetchall()]
            mod_packs = [json.loads(r["data_json"]) for r in conn.execute("SELECT data_json FROM mod_packs ORDER BY sort_order ASC").fetchall()]
            total_assets = conn.execute("SELECT COUNT(*) FROM assets WHERE curation_state NOT IN ('trash', 'scratchpad', 'archived')").fetchone()[0]
        finally:
            conn.close()
    return {
        "config": cfg,
        "presets": presets,
        "collections": collections,
        "vault_categories": vault_cats,
        "mod_packs": mod_packs,
        "jobs": queue.list_recent(25),
        "sorter": sorter_health(sorter_raw),
        "total_assets": total_assets,
    }


@app.post("/api/config")
def api_save_config(payload: dict[str, Any]):
    atomic_json(db.CONFIG_PATH, payload)
    return {"ok": True}


@app.post("/api/presets")
def api_save_presets(payload: dict[str, Any]):
    atomic_json(db.PRESETS_PATH, payload)
    return {"ok": True}


@app.post("/api/collections")
def api_save_collections(payload: dict[str, Any]):
    atomic_json(db.COLLECTIONS_PATH, payload)
    return {"ok": True}


@app.post("/api/mod-packs")
def api_save_mod_packs(payload: list[dict[str, Any]]):
    with db._db_lock:
        conn = db.get_conn()
        try:
            conn.execute("DELETE FROM mod_packs")
            for idx, pack in enumerate(payload):
                conn.execute(
                    "INSERT INTO mod_packs(id, name, data_json, sort_order) VALUES (?, ?, ?, ?)",
                    (pack["id"], pack["name"], json.dumps(pack), idx),
                )
            conn.commit()
        finally:
            conn.close()
    return {"ok": True}


@app.post("/api/vault-categories")
def api_save_vault_categories(payload: list[dict[str, Any]]):
    with db._db_lock:
        conn = db.get_conn()
        try:
            conn.execute("DELETE FROM vault_categories")
            for idx, cat in enumerate(payload):
                conn.execute(
                    "INSERT INTO vault_categories(id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)",
                    (cat["id"], cat["name"], cat.get("icon", "folder"), cat.get("color", "#8B5CF6"), idx),
                )
            conn.commit()
        finally:
            conn.close()
    return {"ok": True}


# ─── Assets, Search, Lineage & Curation ───
@app.get("/api/assets")
def api_assets(
    space: str = "all",
    search: str = "",
    vault_category: str = "",
    collection_id: str = "",
    aspect: str = "",
    model: str = "",
    sort: str = "newest",
    limit: int = 5000,
):
    items = db.query_assets(
        space=space,
        search=search,
        vault_category=vault_category,
        collection_id=collection_id,
        aspect=aspect,
        model=model,
        sort=sort,
        limit=limit,
    )
    return {"items": items, "count": len(items)}


@app.post("/api/assets/sync")
def api_sync_assets():
    res = db.sync_library_to_db()
    return res


@app.get("/api/assets/{asset_id}/chain")
def api_asset_chain(asset_id: str):
    return db.get_asset_chain(asset_id)


@app.patch("/api/assets/{asset_id}")
def api_patch_asset(asset_id: str, patch: AssetPatch):
    with db._db_lock:
        conn = db.get_conn()
        try:
            row = conn.execute("SELECT * FROM assets WHERE id = ?", (asset_id,)).fetchone()
            if not row:
                raise HTTPException(404, "Asset not found")
            curation = patch.curation_state if patch.curation_state is not None else row["curation_state"]
            vault_cat = None if patch.clear_vault else (patch.vault_category if patch.vault_category is not None else row["vault_category"])
            vault_tags = json.dumps(patch.vault_tags) if patch.vault_tags is not None else row["vault_tags"]

            conn.execute(
                "UPDATE assets SET curation_state=?, vault_category=?, vault_tags=? WHERE id=?",
                (curation, vault_cat, vault_tags, asset_id),
            )
            updated = conn.execute("SELECT * FROM assets WHERE id = ?", (asset_id,)).fetchone()
            d = db.row_to_dict(updated)
            db._upsert_fts(conn, dict(updated))
            conn.commit()
        finally:
            conn.close()

    db.sync_asset_mirrors(asset_id)
    bus.emit("asset_updated", {"asset": d})
    return {"asset": d}


@app.post("/api/assets/batch")
def api_batch_patch(payload: BatchAssetPatch):
    updated_ids: list[str] = []
    with db._db_lock:
        conn = db.get_conn()
        try:
            for aid in payload.ids:
                row = conn.execute("SELECT * FROM assets WHERE id = ?", (aid,)).fetchone()
                if not row:
                    continue
                curation = payload.curation_state if payload.curation_state is not None else row["curation_state"]
                vault_cat = None if payload.clear_vault else (payload.vault_category if payload.vault_category is not None else row["vault_category"])
                conn.execute(
                    "UPDATE assets SET curation_state=?, vault_category=? WHERE id=?",
                    (curation, vault_cat, aid),
                )
                updated_ids.append(aid)
            conn.commit()
        finally:
            conn.close()
    for aid in updated_ids:
        db.sync_asset_mirrors(aid)
    bus.emit("library_synced", {"updated": len(updated_ids)})
    return {"updated": updated_ids}


@app.post("/api/assets/empty-trash")
def api_empty_trash():
    deleted: list[str] = []
    with db._db_lock:
        conn = db.get_conn()
        try:
            rows = conn.execute("SELECT id, file_path, thumb_path FROM assets WHERE curation_state = 'trash'").fetchall()
            for row in rows:
                aid = row["id"]
                for p in (row["file_path"], row["thumb_path"]):
                    if p and os.path.isfile(p):
                        os.remove(p)
                jpath = db.JSON_DIR / f"{aid}.json"
                if jpath.is_file():
                    jpath.unlink()
                conn.execute("DELETE FROM assets WHERE id = ?", (aid,))
                conn.execute("DELETE FROM assets_fts WHERE id = ?", (aid,))
                parent_row = conn.execute("SELECT parent_id FROM lineage WHERE child_id = ?", (aid,)).fetchone()
                grandparent = parent_row["parent_id"] if parent_row else None
                conn.execute("UPDATE lineage SET parent_id=? WHERE parent_id=?", (grandparent, aid))
                conn.execute("DELETE FROM lineage WHERE child_id=?", (aid,))
                deleted.append(aid)
            conn.commit()
        finally:
            conn.close()
    bus.emit("library_synced", {"deleted": len(deleted)})
    return {"deleted": deleted}


@app.post("/api/assets/import")
def api_import_asset(req: ImportRequest):
    ts_now = datetime.now()
    base_name = f"import_{ts_now.strftime('%Y%m%d_%H%M%S_%f')}"
    img_path = db.LIBRARY_DIRS["source"] / f"{base_name}.jpg"
    thumb_path = db.THUMBS_DIR / f"thumb_{base_name}.jpg"
    json_path = db.JSON_DIR / f"{base_name}.json"

    raw = req.base64_data.split(",", 1)[1] if "," in req.base64_data else req.base64_data
    img_bytes = base64.b64decode(raw)
    img_path.write_bytes(img_bytes)
    db.create_thumbnail(img_path, thumb_path)

    meta = {
        "type": "import",
        "originalName": req.filename,
        "timestamp": ts_now.isoformat(),
        "timestamp_ms": int(ts_now.timestamp() * 1000),
    }
    atomic_json(json_path, meta)

    tree = read_json(db.IMAGE_TREE_PATH, {"sources": [], "lineage": {}})
    if isinstance(tree, dict) and base_name not in tree.get("sources", []):
        tree.setdefault("sources", []).append(base_name)
        atomic_json(db.IMAGE_TREE_PATH, tree)

    with db._db_lock:
        conn = db.get_conn()
        try:
            db.index_single_file(conn, img_path, "/library/source", "source", {})
            if req.vault_category:
                conn.execute("UPDATE assets SET vault_category=? WHERE id=?", (req.vault_category, base_name))
            conn.commit()
            row = conn.execute("SELECT * FROM assets WHERE id = ?", (base_name,)).fetchone()
            asset = db.row_to_dict(row)
        finally:
            conn.close()

    if req.vault_category:
        db.sync_asset_mirrors(base_name)
    bus.emit("asset_added", {"asset": asset})
    return {"asset": asset}


@app.delete("/api/assets/{asset_id}")
def api_delete_asset(asset_id: str):
    with db._db_lock:
        conn = db.get_conn()
        try:
            row = conn.execute("SELECT file_path, thumb_path FROM assets WHERE id = ?", (asset_id,)).fetchone()
            if row:
                for p in (row["file_path"], row["thumb_path"]):
                    if p and os.path.isfile(p):
                        os.remove(p)
                jpath = db.JSON_DIR / f"{asset_id}.json"
                if jpath.is_file():
                    jpath.unlink()
            conn.execute("DELETE FROM assets WHERE id = ?", (asset_id,))
            conn.execute("DELETE FROM assets_fts WHERE id = ?", (asset_id,))
            # Re-parent children
            parent_row = conn.execute("SELECT parent_id FROM lineage WHERE child_id = ?", (asset_id,)).fetchone()
            grandparent = parent_row["parent_id"] if parent_row else None
            conn.execute("UPDATE lineage SET parent_id=? WHERE parent_id=?", (grandparent, asset_id))
            conn.execute("DELETE FROM lineage WHERE child_id=?", (asset_id,))
            conn.commit()
        finally:
            conn.close()
    bus.emit("asset_deleted", {"id": asset_id})
    return {"ok": True}


# ─── Generation & API Test ───
@app.post("/api/generate")
def api_generate(req: GenerateRequest):
    jobs = queue.enqueue(req.model_dump())
    return {"jobs": jobs}


@app.post("/api/jobs/{job_id}/cancel")
def api_cancel_job(job_id: str):
    queue.cancel(job_id)
    return {"ok": True}


@app.post("/api/dry-run")
def api_dry_run():
    cfg = read_json(db.CONFIG_PATH, {})
    api_key = (cfg.get("api_key") or "").strip()
    if not api_key:
        return {"success": False, "error": "No API key provided in Settings."}
    base_url = (cfg.get("base_url") or "https://ark.ap-southeast.bytepluses.com/api/v3").strip()
    from openai import OpenAI

    try:
        client = OpenAI(base_url=base_url, api_key=api_key)
        client.images.generate(
            model="dry-run-connection-test-invalid-model",
            prompt="connection test",
            size="1024x1024",
            response_format="url",
        )
        return {"success": True, "message": "API connection successful!"}
    except Exception as err:
        s = str(err).lower()
        if any(k in s for k in ("model", "not found", "not exist", "invalid", "unknown model", "unsupported")):
            return {"success": True, "message": "API connection & authentication OK!"}
        if any(k in s for k in ("auth", "401", "403", "forbidden", "unauthorized", "denied")):
            return {"success": False, "error": f"Authentication failed: {str(err)[:180]}"}
        return {"success": False, "error": str(err)[:220]}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    if SESSION_TOKEN:
        tok = ws.query_params.get("token", "") or ws.cookies.get("ark_v2_session", "")
        if not tok or not secrets.compare_digest(tok, SESSION_TOKEN):
            await ws.close(code=1008)
            return
    await ws.accept()
    bus.register(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        bus.unregister(ws)
    except Exception:
        bus.unregister(ws)


if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
