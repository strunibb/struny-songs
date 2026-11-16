#!/usr/bin/env node
/* Conservative automatic lookup of the earliest known release of a recording.
 * Data source: MusicBrainz recording search / first-release-date.
 * Never guess day/month from year-only records. Reject ambiguous title/artist credits.
 * Batches are written to /tmp, then merged onto live gh-pages by the workflow.
 */
import {execFileSync} from "node:child_process";
import {writeFileSync} from "node:fs";

const readLive=(path,fallback)=>{
  try {return JSON.parse(execFileSync("git",["show","origin/gh-pages:"+path],{encoding:"utf8",maxBuffer:30000000}));}
  catch{return fallback;}
};
const norm=x=>String(x||"").toLocaleLowerCase("ru").replace(/ё/g,"е")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-zа-я0-9]+/g," ").replace(/\s+/g," ").trim();
const validDate=x=>{
  if(typeof x!=="string" || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(x))return false;
  const parts=x.split("-").map(Number);
  if(parts[0]<1900||parts[0]>new Date().getUTCFullYear())return false;
  if(parts.length>1&&(parts[1]<1||parts[1]>12))return false;
  if(parts.length===3){
    const date=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]));
    if(date.toISOString().slice(0,10)!==x)return false;
  }
  return x<=(new Date()).toISOString().slice(0,x.length);
};
const credit=list=>Array.isArray(list) ? list.map(x=>typeof x==="string"?x:x.name||x.artist?.name||"").join(""):"";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const catalog=readLive("songs.json",null);
if(!Array.isArray(catalog?.songs)||!catalog.songs.length)throw Error("Published songs.json unavailable");
const index=readLive("release-dates.json",{version:1,dates:{},attempts:{}});
index.version=1;index.dates||={};index.attempts||={};
let checked=0,found=0,errors=0;
const max=Math.max(1,Math.min(75,Number(process.env.RELEASE_LOOKUP_LIMIT||40)));
const now=Date.now(),retryAfterDays=21;
const sig=song=>norm(song.artist)+"|"+norm(song.title);
const prioritized=[...catalog.songs].sort((a,b)=>{
  if(Boolean(a.isNew)!==Boolean(b.isNew))return Number(Boolean(b.isNew))-Number(Boolean(a.isNew));
  return Date.parse(b.createdAt||0)-Date.parse(a.createdAt||0) || b.id-a.id;
});
let lastRequest=0;
async function lookup(song){
  const query='recording:"'+song.title.replace(/["\\]/g," ")+'" AND artist:"'+song.artist.replace(/["\\]/g," ")+'"';
  const endpoint="https://musicbrainz.org/ws/2/recording/?query="+encodeURIComponent(query)+"&fmt=json&limit=12";
  for(let attempt=0;attempt<3;attempt++){
    await sleep(Math.max(0,lastRequest+1450-Date.now()));
    lastRequest=Date.now();
    let response;
    try{
      response=await fetch(endpoint,{headers:{
        "User-Agent":"StrunyFutureReleaseIndex/1.0 (https://github.com/strunibb/struny-songs)",
        "Accept":"application/json"
      },signal:AbortSignal.timeout(18000)});
    }catch(error){console.warn("Network error",song.id,String(error).slice(0,100));errors++;await sleep((attempt+1)*2100);continue;}
    if(response.status===429||response.status===503){await sleep((attempt+1)*7000);continue;}
    if(!response.ok){console.warn("HTTP",response.status,song.id);return {error:true};}
    const data=await response.json();
    const found=(data.recordings||[]).filter(recording=>
      Number(recording.score||0)>=90 &&
      norm(recording.title)===norm(song.title) &&
      norm(credit(recording["artist-credit"]))===norm(song.artist) &&
      !/karaoke|remix|tribute|re-record|cover version|live version/i.test(String(recording.disambiguation||"")) &&
      validDate(recording["first-release-date"])
    );
    // Same song may have multiple recording entries: prefer its earliest known publication.
    found.sort((a,b)=>String(a["first-release-date"]).localeCompare(String(b["first-release-date"])));
    const hit=found[0];
    if(!hit)return {missing:true};
    return {date:hit["first-release-date"],source:"https://musicbrainz.org/recording/"+hit.id};
  }
  return {error:true};
}
for(const song of prioritized){
  const id=String(song.id),signature=sig(song);
  const manual=validDate(song.releaseDate);
  const saved=index.dates[id];
  if(manual)continue;
  if(saved?.artist===song.artist&&saved?.title===song.title&&validDate(saved.date))continue;
  const old=index.attempts[id];
  if(old?.signature===signature && Number.isFinite(Date.parse(old.checkedAt)) &&
      now-Date.parse(old.checkedAt)<retryAfterDays*86400000)continue;
  if(checked>=max)break;
  checked++;
  let result;
  try{result=await lookup(song);}
  catch(e){console.warn("Lookup failure",song.id,String(e).slice(0,100));result={error:true};errors++;}
  if(result?.date){
    index.dates[id]={date:result.date,precision:result.date.length===10?"day":result.date.length===7?"month":"year",
      source:result.source,artist:song.artist,title:song.title,confidence:"musicbrainz-exact"};
    found++;
  }
  // Network errors must not block subsequent retry.
  if(!result?.error)index.attempts[id]={signature,checkedAt:new Date().toISOString(),found:Boolean(result?.date)};
}
const liveIds=new Set(catalog.songs.map(x=>String(x.id)));
for(const id of Object.keys(index.dates))if(!liveIds.has(id))delete index.dates[id];
for(const id of Object.keys(index.attempts))if(!liveIds.has(id))delete index.attempts[id];
index.updatedAt=new Date().toISOString();
index.summary={catalogSize:catalog.songs.length,verifiedDates:Object.keys(index.dates).length,
  scannedThisRun:checked,foundThisRun:found,errorsThisRun:errors};
writeFileSync("/tmp/struny-release-dates.json",JSON.stringify(index,null,2)+"\n");
console.log("MusicBrainz earliest known recording releases:",JSON.stringify(index.summary));
