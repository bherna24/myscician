import axios from "axios";

const BASE = "http://localhost:8000";

export interface SongRead {
  id: number;
  title: string;
  artist: string | null;
  youtube_url: string;
  status: "pending" | "processing" | "ready" | "error";
  error_message: string | null;
  duration: number | null;
}

export interface PitchFrame {
  time: number;
  hz: number | null;
  voiced: boolean;
}

export interface SongPitches {
  id: number;
  title: string;
  duration: number;
  sample_rate: number;
  hop_length: number;
  frames: PitchFrame[];
  audio_path: string;
}

export const api = {
  listSongs: () =>
    axios.get<SongRead[]>(`${BASE}/songs`).then((r) => r.data),

  addSong: (youtube_url: string, title?: string, artist?: string) =>
    axios
      .post<SongRead>(`${BASE}/songs`, { youtube_url, title, artist })
      .then((r) => r.data),

  getSong: (id: number) =>
    axios.get<SongRead>(`${BASE}/songs/${id}`).then((r) => r.data),

  deleteSong: (id: number) => axios.delete(`${BASE}/songs/${id}`),

  getSongStatus: (id: number) =>
    axios
      .get<{ id: number; status: string; error_message: string | null; title: string }>(
        `${BASE}/songs/${id}/status`
      )
      .then((r) => r.data),

  getSongPitches: (id: number) =>
    axios.get<SongPitches>(`${BASE}/songs/${id}/pitches`).then((r) => r.data),
};

export const WS_PITCH_URL = "ws://localhost:8000/ws/pitch";
