#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const sleep = ms => new Promise(r => setTimeout(r, ms));
const readPages = (path, fallback) => {
  try { return JSON.parse(execFileSync("git", ["show", "origin/gh-pages:" + path], {encoding: "utf8", maxBuffer: 24000000})); }
  catch { return fallback; }
};
const norm = x => String(x || "").toLowerCase().replace(/ё/g,"е").replace(/&/g," and ")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zа-я0-9]+/g," ").replace(/\s+/g," ").trim();
function titleMatch(a,b) {
  if (norm(a) === norm(b)) return true;
  const original = String(b).replace(/\s*[\(\[]\s*(?:\d{4}\s+)?(?:remaster(?:ed)?|mono|stereo)[^\)\]]*[\)\]]\s*$/i,"");
  return norm(a) === norm(original) && !/(karaoke|remix|live|cover|tribute)/i.test(b);
}
const matches = (song,artist,title) => norm(song.artist) === norm(artist) && titleMatch(song.title,title);
const counters = {apple:0,mb:0};
async function get(url,provider) {
  for(let n=0;n<3;n++) {
    if(provider === "apple" || provider === "mb") {
      const gap = provider === "apple" ? 3450 : 1350;
      await sleep(Math.max(0,counters[provider] + gap - Date.now()));
      counters[provider]=Date.now();
    }
    try {
      const res = await fetch(url,{headers:{"User-Agent":"StrunySongCatalogue/1.0 (https://github.com/strunibb/struny-songs)","Accept":"application/json"},signal:AbortSignal.timeout(18000)});
      if(res.status===404) return null;
      if(res.status===429 || res.status===503){await sleep((n+1)*16000);continue;}
      if(!res.ok)return null;
      return await res.json();
    }catch(e){console.warn(provider,String(e).slice(0,140));await sleep((n+1)*3000);}
  }
  return null;
}
async function apple(song) {
  const endpoint = "https://itunes.apple.com/search?term="+encodeURIComponent(song.artist+" "+song.title)+"&media=music&entity=song&limit=25&country=us";
  const data=await get(endpoint,"apple");
  const valid=(data?.results||[]).filter(x=>x.kind==="song"&&x.artworkUrl100&&matches(song,x.artistName,x.trackName)
    &&!/(karaoke|tribute to|as made famous|instrumental version|re-recorded)/i.test(String(x.collectionName||"")+" "+String(x.trackName||"")));
  valid.sort((a,b)=>{
    const d=Number(norm(b.trackName)===norm(song.title))-Number(norm(a.trackName)===norm(song.title));
    if(d)return d;
    const ac=/(greatest hits|best of|essentials)/i.test(a.collectionName||"")?1:0;
    const bc=/(greatest hits|best of|essentials)/i.test(b.collectionName||"")?1:0;
    return ac-bc||String(a.releaseDate||"").localeCompare(String(b.releaseDate||""));
  });
  const item=valid[0];if(!item)return null;
  const url=String(item.artworkUrl100).replace(/\/100x100(?=[^/]*$)/,"/600x600");
  if(!url.startsWith("https://"))return null;
  return {url,source:item.trackViewUrl||item.collectionViewUrl||"https://music.apple.com/",artist:song.artist,title:song.title,album:item.collectionName||"",origin:"apple-exact"};
}
function artistCredit(list){return Array.isArray(list)?list.map(x=>typeof x==="string"?x:(x.name||x.artist?.name||"")).join(""):"";}
async function musicbrainz(song) {
  const query='recording:"'+song.title.replace(/["\\]/g," ")+'" AND artist:"'+song.artist.replace(/["\\]/g," ")+'"';
  const data=await get("https://musicbrainz.org/ws/2/recording/?query="+encodeURIComponent(query)+"&fmt=json&limit=8","mb");
  const found=(data?.recordings||[]).filter(x=>matches(song,artistCredit(x["artist-credit"]),x.title));
  for(const recording of found.slice(0,2)) {
    const releases=(recording.releases||[]).filter(x=>!x.status||x.status==="Official");
    const ids=[...new Set(releases.map(x=>x["release-group"]?.id).filter(Boolean))];
    for(const id of ids.slice(0,4)) {
      const cover=await get("https://coverartarchive.org/release-group/"+id,"cover");
      const front=cover?.images?.find(x=>x.front&&x.approved!==false);
      const img=front?.thumbnails?.["500"]||front?.thumbnails?.["250"]||front?.image;
      if(typeof img!=="string"||!img.startsWith("http"))continue;
      return {url:img.replace(/^http:/,"https:"),source:"https://musicbrainz.org/release-group/"+id,artist:song.artist,title:song.title,origin:"musicbrainz-exact"};
    }
  }
  return null;
}
const catalog=readPages("songs.json",null);
if(!Array.isArray(catalog?.songs)||!catalog.songs.length)throw Error("Missing public songs.json; aborting");
const covers=readPages("covers.json",{version:1,covers:{}});
covers.version=1;covers.covers||={};
const status=readPages("cover-status.json",{attempts:{}});
status.attempts||={};
const store=()=>{
  covers.updatedAt=new Date().toISOString();
  writeFileSync("/tmp/struny-covers.json",JSON.stringify(covers,null,2)+"\n");
  status.updatedAt=covers.updatedAt;
  writeFileSync("/tmp/struny-cover-status.json",JSON.stringify(status,null,2)+"\n");
};
const ttl=28*24*3600*1000;
let checked=0,found=0;
for(const song of catalog.songs) {
  const id=String(song.id);if(covers.covers[id]?.url)continue;
  const sig=norm(song.artist+"|"+song.title);
  const before=status.attempts[id];
  if(before?.signature===sig&&Date.now()-Date.parse(before.at)<ttl)continue;
  if(checked>=Number(process.env.COVER_LOOKUP_LIMIT||catalog.songs.length))break;
  checked++;let match=null;
  try{match=await apple(song);if(!match)match=await musicbrainz(song);}
  catch(e){console.warn("Failed",id,String(e).slice(0,140));}
  status.attempts[id]={signature:sig,at:new Date().toISOString(),found:Boolean(match)};
  if(match){covers.covers[id]=match;found++;}
  if(checked%30===0){store();console.log("Scanned",checked,"newly found",found);}
}
const ids=new Set(catalog.songs.map(s=>String(s.id)));
for(const id of Object.keys(covers.covers))if(!ids.has(id))delete covers.covers[id];
status.summary={total:catalog.songs.length,covers:Object.keys(covers.covers).length,withoutVerifiedCover:catalog.songs.length-Object.keys(covers.covers).length,scannedThisRun:checked,foundThisRun:found};
store();console.log("Final:",JSON.stringify(status.summary));
