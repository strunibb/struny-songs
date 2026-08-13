"use client";

import Link from "next/link";
import { useState } from "react";

const telegram = "https://t.me/nikguitar";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand" aria-label="Струны будущего — главная">
          <span className="brand-mark" aria-hidden="true"><span>♪</span></span>
          <span><strong>Струны</strong><small>будущего</small></span>
        </Link>
        <button className="mobile-menu" onClick={() => setOpen((value) => !value)} aria-label="Открыть меню" aria-expanded={open}>
          <span /><span />
        </button>
        <nav className={open ? "main-nav open" : "main-nav"} aria-label="Главное меню">
          <Link href="/songs" onClick={() => setOpen(false)}>Разборы</Link>
          <Link href="/#new" onClick={() => setOpen(false)}>Новинки</Link>
          <Link href="/#popular" onClick={() => setOpen(false)}>Популярное</Link>
          <a className="nav-cta" href={telegram} target="_blank" rel="noreferrer">Предложить песню</a>
        </nav>
      </div>
    </header>
  );
}
