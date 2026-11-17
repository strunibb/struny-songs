/* Inline previews in song cards, song details and album track lists.
   Streams official Apple Music embeds and, where verified, official YouTube embeds.
   Nothing downloads audio or sends the visitor to a search page. */
"use strict";

const previewState = {
  index: {}, active: null, cache: new Map(), pending: new Map(),
  serial: 0, requestSerial: 0
};
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function previewLatin(value) {
  const transliteration = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",
    й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",
    т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",
    ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"
  };
  return String(value || "").normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[а-яё]/g, letter => transliteration[letter] ?? letter)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function previewArtistEquals(actual, expected) {
  const a = previewLatin(actual), b = previewLatin(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  /* Store credits sometimes append collaborators. Match the named principal artist,
     never a merely similar name or a karaoke/tribute artist. */
  const firstCredit = value => value.split(/\s+(?:feat|featuring|ft|with|and)\s+/i)[0].trim();
  /* The store may append collaborators to a known principal artist. */
  return firstCredit(a) === b;
}

function previewTitleEquals(actual, expected) {
  const a = previewLatin(actual), b = previewLatin(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  /* Permit only clearly marked mastering versions of exactly the same song. */
  const stripMastering = value => value
    .replace(/\s+(?:remaster(?:ed)?|remastered version|single version|radio edit)(?:\s+\d{4})?$/,"")
    .trim();
  return stripMastering(a) === stripMastering(b);
}

function previewVerifiedYoutube(song) {
  if (!song || song.previewDisabled === true) return null;
  const manual = typeof song.previewVideoId === "string" ? song.previewVideoId.trim() : "";
  if (YOUTUBE_ID.test(manual)) {
    return {videoId:manual, start:previewStart(song.previewStart)};
  }
  const indexed = previewState.index[String(song.id)];
  if (!indexed || !YOUTUBE_ID.test(indexed.videoId)) return null;
  if (!previewArtistEquals(indexed.artist,song.artist) ||
      !previewTitleEquals(indexed.title,song.title)) return null;
  return {videoId:indexed.videoId, start:previewStart(indexed.start)};
}

function previewStart(number) {
  return Number.isInteger(number) && number >= 0 && number <= 3600 ? number : 0;
}

function previewEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:" ||
        !["music.apple.com","embed.music.apple.com"].includes(host)) return "";
    if (!/^\/[a-z]{2}\/(?:song|album)\//i.test(parsed.pathname)) return "";
    parsed.hostname = "embed.music.apple.com";
    parsed.searchParams.delete("uo");
    return parsed.href;
  } catch {
    return "";
  }
}

function previewFromAppleResult(track) {
  if (!track || !Number.isSafeInteger(track.trackId)) return "";
  const direct = previewEmbedUrl(track.trackViewUrl);
  if (direct) return direct;
  const albumId = Number(track.collectionId);
  if (!Number.isSafeInteger(albumId) || albumId <= 0) return "";
  /* Standard Apple Music album route with selected track ID. */
  return "https://embed.music.apple.com/us/album/" + albumId + "?i=" + track.trackId;
}

function previewFindExact(data, song) {
  if (!Array.isArray(data?.results)) return "";
  for (const track of data.results) {
    if (track.kind !== "song") continue;
    if (!previewTitleEquals(track.trackName,song.title)) continue;
    if (!previewArtistEquals(track.artistName,song.artist)) continue;
    const url = previewFromAppleResult(track);
    if (url) return url;
  }
  return "";
}

function previewJsonp(term,country) {
  return new Promise((resolve,reject) => {
    const callback = "__strunyMusicPreview_" + ++previewState.requestSerial;
    const script = document.createElement("script");
    let finished = false;
    const stop = (error,data) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      script.remove();
      try { delete window[callback]; } catch { window[callback] = undefined; }
      if (error) reject(error); else resolve(data);
    };
    const timeout = setTimeout(() => stop(new Error("Timeout")), 6000);
    window[callback] = data => stop(null,data);
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.onerror = () => stop(new Error("Apple Music search unavailable"));
    const params = new URLSearchParams({
      term, country, media:"music", entity:"song", limit:"30", callback
    });
    script.src = "https://itunes.apple.com/search?" + params.toString();
    document.head.append(script);
  });
}

function previewLookup(song) {
  if (song.previewDisabled === true) return Promise.resolve("");
  const manual = previewEmbedUrl(song.previewAppleMusicUrl || song.previewAppleUrl || "");
  if (manual) return Promise.resolve(manual);
  const key = previewLatin(song.artist) + "|" + previewLatin(song.title);
  if (previewState.cache.has(key)) return Promise.resolve(previewState.cache.get(key));
  if (previewState.pending.has(key)) return previewState.pending.get(key);
  const task = (async () => {
    const search = String(song.artist || "") + " " + String(song.title || "");
    /* A second storefront helps tracks omitted from the US catalogue.
       Search only when a visitor clicks, rather than 1,100+ API calls on load. */
    let hadSuccessfulLookup = false;
    for (const country of ["US","RU"]) {
      try {
        const result = await previewJsonp(search,country);
        hadSuccessfulLookup = true;
        const url = previewFindExact(result,song);
        if (url) { previewState.cache.set(key,url); return url; }
      } catch {
        /* Avoid a second long wait when the service is unreachable. */
        if (country === "US") break;
      }
    }
    if (hadSuccessfulLookup) previewState.cache.set(key,"");
    return "";
  })();
  previewState.pending.set(key,task);
  task.finally(() => previewState.pending.delete(key));
  return task;
}

function previewButton(song,mode="card") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "preview-button preview-button-" + mode;
  button.dataset.previewId = String(song.id);
  button.dataset.previewMode = mode;
  button.textContent = song.previewDisabled === true ? "♫ Фрагмент недоступен" : "♫ Прослушать фрагмент";
  button.disabled = song.previewDisabled === true;
  button.setAttribute("aria-expanded","false");
  button.setAttribute("aria-label","Прослушать оригинал: " + song.artist + " — " + song.title);
  button.title = "Раскрыть встроенный музыкальный плеер на этой странице";
  button.addEventListener("click", () => previewToggle(song,button));
  return button;
}

function previewDecorateCard(card,song) {
  const body = card.querySelector(".card-body");
  const options = body?.querySelector(".purchase-options");
  if (body && options) body.insertBefore(previewButton(song,"card"),options);
}

function previewDecorateModal(modal,song) {
  const anchor = modal.querySelector(".modal-description");
  if (!anchor) return;
  const container = document.createElement("div");
  container.className = "modal-preview-action";
  container.append(previewButton(song,"modal"));
  anchor.insertAdjacentElement("afterend",container);
}

function previewRefreshButtons() {
  /* All songs can be looked up when clicked. No external search fallback. */
  document.querySelectorAll(".preview-button").forEach(button => {
    const song = typeof state !== "undefined" && Array.isArray(state.songs)
      ? state.songs.find(item => String(item.id) === button.dataset.previewId) : null;
    if (!song) return;
    const isDisabled = song.previewDisabled === true;
    button.disabled = isDisabled;
    if (!button.classList.contains("is-open")) {
      button.textContent = isDisabled ? "♫ Фрагмент недоступен" : "♫ Прослушать фрагмент";
    }
  });
}

function previewClose() {
  const active = previewState.active;
  if (!active) return;
  /* Removing the iframe stops playback instantly. */
  active.panel.remove();
  active.button.classList.remove("is-open");
  active.button.setAttribute("aria-expanded","false");
  active.button.textContent = "♫ Прослушать фрагмент";
  previewState.active = null;
}

function previewToggle(song,button) {
  if (previewState.active?.button === button && previewState.active.panel.isConnected) {
    previewClose();
    return;
  }
  previewClose();
  const panel = document.createElement("div");
  panel.className = "song-preview-panel";
  panel.id = "song-preview-" + ++previewState.serial;
  panel.setAttribute("role","region");
  panel.setAttribute("aria-label","Музыкальный фрагмент: " + song.artist + " — " + song.title);
  button.setAttribute("aria-controls",panel.id);
  button.setAttribute("aria-expanded","true");
  button.classList.add("is-open");
  button.textContent = "■ Закрыть фрагмент";
  const row = button.closest(".album-track");
  if (row) row.append(panel);
  else button.insertAdjacentElement("afterend",panel);
  const active = {button,panel};
  previewState.active = active;
  const status = document.createElement("p");
  status.className = "preview-inline-status";
  status.textContent = "Ищем оригинальную запись…";
  status.setAttribute("role","status");
  panel.append(status);
  previewLookup(song).then(appleUrl => {
    if (previewState.active !== active || !panel.isConnected) return;
    if (appleUrl) previewApple(active,song,appleUrl);
    else {
      const youtube = previewVerifiedYoutube(song);
      if (youtube) previewYoutube(active,song,youtube);
      else previewUnavailable(active);
    }
  }).catch(() => {
    if (previewState.active !== active || !panel.isConnected) return;
    const youtube = previewVerifiedYoutube(song);
    if (youtube) previewYoutube(active,song,youtube);
    else previewUnavailable(active);
  });
}

function previewPanelHeading(song,service) {
  const heading = document.createElement("div");
  heading.className = "song-preview-heading";
  const label = document.createElement("span");
  label.textContent = "ОРИГИНАЛЬНАЯ ЗАПИСЬ";
  const source = document.createElement("small");
  source.textContent = service;
  heading.append(label,source);
  return heading;
}

function previewApple(active,song,url) {
  const frame = document.createElement("iframe");
  frame.src = url;
  frame.title = "Apple Music: " + song.artist + " — " + song.title;
  frame.className = "song-preview-apple";
  frame.setAttribute("allow","autoplay *; encrypted-media *");
  frame.setAttribute("loading","eager");
  frame.setAttribute("referrerpolicy","strict-origin-when-cross-origin");
  const note = document.createElement("p");
  note.className = "song-preview-footnote";
  note.textContent = "Нажмите ▶ в плеере. Обычно доступен 30-секундный фрагмент без подписки.";
  active.panel.replaceChildren(previewPanelHeading(song,"APPLE MUSIC"),frame,note);
}

function previewYoutube(active,song,record) {
  const frame = document.createElement("iframe");
  frame.src = "https://www.youtube-nocookie.com/embed/" + record.videoId + "?" +
    new URLSearchParams({playsinline:"1",rel:"0",start:String(record.start),end:String(record.start+30)}).toString();
  frame.title = "Официальная запись: " + song.artist + " — " + song.title;
  frame.className = "song-preview-youtube";
  frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  frame.allowFullscreen = true;
  frame.setAttribute("loading","eager");
  frame.setAttribute("referrerpolicy","strict-origin-when-cross-origin");
  const note = document.createElement("p");
  note.className = "song-preview-footnote";
  note.textContent = "Воспроизведение на этой странице · фрагмент до 30 секунд.";
  active.panel.replaceChildren(previewPanelHeading(song,"YOUTUBE"),frame,note);
}

function previewUnavailable(active) {
  const note = document.createElement("p");
  note.className = "preview-inline-unavailable";
  note.textContent = "Пока нет подтверждённой оригинальной записи для встроенного прослушивания. Вы остаётесь в каталоге.";
  active.panel.replaceChildren(note);
}

document.addEventListener("keydown",event => {
  if (event.key === "Escape" && previewState.active) {
    event.stopImmediatePropagation();
    previewClose();
  }
},true);
document.addEventListener("visibilitychange",() => {
  if (document.hidden) previewClose();
});
document.addEventListener("click",event => {
  if (event.target.closest(".cover-button,.card-title,#modal-close,.modal-close,.album-open")) {
    previewClose();
  }
});
fetch("./previews.json",{cache:"no-store"})
  .then(response => response.ok ? response.json() : {tracks:{}})
  .then(data => {
    previewState.index = data?.tracks && typeof data.tracks === "object" ? data.tracks : {};
    previewRefreshButtons();
  })
  .catch(() => previewRefreshButtons());
