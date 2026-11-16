"use strict";

const REPO = "strunibb/struny-songs";
const ISSUE_URL = "https://github.com/" + REPO + "/issues/new";
const FEATURES = ["Аккорды","Бой","Перебор","Рифф","Соло","Фингерстайл","Табулатура","Интересный бой","Электрогитара"];
const PAGE_SIZE = 80;
const TIER_PRICES = {"Начинающий":25,"Продвинутый":50,"Профи":100};
const $ = id => document.getElementById(id);
const state = { songs:[],covers:{},releases:{},query:"",filter:"all",limit:PAGE_SIZE,current:null,returnFocus:null };
const normalize = value => String(value||"").normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g,"е").trim();
const price = value => Number(value)===0 ? "Бесплатно" : String(value)+" ₽";
const element = (name, className, value) => {
  const node = document.createElement(name);
  if(className)node.className=className;
  if(value!==undefined)node.textContent=value;
  return node;
};
function notify(message) {
  const toast=$("toast");toast.textContent=message;toast.hidden=false;
  clearTimeout(notify.timer);notify.timer=setTimeout(()=>{toast.hidden=true;},5500);
}
function makeFeatureList() {
  const wrap=$("features");
  for(const feature of FEATURES) {
    const label=element("label");
    const input=document.createElement("input");input.type="checkbox";input.value=feature;input.name="feature";
    label.append(input,document.createTextNode(feature));wrap.append(label);
  }
}
function filtered() {
  const q=normalize(state.query);
  return state.songs.filter(song =>
    (!q || normalize(song.artist+" "+song.title).includes(q)) &&
    (state.filter==="all" || state.filter==="free" && song.pdfPrice===0 || state.filter==="new" && !!song.isNew)
  ).sort((a,b)=>a.title.localeCompare(b.title,"ru")||a.artist.localeCompare(b.artist,"ru"));
}
function artNode(song) {
  const art=element("span","mini-art","♫");
  const imageURL=state.covers[String(song.id)]?.url;
  if(typeof imageURL==="string" && imageURL.startsWith("https://")) {
    const image=document.createElement("img");image.src=imageURL;image.loading="lazy";image.decoding="async";image.alt="";
    image.addEventListener("error",()=>image.remove());
    art.replaceChildren(image);
  }
  return art;
}
function render() {
  const songs=filtered();
  $("count").textContent="Показано "+Math.min(songs.length,state.limit)+" из "+songs.length+" песен";
  $("stat-all").textContent=state.songs.length.toLocaleString("ru-RU");
  $("stat-free").textContent=state.songs.filter(x=>x.pdfPrice===0).length.toLocaleString("ru-RU");
  $("stat-new").textContent=state.songs.filter(x=>x.isNew).length.toLocaleString("ru-RU");
  $("stat-covers").textContent=Object.keys(state.covers).length.toLocaleString("ru-RU");
  const body=$("rows"),fragment=document.createDocumentFragment();
  for(const song of songs.slice(0,state.limit)) {
    const tr=document.createElement("tr");
    const main=element("td"),name=element("div","song-name"),text=element("span");
    text.append(element("strong",null,song.title),element("small",null,song.artist));
    name.append(artNode(song),text);main.append(name);tr.append(main);
    const level=element("td");level.append(element("span","tag",song.level||"Без категории"));tr.append(level);
    tr.append(element("td",null,price(song.pdfPrice)),element("td",null,price(song.videoPrice)));
    const status=element("td");
    status.append(element("span","tag "+(song.isNew?"new":"neutral"),song.isNew?"NEW":"В каталоге"));
    tr.append(status);
    const actions=element("td","td-actions");
    const edit=element("button","row-edit","✎");edit.type="button";
    edit.setAttribute("aria-label","Редактировать "+song.artist+" — "+song.title);
    edit.addEventListener("click",()=>openEditor(song));
    const remove=element("button","row-delete","×");remove.type="button";
    remove.setAttribute("aria-label","Удалить "+song.artist+" — "+song.title);
    remove.addEventListener("click",()=>removeSong(song));
    actions.append(edit,remove);tr.append(actions);
    fragment.append(tr);
  }
  if(!songs.length) {
    const tr=document.createElement("tr"),td=element("td",null,"Не найдено песен. Измени запрос или фильтр.");
    td.colSpan=6;tr.append(td);fragment.append(tr);
  }
  body.replaceChildren(fragment);
  $("more").hidden=state.limit>=songs.length;
}
async function loadSongs() {
  $("refresh").disabled=true;
  try {
    const stamp=String(Date.now());
    const [songResponse,coverResponse,releaseResponse]=await Promise.all([
      fetch("../songs.json?fresh="+stamp,{cache:"no-store"}),
      fetch("../covers.json?fresh="+stamp,{cache:"no-store"}),
      fetch("../release-dates.json?fresh="+stamp,{cache:"no-store"}).catch(()=>null)
    ]);
    if(!songResponse.ok)throw Error("HTTP "+songResponse.status);
    const db=await songResponse.json();
    state.songs=Array.isArray(db.songs)?db.songs:[];
    state.covers=coverResponse.ok ? (await coverResponse.json()).covers||{} : {};
    state.releases=releaseResponse?.ok ? (await releaseResponse.json()).dates||{} : {};
    render();
  }catch(e){notify("Не удалось получить каталог. Обнови страницу или проверь соединение.");$("rows").replaceChildren(element("tr"));$("count").textContent="Ошибка загрузки";}
  finally{$("refresh").disabled=false;}
}
function setInput(id,value) {$(id).value=value===undefined||value===null?"":String(value);}
function syncPrices() {
  const level=$("level").value;
  const isFree=$("isFree").checked;
  const fixed=TIER_PRICES[level];
  const locked=isFree || fixed!==undefined;
  $("pdfPrice").disabled=locked;
  $("videoPrice").disabled=locked;
  if(isFree){$("pdfPrice").value="0";$("videoPrice").value="0";}
  else if(fixed!==undefined){$("pdfPrice").value=String(fixed);$("videoPrice").value=String(fixed);}
  $("priceHelp").textContent=isFree?"PDF и видео полностью бесплатны":
    fixed!==undefined?"Фиксированная цена "+fixed+" ₽ для обоих форматов":
    "Для этой категории сохраняются индивидуальные цены";
}
function openEditor(song) {
  state.current=song||null;state.returnFocus=document.activeElement;
  const editing=!!song;
  $("editor-title").textContent=editing?"Изменить разбор":"Добавить разбор";
  setInput("artist",song?.artist||"");setInput("title",song?.title||"");
  setInput("level",song?.level||"Начинающий");
  setInput("difficulty",song?.difficulty||1);
  setInput("pdfPrice",song?.pdfPrice??25);setInput("videoPrice",song?.videoPrice??25);
  setInput("keyName",song?.keyName||"Оригинал");
  setInput("albumName",song?.albumName|| (song ? state.covers[String(song.id)]?.album || "" : ""));
  const release = song ? state.releases[String(song.id)] : null;
  const date = song?.releaseDate || (release?.artist===song?.artist && release?.title===song?.title ? release.date : "") || "";
  setInput("releaseDate", /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "");
  $("releaseHelp").textContent = date && !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ? "Указан только год или месяц. Для точного фильтра недели/месяца нужна полная дата."
    : "Дата музыкального релиза, а не дата добавления разбора. Если неизвестна, оставь пустым.";
  setInput("coverUrl",song ? (state.covers[String(song.id)]?.url||"") : "");
  setInput("description",song?.description||"");
  $("barre").checked=!!song?.barre;
  $("videoAvailable").checked=editing ? song.videoAvailable!==false : false;
  $("isFree").checked=editing ? !!(song.isFree || (song.pdfPrice===0 && song.videoPrice===0)) : false;
  syncPrices();
  $("isNew").checked=editing?!!song.isNew:true;
  for(const checkbox of document.querySelectorAll('input[name="feature"]')) {
    checkbox.checked=!!song?.features?.includes(checkbox.value);
  }
  $("delete").hidden=!editing;
  $("overlay").hidden=false;
  document.body.style.overflow="hidden";
  $("artist").focus();
}
function closeEditor() {
  $("overlay").hidden=true;document.body.style.overflow="";
  state.returnFocus?.focus?.({preventScroll:true});
}
function makePayload(operation,song) {
  if(operation==="delete")return {version:1,operation:"delete",id:song.id};
  const coverUrl=$("coverUrl").value.trim();
  if(coverUrl) {
    try {
      const url=new URL(coverUrl);
      if(url.protocol!=="https:" || url.username || url.password)throw Error();
    } catch {notify("Для обложки допускается только ссылка https://");$("coverUrl").focus();return null;}
  }
  return {
    version:1,operation,id:song?.id,
    artist:$("artist").value.trim(),title:$("title").value.trim(),
    description:$("description").value.trim(),keyName:$("keyName").value.trim()||"Оригинал",
    albumName:$("albumName").value.trim(),releaseDate:$("releaseDate").value.trim(),isFree:$("isFree").checked,
    videoAvailable:$("videoAvailable").checked,
    level:$("level").value,pdfPrice:Number($("pdfPrice").value),videoPrice:Number($("videoPrice").value),
    difficulty:Number($("difficulty").value),barre:$("barre").checked,isNew:$("isNew").checked,
    features:[...document.querySelectorAll('input[name="feature"]:checked')].map(x=>x.value),
    coverUrl
  };
}
function submitIssue(payload,displayName) {
  if(!payload)return;
  const body="STRUNY_CMS_V1\n"+JSON.stringify(payload);
  const op=payload.operation==="add"?"Добавить":payload.operation==="edit"?"Изменить":"Удалить";
  const title="[Struny CMS] "+op+": "+displayName;
  const link=ISSUE_URL+"?title="+encodeURIComponent(title)+"&body="+encodeURIComponent(body);
  if(link.length>10000){notify("Слишком длинный запрос. Сократи описание.");return;}
  const linkNode=document.createElement("a");
  linkNode.href=link;linkNode.target="_blank";linkNode.rel="noopener noreferrer";
  document.body.append(linkNode);linkNode.click();linkNode.remove();
  notify("На открывшейся странице GitHub нажми «Submit new issue». После этого начнётся публикация.");
}
function removeSong(song) {
  if(!window.confirm("Подготовить удаление песни «"+song.artist+" — "+song.title+"»? Далее потребуется подтверждение в GitHub."))return;
  submitIssue(makePayload("delete",song),song.artist+" — "+song.title);
}
$("level").addEventListener("change",syncPrices);
$("isFree").addEventListener("change",syncPrices);
$("add").addEventListener("click",()=>openEditor(null));
$("close").addEventListener("click",closeEditor);
$("shade").addEventListener("click",closeEditor);
$("refresh").addEventListener("click",loadSongs);
$("search").addEventListener("input",e=>{state.query=e.target.value;state.limit=PAGE_SIZE;render();});
$("filter").addEventListener("change",e=>{state.filter=e.target.value;state.limit=PAGE_SIZE;render();});
$("more").addEventListener("click",()=>{state.limit+=PAGE_SIZE;render();});
$("delete").addEventListener("click",()=>{
  if(!state.current)return;
  removeSong(state.current);
});
$("song-form").addEventListener("submit",e=>{
  e.preventDefault();
  if(!e.currentTarget.reportValidity())return;
  const operation=state.current?"edit":"add";
  const payload=makePayload(operation,state.current);
  if(payload)submitIssue(payload,payload.artist+" — "+payload.title);
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape" && !$("overlay").hidden)closeEditor();
  if(e.key!=="Tab" || $("overlay").hidden)return;
  const controls=[...$("overlay").querySelectorAll("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])")].filter(x=>x.getClientRects().length);
  if(!controls.length)return;
  if(e.shiftKey && document.activeElement===controls[0]){e.preventDefault();controls[controls.length-1].focus();}
  if(!e.shiftKey && document.activeElement===controls[controls.length-1]){e.preventDefault();controls[0].focus();}
});
makeFeatureList();
void loadSongs();
