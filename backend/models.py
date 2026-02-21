from typing import Optional
from sqlmodel import Field, SQLModel


class Song(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    artist: Optional[str] = None
    youtube_url: str
    status: str = Field(default="pending")  # pending | processing | ready | error
    error_message: Optional[str] = None
    audio_path: Optional[str] = None
    vocal_path: Optional[str] = None
    pitch_frames: Optional[str] = None  # JSON blob: [{time, hz, voiced}, ...]
    duration: Optional[float] = None    # seconds
    hop_length: int = Field(default=512)
    sample_rate: int = Field(default=16000)


class SongRead(SQLModel):
    id: int
    title: str
    artist: Optional[str]
    youtube_url: str
    status: str
    error_message: Optional[str]
    duration: Optional[float]


class SongCreate(SQLModel):
    youtube_url: str
    title: Optional[str] = None
    artist: Optional[str] = None
