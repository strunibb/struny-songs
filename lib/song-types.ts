export const LEVELS = ["Начинающий", "Любитель", "Продвинутый", "Профи", "Фингерстайл", "Зарубежный рок"] as const;
export const UNASSIGNED_LEVEL = "Без категории" as const;
export const INTERESTING_RHYTHM_SECTION = "Песни с интересным боем" as const;
export const ELECTRIC_GUITAR_SECTION = "Электрогитара" as const;
export const ADMIN_LEVELS = [UNASSIGNED_LEVEL, ...LEVELS] as const;
export const FEATURE_OPTIONS = [
  "Аккорды",
  "Бой",
  "Перебор",
  "Рифф",
  "Соло",
  "Фингерстайл",
  "Табулатура",
  "Интересный бой",
  "Электрогитара",
] as const;

export type SongLevel = (typeof LEVELS)[number];
export type CatalogSongLevel = SongLevel | typeof UNASSIGNED_LEVEL;
export type AdminSongLevel = (typeof ADMIN_LEVELS)[number];
export type SongStatus = "published" | "draft";

export type PublicSong = {
  id: number;
  slug: string;
  artist: string;
  title: string;
  level: CatalogSongLevel;
  price: number;
  pdfPrice: number;
  videoPrice: number;
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
  available: boolean;
};

export type AdminSong = Omit<PublicSong, "level" | "available" | "pdfPrice" | "videoPrice"> & {
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
  "Продвинутый": { color: "red", icon: "●", order: 3 },
  "Профи": { color: "hot", icon: "●", order: 4 },
  "Фингерстайл": { color: "purple", icon: "●", order: 5 },
  "Зарубежный рок": { color: "blue", icon: "●", order: 6 },
};
