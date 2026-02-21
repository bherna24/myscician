interface Props {
  score: number | null; // 0–100
  totalFrames: number;
  matchedFrames: number;
}

export function AccuracyPanel({ score, totalFrames, matchedFrames }: Props) {
  if (score === null) return null;

  const color =
    score >= 80 ? "text-green-400" : score >= 55 ? "text-yellow-400" : "text-red-400";

  const ring =
    score >= 80 ? "stroke-green-400" : score >= 55 ? "stroke-yellow-400" : "stroke-red-400";

  const r = 36;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-8">
      <h2 className="text-xl font-bold text-white">Session Complete</h2>

      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          className={ring}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>

      <p className={`-mt-6 text-4xl font-bold ${color}`}>{score.toFixed(1)}%</p>
      <p className="text-sm text-white/50">accuracy</p>

      <div className="mt-2 grid grid-cols-2 gap-6 text-center">
        <div>
          <p className="text-2xl font-semibold text-white">{matchedFrames}</p>
          <p className="text-xs text-white/40">matched frames</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-white">{totalFrames}</p>
          <p className="text-xs text-white/40">total voiced frames</p>
        </div>
      </div>
    </div>
  );
}
