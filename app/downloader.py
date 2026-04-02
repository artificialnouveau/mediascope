import os
import re
import yt_dlp

MEDIA_DIR = os.path.join(os.path.dirname(__file__), "media")


def sanitize_name(name: str) -> str:
    """Remove special characters and replace spaces with underscores."""
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'\s+', '_', name.strip())
    name = re.sub(r'_+', '_', name)
    return name or "untitled"


def download_video(url: str, notebook_name: str, chapter_name: str) -> dict:
    """Download a video into media/notebook/chapter/ with sanitized filenames."""
    nb_folder = sanitize_name(notebook_name)
    ch_folder = sanitize_name(chapter_name)
    dest_dir = os.path.join(MEDIA_DIR, nb_folder, ch_folder)
    os.makedirs(dest_dir, exist_ok=True)

    base_opts = {
        "quiet": True,
        "no_warnings": True,
    }

    # Try with browser cookies first for age-restricted content
    cookie_attempts = [
        {"cookiesfrombrowser": ("chrome",)},
        {"cookiesfrombrowser": ("firefox",)},
        {"cookiesfrombrowser": ("safari",)},
        {},
    ]

    info = None
    last_error = None
    working_cookie_opt = {}
    for cookie_opt in cookie_attempts:
        try:
            with yt_dlp.YoutubeDL({**base_opts, **cookie_opt}) as ydl:
                info = ydl.extract_info(url, download=False)
            working_cookie_opt = cookie_opt
            break
        except Exception as e:
            last_error = e
            continue

    if info is None:
        raise last_error

    title = info.get("title", "Untitled")
    safe_title = sanitize_name(title)

    # Deduplicate filenames
    final_name = safe_title
    counter = 1
    while os.path.exists(os.path.join(dest_dir, f"{final_name}.mp4")):
        final_name = f"{safe_title}_{counter}"
        counter += 1

    output_template = os.path.join(dest_dir, f"{final_name}.%(ext)s")

    ydl_opts = {
        **base_opts,
        **working_cookie_opt,
        "outtmpl": output_template,
        "format": "best[ext=mp4]/best",
        "merge_output_format": "mp4",
        "writethumbnail": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    # Find the downloaded video file
    video_filename = None
    for f in os.listdir(dest_dir):
        if f.startswith(final_name) and f.endswith(".mp4"):
            video_filename = f
            break
    if not video_filename:
        for f in os.listdir(dest_dir):
            if f.startswith(final_name) and not f.endswith((".jpg", ".png", ".webp", ".txt")):
                video_filename = f
                break

    # Find thumbnail
    thumbnail_filename = None
    for f in os.listdir(dest_dir):
        if f.startswith(final_name) and f.endswith((".jpg", ".png", ".webp")):
            thumbnail_filename = f
            break

    if not video_filename:
        raise RuntimeError("Download completed but video file not found")

    # Relative paths from media/ for serving
    video_path = os.path.join(nb_folder, ch_folder, video_filename)
    thumbnail_path = os.path.join(nb_folder, ch_folder, thumbnail_filename) if thumbnail_filename else None

    return {
        "title": title,
        "video_path": video_path,
        "thumbnail_path": thumbnail_path,
    }


def download_video_to_folder(url: str, folder_name: str) -> dict:
    """Download a video into media/Downloads/folder_name/ with sanitized filenames."""
    safe_folder = sanitize_name(folder_name)
    dest_dir = os.path.join(MEDIA_DIR, "Downloads", safe_folder)
    os.makedirs(dest_dir, exist_ok=True)

    base_opts = {"quiet": True, "no_warnings": True}

    cookie_attempts = [
        {"cookiesfrombrowser": ("chrome",)},
        {"cookiesfrombrowser": ("firefox",)},
        {"cookiesfrombrowser": ("safari",)},
        {},
    ]

    info = None
    last_error = None
    working_cookie_opt = {}
    for cookie_opt in cookie_attempts:
        try:
            with yt_dlp.YoutubeDL({**base_opts, **cookie_opt}) as ydl:
                info = ydl.extract_info(url, download=False)
            working_cookie_opt = cookie_opt
            break
        except Exception as e:
            last_error = e
            continue

    if info is None:
        raise last_error

    title = info.get("title", "Untitled")
    safe_title = sanitize_name(title)

    final_name = safe_title
    counter = 1
    while os.path.exists(os.path.join(dest_dir, f"{final_name}.mp4")):
        final_name = f"{safe_title}_{counter}"
        counter += 1

    output_template = os.path.join(dest_dir, f"{final_name}.%(ext)s")

    ydl_opts = {
        **base_opts,
        **working_cookie_opt,
        "outtmpl": output_template,
        "format": "best[ext=mp4]/best",
        "merge_output_format": "mp4",
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    video_filename = None
    for f in os.listdir(dest_dir):
        if f.startswith(final_name) and f.endswith(".mp4"):
            video_filename = f
            break
    if not video_filename:
        for f in os.listdir(dest_dir):
            if f.startswith(final_name) and not f.endswith((".jpg", ".png", ".webp", ".txt")):
                video_filename = f
                break

    if not video_filename:
        raise RuntimeError("Download completed but video file not found")

    video_path = os.path.join("Downloads", safe_folder, video_filename)

    return {
        "title": title,
        "video_path": video_path,
        "filename": video_filename,
    }


def trim_video(video_path: str, start: str, end: str) -> str:
    """Trim a video using ffmpeg. start/end are timestamps like '00:01:30' or '90'.
    Returns the relative path to the trimmed video."""
    import subprocess

    full_path = os.path.join(MEDIA_DIR, video_path)
    if not os.path.isfile(full_path):
        raise FileNotFoundError(f"Video not found: {full_path}")

    base, ext = os.path.splitext(full_path)
    trimmed_path = f"{base}_trimmed{ext}"

    cmd = ["ffmpeg", "-y", "-i", full_path]
    if start:
        cmd += ["-ss", start]
    if end:
        cmd += ["-to", end]
    cmd += ["-c", "copy", trimmed_path]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        # Fallback: re-encode if stream copy fails
        cmd2 = ["ffmpeg", "-y", "-i", full_path]
        if start:
            cmd2 += ["-ss", start]
        if end:
            cmd2 += ["-to", end]
        cmd2 += [trimmed_path]
        result2 = subprocess.run(cmd2, capture_output=True, text=True)
        if result2.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {result2.stderr}")

    # Replace original with trimmed
    os.replace(trimmed_path, full_path)

    return video_path


def save_notes_file(video_path: str, notes: str):
    """Save notes as a .txt file alongside the video with the same name."""
    if not video_path:
        return
    full_path = os.path.join(MEDIA_DIR, video_path)
    base = os.path.splitext(full_path)[0]
    txt_path = base + ".txt"
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(notes)
