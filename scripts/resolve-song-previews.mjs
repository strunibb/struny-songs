#!/usr/bin/env node
// Exact MusicBrainz recording relations -> official YouTube embeds.
// Never download, cache or proxy audio.
import {execFileSync} from "node:child_process";
import {writeFileSync} from "node:fs";
const readLive=(name,fallback)=>{
  try{return JSON.parse(execFileSync("git",["show","origin/gh-pages:"+name],{encoding:"utf8",maxBuffer:30000000}));}
  catch{return fallback;}
};
const norm=x=>String(x||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
 .toLocaleLowerCase("ru-RU").replace(/ё/g,"е")
 .replace(/[^a-zа-я0-9]+/g," ").replace(/\s+/g," ").trim();
const artistCredit=values=>Array.isArray(values)?values.map(part=>
  typeof part==="string"?part:part.name||part.artist?.name||"").join(""):"";
const toYoutubeId=raw=>{
  try{
    const url=new URL(raw);if(url.protocol!=="https:")return null;
    const host=url.hostname.toLowerCase();
    if(host==="youtu.be"){const parts=url.pathname.split("/").filter(Boolean);return parts.length===1&&/^[A-Za-z0-9_-]{11}$/.test(parts[0])?parts[0]:null;}
    if(["www.youtube.com","youtube.com","music.youtube.com"].includes(host)&&url.pathname==="/watch"){
      const id=url.searchParams.get("v");return /^[A-Za-z0-9_-]{11}$/.test(id||"")?id:null;
    }
  }catch{}
  return null;
};
const catalog=readLive("songs.json",{songs:[]});
if(!Array.isArray(catalog.songs)||catalog.songs.length<100)throw Error("Live catalogue unavailable");
const manifest=readLive("previews.json",{version:1,tracks:{},attempts:{}});
manifest.version=1;manifest.tracks||={};manifest.attempts||={};
const oldTimestamp=Date.now()-21*86400000;
const limit=Math.max(1,Math.min(25,Number(process.env.PREVIEW_LOOKUP_LIMIT||15)));
let scanned=0,linked=0,failures=0,lastRequest=0;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function getJson(url){
  for(let attempt=0;attempt<3;attempt++){
    await pause(Math.max(0,lastRequest+1500-Date.now()));
    lastRequest=Date.now();
    try{
      const response=await fetch(url,{headers:{
        "User-Agent":"StrunySongPreviewIndexer/1.0 (https://github.com/strunibb/struny-songs)",
        "Accept":"application/json"
      },signal:AbortSignal.timeout(15000)});
      if(response.status===429||response.status===503){await pause(3000*(attempt+1));continue;}
      if(!response.ok)return null;
      return await response.json();
    }catch(error){console.warn("MusicBrainz request:",String(error).slice(0,100));failures++;}
  }
  return null;
}
async function findRecordingVideo(song){
  const title=String(song.title).replace(/["\\]/g," ");
  const artist=String(song.artist).replace(/["\\]/g," ");
  const query='recording:"'+title+'" AND artist:"'+artist+'"';
  const search=await getJson("https://musicbrainz.org/ws/2/recording/?query="+encodeURIComponent(query)+"&fmt=json&limit=8");
  if(!search)return null;
  const recordings=(search.recordings||[])
    .filter(r=>Number(r.score||0)>=95&&norm(r.title)===norm(song.title)&&norm(artistCredit(r["artist-credit"]))===norm(song.artist))
    .filter(r=>!/cover|tribute|karaoke|instrumental rendition/i.test(r.disambiguation||""))
    .slice(0,2);
  const candidates=new Map();
  for(const r of recordings){
    const data=await getJson("https://musicbrainz.org/ws/2/recording/"+r.id+"?inc=url-rels&fmt=json");
    if(!data)continue;
    for(const rel of data.relations||[]){
      if(rel["target-type"]!=="url"||rel.type!=="free streaming")continue;
      const id=toYoutubeId(rel.url?.resource||"");
      if(id)candidates.set(id,{videoId:id,start:0,source:"musicbrainz-recording-free-stream",
        recording:"https://musicbrainz.org/recording/"+r.id});
    }
  }
  // Avoid guessing between different recordings or versions.
  return candidates.size===1?[...candidates.values()][0]:null;
}
const songs=[...catalog.songs].sort((a,b)=>{
  if(Boolean(a.isPopular)!==Boolean(b.isPopular))return Number(Boolean(b.isPopular))-Number(Boolean(a.isPopular));
  if(Boolean(a.isNew)!==Boolean(b.isNew))return Number(Boolean(b.isNew))-Number(Boolean(a.isNew));
  return Number(b.popularity||0)-Number(a.popularity||0)||b.id-a.id;
});
for(const song of songs){
  if(scanned>=limit)break;
  const id=String(song.id);
  if(song.previewDisabled===true||song.previewVideoId)continue;
  if(manifest.tracks[id]?.artist===song.artist && manifest.tracks[id]?.title===song.title &&
    toYoutubeId("https://youtube.com/watch?v="+manifest.tracks[id].videoId))continue;
  const signature=norm(song.artist)+"|"+norm(song.title);
  const attempted=manifest.attempts[id];
  if(attempted?.signature===signature && Date.parse(attempted.checkedAt)>oldTimestamp)continue;
  scanned++;
  const result=await findRecordingVideo(song);
  if(result){
    manifest.tracks[id]={artist:song.artist,title:song.title,...result,verifiedAt:new Date().toISOString()};
    linked++;console.log("Matched",id,song.artist,"—",song.title);
  }
  manifest.attempts[id]={signature,checkedAt:new Date().toISOString(),found:Boolean(result)};
}
const ids=new Set(catalog.songs.map(x=>String(x.id)));
for(const key of ["tracks","attempts"])for(const id of Object.keys(manifest[key]))if(!ids.has(id))delete manifest[key][id];
manifest.updatedAt=new Date().toISOString();
manifest.summary={catalogSize:catalog.songs.length,checkedThisRun:scanned,linkedThisRun:linked,lookupFailures:failures,knownMatches:Object.keys(manifest.tracks).length};
writeFileSync("/tmp/struny-previews.json",JSON.stringify(manifest,null,2)+"\n");
console.log("YouTube source verification:",JSON.stringify(manifest.summary));
