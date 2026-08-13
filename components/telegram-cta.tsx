"use client";

import { useEffect, useState } from "react";

const telegramUrl = "https://t.me/nikguitar";

export function TelegramCta({ artist, title, price, compact = false }: { artist: string; title: string; price: number; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const message = `Здравствуйте! Хочу приобрести разбор: ${artist} — ${title}`;

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  function prepareMessage() {
    if (!navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(message).then(() => setCopied(true)).catch(() => undefined);
  }

  return (
    <a
      className={compact ? "button button-small telegram-button" : "button button-primary telegram-button"}
      href={telegramUrl}
      target="_blank"
      rel="noreferrer"
      onClick={prepareMessage}
      aria-label={`Получить разбор ${artist} — ${title} в Telegram`}
    >
      {copied ? "Текст скопирован ✓" : compact ? `Купить — ${price} ₽` : "Получить разбор в Telegram"}
    </a>
  );
}
