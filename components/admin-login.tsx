"use client";

import { FormEvent, useState } from "react";

export function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    if (response.ok) window.location.reload();
    else {
      const payload = await response.json().catch(() => ({ error: "Не удалось войти." }));
      setError(payload.error);
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <a className="brand admin-brand" href="/"><span className="brand-mark"><span>♪</span></span><span><strong>Струны</strong><small>будущего</small></span></a>
      <form className="admin-login-card" onSubmit={submit}>
        <span className="admin-lock">▣</span><p className="eyebrow">Закрытая зона</p><h1>Управление разборами</h1><p>Введите пароль администратора. Эта страница не отображается посетителям сайта.</p>
        <label>Пароль<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required autoFocus placeholder="Введите пароль" /></label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button button-primary" disabled={loading}>{loading ? "Проверяю…" : "Войти в админку"}</button>
        <a href="/">← Вернуться на сайт</a>
      </form>
    </div>
  );
}
