/* Official visible YouTube preview player. No audio copies or third-party previews. */
"use strict";
const previewState={index:{},loaded:false,activeId:null,returnFocus:null};
const YOUTUBE_ID=/^[A-Za-z0-9_-]{11}$/;
function previewNorm(value){
  return String(value||"").normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g,"е")
    .replace(/\s+/g," ").trim();
}
function previewRecord(song) {
  if(!song || song.previewDisabled===true)return null;
  const manual=typeof song.previewVideoId==="string" ? song.previewVideoId : "";
  if(YOUTUBE_ID.test(manual)){
    const start=Number.isInteger(song.previewStart)&&song.previewStart>=0&&song.previewStart<=3600 ? song.previewStart : 0;
    return {videoId:manual,start,source:"owner"};
  }
  const indexed=previewState.index[String(song.id)];
  if(!indexed || !YOUTUBE_ID.test(indexed.videoId))return null;
  if(previewNorm(indexed.artist)!==previewNorm(song.artist) ||
     previewNorm(indexed.title)!==previewNorm(song.title))return null;
  const start=Number.isInteger(indexed.start)&&indexed.start>=0&&indexed.start<=3600 ? indexed.start : 0;
  return {videoId:indexed.videoId,start,source:indexed.source||"verified"};
}
function previewSearchUrl(song){
  return "https://www.youtube.com/results?search_query="+encodeURIComponent(song.artist+" "+song.title+" official audio");
}
function previewOpenSearch(song){
  const a=document.createElement("a");
  a.href=previewSearchUrl(song);a.target="_blank";a.rel="noopener noreferrer";
  document.body.append(a);a.click();a.remove();
}
function previewButton(song,mode="card"){
  const button=document.createElement("button");
  button.type="button";button.className="preview-button preview-button-"+mode;
  button.dataset.previewId=String(song.id);button.dataset.previewMode=mode;
  previewUpdateButton(button,song);
  button.addEventListener("click",()=> {
    const recording=previewRecord(song);
    if(recording)previewOpen(song,recording,button);
    else previewOpenSearch(song);
  });
  return button;
}
function previewUpdateButton(button,song){
  const matched=Boolean(previewRecord(song));
  button.classList.toggle("preview-available",matched);
  button.classList.toggle("preview-search-only",!matched);
  button.textContent=matched ? "▶ Прослушать фрагмент" : "♫ Найти оригинал";
  button.setAttribute("aria-label",matched
    ? "Прослушать фрагмент: "+song.artist+" — "+song.title
    : "Найти оригинальную запись на YouTube: "+song.artist+" — "+song.title);
  button.title=matched
    ? "Фрагмент официального YouTube-видео. Откроется видимый плеер."
    : "Видео пока не подтверждено. Откроется поиск YouTube, не произвольный кавер.";
}
function previewDecorateCard(card,song){
  const body=card.querySelector(".card-body");
  const options=body?.querySelector(".purchase-options");
  if(body&&options)body.insertBefore(previewButton(song,"card"),options);
}
function previewDecorateModal(modal,song){
  const anchor=modal.querySelector(".modal-description");
  if(!anchor)return;
  const container=document.createElement("div");
  container.className="modal-preview-action";
  container.append(previewButton(song,"modal"));
  anchor.insertAdjacentElement("afterend",container);
}
function previewRefreshButtons(){
  if(typeof state==="undefined"||!Array.isArray(state.songs))return;
  const songs=new Map(state.songs.map(s=>[String(s.id),s]));
  document.querySelectorAll("[data-preview-id]").forEach(button=>{
    const song=songs.get(button.dataset.previewId);
    if(song)previewUpdateButton(button,song);
  });
}
function previewEnsureDialog(){
  if(document.getElementById("preview-backdrop"))return;
  const overlay=document.createElement("div");
  overlay.className="preview-backdrop";overlay.id="preview-backdrop";overlay.hidden=true;
  overlay.innerHTML='<section class="preview-dialog" role="dialog" aria-modal="true" aria-labelledby="preview-heading">'
    +'<div class="preview-head"><div class="preview-title-block"><small>ОРИГИНАЛЬНОЕ ИСПОЛНЕНИЕ</small><h2 id="preview-heading"></h2><p id="preview-artist"></p></div>'
    +'<button type="button" id="preview-close" class="preview-close" aria-label="Закрыть плеер">×</button></div>'
    +'<div id="preview-player" class="preview-player"></div>'
    +'<div class="preview-foot"><p>Фрагмент из официального YouTube-плеера. Возможны региональные ограничения.</p>'
    +'<a id="preview-youtube-link" href="#" target="_blank" rel="noopener noreferrer">Открыть на YouTube ↗</a></div></section>';
  document.body.append(overlay);
  overlay.querySelector("#preview-close").addEventListener("click",previewClose);
  overlay.addEventListener("click",event=>{if(event.target===overlay)previewClose();});
  overlay.addEventListener("keydown",event=>{
    if(event.key!=="Tab")return;
    const controls=[...overlay.querySelectorAll("button,a[href],iframe")].filter(el=>el.getClientRects().length);
    if(!controls.length)return;
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
}
function previewOpen(song,record,trigger){
  previewEnsureDialog();
  previewClose(false);
  const overlay=document.getElementById("preview-backdrop");
  previewState.returnFocus=trigger;previewState.activeId=song.id;
  overlay.querySelector("#preview-heading").textContent=song.title;
  overlay.querySelector("#preview-artist").textContent=song.artist;
  overlay.querySelector("#preview-youtube-link").href="https://www.youtube.com/watch?v="+record.videoId;
  const iframe=document.createElement("iframe");
  iframe.title="Музыкальный фрагмент: "+song.artist+" — "+song.title;
  iframe.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";
  iframe.allowFullscreen=true;iframe.referrerPolicy="strict-origin-when-cross-origin";
  iframe.setAttribute("loading","eager");
  const params=new URLSearchParams({autoplay:"1",playsinline:"1",rel:"0",start:String(record.start),end:String(record.start+30)});
  iframe.src="https://www.youtube-nocookie.com/embed/"+record.videoId+"?"+params.toString();
  overlay.querySelector("#preview-player").replaceChildren(iframe);
  overlay.hidden=false;document.body.classList.add("no-scroll");
  overlay.querySelector("#preview-close").focus({preventScroll:true});
}
function previewClose(restore=true){
  const overlay=document.getElementById("preview-backdrop");
  if(!overlay||overlay.hidden)return;
  overlay.hidden=true;
  overlay.querySelector("#preview-player").replaceChildren();
  previewState.activeId=null;
  if(typeof els==="undefined"||(els.songBackdrop.hidden&&els.cartBackdrop.hidden))
    document.body.classList.remove("no-scroll");
  if(restore)previewState.returnFocus?.focus?.({preventScroll:true});
  previewState.returnFocus=null;
}
function previewIsOpen(){
  return !document.getElementById("preview-backdrop")?.hidden;
}
document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&previewIsOpen()){event.stopImmediatePropagation();previewClose();}
},true);
document.addEventListener("visibilitychange",()=>{
  if(document.hidden&&previewIsOpen())previewClose(false);
});
previewEnsureDialog();
fetch("./previews.json",{cache:"no-store"})
  .then(response=>response.ok?response.json():{tracks:{}})
  .then(data=>{
    previewState.index=data?.tracks&&typeof data.tracks==="object"?data.tracks:{};
    previewState.loaded=true;previewRefreshButtons();
  })
  .catch(()=>{previewState.loaded=true;previewRefreshButtons();});
