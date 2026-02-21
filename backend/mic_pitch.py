"""
Server-side real-time pitch detection on raw PCM float32 chunks
received over WebSocket.
"""
import numpy as np
import librosa

SAMPLE_RATE = 16000
HOP_LENGTH = 256
FMIN = librosa.note_to_hz("C2")
FMAX = librosa.note_to_hz("C7")

# Minimum number of samples needed for a reliable pYIN estimate
MIN_SAMPLES = 2048


def detect_pitch(pcm_bytes: bytes, sample_rate: int = SAMPLE_RATE) -> dict:
    """
    Receive raw float32 little-endian PCM bytes, return {hz, voiced}.
    If the chunk is too short or no voiced pitch is detected, returns
    {hz: null, voiced: false}.
    """
    if len(pcm_bytes) < MIN_SAMPLES * 4:
        return {"hz": None, "voiced": False}

    y = np.frombuffer(pcm_bytes, dtype=np.float32).copy()

    if len(y) < MIN_SAMPLES:
        return {"hz": None, "voiced": False}

    try:
        f0, voiced_flag, _ = librosa.pyin(
            y,
            fmin=FMIN,
            fmax=FMAX,
            sr=sample_rate,
            hop_length=HOP_LENGTH,
        )
        # Take the last voiced frame as the "current" pitch
        voiced_indices = np.where(voiced_flag)[0]
        if len(voiced_indices) == 0:
            return {"hz": None, "voiced": False}

        last_voiced = voiced_indices[-1]
        hz_val = float(f0[last_voiced])
        if np.isnan(hz_val):
            return {"hz": None, "voiced": False}

        return {"hz": round(hz_val, 2), "voiced": True}

    except Exception:
        return {"hz": None, "voiced": False}
