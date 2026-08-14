import { seedSongs } from "./seed-songs";
import { LEVELS, UNASSIGNED_LEVEL, type AdminSong, type AdminSongLevel, type PublicSong, type SongLevel, type SongStatus } from "./song-types";
import { pendingSongLibrary } from "./song-library";
import { beginnerSongs } from "./song-groups";
import { interestingRhythmSongs } from "./interesting-rhythm-songs";

type Bindings = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
};

export type SongInput = {
  slug: string;
  artist: string;
  title: string;
  level: AdminSongLevel;
  price: number;
  description: string;
  features: string[];
  keyName: string;
  capo: string;
  barre: boolean;
  difficulty: number;
  videoDuration: string;
  pdfPages: number;
  coverKey: string | null;
  coverStyle: string;
  previewVideoUrl: string;
  privateVideoUrl: string;
  pdfKey: string | null;
  privatePdfUrl: string;
  isNew: boolean;
  isPopular: boolean;
  popularity: number;
  status: SongStatus;
};

type SongRow = {
  id: number;
  slug: string;
  artist: string;
  title: string;
  level: string;
  price: number;
  description: string;
  features: string;
  key_name: string;
  capo: string;
  barre: number;
  difficulty: number;
  video_duration: string;
  pdf_pages: number;
  cover_key: string | null;
  cover_style: string;
  preview_video_url: string;
  private_video_url: string;
  pdf_key: string | null;
  private_pdf_url: string;
  is_new: number;
  is_popular: number;
  popularity: number;
  status: string;
  created_at: string;
};

type SongIdentityRow = Pick<SongRow, "id" | "artist" | "title">;
type SongFeatureRow = Pick<SongRow, "id" | "artist" | "title" | "features">;

function normalizeSongPart(value: string): string {
  return value.normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function songIdentity(artist: string, title: string): string {
  return `${normalizeSongPart(artist)}\u0000${normalizeSongPart(title)}`;
}

export function getBindings(): Bindings {
  return (globalThis as typeof globalThis & { __STRUNY_ENV__?: Bindings }).__STRUNY_ENV__ ?? {};
}

function getD1(): D1Database | null {
  return getBindings().DB ?? null;
}

export function getBucket(): R2Bucket | null {
  return getBindings().BUCKET ?? null;
}

let initialization: Promise<void> | null = null;

export async function ensureDatabase(): Promise<boolean> {
  const db = getD1();
  if (!db) return false;
  if (initialization) {
    await initialization;
    return true;
  }

  initialization = (async () => {
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        artist TEXT NOT NULL,
        title TEXT NOT NULL,
        level TEXT NOT NULL,
        price INTEGER NOT NULL DEFAULT 199,
        description TEXT NOT NULL DEFAULT '',
        features TEXT NOT NULL DEFAULT '[]',
        key_name TEXT NOT NULL DEFAULT '',
        capo TEXT NOT NULL DEFAULT '',
        barre INTEGER NOT NULL DEFAULT 0,
        difficulty INTEGER NOT NULL DEFAULT 1,
        video_duration TEXT NOT NULL DEFAULT '',
        pdf_pages INTEGER NOT NULL DEFAULT 0,
        cover_key TEXT,
        cover_style TEXT NOT NULL DEFAULT 'violet',
        preview_video_url TEXT NOT NULL DEFAULT '',
        private_video_url TEXT NOT NULL DEFAULT '',
        pdf_key TEXT,
        private_pdf_url TEXT NOT NULL DEFAULT '',
        is_new INTEGER NOT NULL DEFAULT 0,
        is_popular INTEGER NOT NULL DEFAULT 0,
        popularity INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      db.prepare("CREATE INDEX IF NOT EXISTS songs_status_idx ON songs(status)"),
      db.prepare("CREATE INDEX IF NOT EXISTS songs_artist_title_idx ON songs(artist, title)"),
      db.prepare("CREATE INDEX IF NOT EXISTS songs_created_at_idx ON songs(created_at DESC)"),
      db.prepare(`CREATE TABLE IF NOT EXISTS app_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
    ]);

    await db.batch(
      seedSongs.map((song) =>
        db.prepare(`INSERT OR IGNORE INTO songs (
          slug, artist, title, level, price, description, features, key_name,
          capo, barre, difficulty, video_duration, pdf_pages, cover_key,
          cover_style, preview_video_url, private_video_url, pdf_key,
          private_pdf_url, is_new, is_popular, popularity, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            song.slug,
            song.artist,
            song.title,
            song.level,
            song.price,
            song.description,
            JSON.stringify(song.features),
            song.keyName,
            song.capo,
            song.barre ? 1 : 0,
            song.difficulty,
            song.videoDuration,
            song.pdfPages,
            song.coverKey,
            song.coverStyle,
            song.previewVideoUrl,
            song.privateVideoUrl,
            song.pdfKey,
            song.privatePdfUrl,
            song.isNew ? 1 : 0,
            song.isPopular ? 1 : 0,
            song.popularity,
            song.status,
            song.createdAt,
          ),
      ),
    );

    await db.prepare("UPDATE songs SET level = 'Профи' WHERE level = 'Хардкор'").run();

    const libraryMigrationId = "song-library-2026-08-14";
    const libraryImported = await db.prepare("SELECT id FROM app_migrations WHERE id = ? LIMIT 1")
      .bind(libraryMigrationId)
      .first<{ id: string }>();

    if (!libraryImported) {
      const chunkSize = 50;
      for (let index = 0; index < pendingSongLibrary.length; index += chunkSize) {
        const chunk = pendingSongLibrary.slice(index, index + chunkSize);
        await db.batch(chunk.map((song) => db.prepare(`INSERT OR IGNORE INTO songs (
          slug, artist, title, level, price, status, is_new
        ) SELECT ?, ?, ?, ?, 0, 'draft', 0
        WHERE NOT EXISTS (
          SELECT 1 FROM songs
          WHERE lower(trim(artist)) = lower(trim(?))
            AND lower(trim(title)) = lower(trim(?))
        )`).bind(song.slug, song.artist, song.title, UNASSIGNED_LEVEL, song.artist, song.title)));
      }
      await db.prepare("INSERT OR IGNORE INTO app_migrations (id) VALUES (?)").bind(libraryMigrationId).run();
    }

    const beginnerMigrationId = "song-group-beginner-2026-08-14";
    const beginnerAssigned = await db.prepare("SELECT id FROM app_migrations WHERE id = ? LIMIT 1")
      .bind(beginnerMigrationId)
      .first<{ id: string }>();

    if (!beginnerAssigned) {
      let rows = await db.prepare("SELECT id, artist, title FROM songs").all<SongIdentityRow>();
      let idsBySong = new Map(rows.results.map((song) => [songIdentity(song.artist, song.title), song.id]));
      const missingSongs = beginnerSongs.filter((song) => !idsBySong.has(songIdentity(song.artist, song.title)));

      const insertChunkSize = 50;
      for (let index = 0; index < missingSongs.length; index += insertChunkSize) {
        const chunk = missingSongs.slice(index, index + insertChunkSize);
        await db.batch(chunk.map((song) => db.prepare(`INSERT OR IGNORE INTO songs (
          slug, artist, title, level, price, status, is_new
        ) VALUES (?, ?, ?, 'Начинающий', 0, 'draft', 0)`)
          .bind(song.slug, song.artist, song.title)));
      }

      rows = await db.prepare("SELECT id, artist, title FROM songs").all<SongIdentityRow>();
      idsBySong = new Map(rows.results.map((song) => [songIdentity(song.artist, song.title), song.id]));
      const beginnerIds = [...new Set(beginnerSongs
        .map((song) => idsBySong.get(songIdentity(song.artist, song.title)))
        .filter((id): id is number => typeof id === "number"))];

      const chunkSize = 75;
      for (let index = 0; index < beginnerIds.length; index += chunkSize) {
        const chunk = beginnerIds.slice(index, index + chunkSize);
        await db.batch(chunk.map((id) => db.prepare(
          "UPDATE songs SET level = 'Начинающий', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).bind(id)));
      }
      await db.prepare("INSERT OR IGNORE INTO app_migrations (id) VALUES (?)").bind(beginnerMigrationId).run();
    }

    const interestingRhythmMigrationId = "song-group-interesting-rhythm-2026-08-15";
    const interestingRhythmAssigned = await db.prepare("SELECT id FROM app_migrations WHERE id = ? LIMIT 1")
      .bind(interestingRhythmMigrationId)
      .first<{ id: string }>();

    if (!interestingRhythmAssigned) {
      const resolveGroupSongId = (song: { artist: string; title: string }, rows: SongFeatureRow[]): number | undefined => {
        const exact = rows.find((row) => songIdentity(row.artist, row.title) === songIdentity(song.artist, song.title));
        if (exact) return exact.id;
        if (song.artist !== "Исполнитель не указан") return undefined;
        const titleMatches = rows.filter((row) => normalizeSongPart(row.title) === normalizeSongPart(song.title));
        return titleMatches.length === 1 ? titleMatches[0].id : undefined;
      };

      let rows = await db.prepare("SELECT id, artist, title, features FROM songs").all<SongFeatureRow>();
      const missingSongs = interestingRhythmSongs.filter((song) => !resolveGroupSongId(song, rows.results));

      const insertChunkSize = 50;
      for (let index = 0; index < missingSongs.length; index += insertChunkSize) {
        const chunk = missingSongs.slice(index, index + insertChunkSize);
        await db.batch(chunk.map((song) => db.prepare(`INSERT OR IGNORE INTO songs (
          slug, artist, title, level, price, status, is_new, features
        ) VALUES (?, ?, ?, ?, 0, 'draft', 0, ?)`)
          .bind(song.slug, song.artist, song.title, UNASSIGNED_LEVEL, JSON.stringify(["Интересный бой"]))));
      }

      rows = await db.prepare("SELECT id, artist, title, features FROM songs").all<SongFeatureRow>();
      const rowsById = new Map(rows.results.map((row) => [row.id, row]));
      const groupIds = [...new Set(interestingRhythmSongs
        .map((song) => resolveGroupSongId(song, rows.results))
        .filter((id): id is number => typeof id === "number"))];
      const rowsToUpdate = groupIds
        .map((id) => rowsById.get(id))
        .filter((row): row is SongFeatureRow => Boolean(row))
        .filter((row) => !parseFeatures(row.features).includes("Интересный бой"));

      const updateChunkSize = 75;
      for (let index = 0; index < rowsToUpdate.length; index += updateChunkSize) {
        const chunk = rowsToUpdate.slice(index, index + updateChunkSize);
        await db.batch(chunk.map((row) => db.prepare(
          "UPDATE songs SET features = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ).bind(JSON.stringify([...parseFeatures(row.features), "Интересный бой"]), row.id)));
      }
      await db.prepare("INSERT OR IGNORE INTO app_migrations (id) VALUES (?)").bind(interestingRhythmMigrationId).run();
    }
  })();

  try {
    await initialization;
    return true;
  } catch (error) {
    initialization = null;
    throw error;
  }
}

function parseFeatures(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapRow(row: SongRow): AdminSong {
  return {
    id: row.id,
    slug: row.slug,
    artist: row.artist,
    title: row.title,
    level: row.level as AdminSongLevel,
    price: row.price,
    description: row.description,
    features: parseFeatures(row.features),
    keyName: row.key_name,
    capo: row.capo,
    barre: Boolean(row.barre),
    difficulty: row.difficulty,
    videoDuration: row.video_duration,
    pdfPages: row.pdf_pages,
    coverUrl: row.cover_key ? `/media/${encodeURIComponent(row.cover_key)}` : null,
    coverKey: row.cover_key,
    coverStyle: row.cover_style,
    previewVideoUrl: row.preview_video_url,
    privateVideoUrl: row.private_video_url,
    pdfKey: row.pdf_key,
    privatePdfUrl: row.private_pdf_url,
    isNew: Boolean(row.is_new),
    isPopular: Boolean(row.is_popular),
    popularity: row.popularity,
    status: row.status as SongStatus,
    createdAt: row.created_at,
  };
}

function publicSong(song: AdminSong): PublicSong {
  if (!LEVELS.includes(song.level as SongLevel)) throw new Error("У опубликованной песни не выбран раздел.");
  const { privateVideoUrl: _video, privatePdfUrl: _pdf, pdfKey: _pdfKey, coverKey: _coverKey, status: _status, level, ...safe } = song;
  return { ...safe, level: level as SongLevel };
}

export async function listPublicSongs(): Promise<PublicSong[]> {
  const db = getD1();
  if (!db) return seedSongs.filter((song) => song.status === "published").map(publicSong);
  await ensureDatabase();
  const result = await db.prepare("SELECT * FROM songs WHERE status = 'published' AND level != ? ORDER BY datetime(created_at) DESC, id DESC").bind(UNASSIGNED_LEVEL).all<SongRow>();
  return result.results.map(mapRow).map(publicSong);
}

export async function listAdminSongs(): Promise<AdminSong[]> {
  const db = getD1();
  if (!db) return seedSongs;
  await ensureDatabase();
  const result = await db.prepare("SELECT * FROM songs ORDER BY datetime(created_at) DESC, id DESC").all<SongRow>();
  return result.results.map(mapRow);
}

export async function findPublicSong(slug: string): Promise<PublicSong | null> {
  const db = getD1();
  if (!db) {
    const found = seedSongs.find((song) => song.slug === slug && song.status === "published");
    return found ? publicSong(found) : null;
  }
  await ensureDatabase();
  const row = await db.prepare("SELECT * FROM songs WHERE slug = ? AND status = 'published' AND level != ? LIMIT 1").bind(slug, UNASSIGNED_LEVEL).first<SongRow>();
  return row ? publicSong(mapRow(row)) : null;
}

export async function findAdminSong(id: number): Promise<AdminSong | null> {
  const db = getD1();
  if (!db) return seedSongs.find((song) => song.id === id) ?? null;
  await ensureDatabase();
  const row = await db.prepare("SELECT * FROM songs WHERE id = ? LIMIT 1").bind(id).first<SongRow>();
  return row ? mapRow(row) : null;
}

export async function createSong(input: SongInput): Promise<AdminSong> {
  const db = getD1();
  if (!db) throw new Error("База данных пока недоступна.");
  await ensureDatabase();
  const row = await db.prepare(`INSERT INTO songs (
    slug, artist, title, level, price, description, features, key_name, capo,
    barre, difficulty, video_duration, pdf_pages, cover_key, cover_style,
    preview_video_url, private_video_url, pdf_key, private_pdf_url, is_new,
    is_popular, popularity, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  RETURNING *`).bind(...inputBindings(input)).first<SongRow>();
  if (!row) throw new Error("Не удалось сохранить разбор.");
  return mapRow(row);
}

export async function updateSong(id: number, input: SongInput): Promise<AdminSong> {
  const db = getD1();
  if (!db) throw new Error("База данных пока недоступна.");
  await ensureDatabase();
  const row = await db.prepare(`UPDATE songs SET
    slug = ?, artist = ?, title = ?, level = ?, price = ?, description = ?,
    features = ?, key_name = ?, capo = ?, barre = ?, difficulty = ?,
    video_duration = ?, pdf_pages = ?, cover_key = ?, cover_style = ?,
    preview_video_url = ?, private_video_url = ?, pdf_key = ?, private_pdf_url = ?,
    is_new = ?, is_popular = ?, popularity = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? RETURNING *`).bind(...inputBindings(input), id).first<SongRow>();
  if (!row) throw new Error("Разбор не найден.");
  return mapRow(row);
}

function inputBindings(input: SongInput): unknown[] {
  return [
    input.slug,
    input.artist,
    input.title,
    input.level,
    input.price,
    input.description,
    JSON.stringify(input.features),
    input.keyName,
    input.capo,
    input.barre ? 1 : 0,
    input.difficulty,
    input.videoDuration,
    input.pdfPages,
    input.coverKey,
    input.coverStyle,
    input.previewVideoUrl,
    input.privateVideoUrl,
    input.pdfKey,
    input.privatePdfUrl,
    input.isNew ? 1 : 0,
    input.isPopular ? 1 : 0,
    input.popularity,
    input.status,
  ];
}

export async function removeSong(id: number): Promise<AdminSong | null> {
  const db = getD1();
  if (!db) throw new Error("База данных пока недоступна.");
  await ensureDatabase();
  const row = await db.prepare("DELETE FROM songs WHERE id = ? RETURNING *").bind(id).first<SongRow>();
  return row ? mapRow(row) : null;
}
