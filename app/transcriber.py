import os
from faster_whisper import WhisperModel

MEDIA_DIR = os.path.join(os.path.dirname(__file__), "media")

_model = None


def get_model():
    global _model
    if _model is None:
        _model = WhisperModel("base", device="cpu", compute_type="int8")
    return _model


def transcribe_video(video_path: str) -> str:
    """Transcribe a video file and return the text."""
    full_path = os.path.join(MEDIA_DIR, video_path)
    if not os.path.isfile(full_path):
        raise FileNotFoundError(f"Video not found: {full_path}")

    model = get_model()
    segments, _ = model.transcribe(full_path, beam_size=5)

    lines = []
    for segment in segments:
        lines.append(segment.text.strip())

    return " ".join(lines)
