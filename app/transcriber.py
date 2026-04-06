import os
from faster_whisper import WhisperModel

MEDIA_DIR = os.path.join(os.path.dirname(__file__), "media")

_model = None
_diarize_pipeline = None


def get_model():
    global _model
    if _model is None:
        _model = WhisperModel("base", device="cpu", compute_type="int8")
    return _model


def _get_diarize_pipeline():
    """Load pyannote speaker diarization pipeline. Returns None if not available."""
    global _diarize_pipeline
    if _diarize_pipeline is not None:
        return _diarize_pipeline
    try:
        from pyannote.audio import Pipeline
        hf_token = os.environ.get("HF_TOKEN", "")
        if not hf_token:
            # Check for token file
            token_path = os.path.expanduser("~/.huggingface/token")
            if os.path.isfile(token_path):
                with open(token_path) as f:
                    hf_token = f.read().strip()
        if not hf_token:
            return None
        _diarize_pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=hf_token,
        )
        return _diarize_pipeline
    except Exception:
        return None


def is_diarization_available():
    """Check if speaker diarization is available."""
    try:
        import pyannote.audio  # noqa
        hf_token = os.environ.get("HF_TOKEN", "")
        if not hf_token:
            token_path = os.path.expanduser("~/.huggingface/token")
            if os.path.isfile(token_path):
                return True
        return bool(hf_token)
    except ImportError:
        return False


def _format_timestamp(seconds):
    """Format seconds as HH:MM:SS or MM:SS."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def transcribe_video(video_path: str, diarize: bool = False) -> str:
    """Transcribe a video file and return timestamped text.
    If diarize=True and pyannote is available, includes speaker labels."""
    full_path = os.path.join(MEDIA_DIR, video_path)
    if not os.path.isfile(full_path):
        raise FileNotFoundError(f"Video not found: {full_path}")

    model = get_model()
    segments, info = model.transcribe(full_path, beam_size=5)
    whisper_segments = []
    for segment in segments:
        text = segment.text.strip()
        if text:
            whisper_segments.append({
                "start": segment.start,
                "end": segment.end,
                "text": text,
            })

    if not diarize or not whisper_segments:
        return "\n".join(
            f"[{_format_timestamp(s['start'])} - {_format_timestamp(s['end'])}] {s['text']}"
            for s in whisper_segments
        )

    # Attempt speaker diarization
    pipeline = _get_diarize_pipeline()
    if pipeline is None:
        # Fall back to regular transcription
        return "\n".join(
            f"[{_format_timestamp(s['start'])} - {_format_timestamp(s['end'])}] {s['text']}"
            for s in whisper_segments
        )

    # Run diarization
    diarization = pipeline(full_path)

    # Build speaker timeline: list of (start, end, speaker)
    speaker_turns = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        speaker_turns.append((turn.start, turn.end, speaker))

    # Assign speakers to whisper segments by overlap
    def get_speaker(seg_start, seg_end):
        best_speaker = None
        best_overlap = 0
        for turn_start, turn_end, speaker in speaker_turns:
            overlap_start = max(seg_start, turn_start)
            overlap_end = min(seg_end, turn_end)
            overlap = max(0, overlap_end - overlap_start)
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = speaker
        return best_speaker or "Unknown"

    # Normalize speaker names to "Speaker 1", "Speaker 2", etc.
    speaker_map = {}
    speaker_counter = 0
    lines = []
    for s in whisper_segments:
        raw_speaker = get_speaker(s["start"], s["end"])
        if raw_speaker not in speaker_map:
            speaker_counter += 1
            speaker_map[raw_speaker] = f"Speaker {speaker_counter}"
        label = speaker_map[raw_speaker]
        start = _format_timestamp(s["start"])
        end = _format_timestamp(s["end"])
        lines.append(f"[{start} - {end}] {label}: {s['text']}")

    return "\n".join(lines)
