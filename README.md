# Digital Culture Notebook

A personal media notebook web app for saving videos with rich-text notes — like Evernote, but for videos. Supports downloading from YouTube, TikTok, Instagram, Facebook, and other platforms via yt-dlp.

![Screenshot](screenshot.png)

## Features

- **Notebooks** — Create multiple notebooks, each with its own set of chapters
- **Chapters** — Organize content into named chapters within a notebook, each with its own rich-text notes. Reorder chapters with drag-and-drop or arrow buttons
- **Video Entries** — Paste a URL, download the video locally, and write notes alongside it
- **Transcription** — Transcribe any video using Whisper (faster-whisper). Transcribe individual entries or all entries in a chapter at once. Already-transcribed entries are automatically skipped
- **Rich Text Editor** — Bold, italic, lists, and headings via Quill.js
- **Search** — Keyword search across all notes and video titles
- **Organized File Storage** — Videos and notes saved in `media/Notebook_Name/Chapter_Name/` with clean filenames
- **Fully Local** — No cloud, no accounts. Videos and notes stay on your machine

## Getting Started

### Step 1: Install Prerequisites

Before anything else, install these two things:

1. **Python 3.10+** — Download and install from [python.org](https://www.python.org/downloads/)
   - **Windows users:** During installation, make sure to check the box that says **"Add Python to PATH"**
   - **Mac users:** Python 3 may already be installed. Open Terminal and type `python3 --version` to check

2. **ffmpeg** — Needed for video processing and transcription
   - **Mac:** Open Terminal and run: `brew install ffmpeg` (requires [Homebrew](https://brew.sh))
   - **Windows:** Download from [ffmpeg.org](https://ffmpeg.org/download.html) and [add it to your PATH](https://www.wikihow.com/Install-FFmpeg-on-Windows)
   - **Linux:** `sudo apt install ffmpeg`

### Step 2: Download the App

1. Go to [the GitHub page](https://github.com/artificialnouveau/digital_culture_notebook)
2. Click the green **"Code"** button
3. Click **"Download ZIP"**
4. Unzip the downloaded file somewhere on your computer (e.g. your Desktop or Documents folder)

### Step 3: Run the App

**Mac / Linux:**
1. Open **Terminal**
2. Drag the unzipped `digital_culture_notebook` folder into the Terminal window (this types the path for you)
3. Type `cd ` (with a space) before the path, then press Enter
4. Type `./install_and_run.sh` and press Enter

Or copy-paste this (replace the path with where you unzipped it):
```bash
cd ~/Desktop/digital_culture_notebook
./install_and_run.sh
```

**Windows:**
1. Open the unzipped `digital_culture_notebook` folder
2. Double-click **`install_and_run.bat`**

The script will automatically install everything it needs (yt-dlp, Whisper, etc.) and start the app. This may take a few minutes the first time.

### Step 4: Open the App

Once the script says "Starting Digital Culture Notebook", open your browser and go to:

**[http://localhost:8080](http://localhost:8080)**

To stop the app, press `Ctrl+C` in the terminal window. To start it again later, just repeat Step 3.

---

## Advanced: Manual Setup

If you prefer to set things up yourself:

```bash
pip install -r requirements.txt
cd app
uvicorn main:app --port 8080
```

### What gets installed (requirements.txt)

| Package | Purpose |
|---------|---------|
| **fastapi** + **uvicorn** | Web server |
| **yt-dlp** | Video downloading (YouTube, TikTok, Instagram, Facebook, etc.) |
| **faster-whisper** | Local speech-to-text transcription |
| **jinja2** | HTML templating |
| **python-multipart** | Form data handling |

## Usage

1. **Create a notebook** — Use the notebook dropdown at the top of the sidebar; click **+** to create, **✏** to rename, **✕** to delete
2. **Create a chapter** — Type a name in the sidebar and click **+**
3. **Reorder chapters** — Hover to see ▲/▼ arrows, or drag and drop
4. **Add chapter notes** — Use the rich-text editor at the top of each chapter for general notes
5. **Add a video entry** — Paste a video URL (YouTube, TikTok, Instagram, Facebook, etc.) and click **Download & Save**
6. **Edit notes** — Each entry has its own rich-text editor; click **Save Notes** to persist (also saved as a .txt file alongside the video)
7. **Transcribe** — Click **Transcribe** on an entry to generate a transcript, or **Transcribe All** in the toolbar to transcribe every entry in the chapter (skips already-transcribed ones)
8. **Search** — Use the search bar in the sidebar to find entries by title or note content
9. **Delete** — Remove entries with the **Delete** button, or delete entire chapters from the sidebar

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
    notebook.db        # SQLite database (git-ignored)
```

## Notes

- Videos are stored locally in `app/media/` and served by the backend
- The database (`notebook.db`) is auto-created on first run
- For age-restricted or login-gated videos, the downloader attempts to use cookies from your browser (Chrome, Firefox, Safari)
- Transcription uses the `base` Whisper model by default. The model is downloaded automatically on first use (~150MB). Edit `transcriber.py` to change the model size (e.g. `small`, `medium`, `large-v3` for higher accuracy)
