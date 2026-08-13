import { FEATURE_OPTIONS, LEVELS, type AdminSong, type SongLevel } from "./song-types";
import type { SongInput } from "./database";

const transliteration: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugify(value: string): string {
  return value.toLowerCase().split("").map((char) => transliteration[char] ?? char).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || `song-${Date.now()}`;
}

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(form: FormData, key: string, fallback: number): number {
  const parsed = Number(text(form, key));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseSongForm(form: FormData, existing?: AdminSong | null): SongInput {
  const artist = text(form, "artist");
  const title = text(form, "title");
  if (!artist || !title) throw new Error("Укажите исполнителя и название песни.");

  const rawLevel = text(form, "level");
  const level: SongLevel = LEVELS.includes(rawLevel as SongLevel) ? (rawLevel as SongLevel) : "Начинающий";
  const features = form.getAll("features").filter((item): item is string => typeof item === "string" && FEATURE_OPTIONS.includes(item as never));

  return {
    slug: text(form, "slug") || existing?.slug || slugify(`${artist}-${title}`),
    artist,
    title,
    level,
    price: Math.max(0, Math.round(numberValue(form, "price", 199))),
    description: text(form, "description"),
    features,
    keyName: text(form, "keyName"),
    capo: text(form, "capo"),
    barre: text(form, "barre") === "true",
    difficulty: Math.min(5, Math.max(1, Math.round(numberValue(form, "difficulty", 1)))),
    videoDuration: text(form, "videoDuration"),
    pdfPages: Math.max(0, Math.round(numberValue(form, "pdfPages", 0))),
    coverKey: existing?.coverKey ?? null,
    coverStyle: text(form, "coverStyle") || existing?.coverStyle || "violet",
    previewVideoUrl: text(form, "previewVideoUrl"),
    privateVideoUrl: text(form, "privateVideoUrl"),
    pdfKey: existing?.pdfKey ?? null,
    privatePdfUrl: text(form, "privatePdfUrl"),
    isNew: text(form, "isNew") === "true",
    isPopular: text(form, "isPopular") === "true",
    popularity: Math.min(100, Math.max(0, Math.round(numberValue(form, "popularity", 0)))),
    status: text(form, "status") === "published" ? "published" : "draft",
  };
}

export function safeFilename(filename: string): string {
  return filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}
