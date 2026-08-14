"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { INTERESTING_RHYTHM_SECTION, levelMeta, LEVELS, UNASSIGNED_LEVEL, type CatalogSongLevel, type PublicSong, type SongLevel } from "@/lib/song-types";
import { PurchaseOptions } from "./cart-provider";
import { SongCover } from "./song-cover";

type SortMode = "new" | "popular" | "title" | "easy" | "hard";
const PAGE_SIZE = 48;

function normalize(value: string) { return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").trim(); }
function priceLabel(price: number) { return price === 0 ? "PDF бесплатно" : `PDF от ${price} ₽`; }

function LevelBadge({ level }: { level: CatalogSongLevel }) {
  const thematicOnly = level === UNASSIGNED_LEVEL;
  const meta = thematicOnly ? { color: "purple", icon: "●" } : levelMeta[level];
  return <span className={`level-badge level-${meta.color}`}><i>{meta.icon}</i>{thematicOnly ? "Интересный бой" : level}</span>;
}

function FeatureList({ features }: { features: string[] }) {
  const icons: Record<string, string> = { Аккорды: "♬", Бой: "↯", Перебор: "≋", Рифф: "ϟ", Соло: "◇", Фингерстайл: "✦", Табулатура: "▦" };
  return <div className="feature-list">{features.slice(0, 4).map((feature) => <span key={feature}>{icons[feature] ?? "•"} {feature}</span>)}<span>▶ Видео</span><span>▤ PDF</span></div>;
}

export function SongCard({ song, compact = false }: { song: PublicSong; compact?: boolean }) {
  return <article className={compact ? "song-card compact" : "song-card"}>
    <Link href={`/songs/${song.slug}`} className="card-cover-link" aria-label={`Открыть разбор ${song.artist} — ${song.title}`}><SongCover song={song} />{song.isNew && song.available ? <span className="new-label">NEW</span> : null}</Link>
    <div className="card-body">
      <div className="card-topline"><span className="artist-name">{song.artist}</span><LevelBadge level={song.level} /></div>
      <Link href={`/songs/${song.slug}`} className="card-title">{song.title}</Link>
      <FeatureList features={song.features} />
      <div className="card-footer"><PurchaseOptions song={song} compact /></div>
    </div>
  </article>;
}

function EmptyState({ query }: { query: string }) {
  const message = `Привет! Хочу предложить песню для нового разбора: ${query}`;
  async function copyAndOpen() {
    await navigator.clipboard.writeText(message);
    window.open("https://t.me/nikguitar", "_blank", "noopener,noreferrer");
  }
  return <div className="empty-state"><span>♫</span><h2>Не нашли нужную песню?</h2><p>Напишите Никите — возможно, именно она станет следующим разбором.</p><button className="button button-primary" onClick={copyAndOpen}>Предложить песню</button></div>;
}

export function SongCatalog({ songs, mode = "home" }: { songs: PublicSong[]; mode?: "home" | "full" }) {
  const [catalog, setCatalog] = useState(songs);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<"Все" | SongLevel | typeof INTERESTING_RHYTHM_SECTION>("Все");
  const [sort, setSort] = useState<SortMode>("new");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const normalizedQuery = normalize(query);

  useEffect(() => {
    let active = true;
    fetch("/api/songs").then((response) => response.ok ? response.json() : Promise.reject()).then((payload) => { if (active && Array.isArray(payload.songs)) setCatalog(payload.songs); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [normalizedQuery, level, sort]);

  const matches = useMemo(() => {
    const filtered = catalog.filter((song) => {
      const searchable = normalize(`${song.artist} ${song.title}`);
      const matchesSection = level === "Все" || (level === INTERESTING_RHYTHM_SECTION ? song.features.includes("Интересный бой") : song.level === level);
      return (!normalizedQuery || searchable.includes(normalizedQuery)) && matchesSection;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "popular") return b.popularity - a.popularity;
      if (sort === "title") return `${a.artist} ${a.title}`.localeCompare(`${b.artist} ${b.title}`, "ru");
      if (sort === "easy") return a.difficulty - b.difficulty;
      if (sort === "hard") return b.difficulty - a.difficulty;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [catalog, normalizedQuery, level, sort]);

  const displayedMatches = matches.slice(0, visibleCount);
  const suggestions = normalizedQuery ? catalog.filter((song) => normalize(`${song.artist} ${song.title}`).includes(normalizedQuery)).slice(0, 5) : [];
  const activeSearch = Boolean(normalizedQuery || level !== "Все");
  const newSongs = catalog.filter((song) => song.isNew && song.available).slice(0, 6);
  const popular = [...catalog].filter((song) => song.isPopular).sort((a, b) => b.popularity - a.popularity).slice(0, 4);

  const results = <section className="section catalog-results" id="library"><div className="shell">
    <div className="section-heading"><div><span className="section-index">{String(matches.length).padStart(2, "0")}</span><h2>{activeSearch ? "Результаты поиска" : "Вся библиотека"}</h2></div><div className="catalog-heading-tools"><p>{matches.length} песен</p><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="Сортировка"><option value="new">Сначала новые</option><option value="popular">Популярные</option><option value="title">По названию</option><option value="easy">Сначала проще</option><option value="hard">Сначала сложнее</option></select></div></div>
    {matches.length ? <><div className="song-grid">{displayedMatches.map((song) => <SongCard key={song.id} song={song} compact />)}</div>{visibleCount < matches.length ? <div className="load-more"><button type="button" className="button button-outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Показать ещё <span>{Math.min(PAGE_SIZE, matches.length - visibleCount)}</span></button></div> : null}</> : <EmptyState query={query} />}
  </div></section>;

  return <>
    {mode === "home" ? <section className="hero" id="catalog"><span className="hero-palm hero-palm-left" aria-hidden="true" /><span className="hero-palm hero-palm-right" aria-hidden="true" /><span className="hero-sun" aria-hidden="true" /><span className="hero-horizon" aria-hidden="true" /><div className="hero-glow glow-one" /><div className="hero-glow glow-two" /><div className="shell hero-inner">
      <div className="hero-copy"><p className="eyebrow"><i /> Библиотека гитарных разборов</p><h1>Играй песни, которые <em>действительно нравятся</em></h1><p>Выберите PDF с текстовым разбором или полный комплект с видео.</p></div>
      <div className="search-wrap"><span className="search-icon" aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти песню или исполнителя" aria-label="Найти песню или исполнителя" />{query ? <button className="search-clear" onClick={() => setQuery("")} aria-label="Очистить поиск">×</button> : <kbd>⌘ K</kbd>}{suggestions.length ? <div className="suggestions">{suggestions.map((song) => <Link key={song.id} href={`/songs/${song.slug}`}><span><small>{song.artist}</small><strong>{song.title}</strong></span><LevelBadge level={song.level} /></Link>)}</div> : null}</div>
      <p className="search-example">Например: <button onClick={() => setQuery("Кино — Пачка сигарет")}>Кино — Пачка сигарет</button></p>
      <div className="level-tabs" aria-label="Фильтр по разделу">{(["Все", ...LEVELS, INTERESTING_RHYTHM_SECTION] as const).map((item) => <button key={item} className={level === item ? "active" : ""} onClick={() => setLevel(item)}>{item !== "Все" && item !== INTERESTING_RHYTHM_SECTION ? <i className={`dot-${levelMeta[item].color}`} /> : item === INTERESTING_RHYTHM_SECTION ? <i className="dot-rhythm" /> : null}{item}</button>)}</div>
    </div></section> : <section className="catalog-hero" id="catalog"><div className="shell"><p className="eyebrow"><i /> Постоянно пополняется</p><h1>Все песни</h1><div className="search-wrap catalog-search"><span className="search-icon">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти песню или исполнителя" />{query ? <button className="search-clear" onClick={() => setQuery("")}>×</button> : null}</div><div className="level-tabs compact-tabs">{(["Все", ...LEVELS, INTERESTING_RHYTHM_SECTION] as const).map((item) => <button key={item} className={level === item ? "active" : ""} onClick={() => setLevel(item)}>{item}</button>)}</div></div></section>}

    {activeSearch || mode === "full" ? results : <>
      {newSongs.length ? <section className="section" id="new"><div className="shell"><div className="section-heading"><div><span className="section-index">01</span><h2>Новые разборы</h2></div><a href="#library">Смотреть все <span>↗</span></a></div><div className="song-grid">{newSongs.map((song) => <SongCard key={song.id} song={song} />)}</div></div></section> : null}
      {popular.length ? <section className="section popular-section" id="popular"><div className="shell"><div className="section-heading light"><div><span className="section-index">02</span><h2>Сейчас выбирают</h2></div><p>Самые популярные материалы недели</p></div><div className="popular-list">{popular.map((song, index) => <Link href={`/songs/${song.slug}`} key={song.id} className="popular-row"><strong>{String(index + 1).padStart(2, "0")}</strong><div className={`mini-cover cover-${song.coverStyle}`}><span>{song.artist.slice(0, 1)}</span></div><div><small>{song.artist}</small><span>{song.title}</span></div><LevelBadge level={song.level} /><b>{priceLabel(song.pdfPrice)}</b><i>↗</i></Link>)}</div></div></section> : null}
      {results}
    </>}
  </>;
}
