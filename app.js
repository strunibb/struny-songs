const SECTIONS = ["Все", "Новинки", "Бесплатные", "Начинающий", "Продвинутый", "Профи", "Фингерстайл", "Зарубежный рок", "Песни по альбомам"];
const PAGE_SIZE = 48;
const STORAGE_KEY = "struny-github-pages-cart-v1";
const icons = { "Аккорды": "♬", "Бой": "↯", "Перебор": "≋", "Рифф": "ϟ", "Соло": "◇", "Фингерстайл": "✦", "Табулатура": "▦", "Интересный бой": "↯", "Электрогитара": "⚡" };
const levelColors = { "Начинающий": "green", "Любитель": "yellow", "Продвинутый": "red", "Профи": "hot", "Фингерстайл": "purple", "Зарубежный рок": "blue", "Электрогитара": "blue", "Интересный бой": "purple" };

const initialFilters = new URLSearchParams(window.location.search);
const legacySections = { "Электрогитара": "Зарубежный рок", "Песни с интересным боем": "Продвинутый" };
const urlSection = legacySections[initialFilters.get("section")] || initialFilters.get("section");
const state = { songs: [], query: initialFilters.get("q") || "", section: SECTIONS.includes(urlSection) ? urlSection : "Все", sort: "title", releasePeriod: RELEASE_PERIODS.includes(initialFilters.get("release")) ? initialFilters.get("release") : "all", visible: PAGE_SIZE, cart: loadCart(), modalSong: null, modalAlbum: null, albums: [] };
const els = {
  search: document.querySelector("#search"), searchClear: document.querySelector("#search-clear"), tabs: document.querySelector("#tabs"), sort: document.querySelector("#sort"),
  grid: document.querySelector("#song-grid"), count: document.querySelector("#result-count"), title: document.querySelector("#result-title"),
  loadMore: document.querySelector("#load-more"), empty: document.querySelector("#empty-state"), template: document.querySelector("#card-template"),
  cartTrigger: document.querySelector("#cart-trigger"), cartCount: document.querySelector("#cart-count"), cartBackdrop: document.querySelector("#cart-backdrop"), cartClose: document.querySelector("#cart-close"), cartContent: document.querySelector("#cart-content"),
  songBackdrop: document.querySelector("#song-backdrop"), modalClose: document.querySelector("#modal-close"), modalContent: document.querySelector("#song-modal-content"),
};

function normalize(value) { return String(value || "").normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/\s+/g, " ").trim(); }
function money(value) { return value === 0 ? "Бесплатно" : `${value} ₽`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
function labelFor(song) {
  if (song.level !== "Без категории") return song.level;
  if (song.sections.includes("Зарубежный рок")) return "Зарубежный рок";
  return "Продвинутый";
}
function difficultyLabel(value) { return ["Начинающий", "Любитель", "Продвинутый", "Профи"][Math.max(1, Math.min(4, value)) - 1]; }

function loadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && Number.isFinite(item.id) && ["pdf", "video"].includes(item.format)) : [];
  } catch { return []; }
}
function saveCart() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart)); }
  catch { /* Корзина продолжает работать в текущей вкладке при запрете хранилища. */ }
  renderCartCount();
}
function reconcileCart() {
  const songsById = new Map(state.songs.map((song) => [song.id, song]));
  const currentItems = new Map();
  for (const item of state.cart) {
    const song = songsById.get(item.id);
    if (!song || (item.format === "video" && song.videoAvailable === false)) continue;
    currentItems.set(song.id, {
      id: song.id, slug: song.slug, artist: song.artist, title: song.title,
      format: item.format, price: item.format === "pdf" ? song.pdfPrice : song.videoPrice,
    });
  }
  state.cart = [...currentItems.values()];
  saveCart();
}
function syncFilters() {
  const url = new URL(window.location.href);
  if (state.query) url.searchParams.set("q", state.query);
  else url.searchParams.delete("q");
  if (state.section !== "Все") url.searchParams.set("section", state.section);
  else url.searchParams.delete("section");
  if (state.releasePeriod !== "all") url.searchParams.set("release", state.releasePeriod);
  else url.searchParams.delete("release");
  window.history.replaceState(null, "", url);
}
function selectedFormat(id) { return state.cart.find((item) => item.id === id)?.format || null; }

function renderTabs() {
  els.tabs.replaceChildren(...SECTIONS.map((section) => {
    const button = document.createElement("button");
    button.type = "button"; button.textContent = section; button.dataset.section = section;
    button.setAttribute("aria-pressed", String(state.section === section));
    button.className = state.section === section ? "active" : "";
    button.addEventListener("click", () => {
      state.section = section; state.visible = PAGE_SIZE;
      if (section === "Новинки") { state.sort = "fresh"; els.sort.value = "fresh"; }
      renderTabs(); renderCatalog();
    });
    return button;
  }));
}

function filteredSongs() {
  const query = normalize(state.query);
  const result = state.songs.filter((song) => {
    const searchableText = normalize(`${song.artist} ${song.title}`);
    const matchesText = !query || query.split(" ").every((word) => searchableText.includes(word));
    const matchesSection = state.section === "Все"
      || (state.section === "Бесплатные" && Number(song.pdfPrice) === 0)
      || (state.section === "Новинки" && (Boolean(song.isNew) || releaseRecency(song) !== null))
      || song.sections.includes(state.section);
    return matchesText && matchesSection && releasePeriodMatches(song, state.releasePeriod);
  });
  return result.sort((a, b) => {
    if (state.sort === "fresh") return compareFreshness(a,b);
    if (state.sort === "release") return releaseOrderValue(b)-releaseOrderValue(a) || a.title.localeCompare(b.title,"ru");
    if (state.sort === "popular") return b.popularity - a.popularity || a.artist.localeCompare(b.artist, "ru");
    if (state.sort === "easy") return a.difficulty - b.difficulty || a.artist.localeCompare(b.artist, "ru");
    if (state.sort === "hard") return b.difficulty - a.difficulty || a.artist.localeCompare(b.artist, "ru");
    if (state.sort === "new") return new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id;
    if (state.sort === "artist") return a.artist.localeCompare(b.artist, "ru") || a.title.localeCompare(b.title, "ru");
    return a.title.localeCompare(b.title, "ru") || a.artist.localeCompare(b.artist, "ru");
  });
}

function badge(song) {
  const label = labelFor(song);
  return `<span class="level-badge level-${levelColors[label] || "purple"}">${escapeHtml(label)}</span>`;
}

function featureMarkup(features, limit = 4, videoAvailable = true) {
  const shown = [...new Set(features)].slice(0, limit);
  return [
    ...shown.map((feature) => `<span>${icons[feature] || "•"} ${escapeHtml(feature)}</span>`),
    ...(videoAvailable ? ["<span>▶ Видео</span>"] : []),
    "<span>▤ PDF</span>"
  ].join("");
}

function coverImageUrl(song) {
  const url = typeof song.coverUrl === "string" ? song.coverUrl.trim() : "";
  return (url.startsWith("https://") || url.startsWith("http://") || url.startsWith("./") || url.startsWith("/")) ? url : "";
}

function createCard(song) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.dataset.id = song.id;
  const cover = node.querySelector(".song-cover");
  cover.classList.add("cover-" + song.coverStyle);
  const coverUrl = coverImageUrl(song);
  if (coverUrl) {
    const image = document.createElement("img");
    image.src = coverUrl;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    cover.prepend(image);
    cover.classList.add("has-image");
    image.addEventListener("error", () => { image.remove(); cover.classList.remove("has-image"); });
  }
  const releaseBadge = releaseLabel(song);
  const badgeNode=node.querySelector(".new-label");
  if (!releaseBadge) badgeNode.remove();
  else {
    badgeNode.textContent=releaseBadge;
    badgeNode.classList.toggle("release-fresh", releaseRecency(song)!==null);
  }
  const showSong = () => openSong(song.id);
  node.querySelector(".card-title").textContent = song.title;
  node.querySelector(".card-title").addEventListener("click", showSong);
  node.querySelector(".card-artist").textContent = song.artist;
  const coverButton = node.querySelector(".cover-button");
  coverButton.setAttribute("aria-label", "Подробнее: " + song.artist + " — " + song.title);
  coverButton.addEventListener("click", showSong);
  node.querySelector(".card-section-line").innerHTML = badge(song);
  node.querySelector(".feature-list").innerHTML = featureMarkup(song.features, 4, song.videoAvailable !== false);
  const selected = selectedFormat(song.id);
  const pdf = node.querySelector('[data-format="pdf"]');
  const video = node.querySelector('[data-format="video"]');
  pdf.querySelector("strong").textContent = money(song.pdfPrice);
  if (song.videoAvailable === false) {
    video.disabled = true;
    video.querySelector("span").textContent = "Видео уточняется";
    video.querySelector("strong").textContent = "Недоступно";
    video.setAttribute("title", "Наличие видеоразбора не подтверждено");
  } else video.querySelector("strong").textContent = money(song.videoPrice);
  pdf.classList.toggle("added", selected === "pdf");
  video.classList.toggle("added", selected === "video");
  pdf.setAttribute("aria-pressed", String(selected === "pdf"));
  video.setAttribute("aria-pressed", String(selected === "video"));
  pdf.addEventListener("click", () => toggleCart(song, "pdf"));
  if (song.videoAvailable !== false) video.addEventListener("click", () => toggleCart(song, "video"));
  return node;
}

function renderCatalog() {
  if (state.section === "Песни по альбомам") { renderAlbumCatalog(); syncFilters(); return; }
  els.grid.classList.remove("album-grid");
  document.querySelector("#result-unit").textContent = "песен";
  const songs = filteredSongs();
  const visible = songs.slice(0, state.visible);
  els.grid.replaceChildren(...visible.map(createCard));
  els.count.textContent = songs.length;
  syncFilters();
  els.title.textContent = state.query || state.section !== "Все" ? "Результаты поиска" : "Вся библиотека";
  els.empty.hidden = songs.length !== 0;
  els.grid.hidden = songs.length === 0;
  const remaining = songs.length - visible.length;
  els.loadMore.parentElement.hidden = remaining <= 0;
  els.loadMore.querySelector("span").textContent = remaining > 0 ? Math.min(PAGE_SIZE, remaining) : "";
}

function toggleCart(song, format) {
  if (format === "video" && song.videoAvailable === false) return;
  const current = selectedFormat(song.id);
  if (current === format) state.cart = state.cart.filter((item) => item.id !== song.id);
  else {
    const price = format === "pdf" ? song.pdfPrice : song.videoPrice;
    const item = { id: song.id, slug: song.slug, artist: song.artist, title: song.title, format, price };
    state.cart = [...state.cart.filter((entry) => entry.id !== song.id), item];
  }
  const fromModal = els.songBackdrop.contains(document.activeElement);
  saveCart(); renderCatalog(); renderModal(); if (!els.cartBackdrop.hidden) renderCart();
  document.querySelector("#cart-feedback").textContent = current === format
    ? `${song.title} убрана из корзины`
    : `${song.title}, ${formatLabel(format)}, добавлено в корзину`;
  const selectedButton = fromModal
    ? (state.modalAlbum
      ? els.modalContent.querySelector(`[data-album-song="${song.id}"][data-format="${format}"]`)
      : els.modalContent.querySelector(`[data-modal-format="${format}"]`))
    : els.grid.querySelector(`[data-id="${song.id}"] [data-format="${format}"]`);
  selectedButton?.focus({ preventScroll: true });
}
function renderCartCount() { els.cartCount.textContent = state.cart.length; els.cartTrigger.setAttribute("aria-label", `Открыть корзину, выбрано песен: ${state.cart.length}`); }
function formatLabel(format) { return format === "pdf" ? "PDF с текстовым разбором" : "PDF + видеоразбор"; }
function cartMessage() {
  const total = state.cart.reduce((sum, item) => sum + item.price, 0);
  return `Здравствуйте, Никита! Хочу получить разборы песен:\n${state.cart.map((item, index) => `${index + 1}. ${item.artist} — ${item.title} — ${formatLabel(item.format)} (${money(item.price)})`).join("\n")}\n\nИтого: ${money(total)}`;
}
function renderCart() {
  if (!state.cart.length) {
    els.cartContent.innerHTML = '<div class="cart-empty"><span>♪</span><h3>Пока пусто</h3><p>Выберите PDF или вариант с видео у одной или нескольких песен.</p><button class="button button-outline" id="empty-close" type="button">Вернуться к песням</button></div>';
    els.cartContent.querySelector("#empty-close").addEventListener("click", closeCart);
    return;
  }
  const total = state.cart.reduce((sum,item) => sum + item.price,0);
  const hasPaidItems = state.cart.some(item=>item.price>0);
  const minimumMet = !hasPaidItems || total>=100;
  const remaining=Math.max(0,100-total);
  const controls = minimumMet
    ? '<a class="button button-primary" id="telegram-order" href="https://t.me/nikguitar?text='+encodeURIComponent(cartMessage())+'" target="_blank" rel="noreferrer">Отправить заявку Никите</a>'
    : '<button class="button button-primary" id="telegram-order" type="button" disabled aria-disabled="true">До заказа ещё '+money(remaining)+'</button>';
  const hint = minimumMet
    ? (hasPaidItems ? 'Минимальный платный заказ 100 ₽. Откроется сообщение для согласования оплаты и получения материалов.' :
      'Все выбранные материалы бесплатны. Отправьте заявку, чтобы получить PDF и видео.')
    : 'Минимальная сумма платного заказа 100 ₽. Добавьте ещё песен на '+money(remaining)+'. Бесплатные материалы не увеличивают сумму.';
  els.cartContent.innerHTML =
    '<div class="cart-list">'+state.cart.map((item,index)=>
      '<div class="cart-row"><b>'+String(index+1).padStart(2,"0")+'</b><span><strong>'+escapeHtml(item.title)+'</strong><small>'+escapeHtml(item.artist)+'</small><em>'+escapeHtml(formatLabel(item.format))+' · '+money(item.price)+'</em></span><button type="button" data-remove="'+item.id+'" aria-label="Убрать '+escapeHtml(item.title)+'">×</button></div>'
    ).join("")+'</div>'+
    '<div class="cart-total"><span>Итого</span><strong>'+money(total)+'</strong></div>'+
    (minimumMet?'':'<p class="cart-minimum" role="status">До минимального заказа не хватает <b>'+money(remaining)+'</b></p>')+
    '<div class="cart-actions"><button class="cart-clear" id="cart-clear" type="button">Очистить</button>'+controls+'</div>'+
    '<p class="cart-note">'+hint+'</p>';
  els.cartContent.querySelectorAll("[data-remove]").forEach(button=>button.addEventListener("click",()=>{
    state.cart=state.cart.filter(item=>item.id!==Number(button.dataset.remove));
    saveCart();renderCart();renderCatalog();renderModal();
  }));
  els.cartContent.querySelector("#cart-clear").addEventListener("click",()=>{
    state.cart=[];saveCart();renderCart();renderCatalog();renderModal();
  });
  if(minimumMet)els.cartContent.querySelector("#telegram-order").addEventListener("click",()=>{
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(cartMessage()).catch(()=>undefined);
  });
}
function openCart() {
  if (!els.songBackdrop.hidden) closeSong();
  renderCart(); els.cartBackdrop.hidden = false;
  document.body.classList.add("no-scroll"); els.cartClose.focus();
}
function closeCart() { els.cartBackdrop.hidden = true; document.body.classList.remove("no-scroll"); els.cartTrigger.focus(); }

function renderModal() {
  if (state.modalAlbum) { renderAlbumModal(); return; }
  const song = state.modalSong;
  if (!song) return;
  const selected = selectedFormat(song.id);
  const releaseTag = releaseLabel(song);
  const dots = "●".repeat(Math.max(1, Math.min(4, song.difficulty)));
  const coverUrl = coverImageUrl(song);
  const coverImage = coverUrl ? '<img src="' + escapeHtml(coverUrl) + '" alt="" loading="eager" decoding="async">' : "";
  const features = [...new Set(song.features)];
  els.modalContent.innerHTML = `
    <div class="modal-content">
      <div class="modal-identity">
        <div class="song-cover modal-cover cover-${escapeHtml(song.coverStyle)}${coverUrl ? " has-image" : ""}">
          ${coverImage}
          <div class="record" aria-hidden="true"><i></i></div>
          <div class="cover-copy"><span>${escapeHtml(song.artist)}</span><strong>${escapeHtml(song.title)}</strong></div>
        </div>
        <div class="modal-heading">
          ${badge(song)}
          ${releaseTag ? '<span class="song-release-tag">'+escapeHtml(releaseTag)+'</span>' : ''}
          <p class="modal-artist">${escapeHtml(song.artist)}</p>
          <h2 id="modal-title">${escapeHtml(song.title)}</h2>
          <p class="modal-description">${escapeHtml(song.description)}</p>
          ${coverUrl && song.coverSource ? `<a class="cover-credit" href="${escapeHtml(song.coverSource)}" target="_blank" rel="noopener noreferrer">Источник обложки ↗</a>` : ""}
        </div>
      </div>
      <div class="modal-bottom">
        <div class="modal-details">
          <h3>О песне</h3>
          <div class="facts">
            <span><small>Сложность</small><strong>${dots} · ${difficultyLabel(song.difficulty)}</strong></span>
            <span><small>Тональность</small><strong>${escapeHtml(song.keyName || "Оригинал")}</strong></span>
            <span><small>Баррэ</small><strong>${song.barre === null ? "Не указано" : song.barre ? "Есть" : "Нет"}</strong></span>
          </div>
          ${features.length ? '<div class="modal-features">' + features.map((feature) => '<span>' + (icons[feature] || "•") + ' ' + escapeHtml(feature) + '</span>').join("") + '</div>' : ""}
        </div>
        <div class="modal-buy">
          <h3>Выберите формат</h3>
          <p>Добавим выбранный материал в корзину</p>
          <div class="purchase-options">
            <button type="button" data-modal-format="pdf" class="${selected === "pdf" ? "added" : ""}"><span>PDF-разбор</span><strong>${money(song.pdfPrice)}</strong></button>
            <button type="button" data-modal-format="video" class="${selected === "video" ? "added" : ""}" ${song.videoAvailable === false ? 'disabled title="Видеоразбор не подтверждён"' : ""}><span>${song.videoAvailable === false ? "Видео уточняется" : "PDF + видеоразбор"}</span><strong>${song.videoAvailable === false ? "Недоступно" : money(song.videoPrice)}</strong></button>
          </div>
        </div>
      </div>
    </div>`;
  const modalImage = els.modalContent.querySelector(".modal-cover img");
  modalImage?.addEventListener("error", () => {
    modalImage.remove();
    els.modalContent.querySelector(".modal-cover")?.classList.remove("has-image");
  });
  els.modalContent.querySelectorAll("[data-modal-format]").forEach((button) => {
    button.setAttribute("aria-pressed", String(selected === button.dataset.modalFormat));
    button.addEventListener("click", () => toggleCart(song, button.dataset.modalFormat));
  });
  if (selected) {
    const cartButton = document.createElement("button");
    cartButton.type = "button";
    cartButton.className = "button button-primary modal-cart";
    cartButton.textContent = "Перейти в корзину";
    cartButton.addEventListener("click", openCart);
    els.modalContent.querySelector(".modal-buy").append(cartButton);
  }
}
function openSong(id) { state.modalAlbum = null; state.modalSong = state.songs.find((song) => song.id === id); renderModal(); els.songBackdrop.hidden = false; document.body.classList.add("no-scroll"); els.modalClose.focus(); }
function closeSong() {
  const songId = state.modalSong?.id;
  const albumKey = state.modalAlbum?.key;
  state.modalSong = null; state.modalAlbum = null; els.songBackdrop.hidden = true;
  document.body.classList.remove("no-scroll");
  (albumKey ? els.grid.querySelectorAll(".album-open") && [...els.grid.querySelectorAll(".album-open")].find(b => b.dataset.album===albumKey) : els.grid.querySelector(`[data-id="${songId}"] .cover-button`))?.focus({preventScroll:true});
}

els.search.addEventListener("input", () => { state.query = els.search.value; state.visible = PAGE_SIZE; els.search.parentElement.classList.toggle("has-value", Boolean(state.query)); renderCatalog(); });
els.searchClear.addEventListener("click", () => { els.search.value = ""; state.query = ""; state.visible = PAGE_SIZE; els.search.parentElement.classList.remove("has-value"); els.search.focus(); renderCatalog(); });
els.sort.addEventListener("change", () => { state.sort = els.sort.value; state.visible = PAGE_SIZE; renderCatalog(); });
const releaseSelect=document.querySelector("#release-period");
releaseSelect.value=state.releasePeriod;
releaseSelect.addEventListener("change", () => {
  state.releasePeriod = RELEASE_PERIODS.includes(releaseSelect.value) ? releaseSelect.value : "all";
  state.visible = PAGE_SIZE;
  renderCatalog();
});
els.loadMore.addEventListener("click", () => { state.visible += PAGE_SIZE; renderCatalog(); });
els.cartTrigger.addEventListener("click", openCart); els.cartClose.addEventListener("click", closeCart); els.modalClose.addEventListener("click", closeSong);
els.cartBackdrop.addEventListener("click", (event) => { if (event.target === els.cartBackdrop) closeCart(); });
els.songBackdrop.addEventListener("click", (event) => { if (event.target === els.songBackdrop) closeSong(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { if (!els.songBackdrop.hidden) closeSong(); else if (!els.cartBackdrop.hidden) closeCart(); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); els.search.focus(); } });

document.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const overlay = !els.songBackdrop.hidden ? els.songBackdrop : !els.cartBackdrop.hidden ? els.cartBackdrop : null;
  if (!overlay) return;
  const controls = [...overlay.querySelectorAll('button, a[href], input, select, [tabindex="0"]')]
    .filter((element) => !element.disabled && element.getClientRects().length);
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
els.search.value = state.query;
els.search.parentElement.classList.toggle("has-value", Boolean(state.query));
Promise.all([
  fetch("./songs.json").then((response) => { if (!response.ok) throw new Error("Не удалось загрузить каталог"); return response.json(); }),
  fetch("./covers.json").then((response) => response.ok ? response.json() : { covers: {} }).catch(() => ({ covers: {} })),
  fetch("./release-dates.json").then((response) => response.ok ? response.json() : { dates: {} }).catch(() => ({ dates: {} }))
])
  .then(([payload, art, musicReleases]) => {
    const covers = art && typeof art.covers === "object" && art.covers ? art.covers : {};
    state.songs = (Array.isArray(payload.songs) ? payload.songs : []).map((song) => {
      const cover = covers[String(song.id)];
      const releaseRecord = musicReleases?.dates?.[String(song.id)];
      return { ...song,
        releaseDate: song.releaseDate || releaseDateForIndex(song,releaseRecord),
        coverUrl: cover?.url || song.coverUrl || "",
        coverSource: cover?.source || "",
        coverAlbum: cover?.album || "" };
    });
    state.albums = makeAlbumGroups(state.songs);
    reconcileCart(); renderTabs(); renderCatalog(); els.grid.setAttribute("aria-busy", "false");
  })
  .catch(() => {
    els.grid.setAttribute("aria-busy", "false");
    els.loadMore.parentElement.hidden = true;
    els.grid.innerHTML = '<p role="alert">Не удалось загрузить каталог. <button type="button" class="button button-outline" id="retry-load">Повторить</button></p>';
    document.querySelector("#retry-load").addEventListener("click", () => window.location.reload());
  });
