// 완성 guide.html 렌더 점검: 데스크톱/모바일·라이트/다크, 가로 넘침, 깨진 미디어, 영상 재생
import {chromium,OUT,sleep} from './lib.mjs';
import path from 'node:path';
const file='file:///'+path.resolve('../guide.html').replace(/\\/g,'/');
const b=await chromium.launch({headless:true});
const res={};
for(const [name,vp,scheme] of [['desk',{width:1440,height:900},'light'],['mobile',{width:400,height:860},'light'],['desk-dark',{width:1440,height:900},'dark']]){
 const c=await b.newContext({viewport:vp,colorScheme:scheme,deviceScaleFactor:1});const p=await c.newPage();await p.goto(file);await p.addStyleTag({content:'html{scroll-behavior:auto!important}'});await sleep(2500);
 res[name]=await p.evaluate(()=>({scrollW:document.documentElement.scrollWidth,clientW:document.documentElement.clientWidth,
  imgs:document.images.length,broken:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).length,
  videos:document.querySelectorAll('video').length,cards:document.querySelectorAll('.card').length,height:document.documentElement.scrollHeight}));
 await p.screenshot({path:path.join(OUT,`guide_${name}_top.png`)});
 await p.evaluate(()=>document.getElementById('collab').scrollIntoView());await sleep(1200);
 res[name].videoPlaying=await p.evaluate(()=>{const v=document.querySelector('#collab video');return v?{t:v.currentTime,paused:v.paused,ready:v.readyState}:null;});
 await p.screenshot({path:path.join(OUT,`guide_${name}_collab.png`)});
 await p.evaluate(()=>document.getElementById('findings').scrollIntoView());await sleep(500);await p.screenshot({path:path.join(OUT,`guide_${name}_findings.png`)});
 await c.close();
}
console.log(JSON.stringify(res,null,1));await b.close();
