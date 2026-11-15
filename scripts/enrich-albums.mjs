#!/usr/bin/env node
// Supplement artwork manifests with verified album titles from MusicBrainz release-groups.
// Only musicbrainz-exact artworks may be annotated; non-album release types are ignored.
import { readFileSync, writeFileSync } from "node:fs";
const file="/tmp/struny-covers.json";
const manifest=JSON.parse(readFileSync(file,"utf8"));
const cache=new Map();let updated=0,checked=0;
for(const entry of Object.values(manifest.covers||{})){
  if(entry.album || entry.origin!=="musicbrainz-exact")continue;
  const match=String(entry.source||"").match(/^https:\/\/musicbrainz\.org\/release-group\/([a-f0-9-]{36})$/);
  if(!match)continue;
  const id=match[1];
  if(!cache.has(id)) {
    await new Promise(resolve=>setTimeout(resolve,1250));
    try{
      const response=await fetch("https://musicbrainz.org/ws/2/release-group/"+id+"?fmt=json",{
        headers:{"User-Agent":"StrunySongCatalogue/1.0 (https://github.com/strunibb/struny-songs)","Accept":"application/json"},
        signal:AbortSignal.timeout(14000)
      });
      if(!response.ok){cache.set(id,null);continue;}
      const album=await response.json();
      cache.set(id,album["primary-type"]==="Album" && typeof album.title==="string" ? album.title : null);
    }catch(error){console.warn("Album lookup failed",id,String(error).slice(0,100));cache.set(id,null);}
  }
  checked++;
  const album=cache.get(id);
  if(album){entry.album=album;updated++;}
}
if(updated) {
  manifest.updatedAt=new Date().toISOString();
  writeFileSync(file,JSON.stringify(manifest,null,2)+"\n");
}
console.log("Album metadata checked",checked,"enriched",updated);
