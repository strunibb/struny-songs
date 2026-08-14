import Link from "next/link";
import { SongCatalog } from "@/components/song-catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { publicSeedSongs } from "@/lib/seed-songs";

export const dynamic = "force-dynamic";

export default function Home() {
  const songs = publicSeedSongs;
  return (
    <main>
      <SiteHeader />
      <SongCatalog songs={songs} />
      <section className="section value-section">
        <div className="shell value-grid">
          <div className="value-intro"><p className="eyebrow"><i /> Всё в одном месте</p><h2><em>Полный путь до песни.</em></h2><p>Каждый материал собран так, чтобы вы не искали объяснения по разным видео и уверенно сыграли композицию целиком.</p><Link href="/#catalog" className="button button-outline">Открыть каталог</Link></div>
          <div className="value-cards">
            <article><span>▶</span><div><strong>Подробное видео</strong><p>Спокойно и по шагам: постановка рук, техника и сборка песни.</p></div></article>
            <article><span>▤</span><div><strong>Удобный PDF</strong><p>Аккорды, табулатуры и структура всегда остаются под рукой.</p></div></article>
            <article><span>✓</span><div><strong>Понятный результат</strong><p>Сразу видно сложность, содержание и что именно вы научитесь играть.</p></div></article>
          </div>
        </div>
      </section>
      <section className="teacher-section">
        <div className="shell teacher-grid">
          <div className="teacher-portrait"><div className="teacher-photo"><img src="/nikita-beach.jpeg" alt="Никита играет на гитаре на берегу моря" /></div><div className="floating-note note-one">♪</div><div className="floating-note note-two">♫</div></div>
          <div><p className="eyebrow"><i /> Автор разборов</p><h2>Привет, я Никита</h2><p>Преподаватель гитары и создатель школы «Струны будущего». Я подготовил уже сотни учеников и знаю, где чаще всего возникают трудности.</p><p>В разборах оставляю только то, что действительно помогает быстрее прийти к уверенной игре любимой песни.</p><div className="teacher-stats"><span><strong>1000+</strong><small>учеников</small></span><span><strong>6 лет</strong><small>преподавания</small></span><span><strong>40 мин</strong><small>средний разбор</small></span></div></div>
        </div>
      </section>
      <section className="request-section"><div className="shell request-card"><div><p className="eyebrow"><i /> Ваша песня может быть следующей</p><h2>Не нашли нужный разбор?</h2><p>Напишите Никите название и исполнителя. Самые востребованные песни появляются в библиотеке первыми.</p></div><a href="https://t.me/nikguitar" target="_blank" rel="noreferrer" className="button button-primary">Предложить песню <span>↗</span></a></div></section>
      <SiteFooter />
    </main>
  );
}
