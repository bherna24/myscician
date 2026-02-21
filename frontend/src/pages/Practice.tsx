import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSongPitches } from "../hooks/useSongPitches";
import { useMicPitch } from "../hooks/useMicPitch";
import { NoteHighway } from "../components/NoteHighway";
import { AccuracyPanel } from "../components/AccuracyPanel";
import type { PitchFrame } from "../api";

interface UserFrame {
  time: number;
  hz: number | null;
  voiced: boolean;
}

function computeAccuracy(
  userFrames: UserFrame[],
  refFrames: PitchFrame[]
): { score: number; total: number; matched: number } {
  const voicedUser = userFrames.filter((f) => f.voiced && f.hz !== null);
  if (voicedUser.length === 0) return { score: 0, total: 0, matched: 0 };

  let matched = 0;
  for (const uf of voicedUser) {
    const closest = refFrames.reduce<PitchFrame | null>((best, rf) => {
      if (!rf.voiced || rf.hz === null) return best;
      if (!best) return rf;
      return Math.abs(rf.time - uf.time) < Math.abs(best.time - uf.time) ? rf : best;
    }, null);

    if (closest && closest.hz) {
      const cents = Math.abs(1200 * Math.log2(uf.hz! / closest.hz));
      if (cents <= 100) matched++;
    }
  }

  return {
    score: (matched / voicedUser.length) * 100,
    total: voicedUser.length,
    matched,
  };
}

export function Practice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const songId = id ? parseInt(id, 10) : null;

  const { data: songData, isLoading, isError } = useSongPitches(songId);

  const [isPlaying, setIsPlaying] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [userFrames, setUserFrames] = useState<UserFrame[]>([]);
  const [sessionDone, setSessionDone] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const sessionStartRef = useRef<number>(0);

  const livePitch = useMicPitch(micActive);

  // Record user pitch frames while playing
  useEffect(() => {
    if (!micActive || !isPlaying) return;
    const frame: UserFrame = {
      time: currentTime,
      hz: livePitch.hz,
      voiced: livePitch.voiced,
    };
    setUserFrames((prev) => [...prev, frame]);
  }, [livePitch, currentTime, isPlaying, micActive]);

  // Animation loop to update currentTime from audio element
  const tick = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, tick]);

  // Audio element: use the backend-served local file via a blob approach
  // In development, we serve the file path directly from the backend
  const audioSrc = songData
    ? `http://localhost:8000/songs/${songData.id}/stream-audio`
    : undefined;

  const handleStart = async () => {
    setUserFrames([]);
    setSessionDone(false);
    setMicActive(true);
    setCurrentTime(0);
    sessionStartRef.current = Date.now();

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      await audioRef.current.play().catch(() => {
        // Autoplay may be blocked; the user can press play manually
      });
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
    setMicActive(false);
    setSessionDone(true);
  };

  const accuracy =
    sessionDone && songData
      ? computeAccuracy(userFrames, songData.frames)
      : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center">
        <p className="text-white/40 text-lg">Loading song data…</p>
      </div>
    );
  }

  if (isError || !songData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg">Failed to load song.</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 text-white/50 hover:text-white underline text-sm"
          >
            Back to library
          </button>
        </div>
      </div>
    );
  }

  const duration = songData.duration ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 p-6 md:p-10">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="rounded-lg border border-white/10 p-2 text-white/40 hover:text-white transition-colors"
          >
            ←
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{songData.title}</h1>
            <p className="text-sm text-white/40">Practice Session</p>
          </div>
        </div>

        {/* Note Highway */}
        <NoteHighway
          referenceFrames={songData.frames}
          userPitchHistory={userFrames}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
        />

        {/* Playback progress bar */}
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
          />
        </div>

        {/* Time */}
        <div className="flex justify-between text-xs text-white/30">
          <span>
            {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}
          </span>
          <span>
            {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, "0")}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {!isPlaying ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              <span>▶</span> Start Singing
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-8 py-3 font-semibold text-white hover:bg-red-500 transition-colors"
            >
              <span>■</span> Stop
            </button>
          )}
        </div>

        {/* Live pitch indicator */}
        {micActive && (
          <div className="flex items-center justify-center gap-3">
            <div
              className={`h-2.5 w-2.5 rounded-full ${livePitch.voiced ? "bg-green-400 animate-pulse" : "bg-white/20"}`}
            />
            <span className="text-sm text-white/50">
              {livePitch.voiced && livePitch.hz
                ? `${livePitch.hz.toFixed(1)} Hz`
                : "Listening…"}
            </span>
          </div>
        )}

        {/* Accuracy results */}
        {sessionDone && accuracy && (
          <AccuracyPanel
            score={accuracy.score}
            totalFrames={accuracy.total}
            matchedFrames={accuracy.matched}
          />
        )}

        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          src={audioSrc}
          onEnded={handleStop}
          preload="auto"
          style={{ display: "none" }}
        />

        {/* Mic permission info */}
        {!micActive && !sessionDone && (
          <p className="text-center text-xs text-white/25">
            Microphone access will be requested when you start.
          </p>
        )}
      </div>
    </div>
  );
}
