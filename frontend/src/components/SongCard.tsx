import { SongRead } from "../api";

interface Props {
  song: SongRead;
  onPractice: (song: SongRead) => void;
  onDelete: (id: number) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  processing: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  ready: "bg-green-500/20 text-green-300 border-green-500/30",
  error: "bg-red-500/20 text-red-300 border-red-500/30",
};

export function SongCard({ song, onPractice, onDelete }: Props) {
  const badgeCls =
    STATUS_COLORS[song.status] ?? "bg-gray-500/20 text-gray-300 border-gray-500/30";

  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4 hover:bg-white/10 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-white">{song.title || "Untitled"}</p>
        {song.artist && (
          <p className="mt-0.5 truncate text-sm text-white/50">{song.artist}</p>
        )}
        {song.duration && (
          <p className="mt-0.5 text-xs text-white/40">
            {Math.floor(song.duration / 60)}:{String(Math.floor(song.duration % 60)).padStart(2, "0")}
          </p>
        )}
        {song.error_message && (
          <p className="mt-1 truncate text-xs text-red-400">{song.error_message}</p>
        )}
      </div>

      <div className="ml-4 flex items-center gap-3 flex-shrink-0">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${badgeCls}`}
        >
          {song.status}
        </span>

        {song.status === "ready" && (
          <button
            onClick={() => onPractice(song)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Practice
          </button>
        )}

        <button
          onClick={() => onDelete(song.id)}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-white/50 hover:text-red-400 hover:border-red-400/30 transition-colors"
          aria-label="Delete song"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
