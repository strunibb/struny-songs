import type { PublicSong } from "@/lib/song-types";

export function SongCover({ song, large = false }: { song: PublicSong; large?: boolean }) {
  return (
    <div className={`song-cover cover-${song.coverStyle}${large ? " cover-large" : ""}`}>
      {song.coverUrl ? <img src={song.coverUrl} alt={`Обложка: ${song.artist} — ${song.title}`} loading={large ? "eager" : "lazy"} /> : null}
      <div className="cover-noise" />
      <div className="cover-record" aria-hidden="true"><i /></div>
      <div className="cover-copy">
        <span>{song.artist}</span>
        <strong>{song.title}</strong>
      </div>
    </div>
  );
}
