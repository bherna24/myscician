import { useEffect, useRef } from "react";
import { PitchFrame } from "../api";

interface Props {
  referenceFrames: PitchFrame[];
  userPitchHistory: Array<{ time: number; hz: number | null; voiced: boolean }>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

const FMIN = 65.41;   // C2
const FMAX = 2093.0;  // C7
const WINDOW_SEC = 5; // seconds visible on screen at once

function hzToLogY(hz: number, canvasH: number): number {
  const logMin = Math.log2(FMIN);
  const logMax = Math.log2(FMAX);
  const logHz = Math.log2(Math.max(hz, FMIN));
  const frac = (logHz - logMin) / (logMax - logMin);
  return canvasH - frac * canvasH;
}

function centDiff(hzA: number, hzB: number): number {
  return 1200 * Math.log2(hzA / hzB);
}

function pitchColor(userHz: number, refHz: number): string {
  const diff = Math.abs(centDiff(userHz, refHz));
  if (diff <= 50) return "#4ade80";  // green — in tune
  if (diff <= 100) return "#facc15"; // yellow — close
  return "#f87171";                  // red — off
}

export function NoteHighway({
  referenceFrames,
  userPitchHistory,
  currentTime,
  duration,
  isPlaying,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Clear
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(0, 0, W, H);

    const windowStart = currentTime - WINDOW_SEC * 0.3;
    const windowEnd = windowStart + WINDOW_SEC;

    function timeToX(t: number): number {
      return ((t - windowStart) / WINDOW_SEC) * W;
    }

    // Draw pitch grid lines (musical octaves / landmark notes)
    const landmarkNotes = [
      { label: "C3", hz: 130.81 },
      { label: "C4", hz: 261.63 },
      { label: "C5", hz: 523.25 },
      { label: "C6", hz: 1046.5 },
    ];
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    for (const { label, hz } of landmarkNotes) {
      const y = hzToLogY(hz, H);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.fillText(label, 6, y - 4);
    }
    ctx.setLineDash([]);

    // Playhead (current time marker)
    const playheadX = timeToX(currentTime);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw reference melody
    const refVisible = referenceFrames.filter(
      (f) => f.voiced && f.hz !== null && f.time >= windowStart && f.time <= windowEnd
    );

    if (refVisible.length > 0) {
      ctx.strokeStyle = "#818cf8"; // indigo
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.beginPath();
      let started = false;
      for (const frame of refVisible) {
        const x = timeToX(frame.time);
        const y = hzToLogY(frame.hz!, H);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Dots on reference
      ctx.fillStyle = "#a5b4fc";
      for (const frame of refVisible) {
        const x = timeToX(frame.time);
        const y = hzToLogY(frame.hz!, H);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw user pitch trail
    const userVisible = userPitchHistory.filter(
      (f) => f.voiced && f.hz !== null && f.time >= windowStart && f.time <= windowEnd
    );

    for (const frame of userVisible) {
      const x = timeToX(frame.time);
      const y = hzToLogY(frame.hz!, H);

      // Find closest reference frame for color
      const closest = referenceFrames.reduce<PitchFrame | null>((best, rf) => {
        if (!rf.voiced || rf.hz === null) return best;
        if (!best) return rf;
        return Math.abs(rf.time - frame.time) < Math.abs(best.time! - frame.time) ? rf : best;
      }, null);

      const color =
        closest && closest.hz ? pitchColor(frame.hz!, closest.hz) : "#fb923c";

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = color.replace(")", ", 0.2)").replace("rgb", "rgba").replace("#", "rgba(").replace("rgba(", "").replace(", 0.2)", "");
      ctx.fill();
    }

    // Current user pitch (large dot at playhead)
    const latestUser = [...userPitchHistory]
      .reverse()
      .find((f) => f.voiced && f.hz !== null);
    if (latestUser && latestUser.hz !== null) {
      const y = hzToLogY(latestUser.hz, H);
      const grad = ctx.createRadialGradient(playheadX, y, 0, playheadX, y, 14);
      grad.addColorStop(0, "rgba(251, 146, 60, 0.9)");
      grad.addColorStop(1, "rgba(251, 146, 60, 0)");
      ctx.beginPath();
      ctx.arc(playheadX, y, 14, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(playheadX, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#fb923c";
      ctx.fill();
    }

    // Legend
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#818cf8";
    ctx.fillRect(W - 130, 12, 14, 4);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("Reference", W - 112, 18);
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.arc(W - 122, 32, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("Your voice", W - 112, 36);
  }, [referenceFrames, userPitchHistory, currentTime, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={280}
      className="w-full rounded-xl border border-white/10"
      style={{ background: "#0f0f1a" }}
    />
  );
}
