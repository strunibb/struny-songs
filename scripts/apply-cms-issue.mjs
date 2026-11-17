#!/usr/bin/env node
// GitHub Actions only. Issue content must never be evaluated or passed to a shell.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const OWNER_ID = 198247340;
const MARKER = "STRUNY_CMS_V1\n";
const LEVELS = ["Начинающий","Продвинутый","Профи","Фингерстайл","Зарубежный рок","Любитель"];
const FEATURES = ["Аккорды","Бой","Перебор","Рифф","Соло","Фингерстайл","Табулатура","Интересный бой","Электрогитара"];
const COVER_STYLES = ["ocean","forest","violet","ember","silver","sunset"];
const FIXED_PRICES = {"Начинающий":25,"Продвинутый":50,"Профи":100};

function assert(condition, message) { if (!condition) throw Error(message); }
function str(x, name, max = 220, required = false) {
  assert(typeof x === "string", name + ": ожидается текст");
  const s = x.trim();
  assert(s.length <= max && !/[\u0000-\u001f\u007f]/.test(s), name + ": недопустимое значение");
  if (required) assert(s.length > 0, name + ": пустое значение");
  return s;
}
function int(x, name, min, max) {
  assert(typeof x === "number" && Number.isInteger(x) && x >= min && x <= max, name + ": неверное число");
  return x;
}
function url(x) {
  if (x === "" || x === undefined || x === null) return "";
  const raw = str(x, "Обложка", 900);
  const u = new URL(raw);
  assert(u.protocol === "https:" && u.hostname && !u.username && !u.password, "Обложка: нужна публичная HTTPS-ссылка");
  return u.toString();
}
function slug(input) {
  const m={а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"};
  return [...input.toLowerCase()].map(c=>m[c]??c).join("").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,65)||"song";
}
function oldFile(name) {
  return JSON.parse(execFileSync("git",["show","origin/gh-pages:"+name],{encoding:"utf8",maxBuffer:30000000}));
}
function payload(body) {
  assert(typeof body==="string" && body.length<=12000 && body.startsWith(MARKER),"Нет корректной метки CRM");
  const p=JSON.parse(body.slice(MARKER.length));
  assert(p && typeof p==="object" && !Array.isArray(p) && p.version===1,"Некорректные данные");
  assert(["add","edit","delete"].includes(p.operation),"Неизвестная операция");
  if(p.operation!=="add") p.id=int(p.id,"ID",1,100000000);
  if(p.operation==="delete") return p;
  p.artist=str(p.artist,"Исполнитель",125,true);
  p.title=str(p.title,"Название",160,true);
  p.description=str(p.description??"","Описание",600);
  p.keyName=str(p.keyName??"Оригинал","Тональность",55);
  p.albumName=str(p.albumName??"","Альбом",160);
  // Полная дата вводится только владельцем; автоматические оценки хранятся отдельно.
  p.releaseDate = p.releaseDate === undefined ? null : str(p.releaseDate,"Дата релиза",10);
  if(p.releaseDate){
    assert(/^\d{4}-\d{2}-\d{2}$/.test(p.releaseDate),"Дата релиза: ожидается ГГГГ-ММ-ДД");
    const dt=new Date(p.releaseDate+"T00:00:00Z");
    assert(Number.isFinite(dt.getTime()) && dt.toISOString().slice(0,10)===p.releaseDate,
      "Дата релиза: неверная календарная дата");
    assert(p.releaseDate<=new Date().toISOString().slice(0,10),
      "Дата релиза: нельзя указывать будущую дату как состоявшийся релиз");
  }
  assert(LEVELS.includes(p.level),"Неизвестная категория");
  p.pdfPrice=int(p.pdfPrice,"Стоимость PDF",0,100000);
  p.videoPrice=int(p.videoPrice,"Стоимость PDF + видео",0,100000);
  p.videoAvailable=p.videoAvailable!==false;
  p.isFree=p.isFree===true || (p.isFree===undefined && p.pdfPrice===0 && p.videoPrice===0);
  assert(typeof p.isFree==="boolean","Неверная бесплатная категория");
  if(p.isFree){p.pdfPrice=0;p.videoPrice=0;}
  else if(Object.hasOwn(FIXED_PRICES,p.level)){
    p.pdfPrice=FIXED_PRICES[p.level];
    p.videoPrice=FIXED_PRICES[p.level];
  }
  p.difficulty=int(p.difficulty,"Сложность",1,4);
  assert(typeof p.barre==="boolean" && typeof p.isNew==="boolean","Неверный формат переключателя");
  assert(Array.isArray(p.features) && p.features.length<=FEATURES.length && p.features.every(x=>FEATURES.includes(x)),"Некорректные особенности");
  p.features=[...new Set(p.features)];
  p.coverUrl=url(p.coverUrl);
  p.previewYouTubeUrl=str(p.previewYouTubeUrl??"","Оригинальная запись",350);
  p.previewStart=int(p.previewStart??0,"Начало фрагмента",0,3600);
  p.previewDisabled=p.previewDisabled===true;
  p.previewVideoId="";
  if(p.previewYouTubeUrl) {
    let video;
    try {
      const link=new URL(p.previewYouTubeUrl);
      assert(link.protocol==="https:" && !link.username && !link.password,"Только HTTPS YouTube");
      const hostname=link.hostname.toLowerCase();
      if(hostname==="youtu.be") {
        const parts=link.pathname.split("/").filter(Boolean);
        assert(parts.length===1,"Ссылка должна вести на одно видео");
        video=parts[0];
      } else {
        assert(["youtube.com","www.youtube.com","music.youtube.com"].includes(hostname),"Разрешён только YouTube");
        assert(link.pathname==="/watch","Нужна обычная ссылка на YouTube-видео");
        video=link.searchParams.get("v");
      }
      assert(/^[a-zA-Z0-9_-]{11}$/.test(video||""),"Некорректный ID YouTube");
    } catch(e) { throw Error("Оригинальная запись: "+String(e.message||e)); }
    p.previewVideoId=video;
  }
  return p;
}
const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
assert(event?.issue?.user?.id===OWNER_ID, "Отказано: изменения разрешены только владельцу");
assert(String(event.issue.title||"").startsWith("[Struny CMS]"),"Не CRM-запрос");
const p=payload(event.issue.body);
const db=oldFile("songs.json");
assert(Array.isArray(db.songs) && db.songs.length>100,"Опубликованный каталог не найден");
const now=new Date().toISOString();
let id, previous=null;
if(p.operation==="delete") {
  const at=db.songs.findIndex(s=>s.id===p.id);
  assert(at>=0,"Песня с ID "+p.id+" не найдена");
  id=p.id;previous=db.songs[at];db.songs.splice(at,1);
} else {
  const at=p.operation==="edit"?db.songs.findIndex(s=>s.id===p.id):-1;
  if(p.operation==="edit")assert(at>=0,"Песня с ID "+p.id+" не найдена");
  previous=at>=0?db.songs[at]:null;
  id=previous?previous.id:Math.max(0,...db.songs.map(s=>Number(s.id)||0))+1;
  const song={
    ...(previous||{}),
    id,
    slug:previous?.slug||("song-"+id+"-"+slug(p.artist+"-"+p.title)),
    artist:p.artist,title:p.title,
    level:p.level,
    sections:[...new Set([p.level,...(previous?.sections||[]).filter(section=>
      section!==previous?.level && section!==p.level && LEVELS.includes(section))])],
    isFree:p.isFree,albumName:p.albumName,videoAvailable:p.videoAvailable,
    previewVideoId:p.previewVideoId,previewStart:p.previewStart,previewDisabled:p.previewDisabled,
    releaseDate:p.releaseDate===null ? (previous?.releaseDate||"") : p.releaseDate,
    description:p.description||"Разбор композиции для самостоятельной практики.",
    features:p.features,keyName:p.keyName||"Оригинал",
    barre:p.barre,difficulty:p.difficulty,
    coverStyle:previous?.coverStyle||COVER_STYLES[id%COVER_STYLES.length],
    isNew:p.isNew,isPopular:previous?.isPopular||false,
    popularity:previous?.popularity||0,
    createdAt:previous?.createdAt||now,
    price:p.pdfPrice,pdfPrice:p.pdfPrice,videoPrice:p.videoPrice
  };
  if(p.operation==="edit")db.songs[at]=song;else db.songs.push(song);
}
assert(new Set(db.songs.map(s=>s.id)).size===db.songs.length,"Повторяющиеся ID");
writeFileSync("/tmp/struny-cms-songs.json",JSON.stringify(db,null,2)+"\n");
writeFileSync("/tmp/struny-cms-patch.json",JSON.stringify({
  operation:p.operation,id,
  coverUrl:p.operation==="delete"?"":p.coverUrl,
  artist:p.artist||previous?.artist||"",
  title:p.title||previous?.title||""
},null,2)+"\n");
console.log("Validated:",p.operation,"song:",id,"total:",db.songs.length);
