import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export function useSongPitches(songId: number | null) {
  return useQuery({
    queryKey: ["song-pitches", songId],
    queryFn: () => api.getSongPitches(songId!),
    enabled: songId !== null,
    staleTime: Infinity,
  });
}
