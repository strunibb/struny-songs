const SECTIONS = ["Все", "Начинающий", "Продвинутый", "Профи", "Фингерстайл", "Зарубежный рок", "Электрогитара", "Песни с интересным боем"];
const PAGE_SIZE = 48;
const STORAGE_KEY = "struny-github-pages-cart-v1";
const icons = { "Аккорды": "♬", "Бой": "↯", "Перебор": "≋", "Рифф": "ϟ", "Соло": "◇", "Фингерстайл": "✦", "Табулатура": "▦", "Интересный бой": "↯", "Электрогитара": "⚡" };
const levelColors = { "Начинающий": "green", "Любитель": "yellow", "Продвинутый": "red", "Профи": "hot", "Фингерстайл": "purple", "Зарубежный рок": "blue", "Электрогитара": "blue", "Интересный бой": "purple" };

const state = { songs: [], query: "", section: "Все", sort: "title", visible: PAGE_SIZE, cart: loadCart(), modalSong: null };
const els = {
  search: document.querySelector("#search"), searchClear: document.querySelector("#search-clear"), tabs: document.querySelector("#tabs"), sort: document.querySelector("#sort"),
  grid: document.querySelector("#song-grid"), count: document.querySelector("#result-count"), index: document.querySelector("#result-index"), title: document.querySelector("#result-title"),
  loadMore: document.querySelector("#load-more"), empty: document.querySelector("#empty-state"), template: document.querySelector("#card-template"),
  cartTrigger: document.querySelector("#cart-trigger"), cartCount: document.querySelector("#cart-count"), cartBackdrop: document.querySelector("#cart-backdrop"), cartClose: document.querySelector("#cart-close"), cartContent: document.querySelector("#cart-content"),
  songBackdrop: document.querySelector("#song-backdrop"), modalClose: document.querySelector("#modal-close"), modalContent: document.querySelector("#song-modal-content"),
};

function normalize(value) { return String(value || "").normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/\s+/g, " ").trim(); }
function money(value) { return value === 0 ? "Бесплатно" : `${value} ₽`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
function labelFor(song) {
  if (song.level !== "Без категории") return song.level;
  if (song.sections.includes("Электрогитара")) return "Электрогитара";
  return "Интересный бой";
}
function difficultyLabel(value) { return ["Начинающий", "Любитель", "Продвинутый", "Профи"][Math.max(1, Math.min(4, value)) - 1]; }

function loadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && Number.isFinite(item.id) && ["pdf", "video"].includes(item.format)) : [];
  } catch { return []; }
}
function saveCart() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart)); renderCartCount(); }
function selectedFormat(id) { return state.cart.find((item) => item.id === id)?.format || null; }

function renderTabs() {
  els.tabs.replaceChildren(...SECTIONS.map((section) => {
    const button = document.createElement("button");
    button.type = "button"; button.textContent = section; button.dataset.section = section;
    button.className = state.section === section ? "active" : "";
    button.addEventListener("click", () => { state.section = section; state.visible = PAGE_SIZE; renderTabs(); renderCatalog(); });
    return button;
  }));
}

function filteredSongs() {
  const query = normalize(state.query);
  const result = state.songs.filter((song) => {
    const matchesText = !query || normalize(`${song.artist} ${song.title}`).includes(query);
    const matchesSection = state.section === "Все" || song.sections.includes(state.section);
    return matchesText && matchesSection;
  });
  return result.sort((a, b) => {
    if (state.sort === "popular") return b.popularity - a.popularity || a.artist.localeCompare(b.artist, "ru");
    if (state.sort === "easy") return a.difficulty - b.difficulty || a.artist.localeCompare(b.artist, "ru");
    if (state.sort === "hard") return b.difficulty - a.difficulty || a.artist.localeCompare(b.artist, "ru");
    if (state.sort === "new") return new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id;
    return a.artist.localeCompare(b.artist, "ru") || a.title.localeCompare(b.title, "ru");
  });
}

function badge(song) {
  const label = labelFor(song);
  return `<span class="level-badge level-${levelColors[label] || "purple"}">${escapeHtml(label)}</span>`;
}

function featureMarkup(features, limit = 4) {
  const shown = [...new Set(features)].slice(0, limit);
  return [...shown.map((feature) => `<span>${icons[feature] || "•"} ${escapeHtml(feature)}</span>`), "<span>▶ Видео</span>", "<span>▤ PDF</span>"].join("");
}

function createCard(song) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.dataset.id = song.id;
  const cover = node.querySelector(".song-cover");
  cover.classList.add(`cover-${song.coverStyle}`);
  node.querySelector(".cover-copy span").textContent = song.artist;
  node.querySelector(".cover-copy strong").textContent = song.title;
  const newLabel = node.querySelector(".new-label");
  if (!song.isNew) newLabel.remove();
  const coverButton = node.querySelector(".cover-button");
  coverButton.setAttribute("aria-label", `Подробнее: ${song.artist} — ${song.title}`);
  coverButton.addEventListener("click", () => openSong(song.id));
  node.querySelector(".card-section-line").innerHTML = badge(song);
  node.querySelector(".feature-list").innerHTML = featureMarkup(song.features);
  const selected = selectedFormat(song.id);
  const pdf = node.querySelector('[data-format="pdf"]');
  const video = node.querySelector('[data-format="video"]');
  pdf.querySelector("strong").textContent = money(song.pdfPrice);
  video.querySelector("strong").textContent = money(song.videoPrice);
  pdf.classList.toggle("added", selected === "pdf");
  video.classList.toggle("added", selected === "video");
  pdf.setAttribute("aria-pressed", String(selected === "pdf"));
  video.setAttribute("aria-pressed", String(selected === "video"));
  pdf.addEventListener("click", () => toggleCart(song, "pdf"));
  video.addEventListener("click", () => toggleCart(song, "video"));
  return node;
}

function renderCatalog() {
  const songs = filteredSongs();
  const visible = songs.slice(0, state.visible);
  els.grid.replaceChildren(...visible.map(createCard));
  els.count.textContent = songs.length;
  els.index.textContent = String(songs.length).padStart(2, "0");
  els.title.textContent = state.query || state.section !== "Все" ? "Результаты поиска" : "Вся библиотека";
  els.empty.hidden = songs.length !== 0;
  els.grid.hidden = songs.length === 0;
  const remaining = songs.length - visible.length;
  els.loadMore.parentElement.hidden = remaining <= 0;
  els.loadMore.querySelector("span").textContent = remaining > 0 ? Math.min(PAGE_SIZE, remaining) : "";
}

function toggleCart(song, format) {
  const current = selectedFormat(song.id);
  if (current === format) state.cart = state.cart.filter((item) => item.id !== song.id);
  else {
    const price = format === "pdf" ? song.pdfPrice : song.videoPrice;
    const item = { id: song.id, slug: song.slug, artist: song.artist, title: song.title, format, price };
    state.cart = [...state.cart.filter((entry) => entry.id !== song.id), item];
  }
  saveCart(); renderCatalog(); renderModal(); if (!els.cartBackdrop.hidden) renderCart();
}
function renderCartCount() { els.cartCount.textContent = state.cart.length; els.cartTrigger.setAttribute("aria-label", `Открыть корзину, выбрано песен: ${state.cart.length}`); }
function formatLabel(format) { return format === "pdf" ? "PDF с текстовым разбором" : "PDF + видеоразбор"; }
function cartMessage() {
  const total = state.cart.reduce((sum, item) => sum + item.price, 0);
  return `Здравствуйте! Хочу купить разборы на песни:\n${state.cart.map((item, index) => `${index + 1}. ${item.artist} — ${item.title} — ${formatLabel(item.format)} (${money(item.price)})`).join("\n")}\n\nИтого: ${money(total)}`;
}
function renderCart() {
  if (!state.cart.length) {
    els.cartContent.innerHTML = `<div class="cart-empty"><span>♪</span><h3>Пока пусто</h3><p>Выберите PDF или вариант с видео у одной или нескольких песен.</p><button class="button button-outline" id="empty-close" type="button">Вернуться к песням</button></div>`;
    els.cartContent.querySelector("#empty-close").addEventListener("click", closeCart); return;
  }
  const total = state.cart.reduce((sum, item) => sum + item.price, 0);
  els.cartContent.innerHTML = `<div class="cart-list">${state.cart.map((item, index) => `<div class="cart-row"><b>${String(index + 1).padStart(2, "0")}</b><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.artist)}</small><em>${escapeHtml(formatLabel(item.format))} · ${money(item.price)}</em></span><button type="button" data-remove="${item.id}" aria-label="Убрать ${escapeHtml(item.title)}">×</button></div>`).join("")}</div><div class="cart-total"><span>Итого</span><strong>${money(total)}</strong></div><div class="cart-actions"><button class="cart-clear" id="cart-clear" type="button">Очистить</button><a class="button button-primary" id="telegram-order" href="https://t.me/nikguitar?text=${encodeURIComponent(cartMessage())}" target="_blank" rel="noreferrer">Отправить заявку Никите</a></div><p class="cart-note">Telegram откроется с готовым списком. На всякий случай текст заявки также скопируется.</p>`;
  els.cartContent.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => { state.cart = state.cart.filter((item) => item.id !== Number(button.dataset.remove)); saveCart(); renderCart(); renderCatalog(); renderModal(); }));
  els.cartContent.querySelector("#cart-clear").addEventListener("click", () => { state.cart = []; saveCart(); renderCart(); renderCatalog(); renderModal(); });
  els.cartContent.querySelector("#telegram-order").addEventListener("click", () => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(cartMessage()).catch(() => undefined);
  });
}
function openCart() { renderCart(); els.cartBackdrop.hidden = false; document.body.classList.add("no-scroll"); }
function closeCart() { els.cartBackdrop.hidden = true; document.body.classList.remove("no-scroll"); }

function renderModal() {
  const song = state.modalSong;
  if (!song) return;
  const selected = selectedFormat(song.id);
  const dots = "●".repeat(Math.max(1, Math.min(4, song.difficulty)));
  els.modalContent.innerHTML = `<div class="modal-grid"><div class="song-cover modal-cover cover-${song.coverStyle}"><div class="record" aria-hidden="true"><i></i></div><div class="cover-copy"><span>${escapeHtml(song.artist)}</span><strong id="modal-title">${escapeHtml(song.title)}</strong></div></div><div class="modal-copy">${badge(song)}<p>${escapeHtml(song.description)}</p><div class="facts"><span><small>Сложность</small><strong>${dots} · ${difficultyLabel(song.difficulty)}</strong></span><span><small>Тональность</small><strong>${escapeHtml(song.keyName || "Оригинал")}</strong></span><span><small>Баррэ</small><strong>${song.barre ? "Есть" : "Нет"}</strong></span></div><div class="modal-features">${[...new Set(song.features)].map((feature) => `<span>${icons[feature] || "•"} ${escapeHtml(feature)}</span>`).join("")}</div><div class="purchase-options"><button type="button" data-modal-format="pdf" class="${selected === "pdf" ? "added" : ""}"><span>PDF с текстовым разбором</span><strong>${money(song.pdfPrice)}</strong></button><button type="button" data-modal-format="video" class="${selected === "video" ? "added" : ""}"><span>PDF + видеоразбор</span><strong>${money(song.videoPrice)}</strong></button></div></div></div>`;
  els.modalContent.querySelectorAll("[data-modal-format]").forEach((button) => button.addEventListener("click", () => toggleCart(song, button.dataset.modalFormat)));
}
function openSong(id) { state.modalSong = state.songs.find((song) => song.id === id); renderModal(); els.songBackdrop.hidden = false; document.body.classList.add("no-scroll"); }
function closeSong() { state.modalSong = null; els.songBackdrop.hidden = true; document.body.classList.remove("no-scroll"); }

els.search.addEventListener("input", () => { state.query = els.search.value; state.visible = PAGE_SIZE; els.search.parentElement.classList.toggle("has-value", Boolean(state.query)); renderCatalog(); });
els.searchClear.addEventListener("click", () => { els.search.value = ""; state.query = ""; state.visible = PAGE_SIZE; els.search.parentElement.classList.remove("has-value"); els.search.focus(); renderCatalog(); });
els.sort.addEventListener("change", () => { state.sort = els.sort.value; state.visible = PAGE_SIZE; renderCatalog(); });
els.loadMore.addEventListener("click", () => { state.visible += PAGE_SIZE; renderCatalog(); });
els.cartTrigger.addEventListener("click", openCart); els.cartClose.addEventListener("click", closeCart); els.modalClose.addEventListener("click", closeSong);
els.cartBackdrop.addEventListener("click", (event) => { if (event.target === els.cartBackdrop) closeCart(); });
els.songBackdrop.addEventListener("click", (event) => { if (event.target === els.songBackdrop) closeSong(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { if (!els.songBackdrop.hidden) closeSong(); else if (!els.cartBackdrop.hidden) closeCart(); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); els.search.focus(); } });

fetch("./songs.json")
  .then((response) => { if (!response.ok) throw new Error("Не удалось загрузить каталог"); return response.json(); })
  .then((payload) => { state.songs = Array.isArray(payload.songs) ? payload.songs : []; renderTabs(); renderCartCount(); renderCatalog(); })
  .catch(() => { els.grid.innerHTML = "<p>Не удалось загрузить каталог. Обновите страницу.</p>"; });
