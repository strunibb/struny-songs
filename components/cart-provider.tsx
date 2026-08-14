"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type PurchaseOption = "pdf" | "video";
type PurchasableSong = { id: number; slug: string; artist: string; title: string; pdfPrice: number; videoPrice: number };
type CartSong = Omit<PurchasableSong, "pdfPrice" | "videoPrice"> & { option: PurchaseOption; price: number };
type CartContextValue = { songs: CartSong[]; open: boolean; setOpen: (open: boolean) => void; selectSong: (song: PurchasableSong, option: PurchaseOption) => void; removeSong: (id: number) => void; clear: () => void; selectedOption: (id: number) => PurchaseOption | null };

const STORAGE_KEY = "struny-song-cart-v2";
const CartContext = createContext<CartContextValue | null>(null);

function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("CartProvider is missing");
  return value;
}

function priceLabel(price: number) { return price === 0 ? "Бесплатно" : `${price} ₽`; }
function optionLabel(option: PurchaseOption) { return option === "pdf" ? "PDF с текстовым разбором" : "PDF + видеоразбор"; }

export function CartProvider({ children }: { children: ReactNode }) {
  const [songs, setSongs] = useState<CartSong[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setSongs(parsed.filter((item) => item && typeof item.id === "number" && typeof item.title === "string" && (item.option === "pdf" || item.option === "video") && typeof item.price === "number"));
      }
    } catch { /* Корзина продолжит работать в рамках текущей вкладки. */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(songs)); } catch { /* localStorage может быть отключён. */ }
  }, [ready, songs]);

  const value = useMemo<CartContextValue>(() => ({
    songs, open, setOpen,
    selectSong(song, option) {
      const price = option === "pdf" ? song.pdfPrice : song.videoPrice;
      setSongs((current) => {
        const selected = current.find((item) => item.id === song.id);
        if (selected?.option === option) return current.filter((item) => item.id !== song.id);
        const next = { id: song.id, slug: song.slug, artist: song.artist, title: song.title, option, price };
        return [...current.filter((item) => item.id !== song.id), next];
      });
    },
    removeSong(id) { setSongs((current) => current.filter((song) => song.id !== id)); },
    clear() { setSongs([]); },
    selectedOption(id) { return songs.find((song) => song.id === id)?.option ?? null; },
  }), [open, songs]);

  return <CartContext.Provider value={value}>{children}<CartDrawer /></CartContext.Provider>;
}

export function CartTrigger() {
  const { songs, setOpen } = useCart();
  return <button type="button" className="cart-trigger" onClick={() => setOpen(true)} aria-label={`Открыть корзину, выбрано песен: ${songs.length}`}><span>Корзина</span><b>{songs.length}</b></button>;
}

export function PurchaseOptions({ song, compact = false }: { song: PurchasableSong; compact?: boolean }) {
  const { selectedOption, selectSong } = useCart();
  const selected = selectedOption(song.id);
  return <div className={`purchase-options${compact ? " compact" : ""}`}>
    <button type="button" className={selected === "pdf" ? "added" : ""} onClick={() => selectSong(song, "pdf")} aria-pressed={selected === "pdf"}><span>PDF</span><strong>{priceLabel(song.pdfPrice)}</strong></button>
    <button type="button" className={selected === "video" ? "added" : ""} onClick={() => selectSong(song, "video")} aria-pressed={selected === "video"}><span>PDF + видео</span><strong>{priceLabel(song.videoPrice)}</strong></button>
  </div>;
}

function CartDrawer() {
  const { songs, open, setOpen, removeSong, clear } = useCart();
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const total = songs.reduce((sum, song) => sum + song.price, 0);
  const message = `Здравствуйте! Хочу купить разборы на песни:\n${songs.map((song, index) => `${index + 1}. ${song.artist} — ${song.title} — ${optionLabel(song.option)} (${priceLabel(song.price)})`).join("\n")}\n\nИтого: ${priceLabel(total)}`;
  const telegramUrl = `https://t.me/nikguitar?text=${encodeURIComponent(message)}`;
  function copyRequest() {
    void navigator.clipboard?.writeText(message).then(() => setCopied(true)).catch(() => undefined);
  }

  return <div className="cart-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
    <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <div className="cart-head"><div><small>Заявка в Telegram</small><h2 id="cart-title">Корзина</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Закрыть корзину">×</button></div>
      {songs.length ? <><div className="cart-list">{songs.map((song, index) => <div className="cart-row" key={song.id}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{song.title}</strong><small>{song.artist}</small><em>{optionLabel(song.option)} · {priceLabel(song.price)}</em></span><button type="button" onClick={() => removeSong(song.id)} aria-label={`Убрать ${song.artist} — ${song.title}`}>×</button></div>)}</div><div className="cart-total"><span>Итого</span><strong>{priceLabel(total)}</strong></div><div className="cart-actions"><button type="button" className="cart-clear" onClick={clear}>Очистить</button><a className="button button-primary" href={telegramUrl} target="_blank" rel="noreferrer" onClick={copyRequest}>{copied ? "Заявка готова ✓" : "Отправить заявку Никите"}</a></div><p>Telegram откроется уже с готовым списком песен — останется только нажать «Отправить».</p></> : <div className="cart-empty"><span>♪</span><h3>Пока пусто</h3><p>Выберите PDF или вариант с видео у одной или нескольких песен.</p><button type="button" className="button button-outline" onClick={() => setOpen(false)}>Вернуться к песням</button></div>}
    </aside>
  </div>;
}
