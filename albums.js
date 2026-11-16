/* Album discovery and purchasing. Executed after app.js as a classic deferred script. */
function elementReleaseBadge(label){
  const tag=document.createElement("span");tag.className="album-track-fresh";
  tag.textContent=label;
  return tag;
}
function albumSlug(artist, title) {
  return normalize(artist) + "||" + normalize(title);
}

function makeAlbumGroups(songs) {
  const grouped = new Map();
  for (const song of songs) {
    const name = String(song.albumName || song.coverAlbum || "").trim();
    if (!name || /(?:^|[-–— ])(?:single|ep)$/i.test(name)) continue;
    const key = albumSlug(song.artist, name);
    if (!grouped.has(key)) grouped.set(key, { key, artist:song.artist, title:name, songs:[], artwork:"" });
    const album = grouped.get(key);
    album.songs.push(song);
    if (!album.artwork && coverImageUrl(song)) album.artwork = coverImageUrl(song);
  }
  return [...grouped.values()]
    .filter(a => a.songs.length >= 2)
    .map(a => ({...a, songs:a.songs.sort((x,y)=>x.title.localeCompare(y.title, "ru"))}))
    .sort((a,b) => b.songs.length-a.songs.length || a.artist.localeCompare(b.artist,"ru") || a.title.localeCompare(b.title,"ru"));
}

function albumPrice(album, format) {
  return album.songs.reduce((total, song) => total + (format==="pdf" ? song.pdfPrice : song.videoPrice), 0);
}

function makeAlbumArtwork(album, cls) {
  const frame = document.createElement("div");
  frame.className = cls;
  frame.textContent = "♫";
  if (album.artwork) {
    const image = document.createElement("img");
    image.src=album.artwork; image.alt="";
    image.loading="lazy"; image.decoding="async";
    image.addEventListener("error", () => image.remove());
    frame.replaceChildren(image);
  }
  return frame;
}

function makeAlbumCard(album) {
  const card=document.createElement("article");
  card.className="album-card";
  const btn=document.createElement("button");
  btn.type="button";btn.className="album-open";
  btn.dataset.album=album.key;
  btn.setAttribute("aria-label","Открыть альбом "+album.title+" — "+album.artist);
  btn.append(makeAlbumArtwork(album,"album-art"));
  const copy=document.createElement("div");copy.className="album-copy";
  const subtitle=document.createElement("p");subtitle.className="album-artist";subtitle.textContent=album.artist;
  const title=document.createElement("h3");title.textContent=album.title;
  const sub=document.createElement("p");sub.className="album-count";sub.textContent=album.songs.length+" разбора в каталоге";
  copy.append(subtitle,title,sub);
  btn.append(copy);
  btn.addEventListener("click",()=>openAlbum(album.key));
  const prices=document.createElement("div");prices.className="album-prices";
  const price=document.createElement("span");price.textContent="PDF от "+money(albumPrice(album,"pdf"));
  const link=document.createElement("span");link.textContent="Выбрать песни  ›";
  prices.append(price,link);
  card.append(btn,prices);
  return card;
}

function renderAlbumCatalog() {
  const query = normalize(state.query);
  const groups=state.albums.filter(a =>
    (!query || query.split(" ").every(w =>
      normalize(a.artist+" "+a.title+" "+a.songs.map(s=>s.title).join(" ")).includes(w))) &&
    (state.releasePeriod==="all" || a.songs.some(song=>releasePeriodMatches(song,state.releasePeriod)))
  ).sort((a,b)=>{
    if(state.sort==="release")return Math.max(...b.songs.map(releaseOrderValue))-Math.max(...a.songs.map(releaseOrderValue));
    if(state.sort==="fresh")return Math.max(...b.songs.map(freshnessScore))-Math.max(...a.songs.map(freshnessScore));
    return 0;
  });
  const visible=groups.slice(0,state.visible);
  els.grid.classList.add("album-grid");
  els.grid.replaceChildren(...visible.map(makeAlbumCard));
  els.count.textContent=groups.length;
  document.querySelector("#result-unit").textContent="альбомов";
  els.title.textContent="Песни по альбомам";
  els.empty.hidden=groups.length!==0;
  els.grid.hidden=groups.length===0;
  const remaining=groups.length-visible.length;
  els.loadMore.parentElement.hidden=remaining<=0;
  els.loadMore.querySelector("span").textContent=remaining>0?Math.min(PAGE_SIZE,remaining):"";
}

function addAlbumToCart(album,format) {
  if (format === "video" && album.songs.some(song => song.videoAvailable === false)) return;
  const selected=new Map(state.cart.map(item=>[item.id,item]));
  for(const song of album.songs) {
    selected.set(song.id,{id:song.id,slug:song.slug,artist:song.artist,title:song.title,
      format,price:format==="pdf"?song.pdfPrice:song.videoPrice});
  }
  state.cart=[...selected.values()];
  saveCart();renderCatalog();renderModal();
  document.querySelector("#cart-feedback").textContent=
    "Добавлено "+album.songs.length+" песен из альбома «"+album.title+"».";
  els.modalContent.querySelector('[data-album-add="'+format+'"]')?.focus({preventScroll:true});
}

function renderAlbumModal() {
  const album=state.modalAlbum;
  if (!album) return;
  const root=document.createElement("div");root.className="album-dialog";
  const top=document.createElement("div");top.className="album-dialog-head";
  top.append(makeAlbumArtwork(album,"album-dialog-cover"));
  const copy=document.createElement("div");
  const kicker=document.createElement("p");kicker.className="eyebrow";kicker.textContent="АЛЬБОМ · "+album.artist;
  const title=document.createElement("h2");title.id="modal-title";title.textContent=album.title;
  const subtitle=document.createElement("p");subtitle.className="album-subtitle";
  subtitle.textContent=album.songs.length+" песни доступны как отдельные разборы. Можно выбрать несколько или весь альбом.";
  copy.append(kicker,title,subtitle);top.append(copy);root.append(top);

  const group=document.createElement("div");group.className="album-track-group";
  const heading=document.createElement("h3");heading.textContent="Песни альбома";group.append(heading);
  album.songs.forEach((song,index)=>{
    const entry=document.createElement("div");entry.className="album-track";
    const num=document.createElement("span");num.className="album-track-number";num.textContent=String(index+1).padStart(2,"0");
    const meta=document.createElement("div");meta.className="album-track-meta";
    const songTitle=document.createElement("strong");songTitle.textContent=song.title;
    const info=document.createElement("small");info.textContent=money(song.pdfPrice)+" PDF · "+money(song.videoPrice)+" PDF + видео";
    meta.append(songTitle,info);
    const freshLabel=releaseLabel(song);
    if(freshLabel)meta.append(elementReleaseBadge(freshLabel));
    const actions=document.createElement("div");actions.className="album-track-actions";
    for(const format of ["pdf","video"]) {
      const button=document.createElement("button");
      button.type="button";button.dataset.albumSong=String(song.id);button.dataset.format=format;
      button.textContent=format==="pdf"?"PDF":song.videoAvailable===false?"Видео недоступно":"PDF + видео";
      button.disabled=format==="video" && song.videoAvailable===false;
      button.className="album-track-action"+(selectedFormat(song.id)===format?" selected":"");
      button.setAttribute("aria-pressed",String(selectedFormat(song.id)===format));
      button.addEventListener("click",()=>toggleCart(song,format));
      actions.append(button);
    }
    entry.append(num,meta,actions);group.append(entry);
  });
  root.append(group);
  const controls=document.createElement("div");controls.className="album-bundle";
  const label=document.createElement("h3");label.textContent="Весь альбом";
  const desc=document.createElement("p");desc.textContent="Цена равна сумме песен. Бесплатные треки входят бесплатно, минимальный платный заказ 100 ₽.";
  controls.append(label,desc);
  const buttons=document.createElement("div");buttons.className="album-bundle-buttons";
  for(const format of ["pdf","video"]) {
    const button=document.createElement("button");button.type="button";button.dataset.albumAdd=format;
    button.className="button "+(format==="video"?"button-primary":"button-outline");
    const unavailable=format==="video" && album.songs.some(song=>song.videoAvailable===false);
    button.disabled=unavailable;
    button.textContent=unavailable ? "Видео ко всем песням пока недоступно" : (format==="pdf"?"Все PDF":"Все PDF + видео")+" · "+money(albumPrice(album,format));
    if(!unavailable)button.addEventListener("click",()=>addAlbumToCart(album,format));
    buttons.append(button);
  }
  controls.append(buttons);
  const cartLink=document.createElement("button");
  cartLink.type="button";cartLink.className="button button-primary album-checkout";
  cartLink.textContent="Корзина ("+state.cart.length+")";
  cartLink.addEventListener("click",openCart);
  controls.append(cartLink);root.append(controls);
  els.modalContent.replaceChildren(root);
}

function openAlbum(key) {
  const album=state.albums.find(a=>a.key===key);
  if(!album) return;
  state.modalSong=null;
  state.modalAlbum=album;
  renderAlbumModal();
  els.songBackdrop.hidden=false;
  document.body.classList.add("no-scroll");
  els.modalClose.focus();
}
