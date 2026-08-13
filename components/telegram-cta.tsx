"use client";

import { useState } from "react";

const telegramUrl = "https://t.me/nikguitar";

export function TelegramCta({ artist, title, price, compact = false }: { artist: string; title: string; price: number; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const message = `Здравствуйте! Хочу приобрести разбор: ${artist} — ${title}`;

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
  }

  return (
    <>
      <button className={compact ? "button button-small" : "button button-primary"} onClick={() => setOpen(true)}>
        {compact ? `Купить — ${price} ₽` : "Получить разбор в Telegram"}
      </button>
      {open ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section className="purchase-dialog" role="dialog" aria-modal="true" aria-labelledby="purchase-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" onClick={() => setOpen(false)} aria-label="Закрыть">×</button>
            <span className="dialog-icon">✦</span>
            <p className="eyebrow">Почти готово</p>
            <h2 id="purchase-title">Напишите Никите</h2>
            <p>Скопируйте готовое сообщение, откройте Telegram и отправьте его Никите.</p>
            <div className="message-copy"><span>{message}</span><button onClick={copyMessage}>{copied ? "Скопировано" : "Копировать"}</button></div>
            <a className="button button-primary dialog-button" href={telegramUrl} target="_blank" rel="noreferrer" onClick={copyMessage}>Открыть Telegram</a>
            <small>Никита ответит лично и отправит материалы после оплаты.</small>
          </section>
        </div>
      ) : null}
    </>
  );
}
