# Digital Culture Notebook

A personal media notebook web app for saving videos with rich-text notes — like Evernote, but for videos. Supports downloading from YouTube, TikTok, Instagram, Facebook, and other platforms via yt-dlp.

![Screenshot](screenshot.png)

## Features

- **Notebooks & Chapters** — Create multiple notebooks, each with named chapters. Reorder chapters with drag-and-drop or arrow buttons. Each chapter shows its file save path
- **Video Entries** — Paste a URL, download the video locally, and write notes alongside it. Progress bar shown during download
- **Transcription** — Transcribe any video using Whisper (faster-whisper) into a dedicated transcript section separate from your notes. Transcribe individual entries or all entries at once
- **Video Trimming** — Trim videos by start/end timestamps. The original video is preserved and a new entry is created for each trim
- **Scene Splitting** — Detect scene changes in a video using perceptual frame hashing (runs in-browser). Preview detected scenes with thumbnails, then save individual scenes or all scenes as separate entries
- **Semantic Search (RAG)** — Build a search index from transcripts, then search by meaning using sentence embeddings. Uses `sentence-transformers` (server-side) for indexing and `Transformers.js` (client-side) for querying. Click "Build Index" to create; rebuild after adding new videos
- **Bulk Download** — Download multiple videos at once into a named folder. Optionally transcribe all after download
- **Keyword Search** — Search across all notes and video titles from the sidebar
- **Rich Text Editor** — Bold, italic, lists, and headings via Quill.js
- **Organized File Storage** — Videos and notes saved in `media/Notebook_Name/Chapter_Name/` with clean filenames. Folder paths shown in the UI
- **Fully Local** — No cloud, no accounts. Videos and notes stay on your machine

## Getting Started

### Step 1: Install Python

If you don't have Python installed yet:

1. Go to [python.org/downloads](https://www.python.org/downloads/)
2. Download and install **Python 3.10 or newer**
3. **Windows users:** During installation, check the box that says **"Add Python to PATH"**

*(Mac users: Python 3 may already be installed. The launcher will tell you if it's missing.)*

### Step 2: Download the App

1. Click this link: [**Download ZIP**](https://github.com/artificialnouveau/digital_culture_notebook/archive/refs/heads/main.zip)
2. Unzip the downloaded file (double-click it)

### Step 3: Run the App

**Mac:**
- Open the unzipped folder and double-click **`install_and_run.command`**
- If macOS says the file can't be opened: right-click it, choose **Open**, then click **Open** again

**Windows:**
- Open the unzipped folder and double-click **`install_and_run.bat`**

That's it! The script automatically installs everything needed — including **Homebrew** and **ffmpeg** if they're missing (Mac) — and opens the app in your browser. The first launch takes a few minutes while dependencies install.

> **Windows note:** ffmpeg is not auto-installed on Windows. If the script warns about it missing, download from [ffmpeg.org](https://ffmpeg.org/download.html) and [add it to PATH](https://www.wikihow.com/Install-FFmpeg-on-Windows). Without ffmpeg, video downloading still works but trimming, scene splitting, and transcription won't.

To stop the app, close the terminal window or press `Ctrl+C`.

### Running it again later

After the first install, use the quick launcher instead:

- **Mac:** Double-click **`Digital Culture Notebook.command`**
- **Windows:** Double-click **`Digital Culture Notebook.bat`**

**Tip:** Drag this file to your Dock (Mac) or pin to Taskbar (Windows) for easy access.

---

## Usage

### Basic Workflow

1. **Create a notebook** — Use the notebook dropdown; click **+** to create, **✏** to rename, **✕** to delete
2. **Create a chapter** — Type a name in the sidebar and click **+**
3. **Add a video entry** — Paste a video URL and click **Download & Save**
4. **Edit notes** — Each entry has its own rich-text editor; click **Save Notes** to persist

### Transcription

- Click **Transcribe** on any entry to generate a transcript (appears in a dedicated section below notes)
- Click **Transcribe All** in the toolbar to transcribe every entry in the chapter
- Already-transcribed entries are automatically skipped

### Video Trimming

- Enter start/end timestamps (e.g. `00:01:00`, `00:02:30`) and click **Trim**
- The original video is kept; a new entry is created for the trimmed clip

### Scene Splitting

1. Click **Split Scenes** on any entry
2. Adjust sensitivity (lower = more scenes detected) and sample interval
3. Click **Detect Scenes** — the app analyzes frames in-browser using perceptual hashing
4. Preview detected scenes with thumbnails. Click a thumbnail to preview in the video player
5. Save individual scenes, selected scenes, or all scenes at once — each becomes a new entry

### Semantic Search (RAG)

1. Transcribe your videos first (the index is built from transcripts)
2. Click **Build Index** in the toolbar — this generates embeddings using `all-MiniLM-L6-v2`
3. A search box appears. Type a query like "protest movements" or "economic impact" — results are ranked by semantic similarity
4. **Rebuild the index** after adding or transcribing new videos

### Bulk Download

1. Click **Bulk Download** in the sidebar
2. Enter a folder name and paste multiple URLs (one per line)
3. Optionally check "Transcribe after download"
4. Click **Download All** — progress bar tracks each download

## Advanced: Manual Setup

```bash
pip install -r requirements.txt
cd app
uvicorn main:app --port 8080
```

### Dependencies (requirements.txt)

| Package | Purpose |
|---------|---------|
| **fastapi** + **uvicorn** | Web server |
| **yt-dlp** | Video downloading (YouTube, TikTok, Instagram, Facebook, etc.) |
| **faster-whisper** | Local speech-to-text transcription |
| **sentence-transformers** | Semantic search index building (all-MiniLM-L6-v2) |
| **jinja2** | HTML templating |
| **python-multipart** | Form data handling |

Client-side libraries (loaded via CDN, no install needed):
- **Quill.js** — Rich text editor
- **Transformers.js** — In-browser semantic search queries (Xenova/all-MiniLM-L6-v2)

## Supported Platforms

yt-dlp supports [1000+ sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md), including:
- YouTube
- TikTok
- Instagram (Reels, posts)
- Facebook (Reels, videos)
- Twitter/X
- Reddit
- Vimeo
- And many more

## Project Structure

```
digital_culture_notebook/
  install_and_run.sh   # One-click setup & launch (macOS/Linux)
  install_and_run.bat  # One-click setup & launch (Windows)
  requirements.txt     # Python dependencies
  app/
    main.py            # FastAPI backend (API + page serving)
    database.py        # SQLite setup and migrations
    downloader.py      # yt-dlp wrapper with browser cookie support
    transcriber.py     # Whisper transcription wrapper
    templates/         # Jinja2 HTML templates
    static/            # CSS, JS, icon
    media/             # Downloaded videos and notes (git-ignored)
      My_Notebook/
        Chapter_1/
          video_title.mp4
          video_title.txt   # Notes saved alongside video
          index.json        # Semantic search index (after building)
    notebook.db        # SQLite database (git-ignored)
```

## Notes

- Videos are stored locally in `app/media/` and served by the backend
- The database (`notebook.db`) is auto-created on first run
- For age-restricted or login-gated videos, the downloader attempts to use cookies from your browser (Chrome, Firefox, Safari)
- Transcription uses the `base` Whisper model by default. The model is downloaded automatically on first use (~150MB). Edit `transcriber.py` to change the model size (e.g. `small`, `medium`, `large-v3` for higher accuracy)
- The semantic search model (`all-MiniLM-L6-v2`) is downloaded on first index build (~90MB)
- Scene detection runs entirely in the browser — no server resources needed
