import type { Metadata } from "next";
import { SongCatalog } from "@/components/song-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { publicSeedSongs } from "@/lib/seed-songs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Все разборы песен — Струны будущего", description: "Каталог готовых разборов песен на гитаре: видео, PDF, аккорды, бой, риффы и фингерстайл." };

export default function SongsPage() {
  const songs = publicSeedSongs;
  return <main><SiteHeader /><SongCatalog songs={songs} mode="full" /><section className="request-section"><div className="shell request-card"><div><p className="eyebrow"><i /> Добавляем новые песни</p><h2>Не нашли то, что искали?</h2><p>Предложите песню Никите — возможно, именно она станет следующим разбором.</p></div><a href="https://t.me/nikguitar" target="_blank" rel="noreferrer" className="button button-primary">Предложить песню <span>↗</span></a></div></section><SiteFooter /></main>;
}
