import type { PublicSong } from "@/lib/song-types";

const fallbackPhotos = [
  "photo-1510915361894-db8b60106cb1",
  "photo-1507525428034-b723cf961d3e",
  "photo-1470252649378-9c29740c9fa8",
  "photo-1519608487953-e999c86e7455",
  "photo-1441974231531-c6227db76b6e",
];

function photoUrl(song: PublicSong) {
  const value = `${song.artist} ${song.title}`.toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
  let photo = "";
  if (/море|океан|пляж|ямайк|портофино|остров|волна/.test(value)) photo = "photo-1507525428034-b723cf961d3e";
  else if (/звезд|солнц|луна|небо|космос|мотыл/.test(value)) photo = "photo-1464802686167-b939a6910659";
  else if (/дожд|снег|осен|зонт|холод/.test(value)) photo = "photo-1515694346937-94d85e41e6f0";
  else if (/лес|дерев|поле|птиц|цвет|ромаш|сирен/.test(value)) photo = "photo-1441974231531-c6227db76b6e";
  else if (/огонь|пожар|fire|гор/.test(value)) photo = "photo-1473448912268-2022ce9509d8";
  else if (/город|питер|район|квартал|улиц|бар|танц/.test(value)) photo = "photo-1519608487953-e999c86e7455";
  else if (/дорог|путь|солдат|поезд|машин|самолет/.test(value)) photo = "photo-1500534314209-a25ddb2bd429";
  else if (/люб|серд|девоч|мама|фея|красив/.test(value)) photo = "photo-1490750967868-88aa4486c946";
  if (!photo) {
    const hash = [...`${song.artist}${song.title}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    photo = fallbackPhotos[hash % fallbackPhotos.length];
  }
  return `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1000&q=72`;
}

export function SongCover({ song, large = false }: { song: PublicSong; large?: boolean }) {
  return (
    <div className={`song-cover cover-${song.coverStyle}${large ? " cover-large" : ""}`}>
      <img src={song.coverUrl || photoUrl(song)} alt={`Обложка: ${song.artist} — ${song.title}`} loading={large ? "eager" : "lazy"} />
      <div className="cover-noise" />
      <div className="cover-record" aria-hidden="true"><i /></div>
      <div className="cover-copy">
        <span>{song.artist}</span>
        <strong>{song.title}</strong>
      </div>
    </div>
  );
}
