import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, SongRead } from "../api";
import { SongCard } from "../components/SongCard";

export function Library() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [showForm, setShowForm] = useState(false);
  const pollingIds = useRef<Set<number>>(new Set());

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["songs"],
    queryFn: api.listSongs,
    refetchInterval: 3000,
  });

  // Poll individual processing songs
  useEffect(() => {
    const processing = songs.filter(
      (s) => s.status === "pending" || s.status === "processing"
    );
    processing.forEach((s) => pollingIds.current.add(s.id));
  }, [songs]);

  const addMutation = useMutation({
    mutationFn: () => api.addSong(url.trim(), title.trim() || undefined, artist.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["songs"] });
      setUrl("");
      setTitle("");
      setArtist("");
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteSong(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["songs"] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    addMutation.mutate();
  };

  const handlePractice = (song: SongRead) => {
    navigate(`/practice/${song.id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 p-6 md:p-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Myscician</h1>
            <p className="mt-1 text-sm text-white/40">Your worship song pitch library</p>
          </div>
          <button
            onClick={() => setShowForm((p) => !p)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            {showForm ? "Cancel" : "+ Add Song"}
          </button>
        </div>

        {/* Add Song Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4"
          >
            <h2 className="font-semibold text-white text-lg">Add a YouTube Song</h2>

            <div>
              <label className="block text-sm text-white/60 mb-1">YouTube URL *</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-white/20 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Title (optional)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Fetched automatically"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-white/20 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Artist (optional)</label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="e.g. Hillsong"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-white/20 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {addMutation.isError && (
              <p className="text-sm text-red-400">
                Error: {String((addMutation.error as Error)?.message ?? "Unknown error")}
              </p>
            )}

            <button
              type="submit"
              disabled={addMutation.isPending}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addMutation.isPending ? "Adding…" : "Add Song"}
            </button>

            <p className="text-xs text-white/30 text-center">
              The audio will be downloaded and processed in the background. This may take a few minutes.
            </p>
          </form>
        )}

        {/* Song list */}
        {isLoading ? (
          <div className="py-16 text-center text-white/30">Loading library…</div>
        ) : songs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-white/30 text-lg">No songs yet.</p>
            <p className="mt-2 text-white/20 text-sm">
              Add a YouTube URL above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {songs.map((song) => (
              <SongCard
                key={song.id}
                song={song}
                onPractice={handlePractice}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
