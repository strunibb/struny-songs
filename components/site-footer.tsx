import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <div className="brand footer-brand"><span className="brand-mark"><span>♪</span></span><span><strong>Струны</strong><small>будущего</small></span></div>
          <p>Понятные разборы любимых песен от Никиты — преподавателя, который сам продолжает учиться музыке каждый день.</p>
        </div>
        <div className="footer-links">
          <strong>Библиотека</strong>
          <Link href="/#catalog">Все песни</Link>
          <Link href="/#new">Новинки</Link>
          <Link href="/#popular">Популярное</Link>
        </div>
        <div className="footer-links">
          <strong>Связаться</strong>
          <a href="https://t.me/nikguitar" target="_blank" rel="noreferrer">Telegram Никиты ↗</a>
          <a href="https://strunib.ru" target="_blank" rel="noreferrer">Музыкальная школа ↗</a>
        </div>
      </div>
      <div className="shell footer-bottom"><span>© 2026 «Струны будущего»</span><span>Играй то, что нравится</span></div>
    </footer>
  );
}
