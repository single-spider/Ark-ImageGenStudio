"""SQLite (WAL + FTS5) asset index, multi-parent lineage, Vault & NTFS hardlink sync."""
from __future__ import annotations

import json
import os
import shutil
import sqlite3
import sys
import threading
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

from PIL import Image

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from image_library import (  # noqa: E402
    CATEGORIES,
    IMAGE_EXTENSIONS,
    atomic_json,
    data_dir,
    library_id,
    library_root,
    read_json,
)

DATA_DIR = data_dir()
DB_PATH = DATA_DIR / "studio.db"
THUMBS_DIR = DATA_DIR / "thumbnails"
JSON_DIR = DATA_DIR / "json"
META_DIR = DATA_DIR / "library_metadata"

LIBRARY_ROOT = Path(os.environ.get("ARK_LIBRARY_ROOT", str(library_root())))
LIBRARY_DIRS = {key: LIBRARY_ROOT / value for key, value in CATEGORIES.items()}

VAULT_MIRROR_ROOT = LIBRARY_ROOT / "Reference Vault"
FINALS_MIRROR_ROOT = LIBRARY_ROOT / "Finals"

LEGACY_HISTORY_DIR = ROOT_DIR / "web" / "generation_history"
LEGACY_IMPORTS_DIR = LEGACY_HISTORY_DIR / "imported"
CONFIG_PATH = DATA_DIR / "ark_studio_config.json"
PRESETS_PATH = DATA_DIR / "presets.json"
IMAGE_TREE_PATH = DATA_DIR / "image_tree.json"
COLLECTIONS_PATH = DATA_DIR / "collections.json"

DEFAULT_VAULT_CATEGORIES = [
    {"id": "Characters", "name": "Characters", "icon": "user", "color": "#8B5CF6", "sort_order": 0},
    {"id": "Creatures", "name": "Creatures", "icon": "bug", "color": "#10B981", "sort_order": 1},
    {"id": "Poses", "name": "Poses", "icon": "person-standing", "color": "#3B82F6", "sort_order": 2},
    {"id": "Anatomy", "name": "Anatomy & Details", "icon": "eye", "color": "#F59E0B", "sort_order": 3},
    {"id": "Outfits", "name": "Outfits & Props", "icon": "shirt", "color": "#EC4899", "sort_order": 4},
    {"id": "Styles", "name": "Styles & Lighting", "icon": "sparkles", "color": "#06B6D4", "sort_order": 5},
]

DEFAULT_MOD_PACKS = [
    {
        "id": "guardrails",
        "name": "Consistency & Pose",
        "items": [
            {"id": "pose-lock", "label": "Pose Lock", "text": "maintain exact pose, camera angle, and composition from primary reference"},
            {"id": "identity-lock", "label": "Identity Lock", "text": "preserve exact character facial features, hair, and proportions"},
            {"id": "lighting-match", "label": "Match Lighting", "text": "match ambient lighting, shadows, and color grading seamlessly"},
            {"id": "anatomy-detail", "label": "High Detail", "text": "crisp anatomical detail, sharp focus, clean rendering"},
        ],
    },
    {
        "id": "camera",
        "name": "Framing & Lighting",
        "items": [
            {"id": "close-up", "label": "Close-Up", "text": "tight portrait close-up framing"},
            {"id": "full-body", "label": "Full Body", "text": "full-body wide framing from head to toe"},
            {"id": "rim-light", "label": "Rim Light", "text": "dramatic rim lighting, subtle volumetric depth"},
            {"id": "soft-studio", "label": "Soft Studio", "text": "soft diffused studio lighting, clean shadows"},
        ],
    },
]

_db_lock = threading.RLock()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    for _d in LIBRARY_DIRS.values():
        _d.mkdir(parents=True, exist_ok=True)
    with _db_lock:
        conn = get_conn()
        try:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS assets (
                    id TEXT PRIMARY KEY,
                    file_path TEXT NOT NULL,
                    thumb_path TEXT,
                    image_url TEXT NOT NULL,
                    thumb_url TEXT NOT NULL,
                    library_category TEXT NOT NULL,
                    asset_type TEXT NOT NULL,
                    width INTEGER NOT NULL DEFAULT 0,
                    height INTEGER NOT NULL DEFAULT 0,
                    aspect_ratio REAL NOT NULL DEFAULT 1.0,
                    timestamp_ms INTEGER NOT NULL DEFAULT 0,
                    file_version TEXT NOT NULL DEFAULT '',
                    prompt TEXT NOT NULL DEFAULT '',
                    model TEXT NOT NULL DEFAULT '',
                    model_code TEXT NOT NULL DEFAULT '',
                    exact_pixels TEXT NOT NULL DEFAULT '',
                    original_name TEXT NOT NULL DEFAULT '',
                    curation_state TEXT NOT NULL DEFAULT 'draft',
                    vault_category TEXT DEFAULT NULL,
                    vault_tags TEXT NOT NULL DEFAULT '[]',
                    metadata_json TEXT NOT NULL DEFAULT '{}'
                );

                CREATE INDEX IF NOT EXISTS idx_assets_ts ON assets(timestamp_ms DESC);
                CREATE INDEX IF NOT EXISTS idx_assets_curation ON assets(curation_state);
                CREATE INDEX IF NOT EXISTS idx_assets_vault ON assets(vault_category);
                CREATE INDEX IF NOT EXISTS idx_assets_libcat ON assets(library_category);

                CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
                    id UNINDEXED,
                    prompt,
                    original_name,
                    model,
                    vault_category,
                    vault_tags
                );

                CREATE TABLE IF NOT EXISTS lineage (
                    child_id TEXT PRIMARY KEY,
                    parent_id TEXT,
                    prompt TEXT NOT NULL DEFAULT '',
                    ref_ids_json TEXT NOT NULL DEFAULT '[]',
                    ref_roles_json TEXT NOT NULL DEFAULT '{}'
                );
                CREATE INDEX IF NOT EXISTS idx_lineage_parent ON lineage(parent_id);

                CREATE TABLE IF NOT EXISTS vault_categories (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    icon TEXT NOT NULL DEFAULT 'folder',
                    color TEXT NOT NULL DEFAULT '#8B5CF6',
                    sort_order INTEGER NOT NULL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS mod_packs (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    data_json TEXT NOT NULL DEFAULT '{}',
                    sort_order INTEGER NOT NULL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    prompt TEXT NOT NULL,
                    model_name TEXT NOT NULL,
                    model_code TEXT NOT NULL,
                    px_size TEXT NOT NULL,
                    ref_ids_json TEXT NOT NULL DEFAULT '[]',
                    result_asset_id TEXT DEFAULT NULL,
                    error TEXT DEFAULT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                """
            )
            # Seed default Vault Categories if empty
            if conn.execute("SELECT COUNT(*) FROM vault_categories").fetchone()[0] == 0:
                for cat in DEFAULT_VAULT_CATEGORIES:
                    conn.execute(
                        "INSERT INTO vault_categories(id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)",
                        (cat["id"], cat["name"], cat["icon"], cat["color"], cat["sort_order"]),
                    )
            # Seed default Mod Packs if empty
            if conn.execute("SELECT COUNT(*) FROM mod_packs").fetchone()[0] == 0:
                for idx, pack in enumerate(DEFAULT_MOD_PACKS):
                    conn.execute(
                        "INSERT INTO mod_packs(id, name, data_json, sort_order) VALUES (?, ?, ?, ?)",
                        (pack["id"], pack["name"], json.dumps(pack), idx),
                    )
            conn.commit()
        finally:
            conn.close()


def create_thumbnail(source_path: Path, thumb_path: Path, max_size: int = 640) -> None:
    try:
        with Image.open(source_path) as img:
            if img.mode != "RGB":
                img = img.convert("RGB")
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            img.save(thumb_path, "JPEG", quality=90, optimize=True)
    except Exception:
        if not thumb_path.exists():
            placeholder = Image.new("RGB", (max_size, max_size), color=(19, 22, 32))
            placeholder.save(thumb_path, "JPEG", quality=75)


def _read_asset_metadata(image_id: str) -> dict[str, Any]:
    dl_meta = META_DIR / f"{image_id}.json"
    if dl_meta.is_file():
        data = read_json(dl_meta, {})
        if isinstance(data, dict):
            return data
    app_meta = JSON_DIR / f"{image_id}.json"
    data = read_json(app_meta, {})
    return data if isinstance(data, dict) else {}


def _upsert_fts(conn: sqlite3.Connection, row: dict[str, Any]) -> None:
    conn.execute("DELETE FROM assets_fts WHERE id = ?", (row["id"],))
    conn.execute(
        "INSERT INTO assets_fts(id, prompt, original_name, model, vault_category, vault_tags) VALUES (?, ?, ?, ?, ?, ?)",
        (
            row["id"],
            row["prompt"],
            row["original_name"],
            row["model"],
            row["vault_category"] or "",
            row["vault_tags"],
        ),
    )


def _collect_directories() -> list[tuple[Path, str, str | None]]:
    """Single canonical media root: Source Images, Generated Images, and Others."""
    dirs: list[tuple[Path, str, str | None]] = []
    for cat, directory in LIBRARY_DIRS.items():
        if directory.is_dir():
            dirs.append((directory, f"/library/{cat}", cat))
    return dirs


def consolidate_legacy_media() -> dict[str, int]:
    """Consolidate scattered legacy media (web/generation_history & workspace Images/) into LIBRARY_ROOT."""
    moved = 0
    deduped = 0
    meta_moved = 0

    for _d in LIBRARY_DIRS.values():
        _d.mkdir(parents=True, exist_ok=True)
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)

    def _move_media_file(src: Path, target_cat: str) -> None:
        nonlocal moved, deduped
        if not src.is_file() or src.suffix.lower() not in IMAGE_EXTENSIONS or src.name.startswith("thumb_"):
            return
        dest_dir = LIBRARY_DIRS[target_cat]
        dest = dest_dir / src.name
        if dest.exists():
            try:
                if dest.stat().st_size == src.stat().st_size:
                    src.unlink(missing_ok=True)
                    deduped += 1
                    return
            except OSError:
                pass
            stem, ext = src.stem, src.suffix
            idx = 1
            while (dest_dir / f"{stem}_legacy{idx}{ext}").exists():
                idx += 1
            dest = dest_dir / f"{stem}_legacy{idx}{ext}"
        try:
            shutil.move(str(src), str(dest))
            moved += 1
        except OSError:
            pass

    # 1. Consolidate web/generation_history/ & web/generation_history/imported/
    if LEGACY_HISTORY_DIR.is_dir():
        for entry in list(LEGACY_HISTORY_DIR.iterdir()):
            if entry.is_file():
                cat = "generated" if entry.name.startswith("output_") else "source"
                _move_media_file(entry, cat)
        legacy_json = LEGACY_HISTORY_DIR / "json"
        if legacy_json.is_dir():
            for jf in list(legacy_json.iterdir()):
                if jf.is_file() and jf.suffix.lower() == ".json":
                    dest = JSON_DIR / jf.name
                    if not dest.exists():
                        shutil.move(str(jf), str(dest))
                        meta_moved += 1
        legacy_thumbs = LEGACY_HISTORY_DIR / "thumbnails"
        if legacy_thumbs.is_dir():
            for tf in list(legacy_thumbs.iterdir()):
                if tf.is_file() and tf.suffix.lower() in IMAGE_EXTENSIONS:
                    dest = THUMBS_DIR / tf.name
                    if not dest.exists():
                        shutil.move(str(tf), str(dest))
    if LEGACY_IMPORTS_DIR.is_dir():
        for entry in list(LEGACY_IMPORTS_DIR.iterdir()):
            if entry.is_file():
                _move_media_file(entry, "source")

    # 2. Consolidate workspace Images/ folder
    workspace_images = ROOT_DIR / "Images"
    if workspace_images.is_dir():
        for entry in list(workspace_images.iterdir()):
            if entry.is_file():
                cat = "generated" if entry.name.startswith("output_") else "source"
                _move_media_file(entry, cat)

    return {"moved": moved, "deduped": deduped, "meta_moved": meta_moved}


def index_single_file(
    conn: sqlite3.Connection,
    path: Path,
    url_base: str,
    lib_cat: str | None,
    existing_map: dict[str, sqlite3.Row],
) -> str | None:
    if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
        return None
    if path.name.startswith("thumb_"):
        return None

    image_id = library_id(lib_cat, path.name) if lib_cat else path.stem
    stat = path.stat()
    file_version = f"{stat.st_mtime_ns}-{stat.st_size}"
    prev = existing_map.get(image_id)

    if prev and prev["file_version"] == file_version and prev["width"] > 0:
        return image_id

    width = prev["width"] if prev and prev["width"] > 0 else 0
    height = prev["height"] if prev and prev["height"] > 0 else 0
    if width == 0 or height == 0 or not prev or prev["file_version"] != file_version:
        try:
            with Image.open(path) as im:
                width, height = im.size
        except Exception:
            width, height = 1024, 1024

    aspect_ratio = round(width / max(1, height), 4)
    meta = _read_asset_metadata(image_id)
    inferred_cat = lib_cat or meta.get("library_category") or (
        "generated" if image_id.startswith("output_") or meta.get("model") else "source"
    )
    asset_type = str(meta.get("type") or ("generated" if inferred_cat == "generated" else "import" if inferred_cat == "source" else "other"))

    thumb_file = f"thumb_{image_id}.jpg"
    thumb_path = THUMBS_DIR / thumb_file
    if not thumb_path.exists() or thumb_path.stat().st_mtime_ns < stat.st_mtime_ns:
        create_thumbnail(path, thumb_path)

    ts_ms = int(meta.get("timestamp_ms") or (stat.st_ctime * 1000))
    image_url = f"{url_base}/{quote(path.name)}?v={quote(file_version)}"
    thumb_ver = f"{file_version}-640"
    thumb_url = f"/library-thumbnails/{quote(thumb_file)}?v={quote(thumb_ver)}"

    curation_state = prev["curation_state"] if prev else "draft"
    vault_category = prev["vault_category"] if prev else None
    vault_tags = prev["vault_tags"] if prev else "[]"

    row = {
        "id": image_id,
        "file_path": str(path),
        "thumb_path": str(thumb_path),
        "image_url": image_url,
        "thumb_url": thumb_url,
        "library_category": inferred_cat,
        "asset_type": asset_type,
        "width": width,
        "height": height,
        "aspect_ratio": aspect_ratio,
        "timestamp_ms": ts_ms,
        "file_version": file_version,
        "prompt": str(meta.get("prompt") or ""),
        "model": str(meta.get("model") or ""),
        "model_code": str(meta.get("model_code") or ""),
        "exact_pixels": str(meta.get("exact_pixels") or f"{width}x{height}"),
        "original_name": str(meta.get("originalName") or path.name),
        "curation_state": curation_state,
        "vault_category": vault_category,
        "vault_tags": vault_tags,
        "metadata_json": json.dumps(meta, ensure_ascii=False),
    }

    conn.execute(
        """
        INSERT INTO assets (
            id, file_path, thumb_path, image_url, thumb_url, library_category, asset_type,
            width, height, aspect_ratio, timestamp_ms, file_version, prompt, model, model_code,
            exact_pixels, original_name, curation_state, vault_category, vault_tags, metadata_json
        ) VALUES (
            :id, :file_path, :thumb_path, :image_url, :thumb_url, :library_category, :asset_type,
            :width, :height, :aspect_ratio, :timestamp_ms, :file_version, :prompt, :model, :model_code,
            :exact_pixels, :original_name, :curation_state, :vault_category, :vault_tags, :metadata_json
        )
        ON CONFLICT(id) DO UPDATE SET
            file_path=excluded.file_path,
            thumb_path=excluded.thumb_path,
            image_url=excluded.image_url,
            thumb_url=excluded.thumb_url,
            library_category=excluded.library_category,
            asset_type=excluded.asset_type,
            width=excluded.width,
            height=excluded.height,
            aspect_ratio=excluded.aspect_ratio,
            timestamp_ms=excluded.timestamp_ms,
            file_version=excluded.file_version,
            prompt=excluded.prompt,
            model=excluded.model,
            model_code=excluded.model_code,
            exact_pixels=excluded.exact_pixels,
            original_name=excluded.original_name,
            metadata_json=excluded.metadata_json
        """,
        row,
    )
    _upsert_fts(conn, row)

    # Sync multi-parent ref lineage from metadata if absent
    ref_ids = meta.get("ref_ids") or ([meta["ref_id"]] if meta.get("ref_id") else [])
    if ref_ids:
        conn.execute(
            """
            INSERT INTO lineage(child_id, parent_id, prompt, ref_ids_json, ref_roles_json)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(child_id) DO NOTHING
            """,
            (image_id, ref_ids[0], row["prompt"], json.dumps(ref_ids), "{}"),
        )
    return image_id


def sync_library_to_db() -> dict[str, int]:
    """Scan library directories & sync image_tree.json into SQLite without moving user files."""
    with _db_lock:
        conn = get_conn()
        try:
            existing_rows = conn.execute("SELECT * FROM assets").fetchall()
            existing_map = {r["id"]: r for r in existing_rows}
            seen_ids: set[str] = set()

            for directory, url_base, lib_cat in _collect_directories():
                for entry in sorted(directory.iterdir()):
                    aid = index_single_file(conn, entry, url_base, lib_cat, existing_map)
                    if aid:
                        seen_ids.add(aid)

            # Remove records whose source files no longer exist on disk
            removed = [aid for aid in existing_map if aid not in seen_ids]
            for aid in removed:
                conn.execute("DELETE FROM assets WHERE id = ?", (aid,))
                conn.execute("DELETE FROM assets_fts WHERE id = ?", (aid,))

            # Import legacy image_tree.json lineage edges
            tree = read_json(IMAGE_TREE_PATH, {"sources": [], "lineage": {}})
            if isinstance(tree, dict) and isinstance(tree.get("lineage"), dict):
                for child_id, info in tree["lineage"].items():
                    if not isinstance(info, dict):
                        continue
                    parent_id = info.get("parent")
                    prompt = str(info.get("prompt") or "")
                    if child_id in seen_ids and parent_id:
                        conn.execute(
                            """
                            INSERT INTO lineage(child_id, parent_id, prompt, ref_ids_json, ref_roles_json)
                            VALUES (?, ?, ?, ?, ?)
                            ON CONFLICT(child_id) DO UPDATE SET parent_id=COALESCE(lineage.parent_id, excluded.parent_id)
                            """,
                            (child_id, parent_id, prompt, json.dumps([parent_id]), "{}"),
                        )

            conn.commit()
            return {"total": len(seen_ids), "removed": len(removed)}
        finally:
            conn.close()


def _hardlink_or_copy(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        try:
            if os.path.samefile(src, dest):
                return
        except OSError:
            pass
        dest.unlink(missing_ok=True)
    try:
        os.link(src, dest)
    except OSError:
        shutil.copy2(src, dest)


def sync_asset_mirrors(asset_id: str) -> None:
    """Sync NTFS hardlinks for Reference Vault/<Category> and Finals/."""
    with _db_lock:
        conn = get_conn()
        try:
            row = conn.execute("SELECT file_path, original_name, vault_category, curation_state FROM assets WHERE id = ?", (asset_id,)).fetchone()
            if not row:
                return
            src = Path(row["file_path"])
            if not src.is_file():
                return
            filename = f"{asset_id}{src.suffix.lower()}"

            # Clean stale hardlinks across Vault categories
            if VAULT_MIRROR_ROOT.is_dir():
                for sub in VAULT_MIRROR_ROOT.iterdir():
                    if sub.is_dir():
                        candidate = sub / filename
                        if candidate.exists() and sub.name != (row["vault_category"] or ""):
                            candidate.unlink(missing_ok=True)
            if row["vault_category"]:
                safe_cat = "".join(c for c in row["vault_category"] if c.isalnum() or c in (" ", "_", "-")).strip() or "General"
                _hardlink_or_copy(src, VAULT_MIRROR_ROOT / safe_cat / filename)

            # Finals mirror
            final_dest = FINALS_MIRROR_ROOT / filename
            if row["curation_state"] == "final":
                _hardlink_or_copy(src, final_dest)
            elif final_dest.exists():
                final_dest.unlink(missing_ok=True)
        finally:
            conn.close()


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "image_url": row["image_url"],
        "thumb_url": row["thumb_url"],
        "library_category": row["library_category"],
        "asset_type": row["asset_type"],
        "width": row["width"],
        "height": row["height"],
        "aspect_ratio": row["aspect_ratio"],
        "timestamp": row["timestamp_ms"],
        "prompt": row["prompt"],
        "model": row["model"],
        "model_code": row["model_code"],
        "exact_pixels": row["exact_pixels"],
        "original_name": row["original_name"],
        "curation_state": row["curation_state"],
        "vault_category": row["vault_category"],
        "vault_tags": json.loads(row["vault_tags"] or "[]"),
        "metadata": json.loads(row["metadata_json"] or "{}"),
    }


def query_assets(
    space: str = "all",
    search: str = "",
    vault_category: str = "",
    collection_id: str = "",
    aspect: str = "",
    model: str = "",
    sort: str = "newest",
    limit: int = 5000,
) -> list[dict[str, Any]]:
    with _db_lock:
        conn = get_conn()
        try:
            clauses: list[str] = []
            params: list[Any] = []

            if space == "keepers":
                clauses.append("curation_state IN ('keeper', 'final')")
            elif space == "finals":
                clauses.append("curation_state = 'final'")
            elif space == "vault":
                clauses.append("vault_category IS NOT NULL AND curation_state NOT IN ('trash', 'scratchpad', 'archived')")
            elif space == "generations":
                clauses.append("library_category = 'generated' AND curation_state NOT IN ('trash', 'scratchpad', 'archived')")
            elif space == "others":
                clauses.append("library_category = 'others' AND curation_state NOT IN ('trash', 'scratchpad', 'archived')")
            elif space == "originals":
                clauses.append("id NOT IN (SELECT child_id FROM lineage WHERE parent_id IS NOT NULL) AND curation_state NOT IN ('trash', 'scratchpad', 'archived')")
            elif space == "trash":
                clauses.append("curation_state = 'trash'")
            elif space == "scratchpad":
                clauses.append("curation_state = 'scratchpad'")
            elif space == "archived":
                clauses.append("curation_state = 'archived'")
            else:
                clauses.append("curation_state NOT IN ('trash', 'scratchpad', 'archived')")

            if vault_category:
                clauses.append("vault_category = ?")
                params.append(vault_category)

            if model:
                clauses.append("model = ?")
                params.append(model)

            if aspect == "portrait":
                clauses.append("aspect_ratio < 0.92")
            elif aspect == "landscape":
                clauses.append("aspect_ratio > 1.08")
            elif aspect == "square":
                clauses.append("aspect_ratio BETWEEN 0.92 AND 1.08")

            if collection_id:
                cols = read_json(COLLECTIONS_PATH, {"collections": {}}).get("collections", {})
                if collection_id == "__uncollected__":
                    collected = {img_id for col in cols.values() for img_id in (col.get("images") or [])}
                    if collected:
                        placeholders = ",".join("?" for _ in collected)
                        clauses.append(f"id NOT IN ({placeholders})")
                        params.extend(collected)
                else:
                    col_imgs = (cols.get(collection_id) or {}).get("images") or []
                    if not col_imgs:
                        return []
                    placeholders = ",".join("?" for _ in col_imgs)
                    clauses.append(f"id IN ({placeholders})")
                    params.extend(col_imgs)

            if search.strip():
                tokens = [f'"{tok.replace(chr(34), "")}"*' for tok in search.strip().split() if tok]
                if tokens:
                    fts_query = " AND ".join(tokens)
                    clauses.append("id IN (SELECT id FROM assets_fts WHERE assets_fts MATCH ?)")
                    params.append(fts_query)

            where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
            order_sql = (
                "ORDER BY original_name ASC"
                if sort == "name"
                else "ORDER BY timestamp_ms ASC"
                if sort == "oldest"
                else "ORDER BY timestamp_ms DESC"
            )
            sql = f"SELECT * FROM assets {where_sql} {order_sql} LIMIT ?"
            params.append(limit)
            rows = conn.execute(sql, params).fetchall()
            return [row_to_dict(r) for r in rows]
        finally:
            conn.close()


def get_asset_chain(asset_id: str) -> dict[str, Any]:
    """Return primary ancestor/sibling/child chain for the Stacked-Card Iterations strip."""
    with _db_lock:
        conn = get_conn()
        try:
            lineage_rows = conn.execute("SELECT * FROM lineage").fetchall()
            parent_of: dict[str, str] = {}
            children_of: dict[str, list[str]] = {}
            refs_of: dict[str, list[str]] = {}
            for lr in lineage_rows:
                cid = lr["child_id"]
                pid = lr["parent_id"]
                if pid and pid != cid:
                    parent_of[cid] = pid
                    children_of.setdefault(pid, []).append(cid)
                refs_of[cid] = json.loads(lr["ref_ids_json"] or "[]")

            # Walk up to root
            chain_ids = [asset_id]
            seen = {asset_id}
            curr = asset_id
            while curr in parent_of and parent_of[curr] not in seen:
                curr = parent_of[curr]
                chain_ids.append(curr)
                seen.add(curr)
            chain_ids.reverse()

            # Walk forward along most recent child path from active node
            curr = asset_id
            while children_of.get(curr):
                kids = children_of[curr]
                next_kid = kids[-1]
                if next_kid in seen:
                    break
                chain_ids.append(next_kid)
                seen.add(next_kid)
                curr = next_kid

            all_needed = set(chain_ids)
            for nid in list(chain_ids):
                all_needed.update(children_of.get(nid, []))
                all_needed.update(refs_of.get(nid, []))

            assets_by_id: dict[str, dict[str, Any]] = {}
            if all_needed:
                placeholders = ",".join("?" for _ in all_needed)
                for r in conn.execute(f"SELECT * FROM assets WHERE id IN ({placeholders})", list(all_needed)).fetchall():
                    assets_by_id[r["id"]] = row_to_dict(r)

            nodes = []
            for nid in chain_ids:
                asset = assets_by_id.get(nid)
                if not asset:
                    continue
                kids = [assets_by_id[k] for k in children_of.get(nid, []) if k in assets_by_id]
                kids.sort(key=lambda x: x["timestamp"], reverse=True)
                sat_refs = [
                    assets_by_id[rid]
                    for rid in refs_of.get(nid, [])[1:4]
                    if rid in assets_by_id
                ]
                nodes.append({
                    "asset": asset,
                    "children": kids,
                    "child_count": len(kids),
                    "satellite_refs": sat_refs,
                })

            return {
                "root_id": chain_ids[0] if chain_ids else asset_id,
                "active_id": asset_id,
                "nodes": nodes,
            }
        finally:
            conn.close()


def rebuild_all_thumbnails(max_size: int = 640) -> int:
    """Regenerate all cached thumbnails at crisp LANCZOS resolution and refresh thumb_url cache-busters."""
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    rebuilt = 0
    with _db_lock:
        conn = get_conn()
        try:
            rows = conn.execute("SELECT id, file_path, file_version FROM assets").fetchall()
            for row in rows:
                src = Path(row["file_path"])
                if not src.is_file():
                    continue
                thumb_file = f"thumb_{row['id']}.jpg"
                thumb_path = THUMBS_DIR / thumb_file
                create_thumbnail(src, thumb_path, max_size=max_size)
                thumb_ver = f"{row['file_version']}-{max_size}"
                thumb_url = f"/library-thumbnails/{quote(thumb_file)}?v={quote(thumb_ver)}"
                conn.execute("UPDATE assets SET thumb_path=?, thumb_url=? WHERE id=?", (str(thumb_path), thumb_url, row["id"]))
                rebuilt += 1
            conn.commit()
        finally:
            conn.close()
    return rebuilt


def checkpoint_wal() -> None:
    with _db_lock:
        conn = get_conn()
        try:
            conn.execute("PRAGMA wal_checkpoint(PASSIVE);")
        except sqlite3.Error:
            pass
        finally:
            conn.close()
