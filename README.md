# Myscician

A personal pitch-tracking singing tool for worship songs from YouTube.

## Features

- Add any YouTube song URL to your library
- Automatic audio download (yt-dlp), vocal isolation (Spleeter), and pitch extraction (pYIN)
- Practice sessions with a scrolling **note highway** (Guitar Hero style)
- Real-time microphone pitch detection overlaid on the reference melody
- Post-session accuracy scoring

---

## Setup

### Prerequisites

- Python 3.9+ (3.10 recommended)
- Node.js 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed and on your PATH
- ffmpeg installed and on your PATH (required by yt-dlp and Spleeter)

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will open at `http://localhost:5173`.

---

## Usage

1. Open `http://localhost:5173`
2. Click **+ Add Song** and paste a YouTube URL
3. Wait for the song to finish processing (status changes to **ready**)
4. Click **Practice** to open a practice session
5. Press **Start Singing** — the note highway will scroll and your mic pitch will be overlaid in real time
6. Press **Stop** to see your accuracy score

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI + Uvicorn |
| Database | SQLite via SQLModel |
| Audio download | yt-dlp |
| Vocal isolation | Spleeter (2-stem model) |
| Pitch extraction | librosa pYIN |
| Real-time mic pitch | WebSocket + librosa pYIN |
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| Data fetching | TanStack Query |
| Routing | React Router v7 |

---

## Notes

- First run of Spleeter will download the pretrained model (~100 MB) automatically.
- Audio files are stored in `backend/songs/` (gitignored).
- The app is intended for personal/local use only.
