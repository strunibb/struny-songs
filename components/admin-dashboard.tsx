"use client";

import { FormEvent, useMemo, useState } from "react";
import { ADMIN_LEVELS, FEATURE_OPTIONS, UNASSIGNED_LEVEL, type AdminSong } from "@/lib/song-types";

function appendSong(form: FormData, song: AdminSong, status = song.status) {
  const values: Record<string, string> = {
    slug: song.slug, artist: song.artist, title: song.title, level: song.level, price: String(song.price), description: song.description,
    keyName: song.keyName, capo: song.capo, barre: String(song.barre), difficulty: String(song.difficulty), videoDuration: song.videoDuration,
    pdfPages: String(song.pdfPages), coverStyle: song.coverStyle, previewVideoUrl: song.previewVideoUrl, privateVideoUrl: song.privateVideoUrl,
    privatePdfUrl: song.privatePdfUrl, isNew: String(song.isNew), isPopular: String(song.isPopular), popularity: String(song.popularity), status,
  };
  Object.entries(values).forEach(([key, value]) => form.set(key, value));
  song.features.forEach((feature) => form.append("features", feature));
}

export function AdminDashboard({ initialSongs }: { initialSongs: AdminSong[] }) {
  const [songs, setSongs] = useState(initialSongs);
  const [editing, setEditing] = useState<AdminSong | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const visibleSongs = useMemo(() => songs.filter((song) => `${song.artist} ${song.title}`.toLowerCase().includes(search.toLowerCase())), [songs, search]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.name === "status") form.set("status", submitter.value);
    const endpoint = editing ? `/api/admin/songs/${editing.id}` : "/api/admin/songs";
    const response = await fetch(endpoint, { method: editing ? "PUT" : "POST", body: form });
    const payload = await response.json().catch(() => ({ error: "Не удалось сохранить разбор." }));
    if (response.ok) {
      setSongs((current) => editing ? current.map((song) => song.id === editing.id ? payload.song : song) : [payload.song, ...current]);
      setMessage(editing ? "Разбор обновлён." : "Новый разбор добавлен.");
      setEditing(null);
      setShowForm(false);
    } else setMessage(payload.error);
    setSaving(false);
  }

  async function toggleVisibility(song: AdminSong) {
    if (song.status === "draft" && song.level === UNASSIGNED_LEVEL) {
      setMessage("Сначала выберите раздел для песни.");
      return;
    }
    const form = new FormData();
    appendSong(form, song, song.status === "published" ? "draft" : "published");
    const response = await fetch(`/api/admin/songs/${song.id}`, { method: "PUT", body: form });
    const payload = await response.json();
    if (response.ok) setSongs((current) => current.map((item) => item.id === song.id ? payload.song : item));
    else setMessage(payload.error);
  }

  async function remove(song: AdminSong) {
    if (!window.confirm(`Удалить разбор «${song.artist} — ${song.title}»? Файлы тоже будут удалены.`)) return;
    const response = await fetch(`/api/admin/songs/${song.id}`, { method: "DELETE" });
    if (response.ok) setSongs((current) => current.filter((item) => item.id !== song.id));
    else setMessage("Не удалось удалить разбор.");
  }

  function edit(song: AdminSong) {
    setEditing(song);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  const current = editing;
  return (
    <main className="admin-page">
      <header className="admin-header"><a className="brand" href="/"><span className="brand-mark"><span>♪</span></span><span><strong>Струны</strong><small>будущего</small></span></a><div><a href="/" target="_blank">Открыть сайт ↗</a><button onClick={logout}>Выйти</button></div></header>
      <div className="admin-shell">
        <div className="admin-title"><div><p className="eyebrow"><i /> Панель Никиты</p><h1>Разборы</h1><p>{songs.length} материалов · {songs.filter((song) => song.status === "published").length} опубликовано</p></div><button className="button button-primary" onClick={() => { setEditing(null); setShowForm(true); }}>＋ Добавить разбор</button></div>
        {message ? <div className="admin-message">{message}<button onClick={() => setMessage("")}>×</button></div> : null}
        {showForm ? (
          <section className="admin-editor">
            <div className="editor-title"><div><span>{current ? "Редактирование" : "Новая публикация"}</span><h2>{current ? `${current.artist} — ${current.title}` : "Добавить разбор"}</h2></div><button onClick={() => { setShowForm(false); setEditing(null); }}>×</button></div>
            <form key={current?.id ?? "new"} onSubmit={submit}>
              <div className="form-section"><h3>Основное</h3><div className="form-grid two"><label>Исполнитель *<input name="artist" defaultValue={current?.artist} required placeholder="Кино" /></label><label>Название песни *<input name="title" defaultValue={current?.title} required placeholder="Пачка сигарет" /></label><label>Раздел<select name="level" defaultValue={current?.level ?? UNASSIGNED_LEVEL}>{ADMIN_LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label><label>Цены<small>Рассчитываются автоматически по разделу</small><input name="price" type="hidden" value={current?.price ?? 199} /></label></div><label>Описание<textarea name="description" rows={4} defaultValue={current?.description} placeholder="Что ученик освоит в этом разборе" /></label></div>
              <div className="form-section"><h3>Материалы</h3><div className="checkbox-grid">{FEATURE_OPTIONS.map((feature) => <label key={feature}><input type="checkbox" name="features" value={feature} defaultChecked={current?.features.includes(feature)} /><span>✓</span>{feature}</label>)}</div><div className="form-grid two"><label>Видеоразбор — закрытая ссылка<input name="privateVideoUrl" type="url" defaultValue={current?.privateVideoUrl} placeholder="Google Drive, YouTube, VK Video…" /></label><label>Открытое превью видео<input name="previewVideoUrl" type="url" defaultValue={current?.previewVideoUrl} placeholder="Ссылка для встраивания" /></label><label>PDF-файл<input name="pdf" type="file" accept="application/pdf" /><small>{current?.pdfKey ? "PDF уже загружен; новый файл заменит его" : "До 50 МБ"}</small></label><label>Или закрытая ссылка на PDF<input name="privatePdfUrl" type="url" defaultValue={current?.privatePdfUrl} placeholder="https://…" /></label></div></div>
              <div className="form-section"><h3>Обложка и параметры</h3><div className="form-grid three"><label>Обложка<input name="cover" type="file" accept="image/*" /><small>{current?.coverKey ? "Обложка загружена; новая заменит её" : "JPG, PNG или WebP до 8 МБ"}</small></label><label>Стиль без обложки<select name="coverStyle" defaultValue={current?.coverStyle ?? "violet"}><option value="violet">Фиолетовый</option><option value="ember">Огненный</option><option value="ocean">Океан</option><option value="silver">Серебро</option><option value="sunset">Закат</option><option value="forest">Лесной</option></select></label><label>Сложность 1–4<input name="difficulty" type="number" min="1" max="4" defaultValue={Math.min(current?.difficulty ?? 1, 4)} /></label><label>Тональность<select name="keyName" defaultValue={current?.keyName === "Упрощённая" ? "Упрощённая" : "Оригинал"}><option>Оригинал</option><option>Упрощённая</option></select></label><input name="capo" type="hidden" value="" /><label>Баррэ<select name="barre" defaultValue={String(current?.barre ?? false)}><option value="false">Нет</option><option value="true">Есть</option></select></label><label>Длительность видео<input name="videoDuration" defaultValue={current?.videoDuration} placeholder="28 минут" /></label><label>Страниц PDF<input name="pdfPages" type="number" min="0" defaultValue={current?.pdfPages ?? 0} /></label><label>Популярность 0–100<input name="popularity" type="number" min="0" max="100" defaultValue={current?.popularity ?? 0} /></label></div><div className="switches"><label><input type="checkbox" name="isNew" value="true" defaultChecked={current?.isNew ?? true} /><span />Новый разбор на главной</label><label><input type="checkbox" name="isPopular" value="true" defaultChecked={current?.isPopular} /><span />Показывать в популярном</label></div></div>
              <div className="editor-actions"><button type="button" className="button button-outline" onClick={() => { setShowForm(false); setEditing(null); }}>Отмена</button><button type="submit" name="status" value="draft" className="button button-muted" disabled={saving}>Сохранить черновик</button><button type="submit" name="status" value="published" className="button button-primary" disabled={saving}>{saving ? "Сохраняю…" : "Опубликовать"}</button></div>
            </form>
          </section>
        ) : null}
        <section className="admin-list"><div className="admin-list-tools"><div className="admin-search">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по песням" /></div><span>Показано: {visibleSongs.length}</span></div><div className="admin-table"><div className="admin-row admin-table-head"><span>Название</span><span>Категория</span><span>Цены</span><span>Статус</span><span>Действия</span></div>{visibleSongs.map((song) => <div className="admin-row" key={song.id}><div><div className={`admin-mini-cover cover-${song.coverStyle}`}>{song.coverUrl ? <img src={song.coverUrl} alt="" /> : song.artist.slice(0, 1)}</div><span><strong>{song.title}</strong><small>{song.artist}</small></span></div><span>{song.level}</span><b>Авто</b><span className={song.status === "published" ? "status-live" : "status-draft"}><i />{song.status === "published" ? "Опубликован" : "Черновик"}</span><div className="row-actions"><button onClick={() => edit(song)}>Редактировать</button><button onClick={() => toggleVisibility(song)}>{song.status === "published" ? "Скрыть" : "Опубликовать"}</button><button className="danger" onClick={() => remove(song)}>Удалить</button></div></div>)}</div></section>
      </div>
    </main>
  );
}
