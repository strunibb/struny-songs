export const LEVELS = ["Начинающий", "Любитель", "Хардкор", "Фингерстайл"] as const;
export const FEATURE_OPTIONS = [
  "Аккорды",
  "Бой",
  "Перебор",
  "Рифф",
  "Соло",
  "Фингерстайл",
  "Табулатура",
] as const;

export type SongLevel = (typeof LEVELS)[number];
export type SongStatus = "published" | "draft";

export type PublicSong = {
  id: number;
  slug: string;
  artist: string;
  title: string;
  level: SongLevel;
  price: number;
  description: string;
  features: string[];
  keyName: string;
  capo: string;
  barre: boolean;
  difficulty: number;
  videoDuration: string;
  pdfPages: number;
  coverUrl: string | null;
  coverStyle: string;
  previewVideoUrl: string;
  isNew: boolean;
  isPopular: boolean;
  popularity: number;
  createdAt: string;
};

export type AdminSong = PublicSong & {
  privateVideoUrl: string;
  privatePdfUrl: string;
  pdfKey: string | null;
  coverKey: string | null;
  status: SongStatus;
};

export const levelMeta: Record<SongLevel, { color: string; icon: string; order: number }> = {
  "Начинающий": { color: "green", icon: "●", order: 1 },
  "Любитель": { color: "yellow", icon: "●", order: 2 },
  "Хардкор": { color: "red", icon: "●", order: 3 },
  "Фингерстайл": { color: "purple", icon: "●", order: 4 },
};
