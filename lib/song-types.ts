export const LEVELS = ["Начинающий", "Любитель", "Профи", "Фингерстайл", "Зарубежный рок"] as const;
export const UNASSIGNED_LEVEL = "Без категории" as const;
export const ADMIN_LEVELS = [UNASSIGNED_LEVEL, ...LEVELS] as const;
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
export type AdminSongLevel = (typeof ADMIN_LEVELS)[number];
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

export type AdminSong = Omit<PublicSong, "level"> & {
  level: AdminSongLevel;
  privateVideoUrl: string;
  privatePdfUrl: string;
  pdfKey: string | null;
  coverKey: string | null;
  status: SongStatus;
};

export const levelMeta: Record<SongLevel, { color: string; icon: string; order: number }> = {
  "Начинающий": { color: "green", icon: "●", order: 1 },
  "Любитель": { color: "yellow", icon: "●", order: 2 },
  "Профи": { color: "red", icon: "●", order: 3 },
  "Фингерстайл": { color: "purple", icon: "●", order: 4 },
  "Зарубежный рок": { color: "blue", icon: "●", order: 5 },
};
