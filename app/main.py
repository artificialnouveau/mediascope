import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from database import get_db, init_db
from downloader import download_video, download_video_to_folder, trim_video, save_notes_file, MEDIA_DIR
from transcriber import transcribe_video

app = FastAPI()

BASE_DIR = os.path.dirname(__file__)
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

init_db()


# --- Pydantic models ---

class NameBody(BaseModel):
    name: str

class ChapterCreate(BaseModel):
    notebook_id: int
    name: str

class EntryCreate(BaseModel):
    chapter_id: int
    url: str
    notes: str = ""

class NoteUpdate(BaseModel):
    notes: str

class ReorderBody(BaseModel):
    chapter_ids: list[int]

class BulkDownloadItem(BaseModel):
    url: str
    start: str = ""
    end: str = ""

class BulkDownloadRequest(BaseModel):
    folder: str
    urls: list[BulkDownloadItem]
    transcribe: bool = False

class TrimRequest(BaseModel):
    video_path: str
    start: str = ""
    end: str = ""


# --- Media serving ---

@app.get("/media/{filepath:path}")
def serve_media(filepath: str):
    path = os.path.join(MEDIA_DIR, filepath)
    if not os.path.isfile(path):
        raise HTTPException(404, "File not found")
    return FileResponse(path)


# --- Notebook endpoints ---

@app.get("/api/notebooks")
def list_notebooks():
    db = get_db()
    rows = db.execute("SELECT * FROM notebooks ORDER BY created_at").fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.post("/api/notebooks")
def create_notebook(data: NameBody):
    db = get_db()
    cur = db.execute("INSERT INTO notebooks (name) VALUES (?)", (data.name,))
    db.commit()
    row = db.execute("SELECT * FROM notebooks WHERE id = ?", (cur.lastrowid,)).fetchone()
    db.close()
    return dict(row)


@app.put("/api/notebooks/{notebook_id}")
def rename_notebook(notebook_id: int, data: NameBody):
    db = get_db()
    db.execute("UPDATE notebooks SET name = ? WHERE id = ?", (data.name, notebook_id))
    db.commit()
    row = db.execute("SELECT * FROM notebooks WHERE id = ?", (notebook_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "Notebook not found")
    return dict(row)


@app.delete("/api/notebooks/{notebook_id}")
def delete_notebook(notebook_id: int):
    db = get_db()
    count = db.execute("SELECT COUNT(*) as cnt FROM notebooks").fetchone()["cnt"]
    if count <= 1:
        db.close()
        raise HTTPException(400, "Cannot delete the last notebook")
    db.execute("DELETE FROM notebooks WHERE id = ?", (notebook_id,))
    db.commit()
    db.close()
    return {"ok": True}


# --- Chapter endpoints ---

@app.get("/api/notebooks/{notebook_id}/chapters")
def list_chapters(notebook_id: int):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM chapters WHERE notebook_id = ? ORDER BY sort_order, created_at",
        (notebook_id,),
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.post("/api/chapters")
def create_chapter(data: ChapterCreate):
    db = get_db()
    # Set sort_order to max + 1 so new chapters appear at the end
    max_order = db.execute(
        "SELECT COALESCE(MAX(sort_order), -1) FROM chapters WHERE notebook_id = ?",
        (data.notebook_id,),
    ).fetchone()[0]
    cur = db.execute(
        "INSERT INTO chapters (notebook_id, name, sort_order) VALUES (?, ?, ?)",
        (data.notebook_id, data.name, max_order + 1),
    )
    db.commit()
    row = db.execute("SELECT * FROM chapters WHERE id = ?", (cur.lastrowid,)).fetchone()
    db.close()
    return dict(row)


@app.put("/api/chapters/reorder")
def reorder_chapters(data: ReorderBody):
    db = get_db()
    for i, chapter_id in enumerate(data.chapter_ids):
        db.execute("UPDATE chapters SET sort_order = ? WHERE id = ?", (i, chapter_id))
    db.commit()
    db.close()
    return {"ok": True}


@app.put("/api/chapters/{chapter_id}")
def rename_chapter(chapter_id: int, data: NameBody):
    db = get_db()
    db.execute("UPDATE chapters SET name = ? WHERE id = ?", (data.name, chapter_id))
    db.commit()
    row = db.execute("SELECT * FROM chapters WHERE id = ?", (chapter_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "Chapter not found")
    return dict(row)


@app.get("/api/chapters/{chapter_id}")
def get_chapter(chapter_id: int):
    db = get_db()
    row = db.execute("SELECT * FROM chapters WHERE id = ?", (chapter_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "Chapter not found")
    return dict(row)


@app.put("/api/chapters/{chapter_id}/notes")
def update_chapter_notes(chapter_id: int, data: NoteUpdate):
    db = get_db()
    db.execute("UPDATE chapters SET notes = ? WHERE id = ?", (data.notes, chapter_id))
    db.commit()
    row = db.execute("SELECT * FROM chapters WHERE id = ?", (chapter_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "Chapter not found")
    return dict(row)


@app.delete("/api/chapters/{chapter_id}")
def delete_chapter(chapter_id: int):
    db = get_db()
    db.execute("DELETE FROM chapters WHERE id = ?", (chapter_id,))
    db.commit()
    db.close()
    return {"ok": True}


# --- Entry endpoints ---

@app.get("/api/chapters/{chapter_id}/entries")
def list_entries(chapter_id: int):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM entries WHERE chapter_id = ? ORDER BY created_at",
        (chapter_id,),
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.post("/api/entries")
def create_entry(data: EntryCreate):
    # Look up notebook and chapter names for folder structure
    db = get_db()
    chapter = db.execute("SELECT * FROM chapters WHERE id = ?", (data.chapter_id,)).fetchone()
    if not chapter:
        db.close()
        raise HTTPException(404, "Chapter not found")
    notebook = db.execute("SELECT * FROM notebooks WHERE id = ?", (chapter["notebook_id"],)).fetchone()
    db.close()

    try:
        result = download_video(data.url, notebook["name"], chapter["name"])
    except Exception as e:
        raise HTTPException(400, f"Download failed: {e}")

    # Save initial notes as .txt alongside the video
    if data.notes:
        save_notes_file(result["video_path"], data.notes)

    db = get_db()
    cur = db.execute(
        """INSERT INTO entries (chapter_id, source_url, video_path, video_title, thumbnail_path, notes)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (data.chapter_id, data.url, result["video_path"], result["title"],
         result["thumbnail_path"], data.notes),
    )
    db.commit()
    row = db.execute("SELECT * FROM entries WHERE id = ?", (cur.lastrowid,)).fetchone()
    db.close()
    return dict(row)


@app.put("/api/entries/{entry_id}/notes")
def update_notes(entry_id: int, data: NoteUpdate):
    db = get_db()
    db.execute("UPDATE entries SET notes = ? WHERE id = ?", (data.notes, entry_id))
    db.commit()
    row = db.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "Entry not found")
    # Also save notes as .txt file alongside the video
    save_notes_file(row["video_path"], data.notes)
    return dict(row)


@app.post("/api/entries/{entry_id}/transcribe")
def transcribe_entry(entry_id: int):
    db = get_db()
    row = db.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "Entry not found")
    if not row["video_path"]:
        raise HTTPException(400, "No video to transcribe")

    # Skip if already transcribed
    if row["notes"] and "--- Transcription ---" in row["notes"]:
        return dict(row)

    try:
        transcript = transcribe_video(row["video_path"])
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {e}")

    # Append transcript to existing notes
    existing = row["notes"] or ""
    separator = "<p><br></p><p><strong>--- Transcription ---</strong></p>" if existing.strip() else "<p><strong>--- Transcription ---</strong></p>"
    updated_notes = existing + separator + "<p>" + transcript + "</p>"

    db = get_db()
    db.execute("UPDATE entries SET notes = ? WHERE id = ?", (updated_notes, entry_id))
    db.commit()
    entry = db.execute("SELECT * FROM entries WHERE id = ?", (entry_id,)).fetchone()
    db.close()
    save_notes_file(entry["video_path"], updated_notes)
    return dict(entry)


@app.delete("/api/entries/{entry_id}")
def delete_entry(entry_id: int):
    db = get_db()
    db.execute("DELETE FROM entries WHERE id = ?", (entry_id,))
    db.commit()
    db.close()
    return {"ok": True}


# --- Bulk Download ---

@app.post("/api/bulk/download")
def bulk_download_one(item: BulkDownloadItem, folder: str = ""):
    """Download a single video to a bulk folder."""
    if not folder:
        raise HTTPException(400, "Folder name required")
    try:
        result = download_video_to_folder(item.url, folder)
    except Exception as e:
        raise HTTPException(400, f"Download failed: {e}")

    # Trim if timestamps provided
    if item.start or item.end:
        try:
            trim_video(result["video_path"], item.start, item.end)
        except Exception as e:
            # Download succeeded but trim failed - return with warning
            result["trim_error"] = str(e)

    return result


@app.post("/api/bulk/transcribe")
def bulk_transcribe(video_path: str = ""):
    """Transcribe a bulk-downloaded video and save as .txt."""
    if not video_path:
        raise HTTPException(400, "video_path required")
    try:
        transcript = transcribe_video(video_path)
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {e}")

    save_notes_file(video_path, transcript)
    return {"transcript": transcript, "video_path": video_path}


@app.post("/api/trim")
def trim_entry_video(data: TrimRequest):
    """Trim any video by path."""
    try:
        trim_video(data.video_path, data.start, data.end)
    except Exception as e:
        raise HTTPException(500, f"Trim failed: {e}")
    return {"ok": True, "video_path": data.video_path}


@app.get("/api/bulk/folders")
def list_bulk_folders():
    """List all bulk download folders."""
    downloads_dir = os.path.join(MEDIA_DIR, "Downloads")
    if not os.path.isdir(downloads_dir):
        return []
    folders = []
    for name in sorted(os.listdir(downloads_dir)):
        folder_path = os.path.join(downloads_dir, name)
        if os.path.isdir(folder_path):
            files = [f for f in os.listdir(folder_path) if f.endswith(".mp4")]
            folders.append({"name": name, "video_count": len(files)})
    return folders


@app.get("/api/bulk/folders/{folder_name}")
def list_bulk_folder_contents(folder_name: str):
    """List videos in a bulk download folder."""
    folder_path = os.path.join(MEDIA_DIR, "Downloads", folder_name)
    if not os.path.isdir(folder_path):
        raise HTTPException(404, "Folder not found")
    videos = []
    for f in sorted(os.listdir(folder_path)):
        if f.endswith(".mp4"):
            video_path = os.path.join("Downloads", folder_name, f)
            txt_path = os.path.join(folder_path, os.path.splitext(f)[0] + ".txt")
            transcript = ""
            if os.path.isfile(txt_path):
                with open(txt_path, "r", encoding="utf-8") as tf:
                    transcript = tf.read()
            videos.append({
                "filename": f,
                "video_path": video_path,
                "title": os.path.splitext(f)[0].replace("_", " "),
                "has_transcript": bool(transcript),
                "transcript": transcript,
            })
    return videos


# --- Search ---

@app.get("/api/search")
def search(q: str = ""):
    if not q.strip():
        return []
    db = get_db()
    rows = db.execute(
        """SELECT entries.*, chapters.name as chapter_name
           FROM entries
           JOIN chapters ON entries.chapter_id = chapters.id
           WHERE entries.video_title LIKE ? OR entries.notes LIKE ?
           ORDER BY entries.created_at DESC""",
        (f"%{q}%", f"%{q}%"),
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


# --- HTML Export ---

@app.get("/api/chapters/{chapter_id}/export")
def export_chapter(chapter_id: int):
    db = get_db()
    chapter = db.execute("SELECT * FROM chapters WHERE id = ?", (chapter_id,)).fetchone()
    if not chapter:
        db.close()
        raise HTTPException(404, "Chapter not found")
    entries = db.execute(
        "SELECT * FROM entries WHERE chapter_id = ? ORDER BY created_at",
        (chapter_id,),
    ).fetchall()
    db.close()
    return templates.TemplateResponse("export.html", {
        "request": None,
        "chapter": dict(chapter),
        "entries": [dict(e) for e in entries],
    }, media_type="text/html")


# --- Main page ---

@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
