"""Async generation job queue & WebSocket event broadcaster."""
from __future__ import annotations

import asyncio
import base64
import json
import mimetypes
import os
import threading
import time
import traceback
import uuid
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
from PIL import Image, ImageDraw

from image_library import atomic_json, read_json
from v2.backend import db


class EventBus:
    def __init__(self) -> None:
        self._clients: set[Any] = set()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._lock = threading.Lock()

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def register(self, ws: Any) -> None:
        with self._lock:
            self._clients.add(ws)

    def unregister(self, ws: Any) -> None:
        with self._lock:
            self._clients.discard(ws)

    def emit(self, event_type: str, payload: dict[str, Any]) -> None:
        if not self._loop:
            return
        message = json.dumps({"type": event_type, "payload": payload})
        with self._lock:
            targets = list(self._clients)
        for ws in targets:
            asyncio.run_coroutine_threadsafe(self._safe_send(ws, message), self._loop)

    @staticmethod
    async def _safe_send(ws: Any, message: str) -> None:
        try:
            await ws.send_text(message)
        except Exception:
            pass


bus = EventBus()


class WorkflowLogBuffer:
    def __init__(self, maxlen: int = 200) -> None:
        self._entries: deque[dict[str, Any]] = deque(maxlen=maxlen)
        self._lock = threading.Lock()
        self._seq = 0

    def log(self, level: str, message: str, job_id: str | None = None, detail: str = "") -> dict[str, Any]:
        ts = int(time.time() * 1000)
        with self._lock:
            self._seq += 1
            entry = {
                "id": f"log-{ts}-{self._seq}",
                "ts": ts,
                "level": level,
                "job_id": job_id,
                "message": message,
                "detail": detail,
            }
            self._entries.append(entry)
        prefix = f"[Ark Workflow][{level.upper()}]" + (f"[{job_id}]" if job_id else "")
        print(f"{prefix} {message}" + (f"\n{detail}" if detail and level == "error" else ""), flush=True)
        bus.emit("workflow_log", entry)
        return entry

    def list_recent(self, limit: int = 120) -> list[dict[str, Any]]:
        with self._lock:
            items = list(self._entries)
        return items[-limit:]


workflow_logs = WorkflowLogBuffer()


class JobQueue:
    def __init__(self) -> None:
        self._queue: list[dict[str, Any]] = []
        self._canceled: set[str] = set()
        self._lock = threading.Lock()
        self._event = threading.Event()
        self._started = False

    def start(self) -> None:
        if self._started:
            return
        self._started = True
        t = threading.Thread(target=self._worker_loop, daemon=True)
        t.start()

    def enqueue(self, req: dict[str, Any]) -> list[dict[str, Any]]:
        batch = max(1, min(4, int(req.get("batch", 1))))
        now = int(time.time() * 1000)
        created: list[dict[str, Any]] = []

        with db._db_lock:
            conn = db.get_conn()
            try:
                for i in range(batch):
                    job_id = f"job_{now}_{uuid.uuid4().hex[:6]}"
                    job = {
                        "id": job_id,
                        "status": "queued",
                        "prompt": req["prompt"],
                        "model_name": req["model_name"],
                        "model_code": req["model_code"],
                        "px_size": req["px_size"],
                        "base_res": req.get("base_res", "2K"),
                        "aspect_ratio": req.get("aspect_ratio", "1:1"),
                        "watermark": bool(req.get("watermark", False)),
                        "dry_run": bool(req.get("dry_run", False)),
                        "ref_ids": req.get("ref_ids") or [],
                        "ref_roles": req.get("ref_roles") or {},
                        "result_asset_id": None,
                        "error": None,
                        "created_at": now + i,
                        "updated_at": now + i,
                    }
                    conn.execute(
                        """
                        INSERT INTO jobs(id, status, prompt, model_name, model_code, px_size, ref_ids_json, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            job["id"],
                            "queued",
                            job["prompt"],
                            job["model_name"],
                            job["model_code"],
                            job["px_size"],
                            json.dumps(job["ref_ids"]),
                            job["created_at"],
                            job["updated_at"],
                        ),
                    )
                    created.append(job)
                conn.commit()
            finally:
                conn.close()

        with self._lock:
            self._queue.extend(created)
        self._event.set()
        for job in created:
            workflow_logs.log(
                "info",
                f"Queued {job['model_name']} ({job['px_size']}, refs={len(job['ref_ids'])}, {'dry-run' if job['dry_run'] else 'live'})",
                job_id=job["id"],
            )
            bus.emit("job_update", job)
        return created

    def cancel(self, job_id: str) -> bool:
        with self._lock:
            self._canceled.add(job_id)
            self._queue = [j for j in self._queue if j["id"] != job_id]
        now = int(time.time() * 1000)
        with db._db_lock:
            conn = db.get_conn()
            try:
                conn.execute(
                    "UPDATE jobs SET status='canceled', updated_at=? WHERE id=? AND status='queued'",
                    (now, job_id),
                )
                conn.commit()
            finally:
                conn.close()
        bus.emit("job_update", {"id": job_id, "status": "canceled", "updated_at": now})
        return True

    def list_recent(self, limit: int = 30) -> list[dict[str, Any]]:
        with db._db_lock:
            conn = db.get_conn()
            try:
                rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
                return [
                    {
                        "id": r["id"],
                        "status": r["status"],
                        "prompt": r["prompt"],
                        "model_name": r["model_name"],
                        "model_code": r["model_code"],
                        "px_size": r["px_size"],
                        "ref_ids": json.loads(r["ref_ids_json"] or "[]"),
                        "result_asset_id": r["result_asset_id"],
                        "error": r["error"],
                        "created_at": r["created_at"],
                        "updated_at": r["updated_at"],
                    }
                    for r in rows
                ]
            finally:
                conn.close()

    def _worker_loop(self) -> None:
        while True:
            self._event.wait()
            while True:
                job = None
                with self._lock:
                    if self._queue:
                        job = self._queue.pop(0)
                    else:
                        self._event.clear()
                if not job:
                    break
                if job["id"] in self._canceled:
                    continue
                self._execute_job(job)

    def _update_job(self, job_id: str, status: str, result_asset_id: str | None = None, error: str | None = None) -> None:
        now = int(time.time() * 1000)
        with db._db_lock:
            conn = db.get_conn()
            try:
                conn.execute(
                    "UPDATE jobs SET status=?, result_asset_id=?, error=?, updated_at=? WHERE id=?",
                    (status, result_asset_id, error, now, job_id),
                )
                conn.commit()
            finally:
                conn.close()
        bus.emit(
            "job_update",
            {
                "id": job_id,
                "status": status,
                "result_asset_id": result_asset_id,
                "error": error,
                "updated_at": now,
            },
        )

    def _execute_job(self, job: dict[str, Any]) -> None:
        from openai import OpenAI, RateLimitError

        job_id = job["id"]
        self._update_job(job_id, "running")
        workflow_logs.log("info", f"Starting {job['model_name']} ({job['px_size']})", job_id=job_id)
        try:
            cfg = read_json(db.CONFIG_PATH, {})
            api_key = (cfg.get("api_key") or "").strip()
            base_url = (cfg.get("base_url") or "https://ark.ap-southeast.bytepluses.com/api/v3").strip()
            model_code = job["model_code"]
            model_name = job["model_name"]
            is_pro = model_code == "dola-seedream-5-0-pro-260628"
            supports_multi_ref = model_code in ("dola-seedream-5-0-pro-260628", "dola-seedream-5-5-261028")
            endpoint_id = (cfg.get("pro_endpoint_id") or "").strip() if is_pro else ""
            request_model = endpoint_id or model_code

            if not job["dry_run"] and not api_key:
                raise ValueError("API key not configured. Open Settings to paste your BytePlus Ark API key.")

            ref_ids: list[str] = list(dict.fromkeys(job.get("ref_ids") or []))
            if not supports_multi_ref:
                ref_ids = ref_ids[:1]

            ts_now = datetime.now()
            base_name = f"output_{ts_now.strftime('%Y%m%d_%H%M%S_%f')}"
            img_path = db.LIBRARY_DIRS["generated"] / f"{base_name}.jpg"
            thumb_path = db.THUMBS_DIR / f"thumb_{base_name}.jpg"
            json_path = db.JSON_DIR / f"{base_name}.json"

            if job["dry_run"]:
                time.sleep(1.6)
                w, h = map(int, job["px_size"].split("x"))
                im = Image.new("RGB", (w, h), color=(19, 22, 32))
                draw = ImageDraw.Draw(im)
                draw.rectangle([40, 40, w - 40, h - 40], outline=(139, 92, 246), width=8)
                im.save(img_path, "JPEG", quality=85)
            else:
                client = OpenAI(base_url=base_url, api_key=api_key)
                extra: dict[str, Any] = {"watermark": job["watermark"]}
                if supports_multi_ref:
                    extra["output_format"] = "jpeg"

                if ref_ids:
                    workflow_logs.log("info", f"Encoding {len(ref_ids)} reference image(s)...", job_id=job_id)
                    with db._db_lock:
                        conn = db.get_conn()
                        try:
                            encoded_refs: list[str] = []
                            for rid in ref_ids:
                                row = conn.execute("SELECT file_path FROM assets WHERE id = ?", (rid,)).fetchone()
                                if not row or not os.path.isfile(row["file_path"]):
                                    raise FileNotFoundError(f"Reference image not found: {rid}")
                                rpath = row["file_path"]
                                if os.path.getsize(rpath) > 30_000_000:
                                    raise ValueError(f"Reference exceeds 30 MB BytePlus limit: {rid}")
                                with open(rpath, "rb") as fh:
                                    b64 = base64.b64encode(fh.read()).decode("utf-8")
                                mime = mimetypes.guess_type(rpath)[0] or "image/png"
                                encoded_refs.append(f"data:{mime};base64,{b64}")
                            extra["image"] = encoded_refs if len(encoded_refs) > 1 else encoded_refs[0]
                        finally:
                            conn.close()

                workflow_logs.log("info", f"Calling {request_model} at {base_url}...", job_id=job_id)
                resp = client.images.generate(
                    model=request_model,
                    prompt=job["prompt"],
                    size=job["px_size"],
                    response_format="url",
                    extra_body=extra,
                )
                url = resp.data[0].url
                workflow_logs.log("info", "Downloading generated image...", job_id=job_id)
                dl = requests.get(url, timeout=180)
                dl.raise_for_status()
                img_path.write_bytes(dl.content)

            db.create_thumbnail(img_path, thumb_path)
            primary_ref = ref_ids[0] if ref_ids else None
            meta = {
                "prompt": job["prompt"],
                "model": "DRY RUN TEST" if job["dry_run"] else model_name,
                "model_code": model_code,
                "endpoint_id": endpoint_id or None,
                "base_resolution": job["base_res"],
                "aspect_ratio": job["aspect_ratio"],
                "exact_pixels": job["px_size"],
                "watermark": job["watermark"],
                "referenceUsed": bool(primary_ref),
                "ref_id": primary_ref,
                "ref_ids": ref_ids,
                "timestamp": ts_now.isoformat(),
                "timestamp_ms": int(ts_now.timestamp() * 1000),
            }
            atomic_json(json_path, meta)

            # Update legacy image_tree.json for backwards compatibility
            tree = read_json(db.IMAGE_TREE_PATH, {"sources": [], "lineage": {}})
            if not isinstance(tree, dict):
                tree = {"sources": [], "lineage": {}}
            if primary_ref:
                tree.setdefault("lineage", {})[base_name] = {"parent": primary_ref, "prompt": job["prompt"]}
            elif base_name not in tree.get("sources", []):
                tree.setdefault("sources", []).append(base_name)
            atomic_json(db.IMAGE_TREE_PATH, tree)

            if not job["dry_run"]:
                cfg.setdefault("usage", {})
                cfg["usage"][model_name] = cfg["usage"].get(model_name, 0) + 1
                atomic_json(db.CONFIG_PATH, cfg)

            # Index into SQLite immediately
            with db._db_lock:
                conn = db.get_conn()
                try:
                    db.index_single_file(conn, img_path, "/library/generated", "generated", {})
                    if ref_ids:
                        conn.execute(
                            """
                            INSERT INTO lineage(child_id, parent_id, prompt, ref_ids_json, ref_roles_json)
                            VALUES (?, ?, ?, ?, ?)
                            ON CONFLICT(child_id) DO UPDATE SET
                                parent_id=excluded.parent_id,
                                prompt=excluded.prompt,
                                ref_ids_json=excluded.ref_ids_json,
                                ref_roles_json=excluded.ref_roles_json
                            """,
                            (
                                base_name,
                                primary_ref,
                                job["prompt"],
                                json.dumps(ref_ids),
                                json.dumps(job.get("ref_roles") or {}),
                            ),
                        )
                    conn.commit()
                    row = conn.execute("SELECT * FROM assets WHERE id = ?", (base_name,)).fetchone()
                    asset_dict = db.row_to_dict(row) if row else None
                finally:
                    conn.close()

            self._update_job(job_id, "done", result_asset_id=base_name)
            workflow_logs.log("info", f"Completed -> {base_name}", job_id=job_id)
            if asset_dict:
                bus.emit("asset_added", {"asset": asset_dict, "job_id": job_id})

        except RateLimitError as e:
            body = getattr(e, "body", None)
            if isinstance(body, dict) and isinstance(body.get("error"), dict):
                body = body["error"]
            code = body.get("code") if isinstance(body, dict) else None
            msg = (
                "BytePlus paused this model because its account/model usage limit was reached."
                if code == "SetLimitExceeded"
                else f"BytePlus rate limit: {e}"
            )
            workflow_logs.log("error", msg, job_id=job_id, detail=traceback.format_exc())
            self._update_job(job_id, "error", error=msg)
        except Exception as e:
            msg = f"{type(e).__name__}: {e}"
            workflow_logs.log("error", msg, job_id=job_id, detail=traceback.format_exc())
            self._update_job(job_id, "error", error=msg)


queue = JobQueue()
