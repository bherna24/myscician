import json
import logging
import os
from contextlib import asynccontextmanager
from typing import List, Optional
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlmodel import Session, SQLModel, create_engine, select

from models import Song, SongCreate, SongRead
from pipeline import run_pipeline
from mic_pitch import detect_pitch

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = "sqlite:///./myscician.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Thread pool for blocking pipeline work
executor = ThreadPoolExecutor(max_workers=2)


def get_session():
    with Session(engine) as session:
        yield session


@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    yield
    executor.shutdown(wait=False)


app = FastAPI(title="Myscician API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# REST routes
# ---------------------------------------------------------------------------

@app.get("/songs", response_model=List[SongRead])
def list_songs():
    with Session(engine) as session:
        songs = session.exec(select(Song)).all()
        return songs


@app.post("/songs", response_model=SongRead, status_code=201)
def add_song(payload: SongCreate, background_tasks: BackgroundTasks):
    with Session(engine) as session:
        song = Song(
            youtube_url=payload.youtube_url,
            title=payload.title or "",
            artist=payload.artist,
            status="pending",
        )
        session.add(song)
        session.commit()
        session.refresh(song)
        song_id = song.id

    background_tasks.add_task(_run_pipeline_bg, song_id)
    with Session(engine) as session:
        return session.get(Song, song_id)


def _run_pipeline_bg(song_id: int):
    with Session(engine) as session:
        run_pipeline(song_id, session)


@app.get("/songs/{song_id}", response_model=SongRead)
def get_song(song_id: int):
    with Session(engine) as session:
        song = session.get(Song, song_id)
        if not song:
            raise HTTPException(status_code=404, detail="Song not found")
        return song


@app.delete("/songs/{song_id}", status_code=204)
def delete_song(song_id: int):
    with Session(engine) as session:
        song = session.get(Song, song_id)
        if not song:
            raise HTTPException(status_code=404, detail="Song not found")
        session.delete(song)
        session.commit()


@app.get("/songs/{song_id}/status")
def get_song_status(song_id: int):
    with Session(engine) as session:
        song = session.get(Song, song_id)
        if not song:
            raise HTTPException(status_code=404, detail="Song not found")
        return {
            "id": song.id,
            "status": song.status,
            "error_message": song.error_message,
            "title": song.title,
        }


@app.get("/songs/{song_id}/pitches")
def get_song_pitches(song_id: int):
    with Session(engine) as session:
        song = session.get(Song, song_id)
        if not song:
            raise HTTPException(status_code=404, detail="Song not found")
        if song.status != "ready":
            raise HTTPException(
                status_code=409,
                detail=f"Song is not ready yet (status: {song.status})",
            )
        frames = json.loads(song.pitch_frames) if song.pitch_frames else []
        return {
            "id": song.id,
            "title": song.title,
            "duration": song.duration,
            "sample_rate": song.sample_rate,
            "hop_length": song.hop_length,
            "frames": frames,
            "audio_path": song.audio_path,
        }


@app.get("/songs/{song_id}/audio-url")
def get_audio_url(song_id: int):
    """Return the local file path for HTML5 Audio playback (dev only)."""
    with Session(engine) as session:
        song = session.get(Song, song_id)
        if not song:
            raise HTTPException(status_code=404, detail="Song not found")
        if not song.audio_path:
            raise HTTPException(status_code=404, detail="Audio not yet downloaded")
        return {"audio_path": song.audio_path}


@app.get("/songs/{song_id}/stream-audio")
def stream_audio(song_id: int):
    """Stream the downloaded audio file for HTML5 Audio playback."""
    with Session(engine) as session:
        song = session.get(Song, song_id)
        if not song:
            raise HTTPException(status_code=404, detail="Song not found")
        if not song.audio_path or not os.path.exists(song.audio_path):
            raise HTTPException(status_code=404, detail="Audio file not found on disk")
        return FileResponse(
            song.audio_path,
            media_type="audio/wav",
            headers={"Accept-Ranges": "bytes"},
        )


# ---------------------------------------------------------------------------
# WebSocket — real-time mic pitch detection
# ---------------------------------------------------------------------------

@app.websocket("/ws/pitch")
async def websocket_pitch(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket pitch connection opened")
    try:
        while True:
            data = await websocket.receive_bytes()
            result = detect_pitch(data)
            await websocket.send_text(json.dumps(result))
    except WebSocketDisconnect:
        logger.info("WebSocket pitch connection closed")
    except Exception as exc:
        logger.error("WebSocket error: %s", exc)
        await websocket.close()
