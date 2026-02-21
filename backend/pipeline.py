"""
Audio processing pipeline:
  1. yt-dlp  → download audio as 16kHz mono WAV
  2. Spleeter → isolate vocals stem
  3. librosa pYIN → extract pitch frames
  4. Persist results to SQLite via SQLModel
"""
import json
import os
import subprocess
import logging
from pathlib import Path
from typing import Optional

import numpy as np
import librosa
import soundfile as sf
from sqlmodel import Session

from models import Song

logger = logging.getLogger(__name__)

SONGS_DIR = Path(__file__).parent / "songs"
SONGS_DIR.mkdir(exist_ok=True)

SAMPLE_RATE = 16000
HOP_LENGTH = 512
FMIN = librosa.note_to_hz("C2")
FMAX = librosa.note_to_hz("C7")


def _song_dir(song_id: int) -> Path:
    d = SONGS_DIR / str(song_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def download_audio(youtube_url: str, output_path: Path) -> Path:
    """Download YouTube audio as 16kHz mono WAV using yt-dlp."""
    wav_path = output_path / "audio.wav"
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--extract-audio",
        "--audio-format", "wav",
        "--audio-quality", "0",
        "--postprocessor-args", f"-ar {SAMPLE_RATE} -ac 1",
        "-o", str(wav_path.with_suffix("")) + ".%(ext)s",
        youtube_url,
    ]
    logger.info("Downloading audio: %s", youtube_url)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {result.stderr}")
    # yt-dlp may produce e.g. audio.opus.wav — find the resulting wav
    wav_files = list(output_path.glob("*.wav"))
    if not wav_files:
        raise FileNotFoundError("yt-dlp did not produce a WAV file")
    return wav_files[0]


def separate_vocals(audio_path: Path, output_dir: Path) -> Path:
    """Run Spleeter 2stems to isolate the vocal track."""
    try:
        from spleeter.separator import Separator
    except ImportError:
        logger.warning("Spleeter not installed; skipping vocal separation")
        return audio_path

    logger.info("Separating vocals with Spleeter...")
    separator = Separator("spleeter:2stems")
    separator.separate_to_file(
        str(audio_path),
        str(output_dir),
        codec="wav",
        synchronous=True,
    )
    stem_name = audio_path.stem
    vocal_path = output_dir / stem_name / "vocals.wav"
    if not vocal_path.exists():
        logger.warning("Spleeter vocal output not found at %s; using full mix", vocal_path)
        return audio_path
    return vocal_path


def extract_pitch(vocal_path: Path) -> tuple[list[dict], float, int, int]:
    """
    Run librosa pYIN on the vocal track.
    Returns (pitch_frames, duration, sample_rate, hop_length).
    pitch_frames is a list of {time, hz, voiced} dicts.
    """
    logger.info("Extracting pitch with pYIN from %s", vocal_path)
    y, sr = librosa.load(str(vocal_path), sr=SAMPLE_RATE, mono=True)
    duration = float(len(y)) / sr

    f0, voiced_flag, voiced_probs = librosa.pyin(
        y,
        fmin=FMIN,
        fmax=FMAX,
        sr=sr,
        hop_length=HOP_LENGTH,
    )

    times = librosa.times_like(f0, sr=sr, hop_length=HOP_LENGTH)

    frames = []
    for t, hz, v in zip(times.tolist(), f0.tolist(), voiced_flag.tolist()):
        frames.append({
            "time": round(float(t), 4),
            "hz": round(float(hz), 3) if (hz is not None and not np.isnan(hz)) else None,
            "voiced": bool(v),
        })

    return frames, duration, sr, HOP_LENGTH


def fetch_youtube_title(youtube_url: str) -> Optional[str]:
    """Fetch the video title without downloading the full video."""
    try:
        result = subprocess.run(
            ["yt-dlp", "--get-title", "--no-playlist", youtube_url],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return None


def run_pipeline(song_id: int, session: Session) -> None:
    """
    Full pipeline: download → separate → extract → persist.
    Updates the Song row's status as it progresses.
    """
    song = session.get(Song, song_id)
    if song is None:
        raise ValueError(f"Song {song_id} not found")

    output_dir = _song_dir(song_id)

    try:
        # Step 0: fetch title if not provided
        if not song.title:
            title = fetch_youtube_title(song.youtube_url) or f"Song {song_id}"
            song.title = title
            session.add(song)
            session.commit()

        # Step 1: download
        song.status = "processing"
        session.add(song)
        session.commit()

        audio_path = download_audio(song.youtube_url, output_dir)
        song.audio_path = str(audio_path)
        session.add(song)
        session.commit()

        # Step 2: vocal separation
        vocal_path = separate_vocals(audio_path, output_dir)
        song.vocal_path = str(vocal_path)
        session.add(song)
        session.commit()

        # Step 3: pitch extraction
        frames, duration, sr, hop = extract_pitch(vocal_path)
        song.pitch_frames = json.dumps(frames)
        song.duration = duration
        song.sample_rate = sr
        song.hop_length = hop
        song.status = "ready"
        session.add(song)
        session.commit()

        logger.info("Pipeline complete for song %d (%s)", song_id, song.title)

    except Exception as exc:
        logger.exception("Pipeline failed for song %d: %s", song_id, exc)
        song.status = "error"
        song.error_message = str(exc)
        session.add(song)
        session.commit()
        raise
