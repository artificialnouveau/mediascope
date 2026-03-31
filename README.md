# Digital Culture Notebook

A personal media notebook web app for saving videos with rich-text notes — like Evernote, but for videos. Supports downloading from YouTube, TikTok, Instagram, and other platforms via yt-dlp.

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

## Setup

### Requirements

- Python 3.10+
- [ffmpeg](https://ffmpeg.org/) (required by yt-dlp and faster-whisper for audio/video processing)

On macOS with Homebrew:
```bash
brew install ffmpeg
```

On Ubuntu/Debian:
```bash
sudo apt install ffmpeg
```

### Install Python dependencies

```bash
pip install -r requirements.txt
```

This installs:
- **fastapi** + **uvicorn** — Web server
- **yt-dlp** — Video downloading (YouTube, TikTok, Instagram, etc.)
- **faster-whisper** — Local speech-to-text transcription
- **jinja2** — HTML templating
- **python-multipart** — Form data handling

### Run

```bash
cd app
uvicorn main:app --reload --port 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

### macOS Desktop App (optional)

A `Media Notebook.app` can be placed on your Desktop to launch the server and open your browser with one click. To set it up:

1. Copy the `Media Notebook.app` bundle to your Desktop (or Applications folder)
2. Edit `Contents/MacOS/launch` and set `APP_DIR` to the full path of your `app/` folder
3. Double-click to launch

If macOS blocks it on first run, right-click the app and choose **Open**, or go to **System Settings > Privacy & Security** and click **Open Anyway**.

## Usage

1. **Create a notebook** — Use the notebook dropdown at the top of the sidebar; click **+** to create, **✏** to rename, **✕** to delete
2. **Create a chapter** — Type a name in the sidebar and click **+**
3. **Reorder chapters** — Hover to see ▲/▼ arrows, or drag and drop
4. **Add chapter notes** — Use the rich-text editor at the top of each chapter for general notes
5. **Add a video entry** — Paste a video URL (YouTube, TikTok, Instagram, etc.) and click **Download & Save**
6. **Edit notes** — Each entry has its own rich-text editor; click **Save Notes** to persist (also saved as a .txt file alongside the video)
7. **Transcribe** — Click **Transcribe** on an entry to generate a transcript, or **Transcribe All** in the toolbar to transcribe every entry in the chapter (skips already-transcribed ones)
8. **Search** — Use the search bar in the sidebar to find entries by title or note content
9. **Delete** — Remove entries with the **Delete** button, or delete entire chapters from the sidebar

## Project Structure

```
app/
  main.py          # FastAPI backend (API + page serving)
  database.py      # SQLite setup and migrations
  downloader.py    # yt-dlp wrapper with browser cookie support
  transcriber.py   # Whisper transcription wrapper
  templates/       # Jinja2 HTML templates
  static/          # CSS, JS, icon
  media/           # Downloaded videos and notes (git-ignored)
    My_Notebook/
      Chapter_1/
        video_title.mp4
        video_title.txt   # Notes saved alongside video
  notebook.db      # SQLite database (git-ignored)
requirements.txt
```

## Notes

- Videos are stored locally in `app/media/` and served by the backend
- The database (`notebook.db`) is auto-created on first run
- For age-restricted YouTube videos, the downloader attempts to use cookies from your browser (Chrome, Firefox, Safari)
- Transcription uses the `base` Whisper model by default. The model is downloaded automatically on first use (~150MB). Edit `transcriber.py` to change the model size (e.g. `small`, `medium`, `large-v3` for higher accuracy)
