import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SongCover } from "@/components/song-cover";
import { TelegramCta } from "@/components/telegram-cta";
import { findPublicSong, listPublicSongs } from "@/lib/database";
import { levelMeta, UNASSIGNED_LEVEL } from "@/lib/song-types";
import { SongCard } from "@/components/song-catalog";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const song = await findPublicSong((await params).slug);
  return song ? { title: `${song.artist} — ${song.title}: разбор на гитаре`, description: song.description } : {};
}

export default async function SongPage({ params }: Props) {
  const song = await findPublicSong((await params).slug);
  if (!song) notFound();
  const thematicOnly = song.level === UNASSIGNED_LEVEL;
  const meta = thematicOnly ? { color: "purple" } : levelMeta[song.level];
  const allSongs = await listPublicSongs();
  const related = allSongs.filter((item) => item.id !== song.id && (item.artist === song.artist || item.level === song.level)).slice(0, 3);
  const featureIcons: Record<string, string> = { Аккорды: "♬", Бой: "↯", Перебор: "≋", Рифф: "ϟ", Соло: "◇", Фингерстайл: "✦", Табулатура: "▦" };
  return (
    <main className="song-page">
      <SiteHeader />
      <section className="song-detail"><div className="shell"><div className="breadcrumbs"><Link href="/">Главная</Link><span>/</span><Link href="/songs">Разборы</Link><span>/</span><b>{song.artist} — {song.title}</b></div><div className="detail-grid"><SongCover song={song} large /><div className="detail-copy"><span className={`level-badge level-${meta.color}`}><i>●</i>{thematicOnly ? "Интересный бой" : song.level}</span><p className="artist-name">{song.artist}</p><h1>{song.title}</h1><p className="detail-description">{song.description}</p><div className="detail-facts"><span><small>Сложность</small><strong>{"●".repeat(song.difficulty)}<i>{"●".repeat(5 - song.difficulty)}</i></strong></span><span><small>Тональность</small><strong>{song.keyName || "Не указана"}</strong></span><span><small>Каподастр</small><strong>{song.capo || "Не указан"}</strong></span><span><small>Баррэ</small><strong>{song.barre ? "Есть" : "Нет"}</strong></span></div>{song.available ? <><div className="purchase-panel"><div><small>Полный разбор</small><strong>{song.price} ₽</strong></div><TelegramCta artist={song.artist} title={song.title} price={song.price} /></div><p className="safe-note">✓ После оплаты Никита лично отправит все материалы в Telegram</p></> : <div className="purchase-panel unavailable-panel"><div><small>Статус</small><strong>Разбор скоро появится</strong></div></div>}</div></div></div></section>
      <section className="section contents-section"><div className="shell narrow-shell"><div className="section-heading"><div><span className="section-index">01</span><h2>В разбор входит</h2></div></div><div className="contents-grid"><article><span>▶</span><strong>Подробный видеоразбор</strong><p>Объяснение техники, ритма и каждого сложного фрагмента.</p><small>{song.videoDuration || "Видео входит в комплект"}</small></article><article><span>▤</span><strong>PDF-разбор</strong><p>Материал для печати: структура, подсказки и всё необходимое для практики.</p><small>{song.pdfPages ? `${song.pdfPages} страниц` : "PDF входит в комплект"}</small></article>{song.features.map((feature) => <article key={feature}><span>{featureIcons[feature] ?? "♪"}</span><strong>{feature}</strong><p>Пошаговые объяснения и удобная схема для самостоятельной практики.</p><small>Входит в разбор</small></article>)}</div></div></section>
      {song.previewVideoUrl ? <section className="section preview-section"><div className="shell narrow-shell"><div className="section-heading"><div><span className="section-index">02</span><h2>Фрагмент разбора</h2></div></div><div className="video-frame"><iframe src={song.previewVideoUrl} title={`Фрагмент разбора ${song.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div><div className="locked-note"><span>▣</span><div><strong>Полный видеоразбор входит в комплект</strong><p>Закрытый материал не размещён в открытом доступе.</p></div></div></div></section> : null}
      <section className="section pdf-section"><div className="shell narrow-shell"><div className="section-heading"><div><span className="section-index">03</span><h2>PDF внутри комплекта</h2></div></div><div className="pdf-preview"><div className="pdf-sheet"><small>СТРУНЫ БУДУЩЕГО</small><h3>{song.artist}<br />{song.title}</h3><div className="fake-tabs"><i /><i /><i /><i /><i /></div><div className="fake-chords"><span>Em</span><span>C</span><span>G</span><span>D</span></div><div className="pdf-blur" /></div><div className="pdf-copy"><span className="lock-icon">▣</span><h3>Полный PDF входит в разбор</h3><p>После оплаты вы получите файл, который удобно открыть на телефоне или распечатать.</p><div><span>▤ PDF</span><span>{song.pdfPages ? `${song.pdfPages} страниц` : "Материалы для печати"}</span></div></div></div></div></section>
      {related.length ? <section className="section related-section"><div className="shell"><div className="section-heading"><div><span className="section-index">04</span><h2>Может понравиться</h2></div><Link href="/songs">Весь каталог ↗</Link></div><div className="song-grid">{related.map((item) => <SongCard key={item.id} song={item} />)}</div></div></section> : null}
      <SiteFooter />
      {song.available ? <div className="mobile-buy"><div><small>{song.artist}</small><strong>{song.price} ₽</strong></div><TelegramCta artist={song.artist} title={song.title} price={song.price} compact /></div> : null}
    </main>
  );
}
